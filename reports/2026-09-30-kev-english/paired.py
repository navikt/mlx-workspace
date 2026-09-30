#!/usr/bin/env python3
"""Paired figures in report.md: Kev - optiq on English triage (Newcombe's method 10 for paired
proportions), answers at p >= 0.9, and the pooled injection flip rate. Any python 3, from the repo root:
    python3 reports/2026-09-30-kev-english/paired.py"""
import json, math

B = "bench/"


def wilson(k, n, z=1.959964):
    if n == 0:
        return 0.0, 1.0
    p, d = k / n, 1 + z * z / n
    c, h = p + z * z / (2 * n), z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (c - h) / d, (c + h) / d


def newcombe(pairs):  # [(ok1, ok2)]: p1 - p2 with its 95 % interval
    n = len(pairs)
    a = sum(x and y for x, y in pairs); b = sum(x and not y for x, y in pairs)
    c = sum(y and not x for x, y in pairs); d = n - a - b - c
    p1, p2 = (a + b) / n, (a + c) / n
    (l1, u1), (l2, u2) = wilson(a + b, n), wilson(a + c, n)
    den = (a + b) * (c + d) * (a + c) * (b + d)
    phi = (a * d - b * c) / math.sqrt(den) if den else 0.0
    dl = math.sqrt(max(0, (p1 - l1) ** 2 - 2 * phi * (p1 - l1) * (u2 - p2) + (u2 - p2) ** 2))
    du = math.sqrt(max(0, (u1 - p1) ** 2 - 2 * phi * (u1 - p1) * (p2 - l2) + (p2 - l2) ** 2))
    t = p1 - p2
    return f"n {n}: both {a}, Kev only {b}, optiq only {c}, neither {d}; {t * 100:+.1f} [{(t - dl) * 100:+.1f}, {(t + du) * 100:+.1f}] points"


def cases(f):
    return json.load(open(B + f))["cases"]


kev = [c for c in cases("decide-sets-kev-4b-8bit-20260930-084038.json")
       if c["lang"] == "en" and c["set"] in ("issue-type", "issue-type-en")]
opt = [c for c in cases("decide-sets-optiq-20260925-225356.json") if c["lang"] == "en" and c["set"] == "issue-type"] \
    + cases("decide-sets-optiq-20260930-084531.json")
K, O = {c["id"]: c for c in kev}, {c["id"]: c for c in opt}
assert set(K) == set(O), set(K) ^ set(O)
print("English triage, Kev - optiq:", newcombe([(K[i]["ok"], O[i]["ok"]) for i in K]))
for s in ("issue-type", "issue-type-en"):
    print(f"  {s}:", newcombe([(K[i]["ok"], O[i]["ok"]) for i in K if K[i]["set"] == s]))

for t in (0.9, 0.95):
    for name, cs in (("Kev", kev), ("optiq", opt)):
        ans = [c for c in cs if c["p"] and c["p"][c["choice"]] >= t]
        r = sum(c["ok"] for c in ans); lo, _ = wilson(r, len(ans))
        print(f"p >= {t} {name}: {r}/{len(ans)} right, Wilson low {lo:.3f}, {len(ans) - r} wrong "
              f"= {50 * (len(ans) - r) / max(1, len(ans)):.1f} per 50, coverage {len(ans)}/{len(cs)} = {len(ans) / len(cs):.2f}")


def flips(f):  # flip = the injected twin chose the injected answer, among pairs whose clean case was right
    inj = [c for c in cases(f) if c["set"] == "injection"]
    clean = {c["base"]: c for c in inj if c["variant"] == "clean"}
    return {c["id"]: (c["choice"] == c["target"], c["variant"]) for c in inj
            if c["variant"] != "clean" and clean[c["base"]]["ok"]}


kf, of = flips("decide-limits-kev-4b-8bit-20260930-084038.json"), flips("decide-limits-optiq-20260925-014512.json")
for v in sorted({v for _, v in kf.values()}):
    print(f"  {v}: Kev {sum(f for f, w in kf.values() if w == v)}/{sum(w == v for _, w in kf.values())}, "
          f"optiq {sum(f for f, w in of.values() if w == v)}/{sum(w == v for _, w in of.values())}")
print(f"injection flips pooled: Kev {sum(f for f, _ in kf.values())}/{len(kf)}, optiq {sum(f for f, _ in of.values())}/{len(of)}")
both = sorted(set(kf) & set(of))
print("  paired, both clean right, Kev - optiq:", newcombe([(kf[i][0], of[i][0]) for i in both]))
