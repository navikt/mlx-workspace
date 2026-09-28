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

## Review (2026-09-28)

The Frontier section pools every night. This section covers follow-ups 1 alone, taken from `steps.jsonl` and the twelve result files. All ten frontier files carry `harness_sha` df7deb1af416 and `tasks_sha` 17d0cf33d776, the same as night 2 and the 64 GB nights, and every sample's `served_model` is `mlx-community/Qwen3.6-35B-A3B-OptiQ-4bit`. No sample was invalid, none looped (longest identical run 2), and none timed out. Both decide runs made 896 calls with no errors, on `nav-pilot-main-7236795f`. Intervals are 95 % Wilson.

**Steps 13–18 did not run.** Twelve of 18 steps ran, and the last six (12 create-file samples per arm) stopped in 2–3 s each at `assert_workspace_is_clean`. The cause is one retry2 sample in step 12 (run 2, `cf-r1-a`). Its first attempt listed the workspace and saw `kotlin/`, but its `find` calls for the source files, under the repo and under `/`, returned nothing. It then wrote `DateUtil.kt` and a test under a guessed `src/main/kotlin/no/nav/syfo/…` and `src/test/…` at the workspace root, beside `kotlin/`. Its second attempt deleted both files but left the empty directories, and the third attempt made no changes. The sample counts as failed ("no changes made"), which is right. The next sample (run 2, `cf-r1-b`) tried to read the stray `DateUtil.kt` and got "File not found", so nothing reached a scored sample. The empty tree was moved to `.bench-logs/night3-20260928-080235/stray/`. The steps were not resumed. After harness v2 (#113) they would carry a new `harness_sha` and could not pool with night 2, and v2's per-sample sweep moves exactly this kind of stray (its docstring names this night).

### 1. decide order × negation (steps 1–2)

The question: is the yes/no inconsistency a pull to the last option, or a prior that the text is fine? Per arm, the pooled why/pr/describes sets (n = 184, where fine is always `yes`) and goapi (n = 40, where fine is `no`):

| Arm | Question | Fine answer at | optiq correct | optiq picked B | 27B correct | 27B picked B | goapi picked B, optiq / 27B |
|---|---|---|---|---|---|---|---|
| default | positive | A | 162/184 [0.83–0.92] | 80 | 173/184 [0.90–0.97] | 81 | 32 / 25 (fine at B) |
| swap | positive | B | 139/184 | 137 | 136/184 | 140 | 24 / 21 (fine at A) |
| negate | negated | B | 101/184 [0.48–0.62] | 161 | 111/184 [0.53–0.67] | 137 | 22 / 27 (fine at A) |
| negate-swap | negated | A | 113/184 | 111 | 112/184 | 66 | 40 / 33 (fine at B) |

- **Both models pull to the last option.** With the question held fixed, moving the fine answer from A to B raises how often it is picked, in all eight comparisons (two models × two sets × two question forms), each at McNemar p ≤ 0.031.
- **A "text is fine" prior does not explain it.** On goapi, where fine is `no`, the arms with fine at A pick it in fewer than half the cases: optiq 16/40 and 18/40, the 27B 19/40 and 13/40. On the pooled sets, negation moves optiq's picks of fine in opposite directions: with fine at A, negating lowers them (104 → 73 of 184), and with fine at B it raises them (137 → 161). A prior as the only cause would move both the same way. A small prior on top of the position pull is not ruled out. What stays the same is that negation strengthens the pull to B: optiq picks B in 217/368 [0.54–0.64] positive answers and in 272/368 [0.69–0.78] negated ones.
- **The 27B is mostly position.** With the position held fixed, negation changes little on the pooled sets (b/c 24/39, p = 0.077, and 23/20, p = 0.761), and its B share does not rise under negation (221/368 positive, 203/368 negated).
- Both models repeat #61's arms answer for answer (672/672 each), so the decide path is deterministic across days.

**What changes:** nothing in nav-pilot, as [decide-layout-results.md](../../bench/decide-layout-results.md) already recommended. The recipes keep the shipped `yes,no` order and positive wording. The cause they can now name is a pull to the last-listed option, stronger in optiq when the question is negated. A negated wording is a different question: 0.55–0.61 correct, against 0.88–0.94 in the shipped order.

### 2. read-qa `example` against base (steps 3–10)

The question: is `example`'s gain (26/40 [0.50–0.78] on 27 September against 18/40 [0.31–0.60] on night 1) real? ABBA twice in one night, n = 16 per rung and arm:

| Rung | base | example | one-sided Fisher p |
|---|---|---|---|
| 1 | 2/16 [0.03–0.36] | 13/16 [0.57–0.93] | < 0.001 |
| 2 | 10/16 [0.39–0.82] | 12/16 [0.51–0.90] | 0.35 |
| 3 | 3/16 [0.07–0.43] | 9/16 [0.33–0.77] | 0.033 |
| 4 | 9/16 [0.33–0.77] | 14/16 [0.64–0.97] | 0.057 |
| 5 | 8/16 [0.28–0.72] | 9/16 [0.33–0.77] | 0.50 |
| **all** | **32/80** [0.30–0.51] | **57/80** [0.61–0.80] | < 0.001 |

Median seconds per sample are 0.95–1.42× base's. By design §7's replication rule, `example` replicates at rungs 1, 3 and 4. It does not move the open frontier (0 → 0), so the rule that it moves a rung is not met. Both arms land close to their earlier rates (base 0.40 against 0.45, example 0.71 against 0.65).

The failures show what the prefix does. Base fails 48 times: 40 answers list a file too many (35 of them only extras, the pattern read-qa-analysis.md traced to the defining file), and 8 have no ANSWER line. Example fails 23 times: 5 with extra or missing files, and 18 with no ANSWER line, spread over 8 of the 10 tasks. So the prefix fixes the defining-file error that [read-qa-analysis.md](read-qa-analysis.md) found, and more sessions now end without the answer line.

**What changes:** the `example` lever is real on read-qa. It does not change a routing verdict: every rung is still `cloud` against the bar of 0.95 × p_cloud (the cloud is 8/8 at every rung). The next lever is a reminder of the ANSWER line on top of `example`. That is a new variant (a `harness_sha` input), so it comes after v2: navikt/mlx-workspace#114.

### 3. create-file `retry2` cost per task (steps 11–18)

The question: does retry2 pass design §7's 2× time rule per task? Only one of the four ABBA blocks ran, so tonight adds 4 samples per arm: base 0/4 [0.00–0.49], retry2 3/4 [0.30–0.95] (p = 0.071), with a median of 189 s against 156 s. Pooled with night 2 at the same `harness_sha` (night 1 ran at an earlier `harness_sha`, 3c5708b4423f, and is left out):

| Task | base | retry2 | Fisher p | median s, base / retry2 | ratio | seconds per verified sample, base / retry2 |
|---|---|---|---|---|---|---|
| cf-r1-a | 0/10 [0.00–0.28] | 7/10 [0.40–0.89] | 0.002 | 100 / 269 | 2.7× | – (no pass) / 387 |
| cf-r1-b | 5/10 [0.24–0.76] | 8/10 [0.49–0.94] | 0.18 | 125 / 156 | 1.25× | 340 / 265 |
| **both** | **5/20** [0.11–0.47] | **15/20** [0.53–0.89] | 0.002 | 110 / 223 | 2.02× | 618 / 322 |

- retry2 fails the 2× rule on cf-r1-a alone, the task base never solves (0/10, 9 of them "the new test does not pass"). 4 of retry2's 7 passes there came on a second attempt, and the pooled ratio of 2.016 is one sample from the line.
- Per verified result, retry2 is cheaper on both tasks: 322 s against 618 s pooled.
- Design §7 measures time per sample, so by the rule as written retry2 does not replicate on create-file. Counting cost per verified result instead would be a change to the rule after seeing the data, and that is the user's call, not the report's. It is listed in [UNMEASURED.md](../UNMEASURED.md).

**Invalid samples:** none. The one stray-writing sample is scored and counted, as above.
