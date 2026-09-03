#!/usr/bin/env python3
"""Recompute the cheap-ops comparison from the result files.

Every figure MODELS.md quotes for this suite comes out of here. A number in a
report that this cannot produce is a number one of the two got wrong.

The one thing this refuses to do is compare across harness generations. Fifty
result files sit in bench/ from three of them, and the first published gap,
5.75 against 3.40, came from runs where the sandbox had never granted the build
tools and no model could compile anything. Runs carry a harness_sha now.
Older files predate the stamp, so their generation is read from the run tag in
the table below, which is written down rather than inferred.
"""
import argparse
import glob
import itertools
import json
import pathlib
import statistics as st
from math import comb

ROOT = pathlib.Path(__file__).resolve().parents[1]

# Run-tag prefix -> (generation, what changed). Only for files written before
# harness_sha existed. A tag that is not listed is "unknown", and unknown never
# joins a comparison.
GENERATIONS = {
    "20260901": ("broken", "sandbox granted no build tools; no model could compile or test"),
    "20260902-005446": ("broken", "same sandbox; also two queues sharing one port"),
    # Its own generation, 19 seconds after the four fixes landed. It has git
    # hiding but not the placeholder, so a git command inside that workspace
    # resolved to mlx-workspace instead of failing, and mlx-workspace contains
    # bench/tasks.json. The eleven transcripts show the agent never ran git, so
    # nothing leaked in fact. It is still not the same experiment as gen3.
    "20260902-081512": ("gen2b", "four fixes in, .git hidden by rename with no placeholder"),
    "20260902": ("gen2", "toolchain granted, target pinned to one commit"),
    "20260903-013814": ("gen3-void", "git hidden, D2 retired. VOID: the default arm's workspace held "
                        "committed solution files, and G2 could not pass on any run"),
}


def parse_name(path):
    """(profile, tag) from bench/results-<profile>[-<stamp>-<nn>].json."""
    stem = pathlib.Path(path).stem[len("results-"):]
    parts = stem.rsplit("-", 3)
    if len(parts) == 4 and parts[1].isdigit() and parts[2].isdigit() and parts[3].isdigit():
        return parts[0], f"{parts[1]}-{parts[2]}-{parts[3]}"
    return stem, ""


def generation(tag):
    for prefix, (gen, _) in GENERATIONS.items():
        if tag.startswith(prefix):
            return gen
    return "unknown"


def load():
    out = []
    for f in sorted(glob.glob(str(ROOT / "bench" / "results-*.json"))):
        try:
            d = json.load(open(f))
        except json.JSONDecodeError:
            continue
        if not isinstance(d, dict) or not d or not all(isinstance(v, dict) for v in d.values()):
            continue
        profile, tag = parse_name(f)
        shas = {v.get("harness_sha") for v in d.values() if v.get("harness_sha")}
        secs = [v["seconds"] for v in d.values() if v.get("seconds")]
        out.append({
            "file": pathlib.Path(f).name,
            "profile": profile,
            "tag": tag,
            # A stamped file speaks for itself. An older one is placed by its tag.
            "harness": (shas.pop() if len(shas) == 1 else generation(tag)),
            "tasks": len(d),
            "solved": sum(1 for v in d.values() if v.get("verified") is True),
            "judged": sum(1 for v in d.values() if v.get("verified") is not None),
            "median_seconds": round(st.median(secs), 1) if secs else None,
            "cap_hits": sum(1 for v in d.values() if v.get("timed_out")),
        })
    return out


def mannwhitney_two_sided(a, b):
    """Exact by enumeration. Returns (U for b over a, p, floor)."""
    def U(x, y):
        return sum((xi > yj) + 0.5 * (xi == yj) for xi in x for yj in y)

    obs = U(b, a)
    pool = a + b
    n1, n2 = len(b), len(a)
    centre = n1 * n2 / 2
    extreme = 0
    for pick in itertools.combinations(range(len(pool)), n1):
        s = set(pick)
        x = [pool[i] for i in range(len(pool)) if i in s]
        y = [pool[i] for i in range(len(pool)) if i not in s]
        if abs(U(x, y) - centre) >= abs(obs - centre):
            extreme += 1
    total = comb(n1 + n2, n1)
    return obs, extreme / total, 2 / total


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--harness", default="latest",
                    help="harness generation to report, or 'all'. Default: the newest one present.")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args()

    rows = load()
    harnesses = sorted({r["harness"] for r in rows})
    if args.harness == "latest":
        named = {"broken", "gen2", "gen2b", "gen3", "gen4", "unknown"}
        stamped = sorted({r["harness"] for r in rows if r["harness"] not in named})
        want = stamped[-1:] or ["gen3"]
    elif args.harness == "all":
        want = harnesses
    else:
        want = [args.harness]

    report = {"harnesses_present": harnesses, "reported": want, "arms": {}, "runs": rows}
    for h in want:
        arms = {}
        for r in rows:
            if r["harness"] == h:
                arms.setdefault(r["profile"], []).append(r)
        report["arms"][h] = {
            p: {"n": len(v), "solved": [x["solved"] for x in v],
                "mean": round(st.mean([x["solved"] for x in v]), 2),
                "median": st.median([x["solved"] for x in v]),
                "median_seconds": st.median([x["median_seconds"] for x in v if x["median_seconds"]]) or None,
                "cap_hits": sum(x["cap_hits"] for x in v),
                "tags": [x["tag"] for x in v]}
            for p, v in sorted(arms.items())}
        pair = sorted(arms)
        if len(pair) == 2:
            a = [x["solved"] for x in arms[pair[0]]]
            b = [x["solved"] for x in arms[pair[1]]]
            u, p, floor = mannwhitney_two_sided(a, b)
            report["arms"][h]["_test"] = {
                "a": pair[0], "b": pair[1], "U": u, "p": round(p, 4),
                "floor": round(floor, 4), "arrangements": comb(len(a) + len(b), len(b))}

    if args.json:
        print(json.dumps(report, indent=2))
        return

    for h in want:
        print(f"\nharness {h}")
        block = report["arms"][h]
        for profile, s in block.items():
            if profile == "_test":
                continue
            print(f"  {profile:<28} n={s['n']}  solved={s['solved']}  "
                  f"mean={s['mean']:.2f}  median={s['median']}  "
                  f"median task {s['median_seconds']}s  cap hits {s['cap_hits']}")
        t = block.get("_test")
        if t:
            verdict = ("separates the arms" if t["p"] < 0.05
                       else "cannot separate the arms")
            print(f"  exact two-sided Mann-Whitney: U={t['U']:g}  p={t['p']}  "
                  f"(floor {t['floor']}, {t['arrangements']} arrangements)")
            print(f"  {verdict} at 0.05. A p above the floor is what this design can say, "
                  f"not what is true.")
        elif len(block) != 1:
            print("  no test: a comparison needs exactly two arms in one harness generation")
    print()


if __name__ == "__main__":
    main()
