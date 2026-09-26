# Quality frontier, night 2: results

Written by `mise run night-run-3` from `.bench-logs/night3-20260926-194043/steps.jsonl` and the result files. The plan and the rules are [design.md](design.md). Local model `qwen3.6-35b-a3b-optiq`, cloud reference `claude-sonnet-5`.

- Started 2026-09-26T19:41:03+02:00, last step ended 2026-09-26T23:44:45+02:00.
- Cloud spend: $0 of the $80 cap.

## Steps

| # | Part | Step | Classes | Variant | Status | Minutes | Result |
|---|---|---|---|---|---|---|---|
| 1 | local | base | edit-multi-mechanical | base | OK | 17 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260926-194103.json` |
| 2 | local | lever | edit-multi-mechanical | retry2 | OK | 11 | `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20260926-195746.json` |
| 3 | local | lever | edit-multi-mechanical | retry2 | OK | 11 | `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20260926-200837.json` |
| 4 | local | base | edit-multi-mechanical | base | OK | 19 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260926-201915.json` |
| 5 | local | base | edit-multi-mechanical | base | OK | 10 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260926-203810.json` |
| 6 | local | lever | edit-multi-mechanical | retry2 | OK | 8 | `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20260926-204809.json` |
| 7 | local | lever | edit-multi-mechanical | retry2 | OK | 13 | `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20260926-205608.json` |
| 8 | local | base | edit-multi-mechanical | base | OK | 10 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260926-210858.json` |
| 9 | local | base | edit-single | base | OK | 3 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260926-211911.json` |
| 10 | local | lever | edit-single | retry2 | OK | 5 | `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20260926-212228.json` |
| 11 | local | lever | edit-single | retry2 | OK | 5 | `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20260926-212727.json` |
| 12 | local | base | edit-single | base | OK | 3 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260926-213221.json` |
| 13 | local | base | edit-single | base | OK | 3 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260926-213539.json` |
| 14 | local | lever | edit-single | retry2 | OK | 5 | `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20260926-213845.json` |
| 15 | local | lever | edit-single | retry2 | OK | 4 | `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20260926-214328.json` |
| 16 | local | base | edit-single | base | OK | 4 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260926-214716.json` |
| 17 | local | base | create-file | base | OK | 12 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260926-215102.json` |
| 18 | local | lever | create-file | retry2 | OK | 17 | `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20260926-220319.json` |
| 19 | local | lever | create-file | retry2 | OK | 27 | `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20260926-222006.json` |
| 20 | local | base | create-file | base | OK | 11 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260926-224710.json` |
| 21 | local | base | create-file | base | OK | 12 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260926-225756.json` |
| 22 | local | lever | create-file | retry2 | OK | 13 | `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20260926-230935.json` |
| 23 | local | lever | create-file | retry2 | OK | 15 | `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20260926-232221.json` |
| 24 | local | base | create-file | base | OK | 7 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260926-233731.json` |

## Frontier

From `mise run bench-frontier -- summary`. Verdicts per rung use the routing bar (design.md §4); frontier = highest rung with every rung up to it trusted / not ruled out.

### edit-multi-mechanical (bar 0.90 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | r5 | r6 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 7/10 0.88 trusted | 9/10 0.94 trusted | 10/10 0.96 trusted | 10/10 0.95 trusted | 10/10 0.92 trusted | 10/10 0.86 not-yet | 5 / 6 | none | – | 317.0+ |
| occamy-1.0-4bit-64g | decompose | local |  |  | 2/4 0.66 cloud | 4/4 0.83 not-yet | 4/4 0.71 not-yet | 3/4 0.43 cloud | 0 / 0 | 3 | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 10/10 0.86 trusted | 9/10 0.78 not-yet | 9/10 0.72 not-yet | 7/10 0.58 cloud | 6/10 0.56 cloud | 8/10 0.60 cloud | 1 / 3 | 4 | 1099.3 | – |
| qwen3.6-35b-a3b-optiq | base | local |  |  |  | 14/16 0.78 cloud | 14/16 0.73 cloud |  | 0 / 0 | 4 | – | – |
| qwen3.6-35b-a3b-optiq | cap900 | local |  |  |  | 2/4 0.29 cloud | 2/4 0.23 cloud |  | 0 / 0 | 4 | – | – |
| qwen3.6-35b-a3b-optiq | retry2 | local |  |  |  | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  | 0 / 5 | none | – | 29.0+ |
| qwen3.6-35b-a3b-optiq | retry2 | local |  |  |  | 15/16 0.86 not-yet | 15/16 0.81 not-yet |  | 0 / 5 | none | – | 29.0+ |

### edit-single (bar 0.90 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | r5 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 8/8 0.93 not-yet | 8/8 0.90 not-yet | 7/7 0.81 not-yet | 7/8 0.66 not-yet | 6/8 0.52 not-yet | 0 / 5 | none | 107.7 | 19.2 |
| occamy-1.0-4bit-64g | base | local | 2/4 0.57 cloud | 4/4 0.71 not-yet | 3/4 0.47 cloud | 2/3 0.33 cloud | 1/2 0.16 cloud | 0 / 0 | 1 | – | – |
| occamy-1.0-4bit-64g | decompose | local |  |  | 4/4 0.88 not-yet | 4/4 0.83 not-yet | 4/4 0.71 not-yet | 0 / 5 | none | – | 64.0+ |
| occamy-1.0-4bit-64g | retry2 | local | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  |  |  | 0 / 2 | none | – | 2.0+ |
| qwen3.6-35b-a3b-optiq | base | local | 4/8 0.55 cloud | 7/8 0.66 cloud | 3/8 0.49 cloud | 6/8 0.59 cloud | 6/8 0.52 not-yet | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 13/16 0.66 cloud | 10/16 0.47 cloud |  |  |  | 0 / 0 | 1 | 3.0 | – |
| qwen3.6-35b-a3b-optiq | retry2 | local | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  |  |  | 0 / 2 | none | – | 2.0+ |
| qwen3.6-35b-a3b-optiq | retry2 | local | 16/16 0.95 trusted | 16/16 0.91 trusted |  |  |  | 2 / 2 | none | – | 2.0+ |

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
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · cap900: 0 → 0 (no gain)
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · retry2: 0 → 5 (moves it)
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · retry2: 0 → 5 (moves it)
- edit-single · occamy-1.0-4bit-64g · decompose: 0 → 5 (moves it)
- edit-single · occamy-1.0-4bit-64g · retry2: 0 → 2 (moves it)
- edit-single · qwen3.6-35b-a3b-optiq · retry2: 0 → 2 (moves it)
- edit-single · qwen3.6-35b-a3b-optiq · retry2: 0 → 2 (moves it)
- read-qa · qwen3.6-35b-a3b-optiq · cap900: 0 → 0 (no gain)

✓ bench/frontier-summary.json

## Replication against base (design.md §7)

Same night, same model and harness. A rung passes when both arms have n ≥ 8, the one-sided Fisher p (lever > base) is < 0.1, and the lever's median seconds per sample is ≤ 2× base's. "1st try" is the lever's samples that passed without a retry: the same session as base up to its first check, so it should match base's rate, and a gap there is drift or noise, not the lever.

### create-file · retry2

| Rung | base k/n | lever k/n | 1st try | p (one-sided) | base med s | lever med s | ratio | passes |
|---|---|---|---|---|---|---|---|---|
| 1 | 5/16 | 12/16 | 7/16 | 0.016 | 110 | 224 | 2.03 | no |

Verdict: retry2 does not replicate on create-file at any rung run tonight.

### edit-multi-mechanical · retry2

| Rung | base k/n | lever k/n | 1st try | p (one-sided) | base med s | lever med s | ratio | passes |
|---|---|---|---|---|---|---|---|---|
| 4 | 14/16 | 15/16 | 14/16 | 0.500 | 49 | 48 | 0.99 | no |
| 5 | 14/16 | 15/16 | 13/16 | 0.500 | 131 | 70 | 0.53 | no |

Verdict: retry2 does not replicate on edit-multi-mechanical at any rung run tonight.

### edit-single · retry2

| Rung | base k/n | lever k/n | 1st try | p (one-sided) | base med s | lever med s | ratio | passes |
|---|---|---|---|---|---|---|---|---|
| 1 | 13/16 | 16/16 | 12/16 | 0.113 | 14 | 15 | 1.04 | no |
| 2 | 10/16 | 16/16 | 9/16 | 0.009 | 21 | 23 | 1.10 | yes |

Verdict: retry2 replicates on edit-single at rung(s) 2.

## Review (2026-09-27)

The cells above match the raw result files (recounted from `bench/frontier-qwen3.6-35b-a3b-optiq-*-20260926-*.json`, valid samples only).

- **edit-single:** `retry2` replicates at rung 2 (10/16 → 16/16, p = 0.009) for about 10 % more time. Rung 1 misses the bar narrowly: 13/16 → 16/16, p = 0.113. The retries do real work here: 7 of the 16 rung-2 passes came after a retry.
- **create-file, rung 1:** a large effect (5/16 → 12/16, p = 0.016) that fails the rule only on cost. The median time ratio is 2.03 against a 2.00 limit. The rule is applied as written. The gain is worth a follow-up with the cost measured per task rather than per sample, because `retry2` adds a Gradle verify per retry.
- **edit-multi-mechanical:** base is much stronger tonight (14/16 at r4 and r5) than on night 1 (7/10 and 6/10). The first-try rate of the `retry2` arm (14/16, 13/16) matches base. So night 1's "move" at r4 was mostly sampling noise, as the night-2 queue header warned, and `retry2` adds little here.
- **What this means for nav-pilot:** retry with the verifier's output is justified for single-file edits. It maps to the check-and-retake loop the orchestrator already has, so the recommendation is to make one or two retries the default for edit-single dispatches. It is not justified for mechanical multi-file edits on this evidence. Create-file stays open.
