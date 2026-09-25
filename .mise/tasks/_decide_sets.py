#!/usr/bin/env python3
"""`nav-pilot alpha decide` on the recipe questions with labelled sets (pending-tasks §8.5): issue type
(bug/feature/question), Aksel issue kind (five classes) and whether a PR description explains why.
Cases and labels: bench/decide-cases/README.md.

  all [--models a,b] [--sets s,t] [--stamp S]  every model in turn, np-serve's server lifecycle from
                                               _decide_limits. Called by `mise run bench-decide-sets`,
                                               which holds the queue lock.
  run <key> <out.json>                         every case against the server already up (NP_PORT, NP_MODEL,
                                               BENCH_NAV_PILOT, DECIDE_SETS)
  summary <out.md> <in.json>...                the markdown summary for one or more result files
  --check-cases                                every set is valid and balanced
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import _decide as D            # noqa: E402  read only: decide()
import _decide_limits as DL    # noqa: E402  read only: one(), wilson(), pct(), cell(), serve_and_run(), MODELS

CASES = ROOT / "bench" / "decide-cases"
SETS = ("issue-type", "aksel-kind", "pr-motivation")
THRESHOLDS = (0.5, 0.7, 0.8, 0.9, 0.95, 0.99)
TITLES = {"issue-type": "Is this issue a bug, a feature request or a question?",
          "aksel-kind": "Which of five kinds is this Aksel issue?",
          "pr-motivation": "Does the PR description explain why the change is needed?"}


def cases(s):
    return [json.loads(l) for l in (CASES / f"{s}.jsonl").read_text().splitlines() if l.strip()]


def check_cases(sets=SETS):
    bad = 0
    for s in sets:
        rows = cases(s)
        for r in rows:
            if not (r["set"] == s and r["expect"] in r["options"] and 0 < len(r["evidence"]) <= 8000
                    and not any("," in o for o in r["options"]) and r["meta"].get("lang") in ("en", "no")):
                print(f"✗ {s} {r.get('id')}"); bad += 1
        n = Counter(r["expect"] for r in rows)
        if s == "pr-motivation":
            k = Counter(r["meta"]["construction"] for r in rows)
            ok = n["yes"] == n["no"] == k["real-what"] + k["controlled"] and k["real-why"] == n["yes"]
        else:
            ok = len(set(n.values())) == 1 and set(n) == set(rows[0]["options"])
        bad += not ok
        print(f"{'✓' if ok else '✗'} {s}.jsonl: {len(rows)} cases {dict(n)}")
    return bad


def on_battery():
    return "Battery Power" in subprocess.run(["pmset", "-g", "batt"], capture_output=True, text=True).stdout


def run(key, out):
    import _np_checks as C
    np, port, model = os.environ["BENCH_NAV_PILOT"], os.environ["NP_PORT"], os.environ["NP_MODEL"]
    sets = os.environ.get("DECIDE_SETS", ",".join(SETS)).split(",")
    rev = subprocess.run(["go", "version", "-m", np], capture_output=True, text=True).stdout
    doc = {"key": key, "model": model, "nav_pilot": np, "sets": sets,
           "nav_pilot_commit": (re.search(r"vcs.revision=(\w+)", rev) or [None, None])[1],
           "started": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "cases": [], "eval": {}}
    first = cases(sets[0])[0]
    t0 = time.time()
    d, wall = D.decide(np, first["question"], first["options"], first["evidence"], timeout="300s")
    doc["cold"] = {"ms": d["ms"], "wall_s": wall}
    with C.post(port, {"model": model, "max_tokens": 16, "messages": [
            {"role": "user", "content": "Reply with exactly: OK"}]}) as resp:
        doc["sanity"] = (json.load(resp)["choices"][0]["message"].get("content") or "").strip()
    DL.save(out, doc)
    if "OK" not in doc["sanity"]:
        raise SystemExit(f"✗ server answered {doc['sanity']!r} to the sanity prompt — refusing to measure")
    for s in sets:
        for r in cases(s):
            rec = DL.one(np, r)
            m = r["meta"]
            rec.update(lang=m["lang"], repo=m["repo"], number=m["number"], construction=m.get("construction"))
            doc["cases"].append(rec)
        print(f"  {key} {s}: {DL.cell([c for c in doc['cases'] if c['set'] == s])}", flush=True)
        DL.save(out, doc)
    # nav-pilot's own totals on the same files: the command a reader would run.
    for s in sets:
        p = subprocess.run([np, "alpha", "decide", "--eval", str(CASES / f"{s}.jsonl"), "--json", "--timeout",
                            DL.TIMEOUT], capture_output=True, text=True)
        try:
            doc["eval"][s] = json.loads(p.stdout)
        except ValueError:
            doc["eval"][s] = {"error": f"exit {p.returncode}: {(p.stderr or p.stdout).strip()[-300:]}"}
        DL.save(out, doc)
    doc["finished"], doc["seconds"] = time.strftime("%Y-%m-%dT%H:%M:%S%z"), round(time.time() - t0)
    DL.save(out, doc)
    print(f"✓ {key}: {out}", flush=True)


def pchoice(c):
    return c["p"][c["choice"]] if c["choice"] else 0.0


def ev_cell(e):
    return f"{e['correct']}/{e['cases']} = {e['accuracy']:.2f}" if "accuracy" in e else e.get("error", "–")[:60]


def summary(docs):
    sets = [s for s in SETS if any(c["set"] == s for d in docs for c in d["cases"])]
    L = ["# `nav-pilot alpha decide` on the recipe questions (pending-tasks §8.5)", "",
         "Cases and labels: [decide-cases/README.md](decide-cases/README.md). Cells are correct/n = accuracy "
         "[95% Wilson]. An errored call counts as wrong.", "",
         "| Model | nav-pilot | Calls | Errors | Wall time | Cold decide |", "|---|---|---|---|---|---|"]
    for d in docs:
        L.append(f"| {d['key']} (`{d['model']}`) | `{Path(d['nav_pilot']).name}` ({d.get('nav_pilot_commit')}) | "
                 f"{len(d['cases'])} | {sum(c['error'] is not None for c in d['cases'])} | {d.get('seconds', '?')} s | "
                 f"{d.get('cold', {}).get('ms')} ms |")
    for s in sets:
        L += set_section(s, [(d, [c for c in d["cases"] if c["set"] == s]) for d in docs])
    return "\n".join(L) + "\n"


def set_section(s, runs):
    rows = cases(s)
    opts = rows[0]["options"]
    L = ["", f"## {s}: {TITLES[s]}", "", f"*{rows[0]['question']}* Options: {', '.join(f'`{o}`' for o in opts)}. "
         f"{len(rows)} cases.", "", "### Accuracy", "", "| | " + " | ".join(d["key"] for d, _ in runs) + " |",
         "|---|" + "---|" * len(runs)]
    filt = [("All", lambda c: True), ("Norwegian text", lambda c: c["lang"] == "no"),
            ("English text", lambda c: c["lang"] == "en")]
    filt += [(f"expect `{o}` (recall)", lambda c, o=o: c["expect"] == o) for o in opts]
    if s == "pr-motivation":
        filt += [(f"{k}", lambda c, k=k: c["construction"] == k) for k in ("real-why", "real-what", "controlled")]
    for name, f in filt:
        L.append(f"| {name} | " + " | ".join(DL.cell([c for c in cs if f(c)]) for _, cs in runs) + " |")
    for o in opts:
        L.append(f"| chose `{o}` (precision) | " + " | ".join(
            DL.cell([c for c in cs if c["choice"] == o]) for _, cs in runs) + " |")
    L.append("| p50 / p95 ms per call | " + " | ".join(
        f"{DL.pct([c['ms'] for c in cs], .5)} / {DL.pct([c['ms'] for c in cs], .95)}" for _, cs in runs) + " |")
    L.append("| `--eval` (nav-pilot's totals) | " + " | ".join(ev_cell(d["eval"].get(s, {})) for d, _ in runs) + " |")
    for d, cs in runs:
        L += model_section(s, opts, d, cs)
    return L


def model_section(s, opts, d, cs):
    L = ["", f"### {s} · {d['key']}", "", "Confusion (rows: expected, columns: chosen; `–` = error)", "",
         "| | " + " | ".join(f"`{o}`" for o in opts) + " | – |", "|---|" + "---|" * (len(opts) + 1)]
    for e in opts:
        L.append(f"| `{e}` | " + " | ".join(str(sum(c["expect"] == e and c["choice"] == o for c in cs)) for o in opts)
                 + f" | {sum(c['expect'] == e and c['choice'] is None for c in cs)} |")
    L += ["", "Calibration (p of the chosen option)", "", "| p(choice) | n | Accuracy | Mean p |", "|---|---|---|---|"]
    for lo, hi in ((0.0, 0.5), (0.5, 0.7), (0.7, 0.9), (0.9, 0.99), (0.99, 1.0001)):
        b = [c for c in cs if c["choice"] and lo <= pchoice(c) < hi]
        mp = sum(map(pchoice, b)) / len(b) if b else None
        L.append(f"| {lo:.2f}–{min(hi, 1):.2f} | {len(b)} | {DL.cell(b)} | {'–' if mp is None else f'{mp:.3f}'} |")
    L += ["", "Act only when p(choice) ≥ t, abstain otherwise", "",
          "| t | Answered | Accuracy of those |", "|---|---|---|"]
    for t in THRESHOLDS:
        a = [c for c in cs if c["choice"] and pchoice(c) >= t]
        L.append(f"| {t} | {len(a)}/{len(cs)} = {len(a) / len(cs):.2f} | {DL.cell(a)} |")
    if s == "pr-motivation":
        L += ["", "As a PR check: flag when p(no) ≥ t. Caught = descriptions without a why that it flags; wrongly "
              "flagged = descriptions that do explain why.", "",
              "| t | Caught (of no-why) | Wrongly flagged (of real-why) | Precision of a flag |", "|---|---|---|---|"]
        neg = [c for c in cs if c["expect"] == "no"]
        pos = [c for c in cs if c["expect"] == "yes"]
        for t in THRESHOLDS:
            flag = lambda c: c["choice"] is not None and c["p"]["no"] >= t   # noqa: E731
            k, fb = sum(map(flag, neg)), sum(map(flag, pos))
            lo, hi = DL.wilson(fb, len(pos))
            prec = f"{k}/{k + fb} = {k / (k + fb):.2f}" if k + fb else "–"
            L.append(f"| {t} | {k}/{len(neg)} = {k / len(neg):.2f} | {fb}/{len(pos)} = {fb / len(pos):.2f} "
                     f"[{lo:.2f}–{hi:.2f}] | {prec} |")
    wrong = [c for c in cs if not c["ok"]]
    if wrong:
        L += ["", "Wrong answers", "", "| Case | Expected | Chose | p |", "|---|---|---|---|"]
        for c in wrong:
            link = f"[{c['id']}](https://github.com/{c['repo']}/{'pull' if s == 'pr-motivation' else 'issues'}/{c['number']})"
            L.append(f"| {link} | {c['expect']} | {c['choice'] or 'error'} | "
                     f"{'' if not c['choice'] else round(pchoice(c), 3)} |")
    return L


def main(a):
    sets = a[a.index("--sets") + 1].split(",") if "--sets" in a else list(SETS)
    if a[:1] == ["--check-cases"]:
        return 1 if check_cases(sets) else 0
    keys = a[a.index("--models") + 1].split(",") if "--models" in a else ["optiq", "qwen3.8-27b-optiq-4bit"]
    if a[:1] == ["all"]:
        if check_cases(sets):
            return 1
        stamp = a[a.index("--stamp") + 1] if "--stamp" in a else time.strftime("%Y%m%d-%H%M%S")
        np = os.environ.get("BENCH_NAV_PILOT") or DL.newest_binary()
        backup = Path(os.environ["LIMITS_BACKUP"])
        marker = Path(os.environ["LIMITS_MARKER"])
        os.environ["DECIDE_SETS"] = ",".join(sets)
        # ponytail: reuse _decide_limits.serve_and_run by pointing its re-exec at this file and its output at
        # a scratch dir, as _decide_why does; copy it here if that function's shape changes.
        DL.__file__ = __file__
        DL.BENCH = ROOT / ".bench-logs" / f"decide-sets-{stamp}"
        DL.BENCH.mkdir(parents=True, exist_ok=True)
        DL.MODEL_TIMEOUT_S = 90 * 60   # 218 cases plus the --eval pass, twice decide-why's size
        rcs, docs = {}, []
        for key in keys:
            while on_battery():
                print("… on battery, waiting for AC before starting the server", flush=True)
                time.sleep(60)
            print(f"=== decide-sets {key} · nav-pilot {Path(np).name} · {sets}", flush=True)
            rcs[key] = DL.serve_and_run(key, np, stamp, backup, marker)
            src = DL.BENCH / f"decide-limits-{key}-{stamp}.json"
            if src.exists():
                dst = ROOT / "bench" / f"decide-sets-{key}-{stamp}.json"
                shutil.move(src, dst)
                docs.append(json.loads(dst.read_text()))
        if docs:
            md = ROOT / "bench" / f"decide-sets-{stamp}.md"
            md.write_text(summary(docs))
            print(f"✓ summary: {md}")
        print(f"=== decide-sets done: {rcs}")
        return 0 if all(v == 0 for v in rcs.values()) else 1
    if len(a) == 3 and a[0] == "run":
        run(a[1], a[2]); return 0
    if len(a) >= 3 and a[0] == "summary":
        Path(a[1]).write_text(summary([json.loads(Path(f).read_text()) for f in a[2:]])); return 0
    sys.exit(__doc__)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
