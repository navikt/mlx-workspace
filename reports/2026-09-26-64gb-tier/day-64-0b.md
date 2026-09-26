# Quality frontier, day 64 0b: results

Written by `mise run night-run-3` from `.bench-logs/night3-20260926-152946/steps.jsonl` and the result files. The plan and the rules are [design.md](design.md). Local model(s) `occamy-1.0-4bit-64g`, cloud reference `claude-sonnet-5`.

- Started 2026-09-26T15:30:07+02:00, last step ended 2026-09-26T16:47:14+02:00.
- Cloud spend: $0 of the $80 cap.

## Steps

| # | Part | Step | Classes | Variant | Status | Minutes | Result |
|---|---|---|---|---|---|---|---|
| 1 | local | lever | edit-multi-mechanical | decompose | OK | 41 | `bench/frontier-occamy-1.0-4bit-64g-decompose-20260926-153007.json` |
| 2 | local | lever | edit-single | decompose | OK | 13 | `bench/frontier-occamy-1.0-4bit-64g-decompose-20260926-161125.json` |
| 3 | local | lever | edit-single | retry2 | OK | 3 | `bench/frontier-occamy-1.0-4bit-64g-retry2-20260926-162405.json` |
| 4 | local | base | edit-single | base | TIMEOUT:    ✗ run 1 fs-r1-b         6.8s · 1 att · 3 tools · no changes made | 20 | `bench/frontier-occamy-1.0-4bit-64g-base-20260926-162712.json` |

## Frontier

From `mise run bench-frontier -- summary`. Verdicts per rung use the routing bar (design.md §4); frontier = highest rung with every rung up to it trusted / not ruled out.

### edit-multi-mechanical (bar 0.90 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | r5 | r6 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 7/10 0.88 trusted | 9/10 0.94 trusted | 10/10 0.96 trusted | 10/10 0.95 trusted | 10/10 0.92 trusted | 10/10 0.86 not-yet | 5 / 6 | none | – | 317.0+ |
| occamy-1.0-4bit-64g | decompose | local |  |  | 2/4 0.66 cloud | 4/4 0.83 not-yet | 4/4 0.71 not-yet | 3/4 0.43 cloud | 0 / 0 | 3 | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 10/10 0.86 trusted | 9/10 0.78 not-yet | 9/10 0.72 not-yet | 7/10 0.58 cloud | 6/10 0.56 cloud | 8/10 0.60 cloud | 1 / 3 | 4 | 1099.3 | – |
| qwen3.6-35b-a3b-optiq | cap900 | local |  |  |  | 2/4 0.29 cloud | 2/4 0.23 cloud |  | 0 / 0 | 4 | – | – |
| qwen3.6-35b-a3b-optiq | retry2 | local |  |  |  | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  | 0 / 5 | none | – | 29.0+ |

### edit-single (bar 0.90 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | r5 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 8/8 0.93 not-yet | 8/8 0.90 not-yet | 7/7 0.81 not-yet | 7/8 0.66 not-yet | 6/8 0.52 not-yet | 0 / 5 | none | 107.7 | 19.2 |
| occamy-1.0-4bit-64g | base | local | 2/4 0.57 cloud | 4/4 0.71 not-yet | 3/4 0.47 cloud | 2/3 0.33 cloud | 1/2 0.16 cloud | 0 / 0 | 1 | – | – |
| occamy-1.0-4bit-64g | decompose | local |  |  | 4/4 0.88 not-yet | 4/4 0.83 not-yet | 4/4 0.71 not-yet | 0 / 5 | none | – | 64.0+ |
| occamy-1.0-4bit-64g | retry2 | local | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  |  |  | 0 / 2 | none | – | 2.0+ |
| qwen3.6-35b-a3b-optiq | base | local | 4/8 0.55 cloud | 7/8 0.66 cloud | 3/8 0.49 cloud | 6/8 0.59 cloud | 6/8 0.52 not-yet | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | retry2 | local | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  |  |  | 0 / 2 | none | – | 2.0+ |

### read-qa (bar 0.95 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | r5 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 8/8 0.96 not-yet | 8/8 0.95 not-yet | 8/8 0.94 not-yet | 8/8 0.91 not-yet | 8/8 0.83 not-yet | 0 / 5 | none | – | 12.0+ |
| qwen3.6-35b-a3b-optiq | base | local | 2/8 0.35 cloud | 5/8 0.40 cloud | 0/8 0.34 cloud | 7/8 0.66 cloud | 4/8 0.29 cloud | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | cap900 | local | 1/4 0.11 cloud | 1/4 0.08 cloud |  |  |  | 0 / 0 | 1 | – | – |

### create-file (bar 0.90 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 2/4 0.66 not-yet | 4/4 0.83 not-yet | 4/4 0.71 not-yet | 3/4 0.43 not-yet | 0 / 4 | none | – | 4.0+ |
| qwen3.6-35b-a3b-optiq | base | local | 1/4 0.13 cloud | 1/4 0.11 cloud | 1/4 0.08 cloud | 0/4 0.00 cloud | 0 / 0 | 1 | 0.3 | – |
| qwen3.6-35b-a3b-optiq | retry2 | local | 3/4 0.43 not-yet | 2/4 0.23 cloud |  |  | 0 / 1 | 2 | 2.1 | – |

### debug (bar 0.95 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r3 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 3/4 0.52 not-yet | 3/4 0.43 not-yet | 0 / 3 | none | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 3/4 0.43 not-yet |  | 0 / 1 | none | – | – |

### Harvest: frontier (open) by variant against base

- create-file · qwen3.6-35b-a3b-optiq · retry2: 0 → 1 (moves it)
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · cap900: 3 → 0 (no gain)
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · retry2: 3 → 5 (moves it)
- edit-single · occamy-1.0-4bit-64g · decompose: 0 → 5 (moves it)
- edit-single · occamy-1.0-4bit-64g · retry2: 0 → 2 (moves it)
- edit-single · qwen3.6-35b-a3b-optiq · retry2: 0 → 2 (moves it)
- read-qa · qwen3.6-35b-a3b-optiq · cap900: 0 → 0 (no gain)

✓ bench/frontier-summary.json

## Replication against base (design.md §7)

Same night, same model and harness. A rung passes when both arms have n ≥ 8, the one-sided Fisher p (lever > base) is < 0.1, and the lever's median seconds per sample is ≤ 2× base's. "1st try" is the lever's samples that passed without a retry: the same session as base up to its first check, so it should match base's rate, and a gap there is drift or noise, not the lever.

### edit-single · decompose

| Rung | base k/n | lever k/n | 1st try | p (one-sided) | base med s | lever med s | ratio | passes |
|---|---|---|---|---|---|---|---|---|
| 3 | 3/4 | 4/4 | 4/4 | 0.500 | 48 | 30 | 0.63 | no |
| 4 | 2/3 | 4/4 | 4/4 | 0.429 | 66 | 40 | 0.61 | no |
| 5 | 1/2 | 4/4 | 4/4 | 0.333 | 38 | 61 | 1.59 | no |

Verdict: decompose does not replicate on edit-single at any rung run tonight.

### edit-single · retry2

| Rung | base k/n | lever k/n | 1st try | p (one-sided) | base med s | lever med s | ratio | passes |
|---|---|---|---|---|---|---|---|---|
| 1 | 2/4 | 4/4 | 4/4 | 0.214 | 13 | 14 | 1.03 | no |
| 2 | 4/4 | 4/4 | 4/4 | 1.000 | 22 | 17 | 0.75 | no |

Verdict: retry2 does not replicate on edit-single at any rung run tonight.

## Review against the result files

The cells above match the four result files. Step 4 (Occamy base, edit-single) hit its 20-minute
timeout: r4 has 3 of 4 samples and r5 has 2 of 4, so the base row is partial and the replication
tables compare against n = 2–4 base samples. No rung reaches n ≥ 8, so nothing here can replicate.
The runs are 2 per rung, so these are first cells for night 64-2, not verdicts.

- Decompose on edit-single: Occamy 12/12 on r3–r5, against its own base 6/9 on the same rungs.
- retry2 on edit-single r1–r2: Occamy 8/8, the same as optiq's retry2 (8/8, night 2).
- Decompose on edit-multi-mechanical r3–r6: Occamy 13/16 (2/4 at r3, 3/4 at r6). optiq has no
  decompose cells yet, so there is no control for these cells.

**Step 5 was stopped and left out.** A fifth step (optiq decompose on edit-single, the control) ran
from 16:48. At about 16:53, another process changed the workspace `.venv` (mlx-lm 0.32.0 downgraded
to 0.31.3, numpy 2.5.3, torch added). Decompose restarts the server per sample, so the samples after
16:53 ran on the changed environment. The step was stopped at 16:58 (the trap stopped the server).
Its partial file is kept out of `bench/`, at
`.bench-logs/night3-20260926-152946/step5-partial-mixed-env.json`. Steps 1–4 ended by 16:47, before
the change.
