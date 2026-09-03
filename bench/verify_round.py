#!/usr/bin/env python3
"""Check that the runs in a weather round were independent of each other.

Usage: python3 bench/verify_round.py <run tag prefix>

Every failure this repository has published came from a run that inherited
something: a committed answer tree, a workspace the clear refused to empty, a
result pooled across harnesses. Each was found afterwards by a person. This
checks the property those failures violate, which is that two runs of the same
model, from an empty directory, do not produce the same bytes.
"""
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
tag = sys.argv[1] if len(sys.argv) > 1 else sys.exit("usage: verify_round.py <tag prefix>")

results = sorted(ROOT.glob(f"bench/weather-*-{tag}*.json"))
if not results:
    sys.exit(f"✗ no result files matching bench/weather-*-{tag}*.json")

problems, by_model = [], defaultdict(list)

for r in results:
    d = json.loads(r.read_text())
    key, run = d["model_key"], r.stem.split("-")[-1]
    if d.get("void"):
        problems.append(f"{r.name}: marked void — {d['void'][:60]}...")

    if any(phase.get("timed_out") for phase in d["phases"]):
        capped = [p["phase"] for p in d["phases"] if p.get("timed_out")]
        problems.append(f"{r.name}: {', '.join(capped)} phase hit its cap. The turn was cut off, so "
                        "the tree is whatever existed at the cap, not a submission.")

    for phase in d["phases"]:
        t = phase.get("transcript")
        if not t:
            problems.append(f"{r.name}: {phase['phase']} phase kept no transcript, so traps 7 and 8 cannot be read")
        elif not (ROOT / t).exists():
            problems.append(f"{r.name}: transcript {t} is missing")
        sl = phase.get("session_log")
        if not sl:
            problems.append(f"{r.name}: {phase['phase']} phase names no session log, so traps 7 and 8 "
                            "can only be guessed from the wrapper summary")
        elif not (ROOT / sl).exists():
            problems.append(f"{r.name}: session log {sl} is missing")

    sub = d.get("submission")
    if not sub:
        problems.append(f"{r.name}: no archived submission, so the code cannot be scored")
        continue
    sub = ROOT / sub
    if not sub.is_dir():
        problems.append(f"{r.name}: submission {sub} is missing")
        continue

    # Hash the tree, not the file list. Two runs that produce the same file
    # names are ordinary; two that produce the same bytes did not both write it.
    h = hashlib.sha256()
    for f in sorted(p for p in sub.rglob("*") if p.is_file() and "node_modules" not in p.parts):
        h.update(str(f.relative_to(sub)).encode())
        h.update(f.read_bytes())
    by_model[key].append((run, h.hexdigest()[:12], d))

# Across the whole round, not per model. The queue alternates arms, so the run
# most likely to inherit a workspace is the one from the *other* model, and
# grouping by model made exactly that case invisible.
seen = defaultdict(list)
for key, runs in by_model.items():
    for run, digest, _ in runs:
        seen[digest].append(f"{key} run {run}")
for digest, shared in seen.items():
    if len(shared) > 1:
        problems.append(f"byte-identical trees ({digest}) from {'; '.join(sorted(shared))}. "
                        "One run started from another's workspace.")

print(f"→ {len(results)} result files, tag {tag}\n")
for key, runs in sorted(by_model.items()):
    print(f"  {key}")
    for run, digest, d in sorted(runs):
        t = d["tests"]
        print(f"    run {run}  {d['total_seconds']:>7.1f}s  tree {digest}  "
              f"tests {'pass' if t.get('passed') else 'FAIL'} "
              f"({t.get('pass_count')}/{(t.get('pass_count') or 0) + (t.get('fail_count') or 0)})")
    print()

if problems:
    print("✗ do not score this round:")
    for p in problems:
        print(f"  - {p}")
    sys.exit(1)
print("✓ every run archived a distinct tree and kept its transcripts. Score it blind.")
