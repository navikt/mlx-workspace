"""Per-class pass counts from the result files, pooled only within one condition.

Shared by `bench-results --by-class` (the table) and `bench-capabilities` (the
bar). The rules are reports/2026-09-24-local-vs-cloud-routing/design.md §2 and
§4.2, written down here rather than remembered:

  A row is one class x model x mode x condition. Runs are pooled only inside a
  condition: temperature 0 and 0.6 are two rows, never one.

  mode "local"    raw local passes, nothing checking them (cheap-ops, Copilot
                  local, the debug file).
  mode "delegate" delegated hybrid samples that verified end to end. A hybrid
                  sample that never reached the worker is not a delegate sample.
  mode "cloud"    the reference arms (Copilot cloud, opencode control).

  Timeouts count as failures: to the user a timeout is a failure. A sample with
  no verdict that did not time out is unjudged and left out. Discarded samples
  (valid false) are never counted.
"""
import json
import math
import statistics as st
import sys
from pathlib import Path
from statistics import NormalDist

sys.path.insert(0, str(Path(__file__).parent))
import _profiles as P  # noqa: E402  (read only)

ROOT = Path(__file__).resolve().parents[2]
BENCH = ROOT / "bench"

OPTIQ = "mlx-community/Qwen3.6-35B-A3B-OptiQ-4bit"

# Written down, not inferred, for the August hybrid files: they carry no worker
# id or fragment hash, so the facts that make them a condition live here. Files
# written with a BENCH_HYBRID_TAG carry all three (hybrid_condition below).
HYBRID_WORKER = OPTIQ
HYBRID_ORCHESTRATOR = "claude-sonnet-4.6"
# findings §3.4: a rewritten dispatch fragment, reverted afterwards.
INTERVENTION_FRAGMENT = {"hybrid-4-hybrid.json", "hybrid-5-hybrid.json"}

# cheap-ops runs excluded as invalid in decision.md §3.1: two queues ran at once.
INVALID_RUNS = {
    "results-qwen3.8-27b-4bit-20260923-125734-03.json",
    "results-qwen3.8-27b-4bit-20260923-134745-02.json",
    "results-qwen3.8-27b-8bit-mlx-20260923-125734-02.json",
}

# The debug file predates the harness stamp and names no model: optiq alone on
# the frontend-debug target (design §1.1).
DEBUG_FILE = "results-qwen3.6-35b-a3b-optiq-debug.json"

# Harness generations known to score identically, newer sha -> the one it pools
# with. A harness_sha hashes whole files (bench-cheap-ops _harness_sha), so an
# edit that cannot reach a score still starts a new generation. Add a pair only
# after checking the diff between the two shas' inputs; never by default.
#   f62fbb8cbeae: e5c34cd (24 Sept 19:54) added MLX_NAV_PILOT_TEMPERATURE and
#   MLX_NAV_PILOT_TOP_P to OPTIONAL_DEFAULTS in _profiles.py. Only model-manifest
#   reads them (nav-pilot's sampling); the workspace server, the runner, the
#   tasks and the verifiers never do. It is the only input change from a387e4b.
#   d1229ad0e89f: the E3/debug fix (25 Sept). Three input changes, none of which
#   changes the score of a task id that exists in both generations:
#   - _profiles.py left the hash (profile_sha is stamped per record instead).
#   - verify "debug" no longer fails a clean tree. No task in bench/tasks.json
#     uses it; it reaches only the frontend-debug target, which is not pooled here.
#   - E3 left tasks.json and E3b joined it. A new id, not a new prompt under the
#     old one, so no id means two things; E3 is excluded in task-classes.json.
EQUIVALENT_HARNESS = {"f62fbb8cbeae": "492141135fe6", "d1229ad0e89f": "492141135fe6"}

Z90 = NormalDist().inv_cdf(0.90)  # one-sided 90%


def wilson_lower(k, n, z=Z90):
    if n == 0:
        return None
    p = k / n
    d = 1 + z * z / n
    centre = p + z * z / (2 * n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (centre - half) / d


def wilson(k, n, z):
    """Two-sided Wilson score interval (lo, hi) at z."""
    p = k / n
    d = 1 + z * z / n
    centre = p + z * z / (2 * n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (centre - half) / d, (centre + half) / d


def diff_ci(k1, n1, k2, n2, z=Z90):
    """p1 - p2 with Newcombe's hybrid score interval (method 10), or None.

    For "hybrid not worse than control" on 8-24 samples an arm: Wald intervals
    collapse to zero width at 24/24, Wilson-based ones do not. At z=Z90 the lower
    bound is a one-sided 90% bound, the confidence the routing bar already uses."""
    if not n1 or not n2:
        return None
    p1, p2 = k1 / n1, k2 / n2
    l1, u1 = wilson(k1, n1, z)
    l2, u2 = wilson(k2, n2, z)
    d = p1 - p2
    return d, d - math.sqrt((p1 - l1) ** 2 + (u2 - p2) ** 2), d + math.sqrt((u1 - p1) ** 2 + (p2 - l2) ** 2)


def control_for(f, d):
    """The control file a hybrid file is compared with. A tagged file names its worker
    (bench-hybrid out_path) and shares one control per tag, target and rung."""
    wp = d.get("worker_profile")
    if d.get("tag") and wp:
        return f.with_name(f.name.replace(f"-{wp}-{d.get('rung')}-hybrid.json", f"-{d.get('rung')}-control.json"))
    return f.with_name(f.name.replace("-hybrid.json", "-control.json"))


def task_classes():
    doc = json.loads((BENCH / "task-classes.json").read_text())["tasks"]
    return {tid: ("excluded:" + tid if v.get("exclude_from_bar") else v["class"])
            for tid, v in doc.items()}


def _retired():
    doc = json.loads((BENCH / "tasks.json").read_text())
    return {t["id"] for t in doc["tasks"] if t.get("retired_reason")}


def _outcome(rec):
    """True/False, or None for unjudged."""
    if rec.get("verified") is True:
        return True
    if rec.get("verified") is False or rec.get("timed_out"):
        return False
    return None


def _cheap_ops_files():
    """Stamped runs of the newest harness generation only. A harness change
    starts the count again at zero (design §4.2); newest is by run tag, the
    date the file was written, not by the sha's spelling. Shas listed in
    EQUIVALENT_HARNESS count as the generation they map to."""
    runs = []
    for f in sorted(BENCH.glob("results-*.json")):
        if f.name in INVALID_RUNS:
            continue
        try:
            d = json.loads(f.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        if not isinstance(d, dict) or not d or not all(isinstance(v, dict) for v in d.values()):
            continue
        shas = {v.get("harness_sha") for v in d.values()} - {None}
        if len(shas) != 1:
            continue
        parts = f.stem[len("results-"):].rsplit("-", 3)
        if len(parts) != 4 or not all(p.isdigit() for p in parts[1:]):
            continue
        sha = shas.pop()
        runs.append((f"{parts[1]}-{parts[2]}", parts[0], EQUIVALENT_HARNESS.get(sha, sha), f, d))
    return newest_generation(runs)


def newest_generation(runs):
    """The runs sharing the newest run's (already canonical) sha."""
    if not runs:
        return []
    newest = max(runs)[2]
    return [r for r in runs if r[2] == newest]


def _temp(profile):
    try:
        return P.params_for(profile).get("MLX_TEMP", "?")
    except SystemExit:
        return "?"


def hybrid_condition(d, s, fname):
    """(orchestrator, worker, condition suffix) for one hybrid sample. A tagged
    file records its orchestrator and worker in the preflight snapshot the sample
    ran under, and the dispatch policy's sha256 per sample; the August files fall
    back to the constants above."""
    snaps = d.get("preflight") or []
    ix = s.get("preflight")
    snap = snaps[ix] if isinstance(ix, int) and 0 <= ix < len(snaps) else {}
    if not d.get("tag"):
        frag = "intervention" if fname in INTERVENTION_FRAGMENT else "original"
        return HYBRID_ORCHESTRATOR, HYBRID_WORKER, f"fragment={frag}"
    policy = (s.get("policy") or {}).get("sha256")
    return (snap.get("cloud_model") or "?", snap.get("local_model") or "?",
            f"policy={policy[:8] if policy else 'none'}")


def rows():
    """{(cls, model, mode, condition): row} over every result file in bench/."""
    classes = task_classes()
    retired = _retired()
    out = {}

    def add(cls, model, mode, cond, tid, ok, run, fname, seconds=None):
        if cls is None or ok is None:
            return
        r = out.setdefault((cls, model, mode, cond), {
            "class": cls, "model": model, "mode": mode, "condition": cond,
            "k": 0, "n": 0, "tasks": set(), "runs": set(), "files": set(),
            "seconds": [], "cost_ratios": {}, "dispatch": [0, 0], "control": [0, 0]})
        r["k"] += ok
        r["n"] += 1
        r["tasks"].add(tid)
        r["runs"].add(run)
        r["files"].add(fname)
        if seconds:
            r["seconds"].append(seconds)

    for _tag, profile, sha, f, d in _cheap_ops_files():
        cond = f"cheap-ops profile={profile} temp={_temp(profile)} harness={sha}"
        for tid, rec in d.items():
            if tid in retired:
                continue
            add(classes.get(tid), rec.get("served_model") or "?", "local", cond,
                tid, _outcome(rec), f.name, f.name, rec.get("seconds"))

    dbg = BENCH / DEBUG_FILE
    if dbg.exists():
        for tid, rec in json.loads(dbg.read_text()).items():
            add(classes.get(tid), OPTIQ, "local", "debug-target frontend-debug",
                tid, _outcome(rec), f"{dbg.name}#{tid}", dbg.name, rec.get("seconds"))

    # Copilot whole sessions. Copilot sends temperature 0; each sample is a run.
    for f in sorted(BENCH.glob("copilot-*-*.json")):
        d = json.loads(f.read_text())
        mode = {"local": "local", "cloud": "cloud"}.get(d.get("arm"))
        if not mode:
            continue
        for i, s in enumerate(d.get("samples", [])):
            if s.get("valid"):
                add(classes.get(d["task"]), s.get("model") or "?", mode, "copilot temp=0",
                    d["task"], _outcome(s), f"{f.name}#{i}", f.name, s.get("seconds"))

    # opencode hybrid (delegate) and control (cloud).
    for f in sorted(BENCH.glob("hybrid-*.json")):
        d = json.loads(f.read_text())
        valid = [s for s in d.get("samples", []) if s.get("valid")]
        tid = d.get("task")
        if d.get("arm") == "control":
            for i, s in enumerate(valid):
                orch = hybrid_condition(d, s, f.name)[0]
                cond = f"opencode control orchestrator={orch}" if d.get("tag") else "opencode control"
                add(classes.get(tid), orch, "cloud", cond,
                    tid, _outcome(s), f"{f.name}#{i}", f.name, s.get("seconds"))
            continue
        if d.get("arm") != "hybrid":
            continue
        # One population for everything below: the dispatched samples. The pass
        # rate and the cost ratio used to be taken over different ones (delegated
        # for k/n, every valid sample for the cost), so a worker used on half the
        # samples was priced on the other half. The dispatch rate says how much of
        # the arm that population is.
        delegated = [s for s in valid if s.get("local_calls")]
        keys, seen = set(), {}
        for s in valid:
            orch, worker, extra = hybrid_condition(d, s, f.name)
            key = (classes.get(tid), worker, "delegate", f"opencode delegate orchestrator={orch} {extra}")
            seen.setdefault(key, [0, 0])
            seen[key][0] += bool(s.get("local_calls"))
            seen[key][1] += 1
        for i, s in enumerate(delegated):
            orch, worker, extra = hybrid_condition(d, s, f.name)
            cond = f"opencode delegate orchestrator={orch} {extra}"
            keys.add((classes.get(tid), worker, "delegate", cond))
            add(classes.get(tid), worker, "delegate", cond,
                tid, _outcome(s), f"{f.name}#{i}", f.name, s.get("seconds"))
        for key, (k, n) in seen.items():
            if key in out:
                out[key]["dispatch"][0] += k
                out[key]["dispatch"][1] += n
        # Cost ratio: dispatched median over control median, same target and task.
        # A hybrid arm that never dispatched measures nothing about delegation.
        ctrl = control_for(f, d)
        if delegated and ctrl.exists():
            cv = [s for s in json.loads(ctrl.read_text()).get("samples", []) if s.get("valid")]
            hc = st.median([s.get("cloud_cost_usd") or 0 for s in delegated])
            cc = st.median([s.get("cloud_cost_usd") or 0 for s in cv]) if cv else 0
            judged = [o for o in map(_outcome, cv) if o is not None]
            for key in keys:
                if key in out:
                    out[key]["control"][0] += sum(judged)
                    out[key]["control"][1] += len(judged)
                    if cc:
                        out[key]["cost_ratios"][f.name.replace("-hybrid.json", "")] = round(hc / cc, 2)
    return out


def as_json(r):
    """A row with sets turned into sorted lists and the derived figures added."""
    lb = wilson_lower(r["k"], r["n"])
    return {
        "class": r["class"], "model": r["model"], "mode": r["mode"], "condition": r["condition"],
        "k": r["k"], "n": r["n"], "tasks": sorted(r["tasks"]), "runs": len(r["runs"]),
        "lb": None if lb is None else round(lb, 3),
        "median_seconds": round(st.median(r["seconds"])) if r["seconds"] else None,
        "cost_ratios": r["cost_ratios"], "files": sorted(r["files"]),
        **hybrid_figures(r),
    }


def hybrid_figures(r):
    """Delegate rows only: dispatch rate, the paired control's k/n, and the
    difference in pass rate (dispatched minus control) with its interval."""
    if r["mode"] != "delegate":
        return {}
    (dk, dn), (ck, cn) = r["dispatch"], r["control"]
    ci = diff_ci(r["k"], r["n"], ck, cn)
    return {"dispatch": {"k": dk, "n": dn, "rate": round(dk / dn, 3) if dn else None},
            "control": {"k": ck, "n": cn},
            "diff": None if ci is None else {"d": round(ci[0], 3), "lo90": round(ci[1], 3), "hi90": round(ci[2], 3)}}


def hybrid_md(files):
    """Markdown for one night's tagged hybrid files: per worker against the shared
    control, pooled over the cells (target x rung) the worker ran. Dispatch rate
    first, because every other figure is over the dispatched samples only."""
    docs = {}
    for f in map(Path, files):
        try:
            docs[f] = json.loads(f.read_text())
        except (OSError, ValueError):
            continue
    if not docs:
        return []
    L = ["", "## Hybrid arm", "",
         "Per worker, pooled over its cells. **Dispatch** is how many valid hybrid samples reached the worker; "
         "pass rate, the difference and the cost ratio are over those dispatched samples only, against every valid "
         "control sample of the same cells. The interval is Newcombe's, one-sided 90% on the lower bound; the plan's "
         "rule is lower bound ≥ −10 points.", "",
         "| Worker | Cells | Dispatch | Pass (dispatched) | Pass (control) | Difference [90% lower, upper] | "
         "Median $ dispatched / control | Policy sha256 | Workspace HEAD |",
         "|---|---|---|---|---|---|---|---|---|"]
    by_worker = {}
    for f, d in docs.items():
        if d.get("arm") == "hybrid":
            by_worker.setdefault(d.get("worker_profile") or "?", []).append((f, d))
    for worker, fl in sorted(by_worker.items()):
        valid = [s for _, d in fl for s in d.get("samples", []) if s.get("valid")]
        disp = [s for s in valid if s.get("local_calls")]
        ctrl = []
        for f, d in fl:
            c = control_for(f, d)
            cd = docs.get(c) or (json.loads(c.read_text()) if c.exists() else {})
            ctrl += [s for s in cd.get("samples", []) if s.get("valid")]
        hk = [o for o in map(_outcome, disp) if o is not None]
        ck = [o for o in map(_outcome, ctrl) if o is not None]
        ci = diff_ci(sum(hk), len(hk), sum(ck), len(ck))
        med = lambda xs: st.median(xs) if xs else None
        hc = med([s.get("cloud_cost_usd") or 0 for s in disp])
        cc = med([s.get("cloud_cost_usd") or 0 for s in ctrl])
        pol = sorted({(s.get("policy") or {}).get("sha256", "")[:8] for s in valid} - {""})
        heads = sorted({(s.get("workspace_head") or "?")[:8] for s in valid})
        cells = ", ".join(sorted(f"{d.get('target', 'tasks')}:{d.get('rung')}" for _, d in fl))
        L.append(f"| `{worker}` | {cells} | {len(disp)}/{len(valid)} | {sum(hk)}/{len(hk)} | {sum(ck)}/{len(ck)} | "
                 + (f"{ci[0]:+.2f} [{ci[1]:+.2f}, {ci[2]:+.2f}]" if ci else "–") + " | "
                 + (f"{hc:.3f} / {cc:.3f} = {hc / cc:.2f}×" if hc is not None and cc else "–")
                 + f" | {', '.join(pol) or '–'} | {', '.join(heads) or '–'} |")
    L += ["", "| File | Valid/attempts | Verified | Dispatched | Spent (incl. invalid) $ | Stopped |", "|---|---|---|---|---|---|"]
    for f, d in sorted(docs.items()):
        sm = d.get("samples", [])
        val = [s for s in sm if s.get("valid")]
        L.append(f"| `{f.name}` | {len(val)}/{len(sm)} | {sum(bool(s.get('verified')) for s in val)} | "
                 f"{sum(bool(s.get('local_calls')) for s in val) if d.get('arm') == 'hybrid' else '–'} | "
                 f"{sum(s.get('cloud_cost_seen_usd') or 0 for s in sm):.2f} | {d.get('stopped') or ''} |")
    return L


if __name__ == "__main__":
    # Test vectors from design §4.1 step 3.
    assert round(wilson_lower(15, 15), 3) == 0.901
    assert round(wilson_lower(35, 35), 3) == 0.955
    assert round(wilson_lower(10, 11), 3) == 0.739
    assert wilson_lower(0, 0) is None
    assert _outcome({"verified": None, "timed_out": True}) is False
    assert _outcome({"verified": None}) is None
    # A tagged file keys its condition on what it recorded; an August file on the constants.
    aug = {"samples": [{"preflight": 0}], "preflight": [{"cloud_model": "x"}]}
    assert hybrid_condition(aug, aug["samples"][0], "hybrid-3-hybrid.json") == \
        (HYBRID_ORCHESTRATOR, HYBRID_WORKER, "fragment=original")
    assert hybrid_condition(aug, aug["samples"][0], "hybrid-4-hybrid.json")[2] == "fragment=intervention"
    tagged = {"tag": "np-d24a65e5-sonnet46", "preflight": [{"cloud_model": "gpt-6-sol", "local_model": "w"}],
              "samples": [{"preflight": 0, "policy": {"sha256": "abcdef0123456789"}}, {"preflight": 0}]}
    assert hybrid_condition(tagged, tagged["samples"][0], "f") == ("gpt-6-sol", "w", "policy=abcdef01")
    assert hybrid_condition(tagged, tagged["samples"][1], "f")[2] == "policy=none"
    # Equivalent generations pool; any other sha change still starts from zero.
    def canon(tag, sha):
        return (tag, "p", EQUIVALENT_HARNESS.get(sha, sha), None, None)
    old, new = canon("20260923-1200", "492141135fe6"), canon("20260925-0100", "f62fbb8cbeae")
    assert newest_generation([old, new]) == [old, new]
    other = canon("20260926-0100", "0123456789ab")
    assert newest_generation([old, new, other]) == [other]
    e3fix = canon("20260926-0200", "d1229ad0e89f")
    assert newest_generation([old, new, e3fix]) == [old, new, e3fix]
    assert all(k != v and v not in EQUIVALENT_HARNESS for k, v in EQUIVALENT_HARNESS.items())
    # Newcombe 1998, method 10, example (56/70 vs 48/80): 95% interval 0.0524 to 0.3339.
    d, lo, hi = diff_ci(56, 70, 48, 80, z=NormalDist().inv_cdf(0.975))
    assert (round(d, 4), round(lo, 4), round(hi, 4)) == (0.2, 0.0524, 0.3339), (d, lo, hi)
    assert diff_ci(0, 0, 1, 1) is None
    # 24/24 against 24/24 clears a -10 point floor at one-sided 90%; 22/24 against 22/24 does not.
    assert diff_ci(24, 24, 24, 24)[1] > -0.10 > diff_ci(22, 24, 22, 24)[1]
    # One population: the hybrid file's dispatched samples, the worker in its name.
    assert control_for(Path("hybrid-np-x-sonnet5-occamy-1.0-4bit-64g-3-hybrid.json"),
                       {"tag": "np-x-sonnet5", "worker_profile": "occamy-1.0-4bit-64g", "rung": 3}).name == \
        "hybrid-np-x-sonnet5-3-control.json"
    assert control_for(Path("hybrid-6-hybrid.json"), {}).name == "hybrid-6-control.json"
    import tempfile
    with tempfile.TemporaryDirectory() as t:
        def put(name, doc):
            (Path(t) / name).write_text(json.dumps(doc))
            return str(Path(t) / name)
        smp = lambda ok, calls, cost: {"valid": True, "verified": ok, "local_calls": calls, "cloud_cost_usd": cost,
                                       "cloud_cost_seen_usd": cost, "policy": {"sha256": "ab" * 32}, "workspace_head": "b0351ed8ff"}
        fs = [put("hybrid-np-x-3-control.json", {"arm": "control", "tag": "np-x", "rung": 3,
                                                 "samples": [smp(True, 0, 0.2), smp(True, 0, 0.4)]}),
              put("hybrid-np-x-w-3-hybrid.json", {"arm": "hybrid", "tag": "np-x", "rung": 3, "worker_profile": "w",
                                                  "samples": [smp(True, 2, 0.1), smp(False, 0, 0.5), {"valid": False}]})]
        md = "\n".join(hybrid_md(fs))
        assert "| `w` | tasks:3 | 1/2 | 1/1 | 2/2 |" in md and "0.100 / 0.300 = 0.33×" in md and "abababab" in md, md
    print("✓ _by_class self-check passed")
