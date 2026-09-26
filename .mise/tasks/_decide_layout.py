#!/usr/bin/env python3
"""Two checks of `nav-pilot alpha decide` on the existing case sets, same server, same binary:

  layout       the evidence before the question and options (what nav-pilot ships) against the question and
               options first (NAV_PILOT_DECIDE_LAYOUT=options-first, a nav-pilot build from the unmerged
               navikt/copilot branch exp/decide-options-first). Sets: commit-explains-why EN+NO, issue-type,
               aksel-kind, pr-motivation, decide-limits length.
  consistency  on the yes/no sets (commit-explains-why EN+NO, pr-motivation, decide-limits describes and goapi),
               the default layout against (a) the options swapped and (b) the question negated, expect flipped.

  all [--models a,b] [--stamp S]   every model in turn, np-serve's server lifecycle from _decide_limits.
                                   `mise run bench-decide-layout` holds the queue lock around it.
  run <key> <out.json>             every arm against the server already up (NP_PORT, NP_MODEL, BENCH_NAV_PILOT)
  summary <out.md> <in.json>...    the markdown summary
  --selftest                       `run` and `summary` against _decide's fake server, real binary, 2 cases a set
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
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import _decide as D            # noqa: E402  read only: decide(), FAKE
import _decide_limits as DL    # noqa: E402  read only: one(), wilson(), pct(), cell(), serve_and_run()

FILES = {"why-en": "decide-cases/commit-explains-why.jsonl", "why-no": "decide-cases/commit-explains-why-no.jsonl",
         "issue-type": "decide-cases/issue-type.jsonl", "aksel-kind": "decide-cases/aksel-kind.jsonl",
         "pr-motivation": "decide-cases/pr-motivation.jsonl", "length": "decide-limits/length.jsonl",
         "describes": "decide-limits/describes.jsonl", "goapi": "decide-limits/goapi.jsonl"}
LAYOUT_SETS = ("why-en", "why-no", "issue-type", "aksel-kind", "pr-motivation", "length")
YESNO_SETS = ("why-en", "why-no", "pr-motivation", "describes", "goapi")
# The negated question for each yes/no set; the expected answer flips with it.
NEGATED = {
    "why-en": "Does the commit message fail to explain why the change was made, beyond describing what the diff "
              "already shows?",
    "why-no": "Unnlater commit-meldingen å forklare hvorfor endringen ble gjort, utover å beskrive det diffen "
              "allerede viser?",
    "pr-motivation": "Does this pull request description fail to explain why the change is needed?",
    "describes": "Does this commit message fail to describe the changes in this diff?",
    "goapi": "Does this diff leave every exported Go identifier alone, that is, it adds, removes and changes the "
             "signature of no func, method, type, const or var whose name starts with an upper-case letter?",
}
# Earlier runs of the same cases with the pinned main build: the default layout here should repeat them.
EARLIER = {"why-en": "decide-why-{k}-20260925-072116.json", "why-no": "decide-why-{k}-20260925-072116.json",
           "issue-type": "decide-sets-{k}-20260925-225356.json", "aksel-kind": "decide-sets-{k}-20260925-225356.json",
           "pr-motivation": "decide-sets-{k}-20260925-225356.json", "length": "decide-limits-{k}-20260925-014512.json"}
LIMIT = int(os.environ.get("DECIDE_LAYOUT_LIMIT", "0"))   # --selftest only


def cases(s):
    rows = [dict(json.loads(l), set=s) for l in (ROOT / "bench" / FILES[s]).read_text().splitlines() if l.strip()]
    return rows[:LIMIT] if LIMIT else rows


def call(np, r, arm):
    if arm == "options-first":
        os.environ["NAV_PILOT_DECIDE_LAYOUT"] = "options-first"
    elif arm == "swap":
        r = dict(r, options=r["options"][::-1])
    elif arm == "negate":
        r = dict(r, question=NEGATED[r["set"]], expect=next(o for o in r["options"] if o != r["expect"]))
    try:
        rec = DL.one(np, r)
    finally:
        os.environ.pop("NAV_PILOT_DECIDE_LAYOUT", None)
    rec["arm"] = arm
    return rec


def plan():
    """(set, arm) blocks in run order. The two layouts alternate which goes first per set, so a slow drift in
    the server (or the cloud run next to it) does not land on one layout only."""
    out = []
    for i, s in enumerate(LAYOUT_SETS):
        out += [(s, "default"), (s, "options-first")][::1 if i % 2 == 0 else -1]
    for s in YESNO_SETS:
        if s not in LAYOUT_SETS:
            out.append((s, "default"))
        out += [(s, "swap"), (s, "negate")]
    return out


def run(key, out):
    import _np_checks as C
    np, port, model = os.environ["BENCH_NAV_PILOT"], os.environ["NP_PORT"], os.environ["NP_MODEL"]
    m = re.search(r"-([0-9a-f]{8})$", np)
    doc = {"key": key, "model": model, "nav_pilot": np, "nav_pilot_commit": m and m[1],
           "started": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "cases": []}
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
    for s, arm in plan():
        recs = [call(np, r, arm) for r in cases(s)]
        doc["cases"] += recs
        print(f"  {key} {s} {arm}: {DL.cell(recs)}", flush=True)
        DL.save(out, doc)
    doc["finished"], doc["seconds"] = time.strftime("%Y-%m-%dT%H:%M:%S%z"), round(time.time() - t0)
    DL.save(out, doc)
    print(f"✓ {key}: {out}", flush=True)


# ── statistics ──────────────────────────────────────────────────────────────

def sign_p(b, c):
    """Exact two-sided McNemar (a sign test on the discordant pairs)."""
    n = b + c
    if n == 0:
        return 1.0
    tail = sum(math.comb(n, i) for i in range(min(b, c) + 1)) / 2 ** n
    return min(1.0, 2 * tail)


def arm(cs, s, a):
    return {c["id"]: c for c in cs if c["set"] == s and c["arm"] == a}


def pc(c):
    return c["p"][c["choice"]] if c["choice"] else 0.0


def calib(recs):
    L = []
    for lo, hi in ((0.5, 0.7), (0.7, 0.9), (0.9, 0.99), (0.99, 1.0001)):
        b = [c for c in recs if c["choice"] and lo <= pc(c) < hi]
        L.append(f"{len(b)}: {sum(c['ok'] for c in b)}/{len(b)}" if b else "0")
    return L


def lat(recs):
    return f"{DL.pct([c['ms'] for c in recs], .5)} / {DL.pct([c['ms'] for c in recs], .95)}"


def paired(a, b):
    ids = a.keys() & b.keys()
    bb = sum(a[i]["ok"] and not b[i]["ok"] for i in ids)   # default right, options-first wrong
    cc = sum(b[i]["ok"] and not a[i]["ok"] for i in ids)
    return len(ids), bb, cc


# ── summary ─────────────────────────────────────────────────────────────────

def summary(docs):
    L = ["# `nav-pilot alpha decide`: option order and consistency", "",
         "Layout: `default` is what nav-pilot ships (evidence, then question, options, instruction); `options-first` "
         "is question and options, then evidence, then the same instruction. Consistency: `swap` lists the options in "
         "reverse order; `negate` asks the negated question with the expected answer flipped. Cells are correct/n = "
         "accuracy [95% Wilson]; an errored call counts as wrong. Paired p is the exact two-sided McNemar test on "
         "the discordant cases (b = only default right, c = only options-first right).", "",
         "| Model | nav-pilot | Calls | Errors | Wall time | Cold decide |", "|---|---|---|---|---|---|"]
    for d in docs:
        L.append(f"| {d['key']} (`{d['model']}`) | `{Path(d['nav_pilot']).name}` | {len(d['cases'])} | "
                 f"{sum(c['error'] is not None for c in d['cases'])} | {d.get('seconds', '?')} s | "
                 f"{d.get('cold', {}).get('ms')} ms |")
    L += ["", "## Layout: evidence first (default) against options first", "",
          "| Model | Set | n | default | options-first | b / c | Paired p | p50 / p95 ms default | options-first |",
          "|---|---|---|---|---|---|---|---|---|"]
    for d in docs:
        cs = d["cases"]
        tot = [0, 0, 0]
        for s in LAYOUT_SETS:
            a, b = arm(cs, s, "default"), arm(cs, s, "options-first")
            n, bb, cc = paired(a, b)
            tot = [tot[0] + n, tot[1] + bb, tot[2] + cc]
            L.append(f"| {d['key']} | {s} | {n} | {DL.cell(list(a.values()))} | {DL.cell(list(b.values()))} | "
                     f"{bb} / {cc} | {sign_p(bb, cc):.3f} | {lat(a.values())} | {lat(b.values())} |")
        A = [c for c in cs if c["set"] in LAYOUT_SETS and c["arm"] == "default"]
        B = [c for c in cs if c["set"] in LAYOUT_SETS and c["arm"] == "options-first"]
        L.append(f"| {d['key']} | **all** | {tot[0]} | {DL.cell(A)} | {DL.cell(B)} | {tot[1]} / {tot[2]} | "
                 f"{sign_p(tot[1], tot[2]):.3f} | {lat(A)} | {lat(B)} |")
    L += ["", "### Evidence length and position (decide-limits `length`)", "",
          "| Model | Length | default | options-first | b / c | p50 ms default | options-first |", "|---|---|---|---|---|---|---|"]
    for d in docs:
        a, b = arm(d["cases"], "length", "default"), arm(d["cases"], "length", "options-first")
        for g in sorted({c["length"] for c in a.values()}, key=lambda x: float(x.rstrip("k"))):
            ga = {i: c for i, c in a.items() if c["length"] == g}
            gb = {i: c for i, c in b.items() if c["length"] == g}
            n, bb, cc = paired(ga, gb)
            L.append(f"| {d['key']} | {g} | {DL.cell(list(ga.values()))} | {DL.cell(list(gb.values()))} | {bb} / {cc} | "
                     f"{DL.pct([c['ms'] for c in ga.values()], .5)} | {DL.pct([c['ms'] for c in gb.values()], .5)} |")
        for w in ("early", "middle", "late"):
            ga = {i: c for i, c in a.items() if c["where"] == w}
            gb = {i: c for i, c in b.items() if c["where"] == w}
            n, bb, cc = paired(ga, gb)
            L.append(f"| {d['key']} | line {w} | {DL.cell(list(ga.values()))} | {DL.cell(list(gb.values()))} | "
                     f"{bb} / {cc} | | |")
    L += ["", "### Calibration: answered cases per band of p(choice), right/n", "",
          "| Model | Layout | 0.50–0.70 | 0.70–0.90 | 0.90–0.99 | 0.99–1 |", "|---|---|---|---|---|---|"]
    for d in docs:
        for a in ("default", "options-first"):
            L.append(f"| {d['key']} | {a} | " + " | ".join(calib(
                [c for c in d["cases"] if c["set"] in LAYOUT_SETS and c["arm"] == a])) + " |")
    L += ["", "### Default layout against the earlier runs with the pinned main build", "",
          "Same cases, same prompt bytes, different day: how many chose the same option.", "",
          "| Model | Set | Same choice | Earlier file |", "|---|---|---|---|"]
    for d in docs:
        for s in LAYOUT_SETS:
            f = ROOT / "bench" / EARLIER[s].format(k=d["key"])
            if not f.exists():
                continue
            old = {c["id"]: c for c in json.loads(f.read_text())["cases"]}
            new = arm(d["cases"], s, "default")
            ids = new.keys() & old.keys()
            L.append(f"| {d['key']} | {s} | {sum(new[i]['choice'] == old[i]['choice'] for i in ids)}/{len(ids)} | "
                     f"`{f.name}` |")
    L += ["", "## Consistency on the yes/no sets", "",
          "Agree = the variant gives the same answer (for `negate`, the opposite label). |Δp| = mean over cases of "
          "|p(yes | original) − p(no | negated)| (for `swap`, |p(yes) − p(yes | swapped)|); 0 is perfectly "
          "consistent. First-listed = share of answers that picked option A.", "",
          "| Model | Set | Original | Swapped | Negated | Agree swap | Agree negate | |Δp| swap | |Δp| negate | "
          "First-listed orig / swap |", "|---|---|---|---|---|---|---|---|---|---|"]
    for d in docs:
        for s in (*YESNO_SETS, "all"):
            ss = YESNO_SETS if s == "all" else (s,)
            o = {(c["set"], c["id"]): c for c in d["cases"] if c["set"] in ss and c["arm"] == "default"}
            w = {(c["set"], c["id"]): c for c in d["cases"] if c["set"] in ss and c["arm"] == "swap"}
            g = {(c["set"], c["id"]): c for c in d["cases"] if c["set"] in ss and c["arm"] == "negate"}
            ok = [k for k in o if k in w and k in g and o[k]["choice"] and w[k]["choice"] and g[k]["choice"]]
            if not ok:
                continue
            yes = lambda c: c["options"][0] if c["arm"] != "swap" else c["options"][1]   # noqa: E731
            no = lambda c: c["options"][1] if c["arm"] != "swap" else c["options"][0]    # noqa: E731
            ag_w = sum(o[k]["choice"] == w[k]["choice"] for k in ok)
            ag_g = sum((o[k]["choice"] == yes(o[k])) == (g[k]["choice"] == no(g[k])) for k in ok)
            dw = sum(abs(o[k]["p"][yes(o[k])] - w[k]["p"][yes(w[k])]) for k in ok) / len(ok)
            dg = sum(abs(o[k]["p"][yes(o[k])] - g[k]["p"][no(g[k])]) for k in ok) / len(ok)
            first = lambda cs: sum(c["choice"] == c["options"][0] for c in cs)   # noqa: E731
            lo_w, hi_w = DL.wilson(ag_w, len(ok))
            lo_g, hi_g = DL.wilson(ag_g, len(ok))
            L.append(f"| {d['key']} | {'**all**' if s == 'all' else s} | {DL.cell(list(o.values()))} | "
                     f"{DL.cell(list(w.values()))} | {DL.cell(list(g.values()))} | "
                     f"{ag_w}/{len(ok)} = {ag_w / len(ok):.2f} [{lo_w:.2f}–{hi_w:.2f}] | "
                     f"{ag_g}/{len(ok)} = {ag_g / len(ok):.2f} [{lo_g:.2f}–{hi_g:.2f}] | {dw:.3f} | {dg:.3f} | "
                     f"{first([o[k] for k in ok])} / {first([w[k] for k in ok])} of {len(ok)} |")
    L += ["", "### Answers that flip under a variant, per original answer", "",
          "| Model | Variant | Original yes → flips | Original no → flips | Flips that were right originally |",
          "|---|---|---|---|---|"]
    for d in docs:
        o = {(c["set"], c["id"]): c for c in d["cases"] if c["set"] in YESNO_SETS and c["arm"] == "default"}
        for v in ("swap", "negate"):
            x = {(c["set"], c["id"]): c for c in d["cases"] if c["set"] in YESNO_SETS and c["arm"] == v}
            ks = [k for k in o if k in x and o[k]["choice"] and x[k]["choice"]]
            flip = [k for k in ks if o[k]["ok"] != x[k]["ok"]]
            oy = [k for k in ks if o[k]["choice"] == o[k]["options"][0]]
            on = [k for k in ks if k not in oy]
            L.append(f"| {d['key']} | {v} | {len([k for k in flip if k in oy])}/{len(oy)} | "
                     f"{len([k for k in flip if k in on])}/{len(on)} | {sum(o[k]['ok'] for k in flip)}/{len(flip)} |")
    return "\n".join(L) + "\n"


# ── lifecycle and selftest ─────────────────────────────────────────────────

def on_battery():
    return "Battery Power" in subprocess.run(["pmset", "-g", "batt"], capture_output=True, text=True).stdout


def selftest():
    assert sign_p(0, 0) == 1.0 and abs(sign_p(0, 6) - 0.03125) < 1e-9 and abs(sign_p(3, 3) - 1.0) < 1e-9
    assert set(NEGATED) == set(YESNO_SETS) and all(cases(s) for s in FILES)
    np = os.environ.get("BENCH_NAV_PILOT") or DL.newest_binary()
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
            (t / ".nav-pilot" / "local").mkdir(parents=True)
            (t / ".nav-pilot" / "local" / "server.json").write_text(json.dumps(
                {"pid": srv.pid, "model": model, "port": int(port), "started": "2026-09-26T00:00:00Z", "lstart": lstart}))
            out = t / "layout.json"
            env = {**os.environ, "HOME": str(t), "BENCH_NAV_PILOT": np, "NP_PORT": port, "NP_MODEL": model,
                   "DECIDE_LAYOUT_LIMIT": "2"}
            r = subprocess.run([sys.executable, __file__, "run", "fake", str(out)], env=env, capture_output=True, text=True)
            print(r.stdout[-1500:], r.stderr[-1500:])
            assert r.returncode == 0
            doc = json.loads(out.read_text())
        finally:
            srv.kill()
    cs = doc["cases"]
    assert len(cs) == 2 * len(plan()) and not any(c["error"] for c in cs)
    assert all(c["choice"] == c["options"][0] for c in cs), "the fake always answers A"
    md = summary([doc])
    # Always-A: swap disagrees on every case, negate agrees exactly when the original said no (never, here).
    assert "| fake | **all** |" in md and "0/10 = 0.00" in md, md[md.find("## Consistency"):][:1200]
    print("✓ _decide_layout selftest passed")


def main(a):
    if a == ["--selftest"]:
        selftest(); return 0
    keys = a[a.index("--models") + 1].split(",") if "--models" in a else ["optiq", "qwen3.8-27b-optiq-4bit"]
    if a[:1] == ["all"]:
        stamp = a[a.index("--stamp") + 1] if "--stamp" in a else time.strftime("%Y%m%d-%H%M%S")
        np = os.environ.get("BENCH_NAV_PILOT") or DL.newest_binary()
        backup, marker = Path(os.environ["LIMITS_BACKUP"]), Path(os.environ["LIMITS_MARKER"])
        # ponytail: _decide_sets' reuse of _decide_limits.serve_and_run (re-exec of this file, scratch output dir).
        DL.__file__ = __file__
        DL.BENCH = ROOT / ".bench-logs" / f"decide-layout-{stamp}"
        DL.BENCH.mkdir(parents=True, exist_ok=True)
        DL.MODEL_TIMEOUT_S = 150 * 60
        rcs, docs = {}, []
        for key in keys:
            while on_battery():
                print("… on battery, waiting for AC before starting the server", flush=True)
                time.sleep(60)
            print(f"=== decide-layout {key} · nav-pilot {Path(np).name}", flush=True)
            rcs[key] = DL.serve_and_run(key, np, stamp, backup, marker)
            src = DL.BENCH / f"decide-limits-{key}-{stamp}.json"
            if src.exists():
                dst = ROOT / "bench" / f"decide-layout-{key}-{stamp}.json"
                shutil.move(src, dst)
                docs.append(json.loads(dst.read_text()))
        if docs:
            md = ROOT / "bench" / f"decide-layout-{stamp}.md"
            md.write_text(summary(docs))
            print(f"✓ summary: {md}")
        print(f"=== decide-layout done: {rcs}")
        return 0 if all(v == 0 for v in rcs.values()) else 1
    if len(a) == 3 and a[0] == "run":
        run(a[1], a[2]); return 0
    if len(a) >= 3 and a[0] == "summary":
        Path(a[1]).write_text(summary([json.loads(Path(f).read_text()) for f in a[2:]])); return 0
    sys.exit(__doc__)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
