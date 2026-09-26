# Quality frontier, night 1: results

Written by `mise run night-run-3` from `.bench-logs/night3-20260925-165202/steps.jsonl` and the result files. The plan and the rules are [design.md](design.md). Local model `qwen3.6-35b-a3b-optiq`, cloud reference `claude-sonnet-5`.

- Started 2026-09-25T16:53:22+02:00, last step ended 2026-09-26T09:53:36+02:00.
- Cloud spend: $34.7062 of the $80 cap.

## Steps

| # | Part | Step | Classes | Variant | Status | Minutes | Result |
|---|---|---|---|---|---|---|---|
| 1 | local | validate | - | - | SKIP: already validated |  | `` |
| 2 | local | base | edit-multi-mechanical | base | OK | 52 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260925-165322.json` |
| 3 | local | base | edit-single | base | OK | 27 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260925-174518.json` |
| 4 | local | base | read-qa | base | OK | 11 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260925-181200.json` |
| 5 | local | base | create-file | base | OK | 44 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260925-182232.json` |
| 6 | local | base | debug | base | OK | 11 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260925-190637.json` |
| 7 | local | lever | edit-multi-mechanical | cap900 | OK | 8 | `bench/frontier-qwen3.6-35b-a3b-optiq-cap900-20260925-191743.json` |
| 8 | local | lever | edit-multi-mechanical | retry2 | OK | 11 | `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20260925-192552.json` |
| 9 | local | lever | edit-single | retry2 | OK | 4 | `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20260925-193626.json` |
| 10 | local | lever | read-qa | cap900 | OK | 2 | `bench/frontier-qwen3.6-35b-a3b-optiq-cap900-20260925-193958.json` |
| 11 | local | lever | create-file | retry2 | OK | 30 | `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20260925-194149.json` |
| 12 | cloud | cloud | edit-multi-mechanical | base | SKIP: cloud unreachable: probe session failed |  | `` |
| 13 | cloud | cloud | edit-single | base | SKIP: cloud unreachable: probe session failed |  | `` |
| 14 | cloud | cloud | read-qa | base | SKIP: cloud unreachable: probe session failed |  | `` |
| 15 | cloud | cloud | create-file | base | SKIP: cloud unreachable: probe session failed |  | `` |
| 16 | cloud | cloud | debug | base | SKIP: cloud unreachable: probe session failed |  | `` |
| 12 | cloud | cloud | edit-multi-mechanical | base | INVALID: cplt scoped the session to the repo root, not the workspace (fixed in 37346ad); results moved to invalid-cloud/ | 62 | `bench/frontier-cloud-claude-sonnet-5-base-20260925-201748.json` |
| 13 | cloud | cloud | edit-single | base | INVALID: cplt scoped the session to the repo root, not the workspace (fixed in 37346ad); results moved to invalid-cloud/ | 40 | `bench/frontier-cloud-claude-sonnet-5-base-20260925-212007.json` |
| 14 | cloud | cloud | read-qa | base | INVALID: cplt scoped the session to the repo root, not the workspace (fixed in 37346ad); results moved to invalid-cloud/ | 32 | `bench/frontier-cloud-claude-sonnet-5-base-20260925-220019.json` |
| 15 | cloud | cloud | create-file | base | INVALID: cplt scoped the session to the repo root, not the workspace (fixed in 37346ad); results moved to invalid-cloud/ | 15 | `bench/frontier-cloud-claude-sonnet-5-base-20260925-223240.json` |
| 16 | cloud | cloud | debug | base | INVALID: cplt scoped the session to the repo root, not the workspace (fixed in 37346ad); results moved to invalid-cloud/ | 5 | `bench/frontier-cloud-claude-sonnet-5-base-20260925-224802.json` |
| 12 | cloud | cloud | edit-multi-mechanical | base | OK | 39 | `bench/frontier-cloud-claude-sonnet-5-base-20260926-080859.json` |
| 13 | cloud | cloud | edit-single | base | OK | 18 | `bench/frontier-cloud-claude-sonnet-5-base-20260926-084757.json` |
| 14 | cloud | cloud | read-qa | base | OK | 8 | `bench/frontier-cloud-claude-sonnet-5-base-20260926-090559.json` |
| 15 | cloud | cloud | create-file | base | OK | 18 | `bench/frontier-cloud-claude-sonnet-5-base-20260926-091425.json` |
| 16 | cloud | cloud | debug | base | OK | 21 | `bench/frontier-cloud-claude-sonnet-5-base-20260926-093254.json` |

## Frontier

From `mise run bench-frontier -- summary`. Verdicts per rung use the routing bar (design.md §4); frontier = highest rung with every rung up to it trusted / not ruled out.

### edit-multi-mechanical (bar 0.90 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | r5 | r6 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 7/10 0.88 trusted | 9/10 0.94 trusted | 10/10 0.96 trusted | 10/10 0.95 trusted | 10/10 0.92 trusted | 10/10 0.86 not-yet | 5 / 6 | none | – | 317.0+ |
| qwen3.6-35b-a3b-optiq | base | local | 10/10 0.86 trusted | 9/10 0.78 not-yet | 9/10 0.72 not-yet | 7/10 0.58 cloud | 6/10 0.56 cloud | 8/10 0.60 cloud | 1 / 3 | 4 | 1099.3 | – |
| qwen3.6-35b-a3b-optiq | cap900 | local |  |  |  | 2/4 0.29 cloud | 2/4 0.23 cloud |  | 0 / 0 | 4 | – | – |
| qwen3.6-35b-a3b-optiq | retry2 | local |  |  |  | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  | 0 / 5 | none | – | 29.0+ |

### edit-single (bar 0.90 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | r5 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 8/8 0.93 not-yet | 8/8 0.90 not-yet | 7/7 0.81 not-yet | 7/8 0.66 not-yet | 6/8 0.52 not-yet | 0 / 5 | none | 107.7 | 19.2 |
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
- edit-single · qwen3.6-35b-a3b-optiq · retry2: 0 → 2 (moves it)
- read-qa · qwen3.6-35b-a3b-optiq · cap900: 0 → 0 (no gain)

✓ bench/frontier-summary.json
