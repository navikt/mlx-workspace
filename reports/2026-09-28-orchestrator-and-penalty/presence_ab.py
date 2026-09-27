#!/usr/bin/env python3
"""presence_penalty A/B: pass rate and loop rate per arm (presence-penalty.md).

  python3 reports/2026-09-28-orchestrator-and-penalty/presence_ab.py SINCE   # SINCE = 20260928-0700

Reads bench/frontier-<arm>-*.json started at or after SINCE, and the arm's opencode
transcripts in .bench-logs/ from then on. A sample counts as a loop if the harness saw
3+ identical tool calls in a row, or it timed out. A transcript counts as a text loop if
a step stopped on the token limit or a text part repeats 50 %+ of its 8-grams (the
8-bit's 227 transcripts before this A/B peak at 7 %). Edit and write inputs are not
scanned: mechanical edits repeat by design.
"""
import glob, json, math, os, re, sys
from collections import defaultdict

ARMS = ["qwen3.6-35b-a3b-8bit-64g", "qwen3.6-35b-a3b-8bit-64g-pp15"]
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def rep8(text, n=8):
    w = text.split()
    if len(w) < 4 * n:
        return 0.0
    grams = [tuple(w[i:i + n]) for i in range(len(w) - n + 1)]
    return 1 - len(set(grams)) / len(grams)


def text_loop(path):
    for line in open(path, errors="replace"):
        try:
            d = json.loads(line)
        except ValueError:
            continue
        part = d.get("part") or {}
        if d.get("type") == "step_finish" and part.get("reason") == "length":
            return True
        if d.get("type") == "text" and rep8(part.get("text") or "") >= 0.5:
            return True
    return False


def fisher(a, n1, b, n2):
    """Two-sided Fisher exact p for a/n1 against b/n2."""
    k, n = a + b, n1 + n2
    p = lambda x: math.comb(n1, x) * math.comb(n2, k - x) / math.comb(n, k)
    obs = p(a)
    return min(1.0, sum(p(x) for x in range(max(0, k - n2), min(k, n1) + 1) if p(x) <= obs * (1 + 1e-9)))


def main(since):
    for arm in ARMS:
        cells = defaultdict(lambda: [0, 0, 0])   # (class, rung) -> n, pass, loop
        for f in glob.glob(f"{ROOT}/bench/frontier-{arm}-*.json"):
            if not re.fullmatch(rf"frontier-{re.escape(arm)}-[a-z0-9_]+-\d{{8}}-\d{{6}}\.json", os.path.basename(f)):
                continue
            d = json.load(open(f))
            if d["meta"]["started"] < since:
                continue
            for s in d["samples"]:
                c = cells[(s["class"], s["rung"])]
                c[0] += 1
                c[1] += bool(s.get("verified"))
                c[2] += bool(s.get("timed_out") or s.get("looped_on") or (s.get("longest_identical_run") or 0) >= 3)
        logs = [p for p in glob.glob(f"{ROOT}/.bench-logs/{arm}-*.jsonl")
                if re.fullmatch(rf"{re.escape(arm)}-(\d{{8}}-\d{{6}})\.jsonl", os.path.basename(p))
                and os.path.basename(p)[len(arm) + 1:-6] >= since]
        tl = sum(text_loop(p) for p in logs)
        n, ok, lp = (sum(c[i] for c in cells.values()) for i in range(3))
        print(f"{arm}: pass {ok}/{n}, loop or timeout {lp}/{n}, text loops {tl}/{len(logs)} transcripts")
        for k in sorted(cells):
            print(f"   {k[0]:22} r{k[1]}  pass {cells[k][1]}/{cells[k][0]}  loop {cells[k][2]}")
        yield ok, n


if __name__ == "__main__":
    if len(sys.argv) != 2:
        assert rep8("a b c d e f g h " * 10) > 0.5 and rep8(" ".join(map(str, range(80)))) == 0.0
        assert abs(fisher(10, 16, 16, 16) - 0.018) < 0.002 and fisher(3, 4, 3, 4) == 1.0
        sys.exit("usage: presence_ab.py SINCE   (self-check passed)")
    (a, n1), (b, n2) = main(sys.argv[1])
    if n1 and n2:
        print(f"pass rate A {a}/{n1} against B {b}/{n2}: Fisher p = {fisher(a, n1, b, n2):.3f}")
