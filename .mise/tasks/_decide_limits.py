#!/usr/bin/env python3
"""Where `nav-pilot alpha decide` stops working: language, questions no regex can answer, option count,
evidence length and position, option order, prompt injection, and model size. Cases and how their
labels were built: bench/decide-limits/README.md.

  all [--models a,b] [--stamp S]   every model in turn: server up the np-serve way, `run`, server down.
                                   Called by `mise run bench-decide-limits`, which holds the queue lock.
  run <key> <out.json>             every case against the server already up (NP_PORT, NP_MODEL,
                                   BENCH_NAV_PILOT); writes <out.json> as it goes and <out>.md at the end
  summary <out.md> <in.json>...    the markdown summary for one or more result files
  --check-cases                    the case files are valid and every label re-derives (build.py --check)
  --dry-run                        cases, binary, profiles, weights on disk, the plan and a GPU-time
                                   estimate. No lock, no server, no GPU.
  --selftest                       `run` and `summary` against a fake mlx-lm server with the real binary,
                                   in a scratch HOME, plus the manifest entry for a model without a profile

Each case is one `nav-pilot alpha decide --json` call: `--eval` reports only totals, and one case whose
letters all fall outside the top 11 logprobs aborts a whole `--eval` file. `--eval` still runs once per
on the sets in EVAL_SETS as a cross-check of the per-case totals.
"""
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "bench" / "decide-limits"))
import build as B                      # noqa: E402  the case builder and its label checks
import _decide as D                    # noqa: E402  read only: decide(), FAKE

CASES = ROOT / "bench" / "decide-limits"
BENCH = ROOT / "bench"
# Run order: cheap and most wanted first, so a timeout loses the long-evidence cells, not the rest.
SETS = ["lang-en", "lang-no", "describes", "goapi", "loop-near", "options", "position", "injection", "length"]
EVAL_SETS = ("lang-en", "options")   # --eval cross-check: the original questions, and the set where a case past
                                     # the top-11 cap can abort a whole --eval file. The rest would double the GPU time.
TIMEOUT = "180s"             # one decide call; a 30k-char case on the 27B prefills in ~15 s cold
MODEL_TIMEOUT_S = 40 * 60    # one model's whole `run`
# Prefill tok/s: the 27B dense from bench/np-e2e-qwen3.8-27b-optiq-4bit-20260924-181038.json (29.5k
# tokens cold in 50 s); the MoE ~3x that (MODELS.md: "5x faster at prefill", discounted); the 4B a guess.
MODELS = {
    "optiq": {"profile": "qwen3.6-35b-a3b-optiq", "model": "mlx-community/Qwen3.6-35B-A3B-OptiQ-4bit",
              "prefill_tok_s": 1800},
    # The manifest's 4-bit Qwen3.8 slot; OptiQ-4bit replaced the plain 4-bit on 2026-09-24 (4fff454).
    "qwen3.8-27b-optiq-4bit": {"profile": "qwen3.8-27b-optiq-4bit", "model": "mlx-community/Qwen3.8-27B-OptiQ-4bit",
                               "prefill_tok_s": 700},
    # Not in the manifest and no profile: added as a non-default entry for the run, _np_checks.manifest's trick.
    "qwen3-4b": {"profile": None, "model": "mlx-community/Qwen3-4B-Instruct-2507-4bit", "prefill_tok_s": 3000,
                 "name": "Qwen3 4B Instruct 2507 4bit (decide-limits only)", "weights_gb": 3},
}
CALL_OVERHEAD_S = 0.35       # per call: 0.26-0.31 s measured against the fake server (process start,
                             # server lock, `ps` check, HTTP), plus a template and one decode step
START_S = 90                 # alpha local start plus the cold call
CHARS_PER_TOKEN = 3.2
CACHE = Path.home() / ".nav-pilot" / "local-models.json"
STATE = Path.home() / ".nav-pilot" / "local" / "server.json"


def save(path, doc):
    Path(path).write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")


def cases(name):
    return [json.loads(l) for l in (CASES / f"{name}.jsonl").read_text().splitlines() if l.strip()]


# ── statistics ──────────────────────────────────────────────────────────────

def wilson(k, n, z=1.96):
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0.0, c - h), min(1.0, c + h))


def pct(xs, q):
    s = sorted(x for x in xs if x is not None)
    return s[max(0, math.ceil(q * len(s)) - 1)] if s else None


def cell(recs):
    n, k = len(recs), sum(r["ok"] for r in recs)
    if not n:
        return "–"
    lo, hi = wilson(k, n)
    return f"{k}/{n} = {k / n:.2f} [{lo:.2f}–{hi:.2f}]"


# ── one model ───────────────────────────────────────────────────────────────

def one(np, r):
    """One case through the real binary. Errors are results too: a case with no answer counts as wrong."""
    m = r.get("meta", {})
    rec = {"id": r["id"], "set": r["set"], "expect": r["expect"], "options": r["options"],
           "chars": len(r["evidence"]), **{k: m[k] for k in ("lang", "kind", "k", "pos", "length", "where",
                                                               "variant", "base", "target", "twin", "noise") if k in m}}
    try:
        d, wall = D.decide(np, r["question"], r["options"], r["evidence"], timeout=TIMEOUT)
        rec.update(choice=d["choice"], p=d["p"], ms=d["ms"], wall_s=wall, error=None)
    except (RuntimeError, ValueError) as e:
        rec.update(choice=None, p=None, ms=None, wall_s=None, error=str(e)[-300:])
    rec["ok"] = rec["choice"] == r["expect"]
    return rec


def run(key, out):
    import _np_checks as C
    np, port, model = os.environ["BENCH_NAV_PILOT"], os.environ["NP_PORT"], os.environ["NP_MODEL"]
    rev = subprocess.run(["go", "version", "-m", np], capture_output=True, text=True).stdout
    doc = {"key": key, "model": model, "port": int(port), "nav_pilot": np,
           "nav_pilot_commit": (re.search(r"vcs.revision=(\w+)", rev) or [None, None])[1],
           "started": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "timeout": TIMEOUT, "cases": [], "eval": {}}
    first = cases("lang-en")[0]
    t0 = time.time()
    d, wall = D.decide(np, first["question"], first["options"], first["evidence"], timeout="300s")
    doc["cold"] = {"ms": d["ms"], "wall_s": wall, "choice": d["choice"]}
    with C.post(port, {"model": model, "max_tokens": 16, "messages": [
            {"role": "user", "content": "Reply with exactly: OK"}]}) as resp:
        doc["sanity"] = (json.load(resp)["choices"][0]["message"].get("content") or "").strip()
    save(out, doc)
    if "OK" not in doc["sanity"]:
        raise SystemExit(f"✗ server answered {doc['sanity']!r} to the sanity prompt — refusing to measure")
    print(f"  {key}: cold decide {d['ms']} ms, sanity {doc['sanity']!r}", flush=True)
    for name in SETS:
        rows = cases(name)
        ts = time.time()
        for r in rows:
            doc["cases"].append(one(np, r))
        recs = [c for c in doc["cases"] if c["set"] == name]
        print(f"  {key} {name}: {cell(recs)}, {sum(c['error'] is not None for c in recs)} errors, "
              f"{time.time() - ts:.0f} s", flush=True)
        save(out, doc)
    for name in SETS:
        if name not in EVAL_SETS:
            continue
        p = subprocess.run([np, "alpha", "decide", "--eval", str(CASES / f"{name}.jsonl"), "--json",
                            "--timeout", TIMEOUT], capture_output=True, text=True)
        try:
            doc["eval"][name] = json.loads(p.stdout)
        except ValueError:
            doc["eval"][name] = {"error": f"exit {p.returncode}: {(p.stderr or p.stdout).strip()[-300:]}"}
        save(out, doc)
    doc["finished"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    doc["seconds"] = round(time.time() - t0)
    save(out, doc)
    md = Path(out).with_suffix(".md")
    md.write_text(summary([doc]))
    print(f"✓ {key}: {out} and {md}", flush=True)


# ── server lifecycle, np-serve's, per model ────────────────────────────────

def add_entry(cache, spec, key):
    """_np_checks.manifest's non-default entry, for a model with no profile: a copy of the default entry
    with the model swapped in. The cache is restored from the backup when the model is done."""
    src = Path(cache) if Path(cache).exists() else ROOT / "manifest" / "models.json"
    m = json.loads(src.read_text())
    if not [e for e in m["models"] if e["model"] == spec["model"]]:
        base = next((e for e in m["models"] if e.get("default")), m["models"][0])
        m["models"].append(dict(base, key=key, name=spec["name"], model=spec["model"], default=False,
                                weights_gb=spec["weights_gb"], params={**base["params"], "MLX_MODEL": spec["model"]}))
    Path(cache).write_text(json.dumps(m, indent=2) + "\n")
    print(f"✓ manifest entry for {spec['model']} ({key})")


def server_pid():
    try:
        pid = json.loads(STATE.read_text())["pid"]
        os.kill(pid, 0)
        return pid
    except (OSError, ValueError, KeyError, TypeError):
        return None


def serve_and_run(key, np, stamp, backup, marker):
    spec = MODELS[key]
    cfg = ROOT / ".bench-logs" / f"decide-limits-{stamp}.config.toml"
    env = {**os.environ, "NAV_PILOT_CONFIG": str(cfg), "BENCH_NAV_PILOT": np}
    subprocess.run(["mise", "run", "server-stop"], capture_output=True)
    if server_pid():
        print(f"✗ {key}: a nav-pilot local server is already running ({STATE}); skipping"); return 1
    user = Path.home() / ".nav-pilot" / "config.toml"
    keep = [l for l in (user.read_text().splitlines() if user.exists() else [])
            if not re.match(r"^(auto_update|local_enabled|local_autostart|local_model)\s*=", l)]
    cfg.write_text("\n".join(["auto_update = false", "local_enabled = true", "local_autostart = false",
                              f'local_model = "{spec["model"]}"', *keep]) + "\n")
    if not backup.exists():
        shutil.copy2(CACHE, backup)
    rc = 1
    try:
        try:
            if spec["profile"]:
                import _np_checks as C
                C.manifest(spec["profile"], str(CACHE))
            else:
                add_entry(CACHE, spec, key)
        except SystemExit as e:      # _np_checks.manifest exits on an ambiguous entry; skip this model only
            print(f"✗ {key}: manifest: {e}"); return 1
        marker.touch()
        # Unreachable proxy: start reads the manifest just written instead of refetching it.
        if subprocess.run([np, "alpha", "local", "start"], env={**env, "HTTPS_PROXY": "http://127.0.0.1:9",
                                                                  "HTTP_PROXY": "http://127.0.0.1:9"}).returncode:
            print(f"✗ {key}: nav-pilot alpha local start failed"); return 1
        s = json.loads(STATE.read_text())
        if s.get("model") != spec["model"]:
            print(f"✗ {key}: nav-pilot serves {s.get('model')}, expected {spec['model']}"); return 1
        print(f"  {key}: server pid {s['pid']} port {s['port']} model {s['model']}", flush=True)
        out = BENCH / f"decide-limits-{key}-{stamp}.json"
        try:
            rc = subprocess.run([sys.executable, __file__, "run", key, str(out)], timeout=MODEL_TIMEOUT_S,
                                env={**env, "NP_PORT": str(s["port"]), "NP_MODEL": spec["model"]}).returncode
        except subprocess.TimeoutExpired:
            print(f"✗ {key}: over {MODEL_TIMEOUT_S // 60} min; keeping what it measured"); rc = 124
        return rc
    finally:
        subprocess.run([np, "alpha", "local", "stop"], env=env, capture_output=True)
        marker.unlink(missing_ok=True)
        shutil.copy2(backup, CACHE)
        cfg.unlink(missing_ok=True)


def run_all(keys, stamp):
    np = os.environ.get("BENCH_NAV_PILOT") or newest_binary()
    backup = Path(os.environ.get("LIMITS_BACKUP", f"{CACHE}.np-e2e-{os.getpid()}"))
    marker = Path(os.environ.get("LIMITS_MARKER", ROOT / ".bench-logs" / f"decide-limits-{stamp}.started"))
    rcs = {}
    for key in keys:
        print(f"=== decide-limits {key} · nav-pilot {Path(np).name}", flush=True)
        rcs[key] = serve_and_run(key, np, stamp, backup, marker)
    files = [BENCH / f"decide-limits-{k}-{stamp}.json" for k in keys]
    files = [f for f in files if f.exists()]
    if files:
        md = BENCH / f"decide-limits-{stamp}.md"
        md.write_text(summary([json.loads(f.read_text()) for f in files]))
        print(f"✓ summary: {md}")
    print(f"=== decide-limits done: {rcs}")
    return 0 if all(v == 0 for v in rcs.values()) else 1


def newest_binary():
    for d in (ROOT / ".bench-logs" / "bin", Path("/Users/hans/mlx-workspace/.bench-logs/bin")):
        bins = sorted(d.glob("nav-pilot-main-*"), key=lambda p: p.stat().st_mtime)
        if bins:
            return str(bins[-1])
    sys.exit("✗ no .bench-logs/bin/nav-pilot-main-* binary; set BENCH_NAV_PILOT")


# ── summary ─────────────────────────────────────────────────────────────────

FAMILY = {"cc": "commit-conventional", "describes": "describes", "goapi": "goapi"}


def family(c):
    if c.get("kind") == "lvp":
        return "loop-vs-progress" if c["id"].startswith("lvp-orig") else "loop-near"
    return FAMILY.get(c.get("kind"), c.get("kind"))


def summary(docs):
    L = ["# `nav-pilot alpha decide`: limits", "",
         "Cases and label construction: [bench/decide-limits/README.md](decide-limits/README.md). Every cell is "
         "correct/n = accuracy [95% Wilson interval]. A call that errored counts as wrong and is listed under "
         "latency.", ""]
    if len(docs) > 1:
        L += ["## Accuracy per set and model", "", "| Set | " + " | ".join(d["key"] for d in docs) + " |",
              "|---|" + "---|" * len(docs)]
        for s in SETS:
            L.append(f"| {s} | " + " | ".join(cell([c for c in d["cases"] if c["set"] == s]) for d in docs) + " |")
        L.append("")
    for d in docs:
        L += model_section(d)
    return "\n".join(L) + "\n"


def model_section(d):
    cs = d["cases"]
    L = [f"## {d['key']} (`{d['model']}`)", "",
         f"nav-pilot `{Path(d['nav_pilot']).name}` (commit {d.get('nav_pilot_commit')}), started {d['started']}, "
         f"{len(cs)} cases in {d.get('seconds', '?')} s, cold decide {d.get('cold', {}).get('ms')} ms.", ""]

    L += ["### Language (same evidence and labels; only the question and option labels change)", "",
          "| Question | English | Norwegian | Pairs answered differently |", "|---|---|---|---|"]
    lang = [c for c in cs if c["set"] in ("lang-en", "lang-no", "describes", "goapi", "loop-near")]
    by_id = {c["id"]: c for c in lang}
    for fam in ("commit-conventional", "loop-vs-progress", "describes", "goapi", "loop-near"):
        en = [c for c in lang if family(c) == fam and c.get("lang") == "en"]
        no = [c for c in lang if family(c) == fam and c.get("lang") == "no"]
        diff = sum(1 for c in no if c.get("twin") in by_id and by_id[c["twin"]]["ok"] != c["ok"])
        L.append(f"| {fam} | {cell(en)} | {cell(no)} | {diff}/{len(no)} |")

    L += ["", "### Number of options (type question; the correct type among k)", "",
          "| k | All | Correct inside the top-11 cap (A–K) | Correct past it (L–N) | Errors |", "|---|---|---|---|---|"]
    opt = [c for c in cs if c["set"] == "options"]
    for k in sorted({c["k"] for c in opt}):
        ck = [c for c in opt if c["k"] == k]
        L.append(f"| {k} | {cell(ck)} | {cell([c for c in ck if c['pos'] <= 11])} | "
                 f"{cell([c for c in ck if c['pos'] > 11]) if k > 11 else '–'} | {sum(c['error'] is not None for c in ck)} |")

    L += ["", "### Evidence length and where the deciding line sits", "",
          "| Length | Early | Middle | Late | p50 ms | p95 ms |", "|---|---|---|---|---|---|"]
    ln = [c for c in cs if c["set"] == "length"]
    for name in B.LENGTHS:
        cl = [c for c in ln if c["length"] == name]
        L.append(f"| {name} | " + " | ".join(cell([c for c in cl if c["where"] == w]) for w in B.POSITIONS)
                 + f" | {pct([c['ms'] for c in cl], .5)} | {pct([c['ms'] for c in cl], .95)} |")

    L += ["", "### Option order (position bias)", "",
          "| Correct option at | Type question, 4 options | Share of all answers at this position |", "|---|---|---|"]
    pt = [c for c in cs if c["set"] == "position" and c["kind"] == "type"]
    answered = [c for c in pt if c["choice"]]
    for p in range(1, 5):
        at = sum(1 for c in answered if c["options"].index(c["choice"]) + 1 == p)
        L.append(f"| {'ABCD'[p - 1]} | {cell([c for c in pt if c['pos'] == p])} | "
                 f"{at}/{len(answered)} = {at / max(1, len(answered)):.2f} |")
    yn = [c for c in cs if c["set"] == "position" and c["kind"] == "cc"]
    for first in ("yes", "no"):
        g = [c for c in yn if c["options"][0] == first]
        a = sum(1 for c in g if c["choice"] == c["options"][0])
        L.append(f"| yes/no, `{first}` listed first | {cell(g)} | chose A: {a}/{len(g)} |")

    L += ["", "### Calibration (p of the chosen option, all answered cases)", "",
          "| p(choice) | n | Accuracy | Mean p |", "|---|---|---|---|"]
    bins = [(0, .5), (.5, .7), (.7, .9), (.9, .99), (.99, 1.0001)]
    for lo, hi in bins:
        b = [c for c in cs if c["choice"] and lo <= c["p"][c["choice"]] < hi]
        mp = sum(c["p"][c["choice"]] for c in b) / len(b) if b else None
        L.append(f"| {lo:.2f}–{min(hi, 1):.2f} | {len(b)} | {cell(b)} | {'–' if mp is None else f'{mp:.3f}'} |")

    L += ["", "### Injection (evidence tells the model to give the wrong answer)", "",
          "Flip rate: of the pairs whose clean case was right, how often the injected twin chose the injected answer.", "",
          "| Injection | Pairs | Clean accuracy | Injected accuracy | Flip rate |", "|---|---|---|---|---|"]
    inj = [c for c in cs if c["set"] == "injection"]
    clean = {c["base"]: c for c in inj if c.get("variant") == "clean"}
    for v in sorted({c["variant"] for c in inj} - {"clean"}):
        g = [c for c in inj if c.get("variant") == v]
        cl = [clean[c["base"]] for c in g]
        ok = [c for c in g if clean[c["base"]]["ok"]]
        fl = sum(1 for c in ok if c["choice"] == c["target"])
        lo, hi = wilson(fl, len(ok))
        L.append(f"| {v} | {len(g)} | {cell(cl)} | {cell(g)} | "
                 f"{fl}/{len(ok)} = {fl / max(1, len(ok)):.2f} [{lo:.2f}–{hi:.2f}] |")

    L += ["", "### Latency and errors per set", "", "| Set | n | p50 ms | p95 ms | Errors |", "|---|---|---|---|---|"]
    for s in SETS:
        g = [c for c in cs if c["set"] == s]
        L.append(f"| {s} | {len(g)} | {pct([c['ms'] for c in g], .5)} | {pct([c['ms'] for c in g], .95)} | "
                 f"{sum(c['error'] is not None for c in g)} |")
    errs = Counter(c["error"][:120] for c in cs if c["error"])
    if errs:
        L += ["", "Errors seen: " + "; ".join(f"{n}× `{e}`" for e, n in errs.most_common(5))]

    L += ["", "### `--eval` cross-check (nav-pilot's own totals, same cases)", "",
          "| Set | `--eval` | Per-case calls |", "|---|---|---|"]
    for s, e in d.get("eval", {}).items():
        g = [c for c in cs if c["set"] == s]
        ev = (f"{e['correct']}/{e['cases']} = {e['accuracy']:.2f}, p50 {e['p50_ms']} ms" if "accuracy" in e
              else e.get("error", "?"))
        L.append(f"| {s} | {ev} | {sum(c['ok'] for c in g)}/{len(g)} |")
    return L + [""]


# ── dry run and estimate ────────────────────────────────────────────────────

def weights_ok(model):
    snap = sorted((Path.home() / ".cache" / "huggingface" / "hub" / f"models--{model.replace('/', '--')}"
                   / "snapshots").glob("*"))
    if not snap:
        return "not downloaded"
    s = snap[-1]
    if not (s / "config.json").exists():
        return f"{s}: no config.json"
    idx = s / "model.safetensors.index.json"
    need = set(json.loads(idx.read_text())["weight_map"].values()) if idx.exists() else {"model.safetensors"}
    missing = [f for f in need if not (s / f).exists()]
    if missing or list(s.parents[1].glob("blobs/*.incomplete")):
        return f"incomplete: {missing[:3]}"
    return None


def estimate(keys):
    rows = {n: cases(n) for n in SETS}
    lines, total = [], 0
    for key in keys:
        rate = MODELS[key]["prefill_tok_s"]
        secs = START_S
        for rs in rows.values():
            chars = sum(len(r["evidence"]) for r in rs)
            passes = 2 if rs[0]["set"] in EVAL_SETS else 1        # the --eval cross-check repeats the set
            secs += passes * ((chars / CHARS_PER_TOKEN + 80 * len(rs)) / rate + len(rs) * CALL_OVERHEAD_S)
        lines.append(f"  {key:18} ~{secs / 60:4.0f} min  (prefill {rate} tok/s assumed)")
        total += secs
    return lines, total


def dry_run(keys):
    bad = 0
    print("decide-limits dry run (no lock, no server, no GPU)")
    if B.check():
        bad += 1
    np = os.environ.get("BENCH_NAV_PILOT") or newest_binary()
    rev = subprocess.run(["go", "version", "-m", np], capture_output=True, text=True).stdout
    commit = (re.search(r"vcs.revision=(\w+)", rev) or [None, None])[1]
    helps = subprocess.run([np, "alpha", "decide", "--help"], capture_output=True, text=True)
    ok = os.access(np, os.X_OK) and "--eval" in helps.stderr + helps.stdout
    print(f"{'PASS' if ok else 'FAIL'}  nav-pilot {np} (commit {commit}; needs alpha decide --eval, navikt/copilot#949)")
    bad += not ok
    for key in keys:
        spec = MODELS[key]
        if spec["profile"] and not (ROOT / "profiles" / f"{spec['profile']}.toml").exists():
            print(f"FAIL  {key}: profile {spec['profile']} missing"); bad += 1
        w = weights_ok(spec["model"])
        print(f"{'FAIL' if w else 'PASS'}  {key}: {spec['model']} weights {'on disk' if not w else w}")
        bad += bool(w)
    lines, total = estimate(keys)
    n = sum(len(cases(s)) for s in SETS)
    print(f"plan: {len(keys)} models × {n} cases ({', '.join(f'{s} {len(cases(s))}' for s in SETS)})")
    print("\n".join(lines))
    print(f"  total ~{total / 60:.0f} min GPU (incl. the --eval cross-check on {', '.join(EVAL_SETS)})")
    print(f"out: bench/decide-limits-<model>-<stamp>.json + .md, bench/decide-limits-<stamp>.md")
    print("dry run: " + ("PASS" if not bad else "FAIL"))
    return bad


# ── selftest ────────────────────────────────────────────────────────────────

def selftest():
    assert B.check() == 0, "case files"
    lo, hi = wilson(8, 10)
    assert abs(lo - 0.490) < 0.01 and abs(hi - 0.943) < 0.01, (lo, hi)
    assert wilson(0, 0) == (0.0, 0.0) and pct([3, 1, 2], .5) == 2
    with tempfile.TemporaryDirectory() as t:
        cache = Path(t) / "local-models.json"
        shutil.copy(ROOT / "manifest" / "models.json", cache)
        add_entry(cache, MODELS["qwen3-4b"], "qwen3-4b")
        add_entry(cache, MODELS["qwen3-4b"], "qwen3-4b")     # idempotent
        m = json.loads(cache.read_text())
        e = [x for x in m["models"] if x["model"] == MODELS["qwen3-4b"]["model"]]
        assert len(e) == 1 and not e[0]["default"] and e[0]["params"]["MLX_MODEL"] == e[0]["model"]
        assert sum(x.get("default", False) for x in m["models"]) == 1
    np = os.environ.get("BENCH_NAV_PILOT") or newest_binary()
    with tempfile.TemporaryDirectory() as t:
        t = Path(t)
        (t / "script.py").write_text(D.FAKE)
        portfile, model = t / "port", "fake/model"
        srv = subprocess.Popen([sys.executable, str(t / "script.py"), str(portfile), model])
        try:
            for _ in range(100):
                if portfile.exists() and portfile.read_text():
                    break
                time.sleep(0.05)
            port = portfile.read_text()
            lstart = subprocess.run(["ps", "-o", "lstart=", "-p", str(srv.pid)], capture_output=True, text=True).stdout.strip()
            state = t / ".nav-pilot" / "local"
            state.mkdir(parents=True)
            (state / "server.json").write_text(json.dumps({"pid": srv.pid, "model": model, "port": int(port),
                                                           "started": "2026-09-24T22:00:00Z", "lstart": lstart}))
            out = t / "limits.json"
            env = {**os.environ, "HOME": str(t), "BENCH_NAV_PILOT": np, "NP_PORT": port, "NP_MODEL": model}
            r = subprocess.run([sys.executable, __file__, "run", "fake", str(out)], env=env, capture_output=True, text=True)
            print(r.stdout[-1500:], r.stderr[-1500:])
            assert r.returncode == 0, "run failed against the fake server"
            doc = json.loads(out.read_text())
            md = out.with_suffix(".md").read_text()
        finally:
            srv.kill()
    cs = doc["cases"]
    assert len(cs) == sum(len(cases(s)) for s in SETS), len(cs)
    assert all(c["error"] is None and c["choice"] == c["options"][0] for c in cs), "the fake always answers A"
    for s in SETS:
        g = [c for c in cs if c["set"] == s]
        want = sum(c["expect"] == c["options"][0] for c in g)
        assert sum(c["ok"] for c in g) == want, s
        if s in EVAL_SETS:
            assert doc["eval"][s].get("correct") == want, (s, doc["eval"][s])
    assert set(doc["eval"]) == set(EVAL_SETS)
    for h in ("### Language", "### Number of options", "### Evidence length", "### Option order", "### Calibration",
              "### Injection", "### Latency", "### `--eval` cross-check"):
        assert h in md, h
    # The fake answers A: every injected case whose target is A flips from a clean A.
    assert re.search(r"\| letter \| 30 \|", md), md[md.find("### Injection"):][:600]
    both = summary([doc, {**doc, "key": "fake2"}])
    assert "## Accuracy per set and model" in both and "fake2" in both
    print(f"✓ _decide_limits selftest passed ({len(cs)} cases, nav-pilot {Path(np).name}, real binary against a fake server)")


def main(a):
    if a == ["--check-cases"]:
        return 1 if B.check() else 0
    if a == ["--selftest"]:
        selftest(); return 0
    keys = list(MODELS)
    if "--models" in a:
        keys = a[a.index("--models") + 1].split(",")
        unknown = [k for k in keys if k not in MODELS]
        if unknown:
            sys.exit(f"unknown model key(s) {unknown}; known: {list(MODELS)}")
    if a[:1] == ["--dry-run"]:
        return 1 if dry_run(keys) else 0
    if a[:1] == ["all"]:
        stamp = a[a.index("--stamp") + 1] if "--stamp" in a else time.strftime("%Y%m%d-%H%M%S")
        return run_all(keys, stamp)
    if len(a) == 3 and a[0] == "run":
        run(a[1], a[2]); return 0
    if len(a) >= 3 and a[0] == "summary":
        Path(a[1]).write_text(summary([json.loads(Path(f).read_text()) for f in a[2:]])); return 0
    sys.exit(__doc__)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
