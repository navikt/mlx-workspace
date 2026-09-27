# Quality frontier, night 64 2: results

Written by `mise run night-run-3` from `.bench-logs/night3-20260927-015045/steps.jsonl` and the result files. The plan and the rules are [design.md](design.md). Local model(s) `qwen3.6-35b-a3b-optiq-64g`, `qwen3.6-35b-a3b-8bit-64g`, `laguna-xs-2.1-8bit-64g`, `occamy-1.0-4bit-64g`, `qwen3.6-35b-a3b-optiq`, cloud reference `claude-sonnet-5`.

- Started 2026-09-27T01:51:06+02:00, last step ended 2026-09-27T08:56:27+02:00.
- Cloud spend: $0 of the $80 cap.

## Steps

| # | Part | Step | Classes | Variant | Status | Minutes | Result |
|---|---|---|---|---|---|---|---|
| 1 | local | lever | edit-multi-mechanical | decompose | OK | 33 | `bench/frontier-qwen3.6-35b-a3b-optiq-64g-decompose-20260927-015106.json` |
| 2 | local | lever | edit-multi-mechanical | decompose | OK | 39 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-decompose-20260927-022427.json` |
| 3 | local | lever | edit-multi-mechanical | decompose | OK | 49 | `bench/frontier-laguna-xs-2.1-8bit-64g-decompose-20260927-030333.json` |
| 4 | local | lever | edit-single | decompose | OK | 7 | `bench/frontier-qwen3.6-35b-a3b-optiq-64g-decompose-20260927-035211.json` |
| 5 | local | lever | edit-single | decompose | OK | 11 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-decompose-20260927-035940.json` |
| 6 | local | lever | edit-single | decompose | TIMEOUT | 16 | `bench/frontier-laguna-xs-2.1-8bit-64g-decompose-20260927-041015.json` |
| 7 | local | lever | edit-single | retry2 | OK | 4 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-retry2-20260927-042617.json` |
| 8 | local | lever | edit-single | retry2 | OK | 5 | `bench/frontier-laguna-xs-2.1-8bit-64g-retry2-20260927-043036.json` |
| 9 | local | lever | create-file | retry2 | OK | 48 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-retry2-20260927-043547.json` |
| 10 | local | lever | create-file | retry2 | OK | 65 | `bench/frontier-occamy-1.0-4bit-64g-retry2-20260927-052414.json` |
| 11 | local | lever | create-file | retry2 | OK | 67 | `bench/frontier-laguna-xs-2.1-8bit-64g-retry2-20260927-062942.json` |
| 12 | local | base | edit-multi-mechanical | base | OK | 23 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-base-20260927-073630.json` |
| 13 | local | base | edit-single | base | OK | 16 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-base-20260927-075920.json` |
| 14 | local | base | edit-multi-mechanical | base | TIMEOUT:    ✗ run 1 fm-r4-b        92.4s · 1 att · 28 tools · 1 call site(s) without the file-name literal: NarmesteLederMock.kt: 'listOf(\n                      ' | 30 | `bench/frontier-occamy-1.0-4bit-64g-base-20260927-081539.json` |
| 15 | local | base | edit-multi-mechanical | base | FAIL (exit 1): ✗ /Users/hans/mlx-workspace/workspaces/laguna-xs-2.1-8bit-64g holds src, which the agent can read and which the per-task reset does not touch. | 0 | `` |
| 16 | local | base | edit-single | base | FAIL (exit 1): ✗ /Users/hans/mlx-workspace/workspaces/laguna-xs-2.1-8bit-64g holds src, which the agent can read and which the per-task reset does not touch. | 0 | `` |
| 17 | local | lever | read-qa | example | OK | 11 | `bench/frontier-qwen3.6-35b-a3b-optiq-example-20260927-084548.json` |

## Frontier

From `mise run bench-frontier -- summary`. Verdicts per rung use the routing bar (design.md §4); frontier = highest rung with every rung up to it trusted / not ruled out.

### edit-multi-mechanical (bar 0.90 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | r5 | r6 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 7/10 0.88 trusted | 9/10 0.94 trusted | 10/10 0.96 trusted | 10/10 0.95 trusted | 10/10 0.92 trusted | 10/10 0.86 not-yet | 5 / 6 | none | – | 317.0+ |
| laguna-xs-2.1-8bit-64g | decompose | local |  |  | 4/4 0.71 not-yet | 3/4 0.57 cloud | 3/4 0.52 cloud | 3/4 0.43 cloud | 0 / 3 | 4 | 477.1 | 6.8 |
| occamy-1.0-4bit-64g | base | local |  |  | 3/4 0.43 cloud | 2/4 0.29 cloud | 1/2 0.23 cloud | 1/2 0.16 cloud | 0 / 0 | 3 | 29.5 | – |
| occamy-1.0-4bit-64g | decompose | local |  |  | 2/4 0.66 cloud | 4/4 0.83 not-yet | 4/4 0.71 not-yet | 3/4 0.43 cloud | 0 / 0 | 3 | – | – |
| qwen3.6-35b-a3b-8bit-64g | base | local |  |  | 4/4 0.83 not-yet | 4/4 0.76 not-yet | 3/4 0.66 cloud | 4/4 0.71 not-yet | 0 / 4 | 5 | – | 317.0+ |
| qwen3.6-35b-a3b-8bit-64g | decompose | local |  |  | 3/4 0.66 cloud | 3/4 0.66 cloud | 4/4 0.71 not-yet | 3/4 0.43 cloud | 0 / 0 | 3 | – | 317.0+ |
| qwen3.6-35b-a3b-optiq | base | local | 10/10 0.86 trusted | 9/10 0.78 not-yet | 9/10 0.72 not-yet | 7/10 0.58 cloud | 6/10 0.56 cloud | 8/10 0.60 cloud | 1 / 3 | 4 | 1099.3 | – |
| qwen3.6-35b-a3b-optiq | base | local |  |  |  | 14/16 0.78 cloud | 14/16 0.73 cloud |  | 0 / 0 | 4 | – | – |
| qwen3.6-35b-a3b-optiq | cap900 | local |  |  |  | 2/4 0.29 cloud | 2/4 0.23 cloud |  | 0 / 0 | 4 | – | – |
| qwen3.6-35b-a3b-optiq | retry2 | local |  |  |  | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  | 0 / 5 | none | – | 29.0+ |
| qwen3.6-35b-a3b-optiq | retry2 | local |  |  |  | 15/16 0.86 not-yet | 15/16 0.81 not-yet |  | 0 / 5 | none | – | 29.0+ |
| qwen3.6-35b-a3b-optiq-64g | decompose | local |  |  | 1/4 0.53 cloud | 4/4 0.71 not-yet | 2/4 0.52 cloud | 4/4 0.71 not-yet | 0 / 0 | 3 | – | 317.0+ |

### edit-single (bar 0.90 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | r5 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 8/8 0.93 not-yet | 8/8 0.90 not-yet | 7/7 0.81 not-yet | 7/8 0.66 not-yet | 6/8 0.52 not-yet | 0 / 5 | none | 107.7 | 19.2 |
| laguna-xs-2.1-8bit-64g | decompose | local |  |  | 2/2 0.65 not-yet | 1/1 0.38 not-yet |  | 0 / 4 | none | – | – |
| laguna-xs-2.1-8bit-64g | retry2 | local | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  |  |  | 0 / 2 | none | – | 2.0+ |
| occamy-1.0-4bit-64g | base | local | 2/4 0.57 cloud | 4/4 0.71 not-yet | 3/4 0.47 cloud | 2/3 0.33 cloud | 1/2 0.16 cloud | 0 / 0 | 1 | – | – |
| occamy-1.0-4bit-64g | decompose | local |  |  | 4/4 0.88 not-yet | 4/4 0.83 not-yet | 4/4 0.71 not-yet | 0 / 5 | none | – | 64.0+ |
| occamy-1.0-4bit-64g | retry2 | local | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  |  |  | 0 / 2 | none | – | 2.0+ |
| qwen3.6-35b-a3b-8bit-64g | base | local | 3/4 0.53 cloud | 3/4 0.48 cloud | 2/4 0.40 cloud | 3/4 0.43 cloud | 2/4 0.23 cloud | 0 / 0 | 1 | 133.8 | – |
| qwen3.6-35b-a3b-8bit-64g | decompose | local |  |  | 3/4 0.76 cloud | 4/4 0.83 not-yet | 4/4 0.71 not-yet | 0 / 0 | 3 | – | 64.0+ |
| qwen3.6-35b-a3b-8bit-64g | retry2 | local | 4/4 0.71 not-yet | 3/4 0.43 cloud |  |  |  | 0 / 1 | 2 | 3.5 | 1.4 |
| qwen3.6-35b-a3b-optiq | base | local | 4/8 0.55 cloud | 7/8 0.66 cloud | 3/8 0.49 cloud | 6/8 0.59 cloud | 6/8 0.52 not-yet | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 13/16 0.66 cloud | 10/16 0.47 cloud |  |  |  | 0 / 0 | 1 | 3.0 | – |
| qwen3.6-35b-a3b-optiq | retry2 | local | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  |  |  | 0 / 2 | none | – | 2.0+ |
| qwen3.6-35b-a3b-optiq | retry2 | local | 16/16 0.95 trusted | 16/16 0.91 trusted |  |  |  | 2 / 2 | none | – | 2.0+ |
| qwen3.6-35b-a3b-optiq-64g | decompose | local |  |  | 3/4 0.66 cloud | 4/4 0.71 not-yet | 2/4 0.23 cloud | 0 / 0 | 3 | 144.1 | – |

### read-qa (bar 0.95 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | r5 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 8/8 0.96 not-yet | 8/8 0.95 not-yet | 8/8 0.94 not-yet | 8/8 0.91 not-yet | 8/8 0.83 not-yet | 0 / 5 | none | – | 12.0+ |
| qwen3.6-35b-a3b-optiq | base | local | 2/8 0.35 cloud | 5/8 0.40 cloud | 0/8 0.34 cloud | 7/8 0.66 cloud | 4/8 0.29 cloud | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | cap900 | local | 1/4 0.11 cloud | 1/4 0.08 cloud |  |  |  | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | example | local | 5/8 0.59 cloud | 7/8 0.66 cloud | 3/8 0.47 cloud | 7/8 0.66 cloud | 4/8 0.29 cloud | 0 / 0 | 1 | – | – |

### create-file (bar 0.90 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 2/4 0.66 not-yet | 4/4 0.83 not-yet | 4/4 0.71 not-yet | 3/4 0.43 not-yet | 0 / 4 | none | – | 4.0+ |
| laguna-xs-2.1-8bit-64g | retry2 | local | 2/4 0.23 not-yet | 0/4 0.11 cloud | 2/4 0.23 cloud |  | 0 / 1 | 2 | 0.2 | – |
| occamy-1.0-4bit-64g | retry2 | local | 2/4 0.48 not-yet | 3/4 0.52 cloud | 3/4 0.43 cloud |  | 0 / 1 | 2 | – | – |
| qwen3.6-35b-a3b-8bit-64g | retry2 | local | 4/4 0.83 not-yet | 4/4 0.71 not-yet | 3/4 0.43 cloud |  | 0 / 2 | 3 | 5.5 | 2.3 |
| qwen3.6-35b-a3b-optiq | base | local | 1/4 0.13 cloud | 1/4 0.11 cloud | 1/4 0.08 cloud | 0/4 0.00 cloud | 0 / 0 | 1 | 0.3 | – |
| qwen3.6-35b-a3b-optiq | base | local | 5/16 0.19 cloud |  |  |  | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | retry2 | local | 3/4 0.43 not-yet | 2/4 0.23 cloud |  |  | 0 / 1 | 2 | 2.1 | – |
| qwen3.6-35b-a3b-optiq | retry2 | local | 12/16 0.59 trusted |  |  |  | 1 / 1 | none | – | – |

### debug (bar 0.95 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r3 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 3/4 0.52 not-yet | 3/4 0.43 not-yet | 0 / 3 | none | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 3/4 0.43 not-yet |  | 0 / 1 | none | – | – |

### Harvest: frontier (open) by variant against base

- create-file · qwen3.6-35b-a3b-optiq · retry2: 0 → 1 (moves it)
- create-file · qwen3.6-35b-a3b-optiq · retry2: 0 → 1 (moves it)
- edit-multi-mechanical · occamy-1.0-4bit-64g · decompose: 0 → 0 (no gain)
- edit-multi-mechanical · qwen3.6-35b-a3b-8bit-64g · decompose: 4 → 0 (no gain)
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · cap900: 0 → 0 (no gain)
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · retry2: 0 → 5 (moves it)
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · retry2: 0 → 5 (moves it)
- edit-single · occamy-1.0-4bit-64g · decompose: 0 → 5 (moves it)
- edit-single · occamy-1.0-4bit-64g · retry2: 0 → 2 (moves it)
- edit-single · qwen3.6-35b-a3b-8bit-64g · decompose: 0 → 0 (no gain)
- edit-single · qwen3.6-35b-a3b-8bit-64g · retry2: 0 → 1 (moves it)
- edit-single · qwen3.6-35b-a3b-optiq · retry2: 0 → 2 (moves it)
- edit-single · qwen3.6-35b-a3b-optiq · retry2: 0 → 2 (moves it)
- read-qa · qwen3.6-35b-a3b-optiq · cap900: 0 → 0 (no gain)
- read-qa · qwen3.6-35b-a3b-optiq · example: 0 → 0 (no gain)

✓ bench/frontier-summary.json

## Replication against base (design.md §7)

Same night, same model and harness. A rung passes when both arms have n ≥ 8, the one-sided Fisher p (lever > base) is < 0.1, and the lever's median seconds per sample is ≤ 2× base's. "1st try" is the lever's samples that passed without a retry: the same session as base up to its first check, so it should match base's rate, and a gap there is drift or noise, not the lever.

### edit-multi-mechanical · decompose

| Rung | base k/n | lever k/n | 1st try | p (one-sided) | base med s | lever med s | ratio | passes |
|---|---|---|---|---|---|---|---|---|
| 3 | 7/8 | 8/12 | 8/12 | 0.949 | 66 | 81 | 1.22 | no |
| 4 | 6/8 | 10/12 | 10/12 | 0.535 | 55 | 137 | 2.49 | no |
| 5 | 4/6 | 9/12 | 9/12 | 0.561 | 139 | 165 | 1.19 | no |
| 6 | 5/6 | 10/12 | 10/12 | 0.730 | 91 | 172 | 1.89 | no |

Verdict: decompose does not replicate on edit-multi-mechanical at any rung run tonight.

### edit-single · decompose

| Rung | base k/n | lever k/n | 1st try | p (one-sided) | base med s | lever med s | ratio | passes |
|---|---|---|---|---|---|---|---|---|
| 3 | 2/4 | 8/10 | 8/10 | 0.311 | 48 | 34 | 0.71 | no |
| 4 | 3/4 | 9/9 | 9/9 | 0.308 | 41 | 42 | 1.01 | no |
| 5 | 2/4 | 6/8 | 6/8 | 0.406 | 55 | 40 | 0.73 | no |

Verdict: decompose does not replicate on edit-single at any rung run tonight.

### edit-single · retry2

| Rung | base k/n | lever k/n | 1st try | p (one-sided) | base med s | lever med s | ratio | passes |
|---|---|---|---|---|---|---|---|---|
| 1 | 3/4 | 8/8 | 8/8 | 0.333 | 18 | 17 | 0.93 | no |
| 2 | 3/4 | 7/8 | 6/8 | 0.576 | 23 | 39 | 1.69 | no |

Verdict: retry2 does not replicate on edit-single at any rung run tonight.

## Review (2026-09-27)

Counts come from the raw result files for this night (`bench/frontier-*-20260927-0[1-8]*.json`), with Occamy's cells from day 64-0b (`*-20260926-*`) and the Laguna bases from the 64-2c rerun. Each cell has 2 runs per rung, so these are first cells, not verdicts (the replication bar is n ≥ 8).

| Cell | optiq (control) | Qwen3.6 8-bit | Occamy 4-bit | Laguna 8-bit |
|---|---|---|---|---|
| decompose, edit-multi r3–r6 | 11/16 | 13/16 | 13/16 | 13/16 |
| decompose, edit-single r3–r5 | 9/12 | 11/12 | 12/12 | 3/3 (step timed out) |
| retry2, edit-single r1–r2 | 16/16 (night 2) | 7/8 | 8/8 | 8/8 |
| retry2, create-file r1–r3 | 12/16, r1 only (night 2) | **11/12** | 8/12 | 4/12 |
| base, edit-multi r3–r6 | 14/16 r4–r5 (night 2) | 15/16 | 7/12 | 4/5 (timed out, median 270 s per sample) |
| base, edit-single r1–r5 | 13/16 and 10/16 r1–r2 (night 2) | 13/20 | 12/17 | 8/9 (timed out) |
| read-qa with `example` (optiq) | 26/40 against 18/40 at base (night 1) and 40/40 in the cloud | | | |

**What it says so far:**
- Qwen3.6-35B-A3B 8-bit is the most consistent worker candidate. It is the best of the four on create-file with retries, which is a cloud class today. It uses the same architecture and publisher as the shipped default, so it could ship first.
- Occamy is the best on decomposed single-file edits, but weaker at base (autonomous).
- Laguna is weak on create-file and slow at base: both base steps hit their timeouts. It also wrote test files at the workspace root rather than under `kotlin/` on create-file (07:02). The runner scored those samples as failures, but the stray `src/` blocked the next two steps until it was moved to `.bench-logs/night3-20260927-015045/stray/`.
- Every candidate beats the optiq control on decomposed tasks.
- The `example` prefix lifts optiq's read-qa from 18/40 to 26/40, which supports the analysis in `reports/2026-09-25-quality-frontier/read-qa-analysis.md`.

**Harness follow-up:** the runner doesn't clean files a model writes outside the task directory between samples. The night preflight (#72) only catches them at the start of a night. A per-sample cleanup touches `_frontier.py`, which is a `harness_sha` input, so it is held until the 64 GB series is done (pending-tasks §8.8).

**Next:** night 64-3, the hybrid arm with Sonnet 5 as orchestrator, runs with Qwen3.6 8-bit and Occamy as workers and optiq as the control. It will start after the fixes from the adversarial review and a pilot capped at $2.
