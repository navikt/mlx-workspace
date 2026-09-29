# Quality frontier, night 64 6b: results

Written by `mise run night-run-3` from `.bench-logs/night3-20260929-092538/steps.jsonl` and the result files. The plan and the rules are [design.md](design.md). Local model(s) `qwen3.6-35b-a3b-8bit`, `qwen3.6-35b-a3b-8bit-64g`, cloud reference `claude-sonnet-5`.

- Started 2026-09-29T09:26:03+02:00, last step ended 2026-09-29T11:21:17+02:00.
- Cloud spend: $0 of the $80 cap.

## Steps

| # | Part | Step | Classes | Variant | Status | Minutes | Result |
|---|---|---|---|---|---|---|---|
| 1 | local | e2e | - | - | OK | 2 | `bench/np-e2e-qwen3.6-35b-a3b-8bit-20260929-092603.json` |
| 2 | local | ops | - | - | OK | 12 | `bench/results-qwen3.6-35b-a3b-8bit-64g-20260929-092748-01.json` |
| 3 | local | ops | - | - | OK | 12 | `bench/results-qwen3.6-35b-a3b-8bit-64g-20260929-094015-01.json` |
| 4 | local | ops | - | - | OK | 15 | `bench/results-qwen3.6-35b-a3b-8bit-64g-20260929-095146-01.json` |
| 5 | local | ops | - | - | OK | 16 | `bench/results-qwen3.6-35b-a3b-8bit-64g-20260929-100617-01.json` |
| 6 | local | lever | create-file | retry2 | OK | 59 | `bench/frontier-qwen3.6-35b-a3b-8bit-64g-retry2-20260929-102241.json` |

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
| qwen3.6-35b-a3b-optiq | base | local |  | 4/4 0.76 not-yet | 3/4 0.66 cloud | 4/4 0.71 not-yet |  |  | 0 / 2 | 3 | – | 13.0+ |
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
| qwen3.6-35b-a3b-optiq | base | local |  |  | 2/4 0.57 cloud | 4/4 0.71 not-yet | 3/4 0.43 not-yet | 0 / 0 | 3 | – | – |
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
| laguna-xs-2.1-8bit-64g | retry2 | local | 2/4 0.23 cloud | 0/4 0.11 cloud | 2/4 0.23 cloud |  | 0 / 0 | 1 | 0.2 | – |
| occamy-1.0-4bit-64g | retry2 | local | 6/12 0.49 cloud | 9/12 0.57 cloud | 6/12 0.33 cloud |  | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-8bit-64g | retry2 | local | 21/28 0.77 trusted | 10/12 0.82 cloud | 26/28 0.84 not-yet |  | 1 / 1 | 2 | – | 3.0+ |
| qwen3.6-35b-a3b-8bit-64g | retry2 | local |  |  |  | 3/8 0.20 cloud | 0 / 0 | 4 | – | – |
| qwen3.6-35b-a3b-8bit-64g-pp15 | retry2 | local | 11/16 0.68 trusted |  | 14/16 0.73 cloud |  | 1 / 1 | 3 | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 1/4 0.13 cloud | 1/4 0.11 cloud | 1/4 0.08 cloud | 0/4 0.00 cloud | 0 / 0 | 1 | 0.3 | – |
| qwen3.6-35b-a3b-optiq | base | local | 5/20 0.15 cloud |  |  |  | 0 / 0 | 1 | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 4/4 0.88 not-yet | 4/4 0.83 not-yet | 4/4 0.71 not-yet |  | 0 / 3 | none | – | 3.0+ |
| qwen3.6-35b-a3b-optiq | retry2 | local | 3/4 0.43 not-yet | 2/4 0.23 cloud |  |  | 0 / 1 | 2 | 2.1 | – |
| qwen3.6-35b-a3b-optiq | retry2 | local | 15/20 0.61 not-yet |  |  |  | 0 / 1 | none | – | – |

### debug (bar 0.95 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r3 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 3/4 0.52 not-yet | 3/4 0.43 not-yet | 0 / 3 | none | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 3/4 0.43 not-yet |  | 0 / 1 | none | – | – |
| qwen3.6-35b-a3b-optiq | base | local | 3/4 0.43 not-yet |  | 0 / 1 | none | – | – |

### Harvest: frontier (open) by variant against base

- create-file · qwen3.6-35b-a3b-optiq · retry2: 3 → 1 (no gain)
- create-file · qwen3.6-35b-a3b-optiq · retry2: 3 → 1 (no gain)
- edit-multi-mechanical · laguna-xs-2.1-8bit-64g · decompose: 0 → 3 (moves it)
- edit-multi-mechanical · occamy-1.0-4bit-64g · decompose: 0 → 0 (no gain)
- edit-multi-mechanical · qwen3.6-35b-a3b-8bit-64g · decompose: 4 → 0 (no gain)
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · cap900: 2 → 0 (no gain)
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · retry2: 2 → 5 (moves it)
- edit-multi-mechanical · qwen3.6-35b-a3b-optiq · retry2: 2 → 5 (moves it)
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

## Review (2026-09-29), phases A, B and C

This covers all three phases of night 64-6 ([plan](plan-64-6.md)), from the step logs `.bench-logs/night3-20260929-{091237,092538,112624}/steps.jsonl` and the result files. Every sample's `served_model` is `mlx-community/Qwen3.6-35B-A3B-8bit`. The np-e2e probes ran under `nav-pilot-main-7236795f`, phase C under `nav-pilot-main-2bcca023`, and the ops and frontier steps under the workspace server.

**Fit at 64k (phases A and B).** `bench-np-e2e --latency-only` with targets of 2k, 60k and 64k:

| Step | Wired | Profile (prompt cache) | Cold TTFT 60k / 64k | Decode at 64k | Peak footprint (at 64k) | Plan's line (wired − 2) |
|---|---|---|---|---|---|---|
| A1 | 52 GB | shipped `qwen3.6-35b-a3b-8bit` (6 GiB) | 26.8 s / 36.5 s | 59.9 tok/s | 50.01 GB | 50 GB: over by 0.01 |
| A2 | 52 GB | `-64g-w52` (12 GiB) | 30.4 s / 37.0 s | 61.9 tok/s | 49.52 GB | 50 GB: under |
| B1 | 48 GB | shipped (6 GiB) | 28.7 s / 38.1 s | 55.7 tok/s | 49.18 GB | 46 GB: over by 3.2 |

- Every probe answered, cold and warm, with no error or OOM. The warm TTFT at 60k and 64k was 0.6–0.7 s.
- At 48 GB wired the shipped entry holds a 64k prompt. Its footprint then passes the 46 GB fit line by 3.2 GB. Night 64-4 measured 46.18 GB at 49k, and the line from 49k to 64k (0.2 GB per 1k tokens) matches.
- 52 GB wired buys little: at 64k, TTFT is 4 % lower and decode 8 % higher than at 48 GB, and the footprint is about the same.

**Local-mode capabilities (phase B steps 2–5).** Four `ops` passes ran, all OK. With night 64-1's two, that makes six on harness d1229ad0e89f. `mise run bench-capabilities` then gives the 8-bit:

| Class | Local | Delegate |
|---|---|---|
| read-qa | not-yet, 18/18 | no data |
| edit-single | not-yet, 12/12 | no data |
| edit-multi-mechanical | cloud, 8/12 (M1 2 of 6, M2 6 of 6) | no data |
| create-file | cloud, 10/12 | no data |
| debug | cloud, 0/0 | no data |

- R1 (excluded from the bar) failed 6 of 6.
- D2 timed out in all 6 passes. It is retired in `bench/tasks.json`, so it is outside the 8/12.
- **No class reaches `trusted`.** By the user's decision, only trusted classes ship, so the 8-bit's capabilities block stays as shipped (all `cloud`), and `manifest/capabilities.json` is not regenerated in this PR. Regenerating it would only move enums to not-yet and cloud, with counts, and arm nothing.

**create-file retry2 at rung 4 (phase B step 6, harness v2).** 3/8 verified. cf-r4-a passed 3 of 4. cf-r4-b verified 0 of 4: three single-attempt timeouts at the 420 s cap, and one run that timed out after two retries. It is supporting evidence only (a new `harness_sha`, n = 4 per task). The v1 rungs below it understate create-file (see the v2 validation night) and need re-running before a break can be called.

**Delegate-mode capabilities (phase C): not measured.**
- Steps 2 and 4 (hybrid) were invalid: "local_dispatch = aggressive but the gate was not armed: the manifest trusts no class it has a rule for". With the shipped all-`cloud` block the gate cannot arm, so hybrid samples under it can never count. This is a design gap in plan §4, filed as #147 with ways to measure delegation.
- Steps 1 and 6–12 failed bench-hybrid's preflight on the load average (8.2–17.6 against a ceiling of 8). At the time, other agents were running local builds and tests.
- Steps 3 and 5 (controls, r5 and cf5-a) ran.
- Cloud spend was $1.01 of the $12 cap.
- Requeuing the hybrid steps would only give invalid samples until #147 is decided.

**Proposed manifest update (held for the user).** Nothing in `params` changes, and `wired_limit_gb` stays 48: 52 GB buys little (4 % TTFT, 8 % decode). The entry's `expect` text should say that on this 128 GB M5 Max a 64k prompt worked at 48 GB wired, with a peak footprint of about 49 GB, 1.2 GB over the wired limit itself. A real 64 GB Mac is still untested (UNMEASURED). That leaves about 15 GB of a 64 GB Mac for everything else, so a user with a heavy IDE should cap `MLX_OPENCODE_CONTEXT` near 48k. The capabilities block is unchanged, because no class is trusted.
