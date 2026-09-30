#!/usr/bin/env python3
"""Kev 4B and Laya (pending-tasks §8.6, #95) on the same decide sets as `nav-pilot alpha decide`.

Neither model generates a letter token, so neither runs through nav-pilot and mlx-lm's server: each
returns a probability per option from its own head. This adapter runs one in-process, in its own venv
(.bench-logs/venv-kev, .bench-logs/venv-laya), and writes the same per-case records as _decide_limits,
_decide_sets and _decide_why, so their summaries compare it with optiq and Qwen3.8 unchanged.

  run <model> [--limit N] [--out DIR] [--stamp S]   every case of every set (S1_SETS=a,b: only those), four JSON files:
        DIR/decide-{limits,sets,why,loop}-<model>-<S>.json (DIR defaults to bench/). --limit N takes the
        first N cases per set and exits 1 when more than 20 % of them errored (the dry run).
        Run it with the model's venv python; it only reads the HF cache (HF_HUB_OFFLINE=1).
  summary <stamp> [model ...]                      bench/decide-{limits,sets,why,loop}-s1-<stamp>.md: the
        new models next to the optiq and Qwen3.8 runs in COMPARE (loop has none: optiq and Qwen3.8 were
        measured through nav-pilot's guard prompt directly, System One report §3.1, not this adapter).
        Any python.
  --selftest                                       a fake backend through run and summary. Any python.

`loop` is the System One report's loop classifier (§1-3): the 7 hand-written stuck-loop-vs-legitimate
scenarios from nav-pilot's guard prompt (`_np_checks.py` SCENARIOS, e72319e0), copied once into
bench/decide-cases/loop-classifier.jsonl in this adapter's one-question, fixed-options shape (no
tool results, unlike decide-limits' loop-near set). One case per scenario; the models are deterministic,
so no repeats, as for the other groups.

Each case becomes one `choice` question: state = evidence, instructions = question, criteria =
options. The chosen option and its distribution come from the model's own answer. Extra per-case
fields: state_tokens, truncated (the model cut the state), and for Kev over_train (state longer
than the 384 tokens Kev was trained on).
"""
import json
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import _decide as D            # noqa: E402  decide() is replaced by the in-process backend
import _decide_limits as DL    # noqa: E402  one(), cell(), save(), summary()
import _decide_sets as DS      # noqa: E402  cases(), summary()
import _decide_why as DW       # noqa: E402  cases(), summary()

HUB = Path.home() / ".cache" / "huggingface" / "hub"
KEV_CODE = "08ab0b87d27cb5577a3b371ad7ed4e4686b0502b"   # the commit the 8-bit build was merged with
# repo, revision in the HF cache (downloaded 2026-09-26, sha256-checked), backend.
MODELS = {
    # Merged from jaredpalmer/kev-4b@485ace87 (not main): its own head.pt and tokenizer (§8.6).
    "kev-4b-8bit": ("RoderickQiu/kev-4b-mlx-8bit", "e1c35947b19b74d8cbc34d127ffd38119e722b85", "kev"),
    "laya-421m": ("aac6fef/laya-mlx", "20aed815fc6acde75733882e7ec0e3f28aeb9717", "laya"),
    "laya-m-322m": ("aac6fef/laya-multilingual-mlx", "f2b4faf51023039425946074e2cf1361d2db11d5", "laya"),
}
def loop_summary(docs):
    L = ["# Loop classifier: stuck loop vs legitimate repeat", "",
         "The 7 hand-written scenarios from nav-pilot's guard prompt (System One report §3.1), one call "
         "per scenario, no repeats (the models are deterministic). optiq and Qwen3.8 were measured "
         "directly through the guard prompt, not through this adapter, so there is no comparable file "
         "to merge here. Cells are correct/n [95% Wilson]. An errored call counts as wrong.", "",
         "| | " + " | ".join(d["key"] for d in docs) + " |", "|---|" + "---|" * len(docs),
         "| All | " + " | ".join(DL.cell(d["cases"]) for d in docs) + " |",
         "| Loops (expect stuck loop) | " + " | ".join(
             DL.cell([c for c in d["cases"] if not c["legitimate"]]) for d in docs) + " |",
         "| Polls (expect legitimate) | " + " | ".join(
             DL.cell([c for c in d["cases"] if c["legitimate"]]) for d in docs) + " |"]
    return "\n".join(L) + "\n"


GROUPS = {  # group -> (sets, case loader, extra fields per case, as the group's own run() adds them)
    "loop": (("loop-classifier",), DS.cases, ("legitimate", "n", "scenario")),   # same bench/decide-cases/*.jsonl reader as sets
    "limits": (DL.SETS, DL.cases, ()),
    "sets": ((*DS.SETS, "issue-type-en"), DS.cases, ("lang", "repo", "number", "construction")),
    "why": (tuple(DW.FILES), DW.cases, ("lang", "construction", "sha")),
}
# The runs the summaries set the new models against (the manifest's two default decide models).
COMPARE = {
    "loop": [],   # optiq/Qwen3.8 were measured through the guard prompt directly; see loop_summary
    "limits": ["decide-limits-optiq-20260925-014512.json", "decide-limits-qwen3.8-27b-optiq-4bit-20260925-014512.json"],
    "sets": ["decide-sets-optiq-20260925-225356.json", "decide-sets-qwen3.8-27b-optiq-4bit-20260925-225356.json"],
    "why": ["decide-why-optiq-20260925-072116.json", "decide-why-qwen3.8-27b-optiq-4bit-20260925-072116.json"],
}
SUMMARY = {"loop": loop_summary, "limits": DL.summary, "sets": DS.summary, "why": DW.summary}
EXTRA = {}   # the last call's state_tokens / truncated / over_train, read after DL.one


def snapshot(model):
    repo, rev, _ = MODELS[model]
    d = HUB / f"models--{repo.replace('/', '--')}" / "snapshots" / rev
    if not d.is_dir():
        sys.exit(f"✗ {repo}@{rev[:8]} is not in the HF cache ({d})")
    return d


def load_kev(snap):
    """The 8-bit README's recipe: kev's MLXDecisionModel on the merged weights, head and temperature
    from the same repo's head.pt, tokenizer from the same repo (offline). KEV_TEMPERATURE overrides."""
    from transformers import AutoTokenizer
    from kev.api import SystemOneRequest, to_answers, to_record
    from kev.checkpoint import read_meta
    from kev.mlx_model import MLXDecisionModel
    from kev.model import MAX_STATE, SERVE_MAX_BRANCH, SERVE_MAX_STATE, PointerHead, pad_id, user_tokens
    meta = read_meta(str(snap))
    tok = AutoTokenizer.from_pretrained(str(snap))
    m = MLXDecisionModel(snap, pad_id(tok), head_dim=meta.head_dim)
    m.head = PointerHead(m.text.embed_tokens.dims, dp=meta.head_dim).eval()
    m.head.load_state_dict(meta.head)
    m.head.temperature = float(os.environ.get("KEV_TEMPERATURE") or meta.temperature)

    def predict(question, options, evidence):
        req = SystemOneRequest(state=evidence, questions={"q": {
            "type": "choice", "instructions": question, "criteria": {o: None for o in options}}})
        rec, qm = to_record(req)
        enc = m.encode(tok, rec, max_state=SERVE_MAX_STATE, max_branch=SERVE_MAX_BRANCH)
        a = to_answers([p.tolist() for p in m.probs(enc)], qm)["q"]
        return a["choice"], a["probabilities"]

    def extras(question, options, evidence):
        # Pre-cut count, as for Laya. A state near SERVE_MAX_STATE makes encode raise ContextOverflow (as
        # kev.serve answers 422); such a case is an error, reported as-is, and still gets these fields.
        n = len(user_tokens(tok, evidence))
        return {"state_tokens": n, "truncated": n + 1 > SERVE_MAX_STATE, "over_train": n + 1 > MAX_STATE}
    return predict, extras, {"temperature": m.head.temperature, "kev_code": KEV_CODE, "kev_revision": "485ace87",
                     "base": meta.base, "dtype": m.dtype}


def load_laya(snap):
    """laya_mlx.load on the cached snapshot, FP16 (the port's default and its published numbers)."""
    import laya_mlx
    from laya_mlx.common import build_prefix, serialize_state
    agent = laya_mlx.load(str(snap), dtype="float16")
    max_len, head_len = agent.cfg.get("max_len", 512), agent.cfg.get("head_max_len", 192)
    tok = agent.tok

    def predict(question, options, evidence):
        q = {"type": "choice", "instructions": question, "criteria": list(options)}
        a = agent.predict(evidence, {"q": q})["answers"]["q"]
        return a["choice"], a["probabilities"]

    def extras(question, options, evidence):
        q = {"type": "choice", "instructions": question, "criteria": list(options)}
        prefix, _ = build_prefix(tok, agent._to_internal(q), head_len)
        n = len(tok(serialize_state(evidence).replace(tok.mask_token, " "), add_special_tokens=False)["input_ids"])
        return {"state_tokens": n, "truncated": n > max(0, max_len - len(prefix) - 1)}
    return predict, extras, {"laya_mlx": laya_mlx.__version__, "max_len": max_len, "head_max_len": head_len}


def fake_backend(snap):
    """--selftest: always the first option, and a 'state' of one token per 4 characters cut at 512."""
    def predict(question, options, evidence):
        p = {o: (0.7 if i == 0 else 0.3 / max(1, len(options) - 1)) for i, o in enumerate(options)}
        return options[0], p

    def extras(question, options, evidence):
        return {"state_tokens": len(evidence) // 4, "truncated": len(evidence) // 4 > 512}
    return predict, extras, {"fake": True}


def install(predict, extras):
    """Route DL.one's D.decide through the in-process model; errors surface as DL.one expects. Only the
    model call is timed; the state-length fields are computed afterwards, on failures too."""
    def decide(_np, question, options, evidence, timeout=None):
        EXTRA.clear()
        t = time.perf_counter()
        try:
            choice, p = predict(question, options, evidence)
        except Exception as e:      # noqa: BLE001  any model failure is one wrong case, as a failed decide call is
            raise RuntimeError(f"{type(e).__name__}: {e}") from e
        finally:
            wall = time.perf_counter() - t
            EXTRA.update(extras(question, options, evidence))
        return {"choice": choice, "p": p, "ms": round(wall * 1000, 1)}, wall
    D.decide = decide


def run(model, limit=None, out=ROOT / "bench", stamp=None):
    repo, rev, backend = MODELS.get(model, ("fake/model", "0" * 40, "fake"))
    stamp = stamp or time.strftime("%Y%m%d-%H%M%S")
    max_s = float(os.environ.get("S1_MAX_S", "inf"))   # the launcher's cap for one model's whole pass
    only = [s for s in os.environ.get("S1_SETS", "").split(",") if s]   # run only these sets (kev-english-launcher)
    t0 = time.time()
    snap = snapshot(model) if backend != "fake" else None
    predict, extras, info = {"kev": load_kev, "laya": load_laya, "fake": fake_backend}[backend](snap)
    install(predict, extras)
    load_s = round(time.time() - t0, 1)
    print(f"  {model}: loaded {repo}@{rev[:8]} in {load_s} s {info}", flush=True)
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    errors = total = 0
    for group, (sets, loader, fields) in GROUPS.items():
        sets = [s for s in sets if not only or s in only]
        if not sets:
            continue
        path = out / f"decide-{group}-{model}-{stamp}.json"
        doc = {"key": model, "model": f"{repo}@{rev[:8]}", "nav_pilot": f"in-process {backend} (no nav-pilot)",
               "nav_pilot_commit": None, "backend": {**info, "revision": rev}, "load_s": load_s,
               "started": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "cases": [], "eval": {}, "limit": limit}
        tg = time.time()
        first = loader(sets[0])[0]
        d, _ = D.decide(None, first["question"], first["options"], first["evidence"])
        doc["cold"] = {"ms": d["ms"]}
        for s in sets:
            for r in loader(s)[:limit]:
                if time.time() - t0 > max_s:
                    doc["stopped"] = f"S1_MAX_S {max_s:.0f} s reached"
                    break
                EXTRA.clear()
                rec = DL.one(None, r)
                rec.update({k: r["meta"].get(k) for k in fields}, **EXTRA)
                doc["cases"].append(rec)
            g = [c for c in doc["cases"] if c["set"] == s]
            errors += sum(c["error"] is not None for c in g); total += len(g)
            print(f"  {model} {s}: {DL.cell(g)}, {sum(c['error'] is not None for c in g)} errors, "
                  f"{sum(bool(c.get('truncated')) for c in g)} truncated", flush=True)
            DL.save(path, doc)
        doc["finished"], doc["seconds"] = time.strftime("%Y-%m-%dT%H:%M:%S%z"), round(time.time() - tg)
        DL.save(path, doc)
        print(f"✓ {path}", flush=True)
    if limit and errors > 0.2 * max(1, total):
        print(f"✗ {errors}/{total} cases errored in the dry run", flush=True)
        return 1
    return 0


def summary(stamp, models, src=ROOT / "bench"):
    for group, fn in SUMMARY.items():
        docs = [json.loads((src / f).read_text()) for f in COMPARE[group] if (src / f).exists()]
        docs += [json.loads(p.read_text()) for m in models for p in [src / f"decide-{group}-{m}-{stamp}.json"] if p.exists()]
        md = src / f"decide-{group}-s1-{stamp}.md"
        md.write_text(fn(docs) + truncation(docs))
        print(f"✓ {md}")


def truncation(docs):
    L = ["", "## State length (in-process models only)", "",
         "| Model | Cases | Truncated | Over Kev's 384 training tokens | Median state tokens |", "|---|---|---|---|---|"]
    for d in docs:
        cs = [c for c in d["cases"] if "state_tokens" in c]
        if cs:
            L.append(f"| {d['key']} | {len(cs)} | {sum(bool(c['truncated']) for c in cs)} | "
                     f"{sum(bool(c.get('over_train')) for c in cs) if 'over_train' in cs[0] else '–'} | "
                     f"{DL.pct([c['state_tokens'] for c in cs], .5)} |")
    return "\n".join(L) + "\n"


def selftest():
    import tempfile
    with tempfile.TemporaryDirectory() as t:
        assert run("fake", out=Path(t), stamp="T") == 0
        n = {g: len(json.loads((Path(t) / f"decide-{g}-fake-T.json").read_text())["cases"]) for g in GROUPS}
        assert n == {"loop": 7, "limits": 974, "sets": 338, "why": 96}, n
        doc = json.loads((Path(t) / "decide-why-fake-T.json").read_text())
        c = doc["cases"][0]
        assert c["choice"] == c["options"][0] and c["error"] is None and "sha" in c, c
        assert all("state_tokens" in x for x in doc["cases"])
        assert sum(c["ok"] for c in doc["cases"]) == sum(c["expect"] == c["options"][0] for c in doc["cases"])
        assert run("fake", limit=2, out=Path(t), stamp="L") == 0
        assert len(json.loads((Path(t) / "decide-sets-fake-L.json").read_text())["cases"]) == 6
        for g in GROUPS:   # the comparators live in bench/; the fake run in the scratch dir
            for f in COMPARE[g]:
                (Path(t) / f).write_text((ROOT / "bench" / f).read_text())
        summary("T", ["fake"], src=Path(t))
        for g in GROUPS:
            md = (Path(t) / f"decide-{g}-s1-T.md").read_text()
            assert "fake" in md and "| fake | " in md and "optiq" in md, g
    print("✓ _decide_s1 selftest passed")


def main(a):
    if a == ["--selftest"]:
        selftest(); return 0
    if len(a) >= 2 and a[0] == "run" and a[1] in MODELS:
        opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d   # noqa: E731
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        return run(a[1], int(opt("--limit")) if opt("--limit") else None, Path(opt("--out", ROOT / "bench")), opt("--stamp"))
    if len(a) >= 2 and a[0] == "summary":
        summary(a[1], a[2:] or list(MODELS)); return 0
    sys.exit(__doc__)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
