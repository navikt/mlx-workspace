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
import pathlib
import statistics as st
from math import comb

def write_step_count_figure(rows, out="reports/figures/step-count.svg"):
    """Draw §7.3 as an SVG, from the same rows the table is printed from.

    Hand-written SVG rather than a plotting library: the repo has no matplotlib,
    a figure that needs a dependency stops being regenerated, and an SVG diffs
    as text so a changed number shows up in review rather than as an opaque
    binary blob.

    The x axis is the control arm's median step count and the y axis is the
    delegation ratio. The line at y=1 is the only part that matters to a
    decision: below it delegation saves money, above it costs.
    """
    if len(rows) < 2:
        return
    path = pathlib.Path(out)
    path.parent.mkdir(parents=True, exist_ok=True)

    W, H = 640, 360
    L, R, T, B = 70, 24, 28, 52          # margins
    pw, ph = W - L - R, H - T - B
    xmax = max(r[1] for r in rows) * 1.15
    ymax = max(max(r[2] for r in rows), 1.0) * 1.2

    def px(v):
        return L + (v / xmax) * pw

    def py(v):
        return T + ph - (v / ymax) * ph

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
        f'font-family="system-ui,-apple-system,sans-serif" font-size="12">',
        f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
        # break-even: at 1.0 delegation costs exactly what the cloud costs alone
        f'<line x1="{L}" y1="{py(1.0):.1f}" x2="{L+pw}" y2="{py(1.0):.1f}" '
        f'stroke="#c2410c" stroke-width="1" stroke-dasharray="5 4"/>',
        f'<text x="{L+pw:.0f}" y="{py(1.0)-7:.1f}" text-anchor="end" fill="#c2410c">'
        f'break-even: dispatch costs what the cloud costs alone</text>',
        # axes
        f'<line x1="{L}" y1="{T}" x2="{L}" y2="{T+ph}" stroke="#94a3b8"/>',
        f'<line x1="{L}" y1="{T+ph}" x2="{L+pw}" y2="{T+ph}" stroke="#94a3b8"/>',
    ]
    for v in (0.5, 1.0, 1.5, 2.0):
        if v <= ymax:
            parts.append(f'<text x="{L-8}" y="{py(v)+4:.1f}" text-anchor="end" fill="#475569">{v:.1f}x</text>')
    for v in (0, 5, 10, 15, 20):
        if v <= xmax:
            parts.append(f'<text x="{px(v):.1f}" y="{T+ph+18}" text-anchor="middle" fill="#475569">{v}</text>')

    ordered = sorted(rows, key=lambda r: r[1])
    pts = " ".join(f"{px(r[1]):.1f},{py(r[2]):.1f}" for r in ordered)
    parts.append(f'<polyline points="{pts}" fill="none" stroke="#1d4ed8" stroke-width="1.5" opacity="0.45"/>')
    for name, steps, ratio, nh, nc in ordered:
        cx, cy = px(steps), py(ratio)
        colour = "#15803d" if ratio < 1 else "#b91c1c"
        parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="5" fill="{colour}"/>')
        anchor_ = "start" if steps < xmax * 0.6 else "end"
        dx = 10 if anchor_ == "start" else -10
        parts.append(f'<text x="{cx+dx:.1f}" y="{cy+4:.1f}" text-anchor="{anchor_}" fill="#0f172a">'
                     f'{name} — {ratio:.2f}x</text>')

    parts.append(f'<text x="{L+pw/2:.0f}" y="{H-12}" text-anchor="middle" fill="#0f172a">'
                 f'steps the cloud-only arm needed</text>')
    parts.append(f'<text x="16" y="{T+ph/2:.0f}" text-anchor="middle" fill="#0f172a" '
                 f'transform="rotate(-90 16 {T+ph/2:.0f})">cost with dispatch ÷ without</text>')
    parts.append("</svg>")
    path.write_text("\n".join(parts) + "\n")
    print(f"  figure written: {out}")



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

    write_step_count_figure(rows)

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
