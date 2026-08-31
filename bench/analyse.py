#!/usr/bin/env python3
"""Statistics for reports/local-inference-findings.md, so the numbers can be rechecked.

The report quotes medians and p values. Those were computed here rather than by hand, and
this file exists so a reader can run it rather than trust the prose. Exact enumeration
rather than a normal approximation, because n is small enough that the approximation and
the exact test disagree in the third decimal, and the report quotes three.
"""
import glob
import itertools
import json
import statistics as st
from math import comb


def valid(path):
    return [x for x in json.load(open(path))["samples"] if x.get("valid")]


def priced(samples):
    return [x["cloud_cost_usd"] for x in samples if x.get("cloud_cost_usd") is not None]


def mannwhitney_exact(a, b):
    """One-sided P(cost in a < cost in b) by enumeration. Returns (U, p)."""
    u = sum((x < y) + 0.5 * (x == y) for x in a for y in b)
    n1, n2 = len(a), len(b)
    pooled = [(v, 0) for v in a] + [(v, 1) for v in b]
    ge = 0
    total = comb(n1 + n2, n1)
    for pick in itertools.combinations(range(n1 + n2), n1):
        s = set(pick)
        xa = [pooled[i][0] for i in range(n1 + n2) if i in s]
        xb = [pooled[i][0] for i in range(n1 + n2) if i not in s]
        if sum((x < y) + 0.5 * (x == y) for x in xa for y in xb) >= u:
            ge += 1
    return u, ge / total


def fisher_one_sided(a, b, c, d):
    """P(X >= a) for the 2x2 table [[a,b],[c,d]]."""
    n, r1, c1 = a + b + c + d, a + b, a + c
    return sum(comb(r1, k) * comb(n - r1, c1 - k) / comb(n, c1)
               for k in range(a, min(r1, c1) + 1))


def main():
    print("Table 1, opencode")
    for rung in (1, 2, 3, 6):
        h, c = valid(f"bench/hybrid-{rung}-hybrid.json"), valid(f"bench/hybrid-{rung}-control.json")
        ph, pc = priced(h), priced(c)
        line = (f"  task {rung}: delegated {sum(1 for x in h if x['local_calls'])}/{len(h)}"
                f"  hybrid ${st.median(ph):.3f} (n={len(ph)})"
                f"  control ${st.median(pc):.3f} (n={len(pc)})"
                f"  ratio {st.median(pc)/st.median(ph):.2f}")
        if rung in (3, 6):
            u, p = mannwhitney_exact(ph, pc)
            line += f"  U={u:g} p={p:.4f}"
        print(line)

    print("Table 4, prompt intervention")
    for rung in (4, 5):
        before = valid(f"bench/hybrid-{rung}-hybrid-oldfragment.json")
        after = valid(f"bench/hybrid-{rung}-hybrid.json")
        db = sum(1 for x in before if x["local_calls"])
        da = sum(1 for x in after if x["local_calls"])
        p = fisher_one_sided(da, len(after) - da, db, len(before) - db)
        print(f"  task {rung}: before {db}/{len(before)}  after {da}/{len(after)}  Fisher p={p:.3f}")

    print("\n§7.2 Spring, rung 6")
    try:
        h = valid("bench/hybrid-spring-ia-tjenester-metrikker-6-hybrid.json")
        c = valid("bench/hybrid-spring-ia-tjenester-metrikker-6-control.json")
        ph, pc = priced(h), priced(c)
        # One-sided the other way: on Spring the question is whether hybrid costs MORE.
        u = sum((x > y) + 0.5 * (x == y) for x in ph for y in pc)
        ge, total = 0, comb(len(ph) + len(pc), len(ph))
        pooled = ph + pc
        for pick in itertools.combinations(range(len(pooled)), len(ph)):
            sset = set(pick)
            xa = [pooled[i] for i in range(len(pooled)) if i in sset]
            xb = [pooled[i] for i in range(len(pooled)) if i not in sset]
            if sum((x > y) + 0.5 * (x == y) for x in xa for y in xb) >= u:
                ge += 1
        print(f"  hybrid ${st.median(ph):.3f} (n={len(ph)})  control ${st.median(pc):.3f} (n={len(pc)})"
              f"  ratio {st.median(ph)/st.median(pc):.2f}x dearer  p={ge/total:.4f}")
        print(f"  verified {sum(1 for x in h if x['verified'])}/{len(h)} and "
              f"{sum(1 for x in c if x['verified'])}/{len(c)}")
    except FileNotFoundError as e:
        print(f"  missing: {e.filename}")

    print("\n§7.3 the predictor: ratio against the control arm's step count")
    # Four paired experiments, each within one codebase. The claim is not that
    # they measure the same task, it is that the ratio orders by how many steps
    # the cloud-only arm needed.
    points = [
        ("Ktor, rung 6", "bench/hybrid-6-hybrid.json", "bench/hybrid-6-control.json"),
        ("Frontend, rung 3", "bench/hybrid-frontend-familie-tilbake-3-hybrid.json",
         "bench/hybrid-frontend-familie-tilbake-3-control.json"),
        ("Ktor, rung 3", "bench/hybrid-3-hybrid.json", "bench/hybrid-3-control.json"),
        ("Spring, rung 6", "bench/hybrid-spring-ia-tjenester-metrikker-6-hybrid.json",
         "bench/hybrid-spring-ia-tjenester-metrikker-6-control.json"),
    ]
    rows = []
    for name, hp, cp in points:
        try:
            h, c = valid(hp), valid(cp)
        except FileNotFoundError as e:
            print(f"  {name}: missing {e.filename}")
            continue
        steps = st.median([x.get("cloud_steps") or 0 for x in c])
        ratio = st.median(priced(h)) / st.median(priced(c))
        rows.append((name, steps, ratio, len(h), len(c)))
        print(f"  {name:18} control steps {steps:5.0f}  ratio {ratio:.2f}  (n={len(h)}+{len(c)})")
    if len(rows) > 1:
        ordered = sorted(rows, key=lambda r: -r[1])
        monotone = all(ordered[i][2] <= ordered[i + 1][2] for i in range(len(ordered) - 1))
        print(f"  ordered by step count, ratio is {'monotone' if monotone else 'NOT monotone'}")

    print("\n§7.1 worker instruction language, rung 6 and the two that never delegate")
    for name, path in (("English rung 6", "bench/language-6-en.json"),
                       ("English rung 4", "bench/language-4-en.json"),
                       ("English rung 5", "bench/language-5-en.json")):
        try:
            s_ = valid(path)
        except FileNotFoundError:
            print(f"  {name}: missing {path}")
            continue
        print(f"  {name}: n={len(s_)} delegated {sum(1 for x in s_ if x['local_calls'])} "
              f"verified {sum(1 for x in s_ if x['verified'])}")

    v = ver = 0
    for f in glob.glob("bench/hybrid-*.json") + glob.glob("bench/copilot-*.json") + glob.glob("bench/refactor-*.json") + glob.glob("bench/language-*.json"):
        d = json.load(open(f))
        if "samples" not in d:
            continue
        s = [x for x in d["samples"] if x.get("valid")]
        v += len(s)
        ver += sum(1 for x in s if x.get("verified"))
    print(f"\ntotals: {v} valid, {ver} verified")


if __name__ == "__main__":
    main()
