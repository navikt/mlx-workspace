#!/usr/bin/env python3
"""`nav-pilot alpha decide` on a question no regex answers: does a commit message say why the change was
made, beyond what its diff shows? Cases and labels: bench/decide-cases/README.md.

  all [--models a,b] [--stamp S]   every model in turn, np-serve's server lifecycle from _decide_limits.
                                   Called by `mise run bench-decide-why`, which holds the queue lock.
  run <key> <out.json>             every case against the server already up (NP_PORT, NP_MODEL, BENCH_NAV_PILOT)
  summary <out.md> <in.json>...    the markdown summary for one or more result files
  --check-cases                    both case files are valid, balanced and twins of each other
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import _decide as D            # noqa: E402  read only: decide()
import _decide_limits as DL    # noqa: E402  read only: one(), wilson(), pct(), cell(), serve_and_run(), MODELS

CASES = ROOT / "bench" / "decide-cases"
FILES = {"why-en": "commit-explains-why.jsonl", "why-no": "commit-explains-why-no.jsonl"}
KINDS = ("real-why", "real-what", "controlled")
THRESHOLDS = (0.5, 0.7, 0.8, 0.9, 0.95, 0.99)


def cases(s):
    return [json.loads(l) for l in (CASES / FILES[s]).read_text().splitlines() if l.strip()]


def check_cases():
    bad = 0
    en, no = cases("why-en"), cases("why-no")
    for s, rows, opts in (("why-en", en, ["yes", "no"]), ("why-no", no, ["ja", "nei"])):
        for r in rows:
            m = r.get("meta", {})
            want = opts[0] if m.get("construction") == "real-why" else opts[1]
            if not (r["options"] == opts and r["expect"] == want and r["set"] == s and m.get("construction") in KINDS
                    and 0 < len(r["evidence"].encode()) <= 32 << 10):
                print(f"✗ {s} {r.get('id')}"); bad += 1
        n = {k: sum(r["meta"]["construction"] == k for r in rows) for k in KINDS}
        print(f"{'✓' if not bad else '✗'} {FILES[s]}: {len(rows)} cases {n}")
        if n["real-why"] != n["real-what"] + n["controlled"]:
            print(f"✗ {s}: yes/no not balanced"); bad += 1
    if [r["evidence"] for r in en] != [r["evidence"] for r in no]:
        print("✗ the Norwegian file is not a twin of the English one"); bad += 1
    return bad


def run(key, out):
    import _np_checks as C
    np, port, model = os.environ["BENCH_NAV_PILOT"], os.environ["NP_PORT"], os.environ["NP_MODEL"]
    rev = subprocess.run(["go", "version", "-m", np], capture_output=True, text=True).stdout
    doc = {"key": key, "model": model, "nav_pilot": np,
           "nav_pilot_commit": (re.search(r"vcs.revision=(\w+)", rev) or [None, None])[1],
           "started": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "cases": [], "eval": {}}
    first = cases("why-en")[0]
    t0 = time.time()
    d, wall = D.decide(np, first["question"], first["options"], first["evidence"], timeout="300s")
    doc["cold"] = {"ms": d["ms"], "wall_s": wall}
    with C.post(port, {"model": model, "max_tokens": 16, "messages": [
            {"role": "user", "content": "Reply with exactly: OK"}]}) as resp:
        doc["sanity"] = (json.load(resp)["choices"][0]["message"].get("content") or "").strip()
    DL.save(out, doc)
    if "OK" not in doc["sanity"]:
        raise SystemExit(f"✗ server answered {doc['sanity']!r} to the sanity prompt — refusing to measure")
    for s in FILES:
        for r in cases(s):
            rec = DL.one(np, r)
            rec.update(lang=r["meta"]["lang"], construction=r["meta"]["construction"], sha=r["meta"]["sha"])
            doc["cases"].append(rec)
        print(f"  {key} {s}: {DL.cell([c for c in doc['cases'] if c['set'] == s])}", flush=True)
        DL.save(out, doc)
    # nav-pilot's own totals on the same files: the command a reader would run.
    for s, f in FILES.items():
        p = subprocess.run([np, "alpha", "decide", "--eval", str(CASES / f), "--json", "--timeout", DL.TIMEOUT],
                           capture_output=True, text=True)
        try:
            doc["eval"][s] = json.loads(p.stdout)
        except ValueError:
            doc["eval"][s] = {"error": f"exit {p.returncode}: {(p.stderr or p.stdout).strip()[-300:]}"}
        DL.save(out, doc)
    doc["finished"], doc["seconds"] = time.strftime("%Y-%m-%dT%H:%M:%S%z"), round(time.time() - t0)
    DL.save(out, doc)
    print(f"✓ {key}: {out}", flush=True)


def no_label(c):
    return c["options"][1]


def summary(docs):
    L = ["# `nav-pilot alpha decide`: does the commit message explain why?", "",
         "Question: *Does the commit message explain why the change was made, beyond describing what the diff "
         "already shows?* (and its Norwegian twin), evidence = message + diff. Cases and labels: "
         "[decide-cases/README.md](decide-cases/README.md). Cells are correct/n = accuracy [95% Wilson]. "
         "An errored call counts as wrong.", "",
         "## Accuracy", "", "| | " + " | ".join(d["key"] for d in docs) + " |", "|---|" + "---|" * len(docs)]
    rows = [("All (EN + NO)", lambda c: True), ("English question", lambda c: c["lang"] == "en"),
            ("Norwegian question", lambda c: c["lang"] == "no")]
    rows += [(f"{k} (expect {'yes' if k == 'real-why' else 'no'})", lambda c, k=k: c["construction"] == k) for k in KINDS]
    for name, f in rows:
        L.append(f"| {name} | " + " | ".join(DL.cell([c for c in d["cases"] if f(c)]) for d in docs) + " |")
    L.append("| EN/NO twins answered differently | " + " | ".join(
        f"{twin_diff(d)}/{sum(c['lang'] == 'no' for c in d['cases'])}" for d in docs) + " |")
    L.append("| p50 / p95 ms per call | " + " | ".join(
        f"{DL.pct([c['ms'] for c in d['cases']], .5)} / {DL.pct([c['ms'] for c in d['cases']], .95)}" for d in docs) + " |")
    L.append("| `--eval` (nav-pilot's totals) EN; NO | " + " | ".join(
        "; ".join(ev_cell(d["eval"].get(s, {})) for s in FILES) for d in docs) + " |")
    for d in docs:
        L += model_section(d)
    return "\n".join(L) + "\n"


def twin_diff(d):
    by = {(c["construction"], c["sha"], c["lang"]): c["ok"] for c in d["cases"]}
    return sum(1 for (k, s, l), ok in by.items() if l == "no" and by.get((k, s, "en")) is not None and by[(k, s, "en")] != ok)


def ev_cell(e):
    return f"{e['correct']}/{e['cases']} = {e['accuracy']:.2f}" if "accuracy" in e else e.get("error", "–")[:60]


def model_section(d):
    cs = [c for c in d["cases"] if c["choice"]]
    L = ["", f"## {d['key']} (`{d['model']}`)", "",
         f"nav-pilot `{Path(d['nav_pilot']).name}` (commit {d.get('nav_pilot_commit')}), {len(d['cases'])} calls in "
         f"{d.get('seconds', '?')} s, cold decide {d.get('cold', {}).get('ms')} ms, "
         f"{sum(c['error'] is not None for c in d['cases'])} errors.", "",
         "### Confident answers only (p of the chosen option ≥ 0.9)", "",
         "| | Answered at p ≥ 0.9 | Accuracy of those |", "|---|---|---|"]
    for name, f in (("All", lambda c: True), ("Expect yes", lambda c: c["construction"] == "real-why"),
                    ("Expect no", lambda c: c["construction"] != "real-why")):
        g = [c for c in d["cases"] if f(c)]
        hi = [c for c in g if c["choice"] and c["p"][c["choice"]] >= 0.9]
        L.append(f"| {name} | {len(hi)}/{len(g)} | {DL.cell(hi)} |")
    L += ["", "### Calibration (p of the chosen option)", "", "| p(choice) | n | Accuracy | Mean p |", "|---|---|---|---|"]
    for lo, hi in ((0.5, 0.7), (0.7, 0.9), (0.9, 0.99), (0.99, 1.0001)):
        b = [c for c in cs if lo <= c["p"][c["choice"]] < hi]
        mp = sum(c["p"][c["choice"]] for c in b) / len(b) if b else None
        L.append(f"| {lo:.2f}–{min(hi, 1):.2f} | {len(b)} | {DL.cell(b)} | {'–' if mp is None else f'{mp:.3f}'} |")
    L += ["", "### As a commit-msg hook: block when p(no) ≥ t", "",
          "Caught = messages without a why that the hook would stop. Wrongly blocked = messages that do explain "
          "why and would be stopped anyway. Both over EN + NO calls.", "",
          "| t | Caught (of no-why) | Wrongly blocked (of real-why) | Precision of a block |", "|---|---|---|---|"]
    neg = [c for c in d["cases"] if c["construction"] != "real-why"]
    pos = [c for c in d["cases"] if c["construction"] == "real-why"]
    for t in THRESHOLDS:
        blocks = lambda c: c["choice"] is not None and c["p"][no_label(c)] >= t   # noqa: E731
        k, fb = sum(map(blocks, neg)), sum(map(blocks, pos))
        lo, hi = DL.wilson(fb, len(pos))
        prec = f"{k}/{k + fb} = {k / (k + fb):.2f}" if k + fb else "–"
        L.append(f"| {t} | {k}/{len(neg)} = {k / len(neg):.2f} | {fb}/{len(pos)} = {fb / len(pos):.2f} "
                 f"[{lo:.2f}–{hi:.2f}] | {prec} |")
    wrong = [c for c in d["cases"] if not c["ok"]]
    if wrong:
        L += ["", "### Wrong answers", "", "| Case | Chose | p |", "|---|---|---|"]
        for c in wrong:
            L.append(f"| {c['id']} | {c['choice']} | {'' if not c['choice'] else round(c['p'][c['choice']], 3)} |")
    return L


def main(a):
    if a == ["--check-cases"]:
        return 1 if check_cases() else 0
    keys = ["optiq", "qwen3.8-27b-optiq-4bit"]
    if "--models" in a:
        keys = a[a.index("--models") + 1].split(",")
    if a[:1] == ["all"]:
        if check_cases():
            return 1
        stamp = a[a.index("--stamp") + 1] if "--stamp" in a else time.strftime("%Y%m%d-%H%M%S")
        np = os.environ.get("BENCH_NAV_PILOT") or DL.newest_binary()
        backup = Path(os.environ["LIMITS_BACKUP"])
        marker = Path(os.environ["LIMITS_MARKER"])
        # ponytail: reuse _decide_limits.serve_and_run by pointing its re-exec at this file and its output at
        # a scratch dir; copy it here if that function's shape changes.
        DL.__file__ = __file__
        DL.BENCH = ROOT / ".bench-logs" / f"decide-why-{stamp}"
        DL.BENCH.mkdir(parents=True, exist_ok=True)
        rcs, docs = {}, []
        for key in keys:
            print(f"=== decide-why {key} · nav-pilot {Path(np).name}", flush=True)
            rcs[key] = DL.serve_and_run(key, np, stamp, backup, marker)
            src = DL.BENCH / f"decide-limits-{key}-{stamp}.json"
            if src.exists():
                dst = ROOT / "bench" / f"decide-why-{key}-{stamp}.json"
                shutil.move(src, dst)
                docs.append(json.loads(dst.read_text()))
        if docs:
            md = ROOT / "bench" / f"decide-why-{stamp}.md"
            md.write_text(summary(docs))
            print(f"✓ summary: {md}")
        print(f"=== decide-why done: {rcs}")
        return 0 if all(v == 0 for v in rcs.values()) else 1
    if len(a) == 3 and a[0] == "run":
        run(a[1], a[2]); return 0
    if len(a) >= 3 and a[0] == "summary":
        Path(a[1]).write_text(summary([json.loads(Path(f).read_text()) for f in a[2:]])); return 0
    sys.exit(__doc__)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
