# Quality frontier, presence penalty night: results

Written by `mise run night-run-3` from `.bench-logs/night3-20260928-122007/steps.jsonl` and the result files. The plan and the rules are [design.md](design.md). Local model(s) `qwen3.6-35b-a3b-8bit-64g`, `qwen3.6-35b-a3b-8bit-64g-pp15`, cloud reference `claude-sonnet-5`.

- Started 2026-09-28T12:20:50+02:00, last step ended 2026-09-28T18:58:34+02:00.
- Cloud spend: $0 of the $80 cap.

## Steps

| # | Part | Step | Classes | Variant | Status | Minutes | Result |
|---|---|---|---|---|---|---|---|
| 1 | local | lever | create-file | retry2 | OK | 38 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-retry2-20260928-122050.json` |
| 2 | local | lever | create-file | retry2 | OK | 42 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-pp15-retry2-20260928-125847.json` |
| 3 | local | lever | create-file | retry2 | OK | 43 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-pp15-retry2-20260928-134112.json` |
| 4 | local | lever | create-file | retry2 | OK | 43 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-retry2-20260928-142356.json` |
| 5 | local | lever | create-file | retry2 | OK | 38 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-retry2-20260928-150703.json` |
| 6 | local | lever | create-file | retry2 | OK | 37 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-pp15-retry2-20260928-154533.json` |
| 7 | local | lever | create-file | retry2 | OK | 50 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-pp15-retry2-20260928-162218.json` |
| 8 | local | lever | create-file | retry2 | OK | 41 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-retry2-20260928-171241.json` |
| 9 | local | base | edit-single | base | OK | 14 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-base-20260928-175341.json` |
| 10 | local | base | edit-single | base | OK | 19 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-pp15-base-20260928-180739.json` |
| 11 | local | base | edit-single | base | OK | 19 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-pp15-base-20260928-182644.json` |
| 12 | local | base | edit-single | base | OK | 13 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-base-20260928-184553.json` |

## Frontier

From `mise run bench-frontier -- summary`. Verdicts per rung use the routing bar (design.md §4); frontier = highest rung with every rung up to it trusted / not ruled out.

### edit-multi-mechanical (bar 0.90 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | r5 | r6 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 7/10 0.88 trusted | 9/10 0.94 trusted | 10/10 0.96 trusted | 10/10 0.95 trusted | 10/10 0.92 trusted | 10/10 0.86 trusted | 6 / 6 | none | – | 317.0+ |
| cloud-gpt-6-sol | base | cloud |  |  |  | 4/4 0.71 not-yet |  | 3/4 0.43 cloud | 0 / 4 | 6 | 414.2 | 66.9 |
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
| qwen3.6-35b-a3b-8bit-64g | base | local | 3/4 0.61 cloud | 3/4 0.60 cloud | 8/12 0.59 cloud | 9/12 0.58 cloud | 8/12 0.48 cloud | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-8bit-64g | decompose | local |  |  | 11/12 0.87 not-yet | 11/12 0.87 trusted | 12/12 0.88 trusted | 0 / 5 | none | – | 64.0+ |
| qwen3.6-35b-a3b-8bit-64g | retry2 | local | 4/4 0.71 not-yet | 3/4 0.43 cloud |  |  |  | 0 / 1 | 2 | 3.5 | 1.4 |
| qwen3.6-35b-a3b-8bit-64g-pp15 | base | local |  |  | 3/8 0.54 cloud | 8/8 0.83 not-yet | 5/8 0.40 cloud | 0 / 0 | 3 | – | – |
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
| cloud-claude-sonnet-5 | base | cloud | 2/4 0.66 cloud | 4/4 0.83 not-yet | 4/4 0.71 not-yet | 3/4 0.43 not-yet | 0 / 0 | 1 | – | 4.0+ |
| cloud-gpt-6-sol | base | cloud | 4/4 0.88 not-yet | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  | 0 / 3 | none | – | 3.0+ |
| laguna-xs-2.1-8bit-64g | retry2 | local | 2/4 0.23 cloud | 0/4 0.11 cloud | 2/4 0.23 cloud |  | 0 / 0 | 1 | 0.2 | – |
| occamy-1.0-4bit-64g | retry2 | local | 6/12 0.49 cloud | 9/12 0.57 cloud | 6/12 0.33 cloud |  | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-8bit-64g | retry2 | local | 21/28 0.77 trusted | 10/12 0.82 cloud | 26/28 0.84 not-yet |  | 1 / 1 | 2 | – | 3.0+ |
| qwen3.6-35b-a3b-8bit-64g-pp15 | retry2 | local | 11/16 0.68 trusted |  | 14/16 0.73 cloud |  | 1 / 1 | 3 | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 1/4 0.13 cloud | 1/4 0.11 cloud | 1/4 0.08 cloud | 0/4 0.00 cloud | 0 / 0 | 1 | 0.3 | – |
| qwen3.6-35b-a3b-optiq | base | local | 5/20 0.15 cloud |  |  |  | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | retry2 | local | 3/4 0.43 not-yet | 2/4 0.23 cloud |  |  | 0 / 1 | 2 | 2.1 | – |
| qwen3.6-35b-a3b-optiq | retry2 | local | 15/20 0.61 not-yet |  |  |  | 0 / 1 | none | – | – |

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

## Review (2026-09-28)

The Frontier section pools every night. This section covers the A/B alone, from the 12 result files and `presence_ab.py 20260928-122006` ([plan](plan.md) §2). Arm A is `qwen3.6-35b-a3b-8bit-64g`, and arm B is `-pp15`, the same profile with `MLX_PRESENCE_PENALTY` 1.5. Every file carries `harness_sha` df7deb1af416, and every sample's `served_model` is `mlx-community/Qwen3.6-35B-A3B-8bit`. The meta confirms 0.0 for arm A and 1.5 for arm B. No sample was invalid. Intervals are 95 % Wilson, and p is the two-sided Fisher exact test that `presence_ab.py` uses.

| Cell | A (no penalty) | B (1.5) | p | timeouts A / B | median s A / B |
|---|---|---|---|---|---|
| create-file retry2 r1 | 11/16 | 11/16 | 1.00 | 5 / 3 | 298 / 366 |
| create-file retry2 r3 | 16/16 | 14/16 | 0.48 | 0 / 2 | 243 / 279 |
| edit-single r3 | 6/8 | 3/8 | 0.32 | 0 / 0 | 50 / 56 |
| edit-single r4 | 6/8 | 8/8 | 0.47 | 0 / 0 | 32 / 66 |
| edit-single r5 | 6/8 | 5/8 | 1.00 | 0 / 0 | 69 / 91 |
| **all** | **45/56** [0.68–0.89] | **41/56** [0.60–0.83] | 0.50 | 5 / 5 | |

- **Loops:** no sample in either arm looped on tool calls (`looped_on` empty). The longest identical run was 1 in A. In B one sample reached 3 (cf-r3-b, run 2), and it passed. `presence_ab.py` counts loops and timeouts together: 5/56 for A and 6/56 for B.
- **Text loops:** 0 of A's 72 transcripts and 1 of B's 76. The one in B is a create-file attempt at 13:25 whose step stopped on the output limit (16,384 tokens) right after "I'll write the test file". Its transcript has no further part. No text part in either arm repeated half its 8-grams.
- **Timeouts:** all 10 are create-file samples at the 420 s cap, 5 per arm. This review did not examine their causes.
- **Time:** B's median is longer in every cell, by 1.1–2.1×.

**Verdict:** by the plan's rule, recommend 1.5 only if B's loop or timeout rate is lower and its pass rate is not lower. Neither holds: loops and timeouts are 6/56 against 5/56, and the pass rate is 41/56 against 45/56 (p = 0.50). **presence_penalty stays off**, and the manifest does not change. The data shows no loop problem on this model for the penalty to fix. The one step in the whole A/B that ran to the output limit came under the penalty. This is consistent with the card's warning about a "slight decrease in model performance", but at this n it does not show it.
