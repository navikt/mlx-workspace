# Quality frontier, small tasks results: results

Written by `mise run night-run-3` from `.bench-logs/night3-20261009-194909/steps.jsonl` and the result files. The plan and the rules are [design.md](design.md). Local model(s) `qwen3.6-35b-a3b-optiq-64g`, `qwen3.6-35b-a3b-8bit-64g`, cloud reference `claude-sonnet-5`.

- Started 2026-10-09T19:49:50+02:00, last step ended 2026-10-10T01:14:31+02:00.
- Cloud spend: $2.8394 of the $10 cap.

## Steps

| # | Part | Step | Classes | Variant | Status | Minutes | Result |
|---|---|---|---|---|---|---|---|
| 1 | local | ops | - | - | OK | 15 | `bench/results-qwen3.6-35b-a3b-optiq-64g-20261009-194950-01.json` |
| 2 | local | ops | - | - | OK | 14 | `bench/results-qwen3.6-35b-a3b-8bit-64g-20261009-200502-01.json` |
| 3 | local | ops | - | - | OK | 17 | `bench/results-qwen3.6-35b-a3b-optiq-64g-20261009-201847-01.json` |
| 4 | local | ops | - | - | OK | 13 | `bench/results-qwen3.6-35b-a3b-8bit-64g-20261009-203535-01.json` |
| 5 | local | ops | - | - | OK | 13 | `bench/results-qwen3.6-35b-a3b-optiq-64g-20261009-204838-01.json` |
| 6 | local | ops | - | - | OK | 13 | `bench/results-qwen3.6-35b-a3b-8bit-64g-20261009-210140-01.json` |
| 7 | local | ops | - | - | OK | 15 | `bench/results-qwen3.6-35b-a3b-optiq-64g-20261009-211432-01.json` |
| 8 | local | ops | - | - | OK | 10 | `bench/results-qwen3.6-35b-a3b-8bit-64g-20261009-212921-01.json` |
| 9 | hybrid | hybrid | tasks | control | OK | 1 | `bench/hybrid-np-2bcca023-sonnet5-aggressive-small-1-control.json` |
| 10 | hybrid | hybrid | tasks | hybrid | OK | 2 | `bench/hybrid-np-2bcca023-sonnet5-aggressive-small-qwen3.6-35b-a3b-optiq-64g-1-hybrid.json` |
| 11 | hybrid | hybrid | tasks | control | OK | 1 | `bench/hybrid-np-2bcca023-sonnet5-aggressive-small-2-control.json` |
| 12 | hybrid | hybrid | tasks | hybrid | OK | 2 | `bench/hybrid-np-2bcca023-sonnet5-aggressive-small-qwen3.6-35b-a3b-optiq-64g-2-hybrid.json` |
| 13 | hybrid | hybrid | tasks | control | OK | 1 | `bench/hybrid-np-2bcca023-sonnet5-aggressive-small-3-control.json` |
| 14 | hybrid | hybrid | tasks | hybrid | OK | 3 | `bench/hybrid-np-2bcca023-sonnet5-aggressive-small-qwen3.6-35b-a3b-optiq-64g-3-hybrid.json` |
| 15 | hybrid | hybrid | tasks | control | OK | 2 | `bench/hybrid-np-2bcca023-sonnet5-aggressive-small-4-control.json` |
| 16 | hybrid | hybrid | tasks | hybrid | OK | 8 | `bench/hybrid-np-2bcca023-sonnet5-aggressive-small-qwen3.6-35b-a3b-optiq-64g-4-hybrid.json` |
| 17 | local | ops | - | - | OK | 10 | `bench/results-qwen3.6-35b-a3b-optiq-64g-20261009-220207-01.json` |
| 18 | local | ops | - | - | OK | 13 | `bench/results-qwen3.6-35b-a3b-8bit-64g-20261009-221210-01.json` |
| 19 | local | ops | - | - | OK | 21 | `bench/results-qwen3.6-35b-a3b-optiq-64g-20261009-222524-01.json` |
| 20 | local | ops | - | - | OK | 17 | `bench/results-qwen3.6-35b-a3b-8bit-64g-20261009-224636-01.json` |
| 21 | local | ops | - | - | OK | 15 | `bench/results-qwen3.6-35b-a3b-optiq-64g-20261009-230345-01.json` |
| 22 | local | ops | - | - | OK | 15 | `bench/results-qwen3.6-35b-a3b-8bit-64g-20261009-231903-01.json` |
| 23 | local | ops | - | - | OK | 16 | `bench/results-qwen3.6-35b-a3b-optiq-64g-20261009-233343-01.json` |
| 24 | local | ops | - | - | OK | 12 | `bench/results-qwen3.6-35b-a3b-8bit-64g-20261009-234942-01.json` |
| 25 | local | ops | - | - | OK | 13 | `bench/results-qwen3.6-35b-a3b-optiq-64g-20261010-000203-01.json` |
| 26 | local | ops | - | - | OK | 20 | `bench/results-qwen3.6-35b-a3b-8bit-64g-20261010-001501-01.json` |
| 27 | local | ops | - | - | OK | 15 | `bench/results-qwen3.6-35b-a3b-optiq-64g-20261010-003451-01.json` |
| 28 | local | ops | - | - | OK | 25 | `bench/results-qwen3.6-35b-a3b-8bit-64g-20261010-004944-01.json` |

## Frontier

From `mise run bench-frontier -- summary`. Verdicts per rung use the routing bar (design.md §4); frontier = highest rung with every rung up to it trusted / not ruled out.

### edit-multi-mechanical (bar 0.90 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | r5 | r6 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 7/10 0.88 trusted | 9/10 0.94 trusted | 10/10 0.96 trusted | 10/10 0.95 trusted | 10/10 0.92 trusted | 10/10 0.86 trusted | 6 / 6 | none | – | 317.0+ |
| cloud-gpt-6-sol | base | cloud |  |  |  | 4/4 0.71 not-yet |  | 3/4 0.43 cloud | 0 / 4 | 6 | 414.2 | 66.9 |
| k2-horizon-mova-36b-a4b-4bit | base | local | 0/2 0.00 cloud |  |  |  |  |  | 0 / 0 | 1 | – | – |
| laguna-xs-2.1-8bit-64g | base | local |  |  | 1/2 0.51 cloud | 2/2 0.65 not-yet | 1/1 0.38 not-yet |  | 0 / 0 | 3 | – | 29.0+ |
| laguna-xs-2.1-8bit-64g | decompose | local |  |  | 4/4 0.71 not-yet | 3/4 0.57 cloud | 3/4 0.52 cloud | 3/4 0.43 cloud | 0 / 3 | 4 | 477.1 | 6.8 |
| occamy-1.0-4bit-64g | base | local |  |  | 3/4 0.43 cloud | 2/4 0.29 cloud | 1/2 0.23 cloud | 1/2 0.16 cloud | 0 / 0 | 3 | 29.5 | – |
| occamy-1.0-4bit-64g | decompose | local |  |  | 10/12 0.76 cloud | 11/12 0.76 not-yet | 8/12 0.62 cloud | 10/12 0.66 cloud | 0 / 0 | 3 | – | – |
| qwen3.6-35b-a3b-8bit-64g | base | local |  |  | 4/4 0.83 not-yet | 4/4 0.76 not-yet | 3/4 0.66 cloud | 4/4 0.71 not-yet | 0 / 4 | 5 | – | 317.0+ |
| qwen3.6-35b-a3b-8bit-64g | base | local | 9/10 0.94 trusted | 10/10 0.96 trusted | 10/10 0.95 trusted | 20/20 0.92 trusted | 8/10 0.61 cloud | 7/10 0.50 cloud | 4 / 4 | 5 | 1237.6 | 23.3 |
| qwen3.6-35b-a3b-8bit-64g | base | local |  |  |  | 10/10 0.86 not-yet |  |  | 0 / 4 | none | – | 13.0+ |
| qwen3.6-35b-a3b-8bit-64g | decompose | local |  |  | 10/12 0.77 cloud | 11/12 0.76 not-yet | 10/12 0.67 cloud | 9/12 0.57 cloud | 0 / 0 | 3 | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 10/10 0.86 trusted | 9/10 0.78 not-yet | 9/10 0.72 not-yet | 7/10 0.58 cloud | 6/10 0.56 cloud | 8/10 0.60 cloud | 1 / 3 | 4 | 1099.3 | – |
| qwen3.6-35b-a3b-optiq | base | local |  |  |  | 14/16 0.78 cloud | 14/16 0.73 cloud |  | 0 / 0 | 4 | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 7/10 0.71 trusted | 9/14 0.72 cloud | 13/14 0.80 not-yet | 12/14 0.70 cloud | 6/10 0.56 cloud | 8/10 0.60 cloud | 1 / 1 | 2 | – | – |
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
| qwen3.6-35b-a3b-8bit-64g | base | local | 10/10 0.86 not-yet | 7/10 0.58 cloud | 7/10 0.56 cloud | 7/10 0.50 cloud | 3/10 0.15 cloud | 0 / 1 | 2 | 21.9 | – |
| qwen3.6-35b-a3b-8bit-64g | decompose | local |  |  | 11/12 0.87 not-yet | 11/12 0.87 trusted | 12/12 0.88 trusted | 0 / 5 | none | – | 64.0+ |
| qwen3.6-35b-a3b-8bit-64g | retry2 | local | 4/4 0.71 not-yet | 3/4 0.43 cloud |  |  |  | 0 / 1 | 2 | 3.5 | 1.4 |
| qwen3.6-35b-a3b-8bit-64g-pp15 | base | local |  |  | 3/8 0.54 cloud | 8/8 0.83 not-yet | 5/8 0.40 cloud | 0 / 0 | 3 | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 4/8 0.55 cloud | 7/8 0.66 cloud | 3/8 0.49 cloud | 6/8 0.59 cloud | 6/8 0.52 not-yet | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 13/16 0.66 cloud | 10/16 0.47 cloud |  |  |  | 0 / 0 | 1 | 3.0 | – |
| qwen3.6-35b-a3b-optiq | base | local | 7/10 0.67 cloud | 9/10 0.72 not-yet | 3/14 0.38 cloud | 10/14 0.54 cloud | 7/14 0.34 cloud | 0 / 0 | 1 | 46.6 | – |
| qwen3.6-35b-a3b-optiq | retry2 | local | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  |  |  | 0 / 2 | none | – | 2.0+ |
| qwen3.6-35b-a3b-optiq | retry2 | local | 16/16 0.95 trusted | 16/16 0.91 trusted |  |  |  | 2 / 2 | none | – | 2.0+ |
| qwen3.6-35b-a3b-optiq-64g | decompose | local |  |  | 3/4 0.66 cloud | 4/4 0.71 not-yet | 2/4 0.23 cloud | 0 / 0 | 3 | 144.1 | – |

### read-qa (bar 0.95 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | r5 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 8/8 0.96 not-yet | 8/8 0.95 not-yet | 8/8 0.94 not-yet | 8/8 0.91 not-yet | 8/8 0.83 not-yet | 0 / 5 | none | – | 12.0+ |
| qwen3.6-35b-a3b-optiq | base | local | 2/8 0.35 cloud | 5/8 0.40 cloud | 0/8 0.34 cloud | 7/8 0.66 cloud | 4/8 0.29 cloud | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 2/16 0.33 cloud | 10/16 0.47 cloud | 3/16 0.33 cloud | 9/16 0.42 cloud | 8/16 0.35 cloud | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 1/4 0.32 cloud | 3/4 0.43 cloud | 1/4 0.26 cloud | 2/4 0.29 cloud | 2/4 0.23 cloud | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | cap900 | local | 1/4 0.11 cloud | 1/4 0.08 cloud |  |  |  | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | example | local | 18/24 0.69 cloud | 19/24 0.67 cloud | 12/24 0.60 cloud | 21/24 0.76 cloud | 13/24 0.41 cloud | 0 / 0 | 1 | – | – |

### create-file (bar 0.90 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 2/4 0.66 cloud | 4/4 0.83 not-yet | 4/4 0.71 not-yet | 3/4 0.43 not-yet | 0 / 0 | 1 | – | 4.0+ |
| cloud-gpt-6-sol | base | cloud | 4/4 0.88 not-yet | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  | 0 / 3 | none | – | 3.0+ |
| k2-horizon-mova-36b-a4b-4bit | base | local | 0/10 0.00 cloud | 0/10 0.00 cloud | 0/10 0.00 cloud | 0/10 0.00 cloud | 0 / 0 | 1 | – | – |
| laguna-xs-2.1-8bit-64g | retry2 | local | 2/4 0.23 cloud | 0/4 0.11 cloud | 2/4 0.23 cloud |  | 0 / 0 | 1 | 0.2 | – |
| occamy-1.0-4bit-64g | retry2 | local | 6/12 0.49 cloud | 9/12 0.57 cloud | 6/12 0.33 cloud |  | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-8bit-64g | base | local | 4/10 0.27 cloud | 4/10 0.23 cloud | 3/10 0.15 cloud | 1/10 0.03 cloud | 0 / 0 | 1 | 0.8 | – |
| qwen3.6-35b-a3b-8bit-64g | base | local | 7/10 0.55 not-yet | 5/10 0.51 cloud | 8/10 0.60 cloud | 4/10 0.23 cloud | 0 / 1 | 2 | 5.2 | – |
| qwen3.6-35b-a3b-8bit-64g | retry2 | local | 21/28 0.77 trusted | 10/12 0.82 cloud | 26/28 0.84 not-yet |  | 1 / 1 | 2 | – | 3.0+ |
| qwen3.6-35b-a3b-8bit-64g | retry2 | local |  |  |  | 3/8 0.20 cloud | 0 / 0 | 4 | – | – |
| qwen3.6-35b-a3b-8bit-64g | retry2 | local | 10/10 0.95 trusted | 10/10 0.92 trusted | 10/10 0.86 not-yet | 5/10 0.31 cloud | 2 / 3 | 4 | 4.3 | 2.9 |
| qwen3.6-35b-a3b-8bit-64g-pp15 | retry2 | local | 11/16 0.68 trusted |  | 14/16 0.73 cloud |  | 1 / 1 | 3 | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 1/4 0.13 cloud | 1/4 0.11 cloud | 1/4 0.08 cloud | 0/4 0.00 cloud | 0 / 0 | 1 | 0.3 | – |
| qwen3.6-35b-a3b-optiq | base | local | 5/20 0.15 cloud |  |  |  | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 6/14 0.31 cloud | 5/14 0.28 cloud | 6/14 0.28 cloud | 0/10 0.00 cloud | 0 / 0 | 1 | 0.9 | – |
| qwen3.6-35b-a3b-optiq | base | local | 8/10 0.60 not-yet | 3/10 0.36 cloud | 7/10 0.50 cloud | 1/10 0.03 cloud | 0 / 1 | 2 | 2.1 | – |
| qwen3.6-35b-a3b-optiq | retry2 | local | 3/4 0.43 not-yet | 2/4 0.23 cloud |  |  | 0 / 1 | 2 | 2.1 | – |
| qwen3.6-35b-a3b-optiq | retry2 | local | 15/20 0.61 not-yet |  |  |  | 0 / 1 | none | – | – |
| qwen3.6-35b-a3b-optiq | retry2 | local | 10/10 0.95 trusted | 10/10 0.92 trusted | 10/10 0.86 not-yet | 7/10 0.50 not-yet | 2 / 4 | none | 5.3 | 3.2 |

### debug (bar 0.95 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r3 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 3/4 0.52 not-yet | 3/4 0.43 not-yet | 0 / 3 | none | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 3/4 0.43 not-yet |  | 0 / 1 | none | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 3/4 0.43 not-yet |  | 0 / 1 | none | – | – |

### Harvest: frontier (open) by variant against base

- create-file · qwen3.6-35b-a3b-8bit-64g · retry2: 1 → 1 (no gain)
- create-file · qwen3.6-35b-a3b-8bit-64g · retry2: 1 → 0 (no gain)
- create-file · qwen3.6-35b-a3b-8bit-64g · retry2: 1 → 3 (moves it)
- create-file · qwen3.6-35b-a3b-optiq · retry2: 1 → 1 (no gain)
- create-file · qwen3.6-35b-a3b-optiq · retry2: 1 → 1 (no gain)
- create-file · qwen3.6-35b-a3b-optiq · retry2: 1 → 4 (moves it)
- edit-multi-mechanical · laguna-xs-2.1-8bit-64g · decompose: 0 → 3 (moves it)
- edit-multi-mechanical · occamy-1.0-4bit-64g · decompose: 0 → 0 (no gain)
- edit-multi-mechanical · qwen3.6-35b-a3b-8bit-64g · decompose: 4 → 0 (no gain)
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · cap900: 1 → 0 (no gain)
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · retry2: 1 → 5 (moves it)
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · retry2: 1 → 5 (moves it)
- edit-single · laguna-xs-2.1-8bit-64g · decompose: 4 → 4 (no gain)
- edit-single · laguna-xs-2.1-8bit-64g · retry2: 4 → 2 (no gain)
- edit-single · occamy-1.0-4bit-64g · decompose: 0 → 5 (moves it)
- edit-single · occamy-1.0-4bit-64g · retry2: 0 → 2 (moves it)
- edit-single · qwen3.6-35b-a3b-8bit-64g · decompose: 1 → 5 (moves it)
- edit-single · qwen3.6-35b-a3b-8bit-64g · retry2: 1 → 1 (no gain)
- edit-single · qwen3.6-35b-a3b-optiq · retry2: 0 → 2 (moves it)
- edit-single · qwen3.6-35b-a3b-optiq · retry2: 0 → 2 (moves it)
- read-qa · qwen3.6-35b-a3b-optiq · cap900: 0 → 0 (no gain)
- read-qa · qwen3.6-35b-a3b-optiq · example: 0 → 0 (no gain)

✓ bench/frontier-summary.json

## Hybrid arm

Per worker, pooled over its cells. **Dispatch** is how many valid hybrid samples reached the worker; pass rate, the difference and the cost ratio are over those dispatched samples only, against every valid control sample of the same cells. The interval is Newcombe's, one-sided 90% on the lower bound; the plan's rule is lower bound ≥ −10 points.

| Worker | Cells | Dispatch | Pass (dispatched) | Pass (control) | Difference [90% lower, upper] | Median $ dispatched / control | Policy sha256 | Workspace HEAD |
|---|---|---|---|---|---|---|---|---|
| `qwen3.6-35b-a3b-optiq-64g` (bench-only overlay, not shipped) | tasks:1, tasks:2, tasks:3, tasks:4 | 3/16 | 3/3 | 8/8 | +0.00 [-0.35, +0.17] | 0.174 / 0.094 = 1.85× | 6fcf66c6 | b0351ed8 |

| File | Valid/attempts | Verified | Dispatched | Spent (incl. invalid) $ | Stopped |
|---|---|---|---|---|---|
| `hybrid-np-2bcca023-sonnet5-aggressive-small-1-control.json` | 2/2 | 2 | – | 0.15 |  |
| `hybrid-np-2bcca023-sonnet5-aggressive-small-2-control.json` | 2/2 | 2 | – | 0.19 |  |
| `hybrid-np-2bcca023-sonnet5-aggressive-small-3-control.json` | 2/2 | 2 | – | 0.20 |  |
| `hybrid-np-2bcca023-sonnet5-aggressive-small-4-control.json` | 2/2 | 2 | – | 0.34 |  |
| `hybrid-np-2bcca023-sonnet5-aggressive-small-qwen3.6-35b-a3b-optiq-64g-1-hybrid.json` | 4/4 | 4 | 0 | 0.32 |  |
| `hybrid-np-2bcca023-sonnet5-aggressive-small-qwen3.6-35b-a3b-optiq-64g-2-hybrid.json` | 4/4 | 4 | 0 | 0.40 |  |
| `hybrid-np-2bcca023-sonnet5-aggressive-small-qwen3.6-35b-a3b-optiq-64g-3-hybrid.json` | 4/4 | 4 | 0 | 0.42 |  |
| `hybrid-np-2bcca023-sonnet5-aggressive-small-qwen3.6-35b-a3b-optiq-64g-4-hybrid.json` | 4/4 | 4 | 3 | 0.82 |  |
