# Quality frontier, night followups 1: results

Written by `mise run night-run-3` from `.bench-logs/night3-20260928-080235/steps.jsonl` and the result files. The plan and the rules are [design.md](design.md). Local model(s) `qwen3.6-35b-a3b-optiq`, `qwen3.8-27b-optiq-4bit`, cloud reference `claude-sonnet-5`.

- Started 2026-09-28T08:02:56+02:00, last step ended 2026-09-28T09:51:16+02:00.
- Cloud spend: $0 of the $80 cap.

## Steps

| # | Part | Step | Classes | Variant | Status | Minutes | Result |
|---|---|---|---|---|---|---|---|
| 1 | local | decide | order | - | OK | 11 | `bench/decide-order-qwen3.6-35b-a3b-optiq-20260928-080256.json` |
| 2 | local | decide | order | - | OK | 28 | `bench/decide-order-qwen3.8-27b-optiq-4bit-20260928-081347.json` |
| 3 | local | base | read-qa | base | OK | 6 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260928-084134.json` |
| 4 | local | lever | read-qa | example | OK | 6 | `bench/frontier-qwen3.6-35b-a3b-optiq-example-20260928-084706.json` |
| 5 | local | lever | read-qa | example | OK | 6 | `bench/frontier-qwen3.6-35b-a3b-optiq-example-20260928-085312.json` |
| 6 | local | base | read-qa | base | OK | 5 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260928-085851.json` |
| 7 | local | base | read-qa | base | OK | 5 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260928-090356.json` |
| 8 | local | lever | read-qa | example | OK | 5 | `bench/frontier-qwen3.6-35b-a3b-optiq-example-20260928-090904.json` |
| 9 | local | lever | read-qa | example | OK | 5 | `bench/frontier-qwen3.6-35b-a3b-optiq-example-20260928-091431.json` |
| 10 | local | base | read-qa | base | OK | 6 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260928-091956.json` |
| 11 | local | base | create-file | base | OK | 13 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260928-092542.json` |
| 12 | local | lever | create-file | retry2 | OK | 12 | `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20260928-093833.json` |
| 13 | local | lever | create-file | retry2 | FAIL (exit 1): ✗ /Users/hans/mlx-workspace/workspaces/qwen3.6-35b-a3b-optiq holds src, which the agent can read and which the per-task reset does not touch. | 0 | `` |
| 14 | local | base | create-file | base | FAIL (exit 1): ✗ /Users/hans/mlx-workspace/workspaces/qwen3.6-35b-a3b-optiq holds src, which the agent can read and which the per-task reset does not touch. | 0 | `` |
| 15 | local | base | create-file | base | FAIL (exit 1): ✗ /Users/hans/mlx-workspace/workspaces/qwen3.6-35b-a3b-optiq holds src, which the agent can read and which the per-task reset does not touch. | 0 | `` |
| 16 | local | lever | create-file | retry2 | FAIL (exit 1): ✗ /Users/hans/mlx-workspace/workspaces/qwen3.6-35b-a3b-optiq holds src, which the agent can read and which the per-task reset does not touch. | 0 | `` |
| 17 | local | lever | create-file | retry2 | FAIL (exit 1): ✗ /Users/hans/mlx-workspace/workspaces/qwen3.6-35b-a3b-optiq holds src, which the agent can read and which the per-task reset does not touch. | 0 | `` |
| 18 | local | base | create-file | base | FAIL (exit 1): ✗ /Users/hans/mlx-workspace/workspaces/qwen3.6-35b-a3b-optiq holds src, which the agent can read and which the per-task reset does not touch. | 0 | `` |

## Frontier

From `mise run bench-frontier -- summary`. Verdicts per rung use the routing bar (design.md §4); frontier = highest rung with every rung up to it trusted / not ruled out.

### edit-multi-mechanical (bar 0.90 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | r5 | r6 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 7/10 0.88 trusted | 9/10 0.94 trusted | 10/10 0.96 trusted | 10/10 0.95 trusted | 10/10 0.92 trusted | 10/10 0.86 not-yet | 5 / 6 | none | – | 317.0+ |
| laguna-xs-2.1-8bit-64g | base | local |  |  | 1/2 0.51 cloud | 2/2 0.65 not-yet | 1/1 0.38 not-yet |  | 0 / 0 | 3 | – | 29.0+ |
| laguna-xs-2.1-8bit-64g | decompose | local |  |  | 4/4 0.71 not-yet | 3/4 0.57 cloud | 3/4 0.52 cloud | 3/4 0.43 cloud | 0 / 3 | 4 | 477.1 | 6.8 |
| occamy-1.0-4bit-64g | base | local |  |  | 3/4 0.43 cloud | 2/4 0.29 cloud | 1/2 0.23 cloud | 1/2 0.16 cloud | 0 / 0 | 3 | 29.5 | – |
| occamy-1.0-4bit-64g | decompose | local |  |  | 10/12 0.76 cloud | 11/12 0.76 not-yet | 8/12 0.62 cloud | 10/12 0.66 cloud | 0 / 0 | 3 | – | – |
| qwen3.6-35b-a3b-8bit-64g | base | local |  |  | 4/4 0.83 not-yet | 4/4 0.76 not-yet | 3/4 0.66 cloud | 4/4 0.71 not-yet | 0 / 4 | 5 | – | 317.0+ |
| qwen3.6-35b-a3b-8bit-64g | decompose | local |  |  | 10/12 0.77 cloud | 11/12 0.76 not-yet | 10/12 0.67 cloud | 9/12 0.57 cloud | 0 / 0 | 3 | – | – |
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
| laguna-xs-2.1-8bit-64g | base | local | 2/2 0.83 not-yet | 2/2 0.79 not-yet | 2/2 0.71 not-yet | 2/2 0.55 not-yet | 0/1 0.00 cloud | 0 / 4 | 5 | 31.1 | 11.2 |
| laguna-xs-2.1-8bit-64g | decompose | local |  |  | 2/2 0.65 not-yet | 1/1 0.38 not-yet |  | 0 / 4 | none | – | – |
| laguna-xs-2.1-8bit-64g | retry2 | local | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  |  |  | 0 / 2 | none | – | 2.0+ |
| occamy-1.0-4bit-64g | base | local | 2/4 0.57 cloud | 4/4 0.71 not-yet | 3/4 0.47 cloud | 2/3 0.33 cloud | 1/2 0.16 cloud | 0 / 0 | 1 | – | – |
| occamy-1.0-4bit-64g | decompose | local |  |  | 12/12 0.94 trusted | 12/12 0.88 trusted | 10/12 0.66 not-yet | 4 / 5 | none | 112.7 | 41.0 |
| occamy-1.0-4bit-64g | retry2 | local | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  |  |  | 0 / 2 | none | – | 2.0+ |
| qwen3.6-35b-a3b-8bit-64g | base | local | 3/4 0.53 cloud | 3/4 0.48 cloud | 2/4 0.40 cloud | 3/4 0.43 cloud | 2/4 0.23 cloud | 0 / 0 | 1 | 133.8 | – |
| qwen3.6-35b-a3b-8bit-64g | decompose | local |  |  | 11/12 0.87 not-yet | 11/12 0.87 trusted | 12/12 0.88 trusted | 0 / 5 | none | – | 64.0+ |
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
| qwen3.6-35b-a3b-optiq | base | local | 2/16 0.33 cloud | 10/16 0.47 cloud | 3/16 0.33 cloud | 9/16 0.42 cloud | 8/16 0.35 cloud | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | cap900 | local | 1/4 0.11 cloud | 1/4 0.08 cloud |  |  |  | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | example | local | 18/24 0.69 cloud | 19/24 0.67 cloud | 12/24 0.60 cloud | 21/24 0.76 cloud | 13/24 0.41 cloud | 0 / 0 | 1 | – | – |

### create-file (bar 0.90 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 2/4 0.66 not-yet | 4/4 0.83 not-yet | 4/4 0.71 not-yet | 3/4 0.43 not-yet | 0 / 4 | none | – | 4.0+ |
| laguna-xs-2.1-8bit-64g | retry2 | local | 2/4 0.23 not-yet | 0/4 0.11 cloud | 2/4 0.23 cloud |  | 0 / 1 | 2 | 0.2 | – |
| occamy-1.0-4bit-64g | retry2 | local | 6/12 0.49 trusted | 9/12 0.57 cloud | 6/12 0.33 cloud |  | 1 / 1 | 2 | – | – |
| qwen3.6-35b-a3b-8bit-64g | retry2 | local | 10/12 0.74 trusted | 10/12 0.71 cloud | 10/12 0.66 cloud |  | 1 / 1 | 2 | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 1/4 0.13 cloud | 1/4 0.11 cloud | 1/4 0.08 cloud | 0/4 0.00 cloud | 0 / 0 | 1 | 0.3 | – |
| qwen3.6-35b-a3b-optiq | base | local | 5/20 0.15 cloud |  |  |  | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | retry2 | local | 3/4 0.43 not-yet | 2/4 0.23 cloud |  |  | 0 / 1 | 2 | 2.1 | – |
| qwen3.6-35b-a3b-optiq | retry2 | local | 15/20 0.61 trusted |  |  |  | 1 / 1 | none | – | – |

### debug (bar 0.95 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r3 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 3/4 0.52 not-yet | 3/4 0.43 not-yet | 0 / 3 | none | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 3/4 0.43 not-yet |  | 0 / 1 | none | – | – |

### Harvest: frontier (open) by variant against base

- create-file · qwen3.6-35b-a3b-optiq · retry2: 0 → 1 (moves it)
- create-file · qwen3.6-35b-a3b-optiq · retry2: 0 → 1 (moves it)
- edit-multi-mechanical · laguna-xs-2.1-8bit-64g · decompose: 0 → 3 (moves it)
- edit-multi-mechanical · occamy-1.0-4bit-64g · decompose: 0 → 0 (no gain)
- edit-multi-mechanical · qwen3.6-35b-a3b-8bit-64g · decompose: 4 → 0 (no gain)
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · cap900: 0 → 0 (no gain)
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · retry2: 0 → 5 (moves it)
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · retry2: 0 → 5 (moves it)
- edit-single · laguna-xs-2.1-8bit-64g · decompose: 4 → 4 (no gain)
- edit-single · laguna-xs-2.1-8bit-64g · retry2: 4 → 2 (no gain)
- edit-single · occamy-1.0-4bit-64g · decompose: 0 → 5 (moves it)
- edit-single · occamy-1.0-4bit-64g · retry2: 0 → 2 (moves it)
- edit-single · qwen3.6-35b-a3b-8bit-64g · decompose: 0 → 5 (moves it)
- edit-single · qwen3.6-35b-a3b-8bit-64g · retry2: 0 → 1 (moves it)
- edit-single · qwen3.6-35b-a3b-optiq · retry2: 0 → 2 (moves it)
- edit-single · qwen3.6-35b-a3b-optiq · retry2: 0 → 2 (moves it)
- read-qa · qwen3.6-35b-a3b-optiq · cap900: 0 → 0 (no gain)
- read-qa · qwen3.6-35b-a3b-optiq · example: 0 → 0 (no gain)

✓ bench/frontier-summary.json

## Replication against base (design.md §7)

Same night, same model and harness. A rung passes when both arms have n ≥ 8, the one-sided Fisher p (lever > base) is < 0.1, and the lever's median seconds per sample is ≤ 2× base's. "1st try" is the lever's samples that passed without a retry: the same session as base up to its first check, so it should match base's rate, and a gap there is drift or noise, not the lever.

### create-file · retry2

| Rung | base k/n | lever k/n | 1st try | p (one-sided) | base med s | lever med s | ratio | passes |
|---|---|---|---|---|---|---|---|---|
| 1 | 0/4 | 3/4 | 2/4 | 0.071 | 156 | 189 | 1.21 | no |

Verdict: retry2 does not replicate on create-file at any rung run tonight.

### read-qa · example

| Rung | base k/n | lever k/n | 1st try | p (one-sided) | base med s | lever med s | ratio | passes |
|---|---|---|---|---|---|---|---|---|
| 1 | 2/16 | 13/16 | 13/16 | 0.000 | 5 | 7 | 1.31 | yes |
| 2 | 10/16 | 12/16 | 12/16 | 0.352 | 8 | 8 | 1.05 | no |
| 3 | 3/16 | 9/16 | 9/16 | 0.033 | 6 | 8 | 1.42 | yes |
| 4 | 9/16 | 14/16 | 14/16 | 0.057 | 9 | 9 | 0.99 | yes |
| 5 | 8/16 | 9/16 | 9/16 | 0.500 | 9 | 9 | 0.95 | no |

Verdict: example replicates on read-qa at rung(s) 1, 3, 4.
