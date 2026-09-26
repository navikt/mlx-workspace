"""Write the night run's report from steps.jsonl and the result JSONs the steps wrote.

Usage: python3 .mise/tasks/_night_report.py <night-dir> <report.md>
Self-check: python3 .mise/tasks/_night_report.py --selftest
"""
import json
import math
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GB = 1e9
# The temp 0.6 baselines: cheap-ops of 2026-09-23, verified of 10 per run with the retired
# D2 left out. optiq = bench/results-qwen3.6-35b-a3b-optiq-20260923-{115543-01..03,124337-01};
# 8-bit = bench/results-qwen3.8-27b-8bit-nopin-20260923-083958-01..04 (recounted 2026-09-24).
BASELINE = {"qwen3.6-35b-a3b-optiq-t0": ("qwen3.6-35b-a3b-optiq", 28, 40),
            "qwen3.8-27b-8bit-nopin-c32k-t0": ("qwen3.8-27b-8bit-nopin", 31, 40)}


def fisher(a, b, c, d):
    """Two-sided Fisher exact p for [[a, b], [c, d]]: every table with the same margins
    that is no more likely than the observed one."""
    n1, n2, k = a + b, c + d, a + c
    pr = lambda x: math.comb(n1, x) * math.comb(n2, k - x) / math.comb(n1 + n2, k)
    p0 = pr(a)
    return min(1.0, sum(pr(x) for x in range(max(0, k - n2), min(k, n1) + 1) if pr(x) <= p0 * (1 + 1e-9)))


def fisher_greater(a, b, c, d):
    """One-sided Fisher exact p for [[a, b], [c, d]] that row 1's pass rate exceeds row 2's:
    the chance of a or more passes in row 1 given the margins."""
    n1, n2, k = a + b, c + d, a + c
    return min(1.0, sum(math.comb(n1, x) * math.comb(n2, k - x) for x in range(a, min(k, n1) + 1))
               / math.comb(n1 + n2, k))


def replication_md(result_files, alpha=0.1, min_n=8, max_ratio=2.0):
    """design.md §7 conditions 2 and 3 for each lever against base on the same night:
    per (class, rung) run under both, n ≥ min_n per arm, one-sided Fisher p < alpha, and
    the lever's median wall time per sample at most max_ratio × base's."""
    arms = {}
    for f in result_files:
        d = json.loads(Path(f).read_text())
        if "samples" not in d or d["meta"].get("cloud_model"):  # validation files, the cloud arm
            continue
        for s in d["samples"]:
            if s.get("valid", True):
                arms.setdefault((s["class"], d["meta"]["variant"]), {}).setdefault(s["rung"], []).append(s)
    L = []
    for (cls, var), by_rung in sorted(arms.items()):
        base = arms.get((cls, "base"))
        if var == "base" or not base:
            continue
        if not L:
            L = ["", "## Replication against base (design.md §7)", "",
                 f"Same night, same model and harness. A rung passes when both arms have n ≥ {min_n}, "
                 f"the one-sided Fisher p (lever > base) is < {alpha}, and the lever's median seconds "
                 f"per sample is ≤ {max_ratio:g}× base's. \"1st try\" is the lever's samples that passed "
                 "without a retry: the same session as base up to its first check, so it should match "
                 "base's rate, and a gap there is drift or noise, not the lever."]
        L += ["", f"### {cls} · {var}", "",
              "| Rung | base k/n | lever k/n | 1st try | p (one-sided) | base med s | lever med s | ratio | passes |",
              "|---|---|---|---|---|---|---|---|---|"]
        passed = []
        for r in sorted(set(by_rung) & set(base)):
            b, v = base[r], by_rung[r]
            bk, vk = sum(bool(s["verified"]) for s in b), sum(bool(s["verified"]) for s in v)
            first = sum(bool(s["verified"]) and not s.get("retries") for s in v)
            p = fisher_greater(vk, len(v) - vk, bk, len(b) - bk)
            bm, vm = statistics.median(s["seconds"] for s in b), statistics.median(s["seconds"] for s in v)
            ratio = vm / bm if bm else math.inf
            ok = len(b) >= min_n and len(v) >= min_n and p < alpha and ratio <= max_ratio
            passed += [r] if ok else []
            L.append(f"| {r} | {bk}/{len(b)} | {vk}/{len(v)} | {first}/{len(v)} | {p:.3f} | {bm:.0f} | {vm:.0f} "
                     f"| {ratio:.2f} | {'yes' if ok else 'no'} |")
        L += ["", f"Verdict: {var} replicates on {cls} at rung(s) {', '.join(map(str, passed))}." if passed
              else f"Verdict: {var} does not replicate on {cls} at any rung run tonight."]
    return L


def ops_summary(doc):
    rows = [v for k, v in doc.items() if k != "D2" and isinstance(v, dict) and "verified" in v]
    secs = [r["seconds"] for r in rows if isinstance(r.get("seconds"), (int, float))]
    return {"verified": sum(1 for r in rows if r["verified"]), "n": len(rows),
            "median_s": statistics.median(secs) if secs else None,
            "loops": sum(1 for r in rows if r.get("looped_on"))}


def peak_from_footprint(result):
    fp = ROOT / ".bench-logs" / (Path(result).stem + ".footprint")
    try:
        vals = [int(line.split()[1]) for line in fp.read_text().splitlines() if len(line.split()) == 2]
        return round(max(vals) / GB, 2) if vals else None
    except OSError:
        return None


def e2e_summary(doc, result):
    lat = []
    for rec in doc.get("latency", []):
        c, w = rec.get("cold") or {}, rec.get("warm") or {}
        s = f"{rec['target'] // 1000}k: cold {c.get('ttft_s', c.get('error', '?'))} s, {c.get('decode_tok_s', '?')} tok/s"
        if w:
            s += f", warm {w.get('ttft_s', w.get('error', '?'))} s"
        lat.append(s)
    peak = (doc.get("memory") or {}).get("peak_gb")
    peak = f"{peak} GB" if peak is not None else (f"{p} GB (from .footprint; run did not finish)"
                                                   if (p := peak_from_footprint(result)) else "n/a")
    v = doc.get("verdicts")
    if v is None:
        verdict = "none (run did not reach finish)"
    else:
        bad = [x["criterion"] for x in v if x["refuted"]]
        verdict = f"{len(v) - len(bad)}/{len(v)} hold" + (f"; refuted: {'; '.join(bad)}" if bad else "")
    sess = []
    for state in ("on", "off"):
        rows = [r for r in doc.get("e2e", []) if r.get("classifier") == state]
        if rows:
            sess.append(f"classifier {state} {sum(1 for r in rows if r.get('valid') and r.get('verified'))}/{len(rows)}")
    return verdict, "; ".join(lat) or "n/a", peak, ", ".join(sess) or "n/a (latency-only)"


def main(night_dir, out):
    night_dir = Path(night_dir)
    steps = {}
    for line in (night_dir / "steps.jsonl").read_text().splitlines():
        if line.strip():
            r = json.loads(line)
            steps[int(r["n"])] = r  # a resumed step's later record wins
    L = [f"# Night run 2026-09-24: results", "",
         f"Written by `mise run night-run` from `{night_dir.relative_to(ROOT) if night_dir.is_absolute() and ROOT in night_dir.parents else night_dir}/steps.jsonl` "
         f"and the result JSONs each step wrote. Queue and reasoning: [qwen38-tuning.md §6](qwen38-tuning.md#6-resume) "
         f"and [pending-tasks.md](pending-tasks.md).", ""]
    if steps:
        first, last = steps[min(steps)], steps[max(steps)]
        L += [f"- Started {first.get('start', '?')}, last step ended {last.get('end', '?')}.",
              f"- nav-pilot binary: `{first.get('nav_pilot', '?')}`.",
              f"- `iogpu.wired_limit_mb` per step: {', '.join(sorted({s.get('wired_mb', '?') for s in steps.values()}))}"
              " (36864 is the fleet's 36 GB).", ""]
    L += ["## Steps", "",
          "| # | Step | Profile | Status | Minutes | Log |", "|---|---|---|---|---|---|"]
    e2e_rows, ops_rows, t0 = [], [], {}
    for n in sorted(steps):
        s = steps[n]
        status = s["status"] + (f" (exit {s['rc']})" if s["status"] == "FAIL" else "") + (f": {s['note']}" if s.get("note") else "")
        mins = f"{int(s['seconds']) / 60:.0f}" if s.get("seconds") else ""
        L.append(f"| {n} | {s['kind']} {s['mode']} | `{s['profile']}` | {status} | {mins} | `{s.get('log', '')}` |")
        res = s.get("result")
        if not res:
            continue
        path = Path(res) if Path(res).is_absolute() else ROOT / res
        try:
            doc = json.loads(path.read_text())
        except (OSError, ValueError) as e:
            L[-1] += f" unreadable result {res}: {e}"
            continue
        if s["kind"] == "e2e":
            e2e_rows.append((n, s, *e2e_summary(doc, res)))
        else:
            o = ops_summary(doc)
            ops_rows.append((n, s, o))
            if s["profile"] in BASELINE and s["status"] == "OK":
                t0.setdefault(s["profile"], []).append(o)
    if e2e_rows:
        L += ["", "## nav-pilot E2E (bench-np-e2e)", "",
              "Pass (pending-tasks.md §2): no `Insufficient Memory`, peak ≤ 41 GB warm at max context, "
              "Copilot sessions verified ≥ 5/6.", "",
              "| # | Profile | Status | Verdicts | Latency | Peak footprint | Copilot sessions verified | Result |",
              "|---|---|---|---|---|---|---|---|"]
        for n, s, verdict, lat, peak, sess in e2e_rows:
            L.append(f"| {n} | `{s['profile']}` {s['mode']} | {s['status']} | {verdict} | {lat} | {peak} | {sess} | `{s['result']}` |")
    if ops_rows:
        L += ["", "## cheap-ops (bench-models)", "",
              "| # | Profile | Status | Verified/10 (excl. D2) | Median s/task | Loops | Result |",
              "|---|---|---|---|---|---|---|"]
        for n, s, o in ops_rows:
            med = f"{o['median_s']:.0f}" if o["median_s"] is not None else "n/a"
            L.append(f"| {n} | `{s['profile']}` | {s['status']} | {o['verified']}/{o['n']} | {med} | {o['loops']} | `{s['result']}` |")
    L += ["", "## Temperature: 0 (production) against 0.6 (every earlier cheap-ops run)", "",
          "nav-pilot users run greedy: nav-pilot sets no temperature, opencode sends none and Copilot CLI "
          "sends 0. The workspace server defaults `MLX_TEMP` to 0.6, so the -t0 profiles are the first "
          "cheap-ops runs at the production setting. Baselines are the 2026-09-23 runs at 0.6. The 8-bit "
          "baseline profile (`qwen3.8-27b-8bit-nopin`) also has a 4 GiB cache and 8k output against c32k's "
          "2.25 GiB and 4k. Fisher's exact test, two-sided, on verified against not verified tasks.", "",
          "| Profile | temp 0 | temp 0.6 | p (Fisher) | Loops at temp 0 |", "|---|---|---|---|---|"]
    for prof, (base, bv, bn) in BASELINE.items():
        runs = t0.get(prof, [])
        if not runs:
            L.append(f"| `{prof}` | no finished runs | {bv}/{bn} (`{base}`) | n/a | n/a |")
            continue
        v, n = sum(r["verified"] for r in runs), sum(r["n"] for r in runs)
        p = fisher(v, n - v, bv, bn - bv)
        L.append(f"| `{prof}` | {v}/{n} ({len(runs)} runs) | {bv}/{bn} (`{base}`) | {p:.3f} | {sum(r['loops'] for r in runs)} |")
    L += ["", "With 2–3 runs a cell, only a large difference reaches p < 0.05; read a non-significant p "
          "as \"no evidence of a difference\", not as \"the same\"."]
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text("\n".join(L) + "\n")
    print(f"report: {out}")


def selftest():
    assert abs(fisher(28, 12, 31, 9) - 0.6120) < 1e-3  # scipy.stats.fisher_exact: 0.6120
    assert abs(fisher(3, 1, 1, 3) - 0.4857) < 1e-3
    assert fisher(10, 0, 0, 10) < 1e-4
    assert abs(fisher_greater(8, 0, 5, 3) - 0.1) < 1e-9          # 56/560
    assert abs(fisher_greater(3, 1, 1, 3) - 0.2429) < 1e-3       # scipy alternative="greater": 0.2429
    assert fisher_greater(0, 8, 8, 0) == 1.0
    import tempfile
    with tempfile.TemporaryDirectory() as t:
        mk = lambda cls, r, ok, sec, retries=0: {"class": cls, "rung": r, "verified": ok, "seconds": sec,
                                                  "retries": retries, "valid": True}
        base = [mk("c", 4, i < 3, 10) for i in range(8)] + [mk("c", 5, i < 7, 10) for i in range(8)]
        lever = [mk("c", 4, True, 15, i % 2) for i in range(8)] + [mk("c", 5, True, 25) for i in range(8)]
        for name, var, ss in (("b", "base", base), ("l", "retry2", lever)):
            Path(t, name).write_text(json.dumps({"meta": {"variant": var}, "samples": ss}))
        md = "\n".join(replication_md([Path(t, "b"), Path(t, "l")]))
        assert "| 4 | 3/8 | 8/8 | 4/8 | 0.013 | 10 | 15 | 1.50 | yes |" in md, md
        assert "| 5 | 7/8 | 8/8 |" in md and md.rstrip().endswith("at rung(s) 4."), md
    assert ops_summary({"R1": {"verified": True, "seconds": 10}, "D2": {"verified": True, "seconds": 1},
                        "E1": {"verified": False, "seconds": 30, "looped_on": "read"}}) == \
        {"verified": 1, "n": 2, "median_s": 20.0, "loops": 1}
    print("✓ _night_report selftest passed")


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        selftest()
    else:
        main(*sys.argv[1:])
