# Quality frontier, night 64 4: results

Written by `mise run night-run-3` from `.bench-logs/night3-20260927-161919/steps.jsonl` and the result files. The plan and the rules are [design.md](design.md). Local model(s) `qwen3.6-35b-a3b-8bit-64g`, `occamy-1.0-4bit-64g`, `qwen3.6-35b-a3b-optiq-64g`, cloud reference `claude-sonnet-5`.

- Started 2026-09-27T16:19:41+02:00, last step ended 2026-09-27T17:29:28+02:00.
- Cloud spend: $0 of the $80 cap.

## Steps

| # | Part | Step | Classes | Variant | Status | Minutes | Result |
|---|---|---|---|---|---|---|---|
| 1 | local | e2e | - | full | OK | 6 | `bench/np-e2e-qwen3.6-35b-a3b-8bit-64g-20260927-161941.json` |
| 2 | local | e2e | - | full | OK | 8 | `bench/np-e2e-occamy-1.0-4bit-64g-20260927-162612.json` |
| 3 | local | decide | sets | - | OK | 4 | `bench/decide-sets-qwen3.6-35b-a3b-8bit-64g-20260927-163350.json` |
| 4 | local | decide | sets | - | OK | 3 | `bench/decide-sets-occamy-1.0-4bit-64g-20260927-163733.json` |
| 5 | local | decide | sets | - | OK | 4 | `bench/decide-sets-qwen3.6-35b-a3b-optiq-64g-20260927-164102.json` |
| 6 | local | decide | why | - | OK | 2 | `bench/decide-why-qwen3.6-35b-a3b-8bit-64g-20260927-164434.json` |
| 7 | local | decide | why | - | OK | 2 | `bench/decide-why-occamy-1.0-4bit-64g-20260927-164636.json` |
| 8 | local | decide | why | - | OK | 2 | `bench/decide-why-qwen3.6-35b-a3b-optiq-64g-20260927-164829.json` |
| 9 | local | decide | limits | - | OK | 13 | `bench/decide-limits-qwen3.6-35b-a3b-8bit-64g-20260927-165036.json` |
| 10 | local | decide | limits | - | OK | 13 | `bench/decide-limits-occamy-1.0-4bit-64g-20260927-170327.json` |
| 11 | local | decide | limits | - | OK | 13 | `bench/decide-limits-qwen3.6-35b-a3b-optiq-64g-20260927-171653.json` |

## Frontier

From `mise run bench-frontier -- summary`. Verdicts per rung use the routing bar (design.md §4); frontier = highest rung with every rung up to it trusted / not ruled out.

### edit-multi-mechanical (bar 0.90 × p_cloud; cell: k/n, monotone LB, verdict)

| Model | Variant | Mode | r1 | r2 | r3 | r4 | r5 | r6 | Frontier trusted / open | First break | d50 | d at bar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cloud-claude-sonnet-5 | base | cloud | 7/10 0.88 trusted | 9/10 0.94 trusted | 10/10 0.96 trusted | 10/10 0.95 trusted | 10/10 0.92 trusted | 10/10 0.86 not-yet | 5 / 6 | none | – | 317.0+ |
| laguna-xs-2.1-8bit-64g | base | local |  |  | 1/2 0.51 cloud | 2/2 0.65 not-yet | 1/1 0.38 not-yet |  | 0 / 0 | 3 | – | 29.0+ |
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
| laguna-xs-2.1-8bit-64g | base | local | 2/2 0.83 not-yet | 2/2 0.79 not-yet | 2/2 0.71 not-yet | 2/2 0.55 not-yet | 0/1 0.00 cloud | 0 / 4 | 5 | 31.1 | 11.2 |
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
- edit-single · qwen3.6-35b-a3b-8bit-64g · decompose: 0 → 0 (no gain)
- edit-single · qwen3.6-35b-a3b-8bit-64g · retry2: 0 → 1 (moves it)
- edit-single · qwen3.6-35b-a3b-optiq · retry2: 0 → 2 (moves it)
- edit-single · qwen3.6-35b-a3b-optiq · retry2: 0 → 2 (moves it)
- read-qa · qwen3.6-35b-a3b-optiq · cap900: 0 → 0 (no gain)
- read-qa · qwen3.6-35b-a3b-optiq · example: 0 → 0 (no gain)

✓ bench/frontier-summary.json

## Review (2026-09-28)

The Frontier section above is the standing summary and does not cover this night. The night's numbers come from the raw result files listed in Steps. nav-pilot was `nav-pilot-main-7236795f` for every step, at 48 GB wired (`wired_limit_mb` 49152 in each np-e2e file). nav-pilot served Occamy through the bench manifest override: "bench override: allowing unvetted publisher Accio-Lab", and every decide log names `Accio-Lab/occamy-1.0-MLX-4bit` as the served model.

**np-e2e, full** (Copilot sessions through nav-pilot and its loop guard, 12 sessions: R2, E1, M1 × 2 × 2):

| | Qwen3.6-35B-A3B 8-bit | Occamy 4-bit |
|---|---|---|
| E2E sessions verified | **12/12** | 8/12 |
| Failures | none | Three sessions stopped by the loop guard: two R2 on a `read_bash` call repeated without its required `shellId`/`delay`, and one M1 on a repeated `bash`. One R2 answer did not verify |
| Peak footprint (whole run) | **46.18 GB**, at the 49k latency probe; at most 44.94 GB in sessions | 29.07 GB |
| Peak by probe: 2k / 30k / 49k | 37.8 / 41.6 / 46.2 GB | 20.5 / 25.0 / 29.1 GB |
| Cold TTFT at 30k, decode at 30k | 10.3 s, 73.4 tok/s | 11.1 s, 70.3 tok/s |
| Classifier probe (legitimate scenarios over P(A) 0.9) | recompile, poll-pr-checks | poll-ci, poll-pr-checks |
| Classifier p95 | 0.32 s | 0.24 s |

The 8-bit peaks 0.18 GB over the plan's fit line (wired − 2 = 46 GB) at the 49k probe. It measured 45.6 GB on night 64-1, and nothing OOMed. At the 30k probe and in every e2e session it is 1–4 GB under the line. The profile allows 64k context (`MLX_OPENCODE_CONTEXT` 65536), and nothing past 49k has been measured at 48 wired. Extrapolating the 30k→49k slope (0.24 GB per 1k tokens) gives about 50 GB at 64k, over the 48 GB limit. So at 48 wired the 8-bit needs its context capped near 48k, or 52 wired for 64k (the `-w52` profile, which is still unmeasured). The 40 GB peak criterion in np-e2e's own verdicts belongs to the 36-wired tier and does not apply here.

**Decide** (`nav-pilot alpha decide`, correct/n; errors count as wrong, and there were none):

| Suite | Set | 8-bit | Occamy | optiq-64g (control) |
|---|---|---|---|---|
| sets | issue-type | 94/105 | 90/105 | 95/105 |
| sets | aksel-kind | 53/65 | 50/65 | 51/65 |
| sets | pr-motivation | 37/48 | 33/48 | 36/48 |
| sets | **total** | **184/218** | 173/218 | 182/218 |
| why | why-en / why-no | 47/48, 44/48 | 44/48, 46/48 | 45/48, 44/48 |
| why | **total** | **91/96** | 90/96 | 89/96 |
| limits | injection | 122/160 | **94/160** | 132/160 |
| limits | length | 108/150 | 97/150 | 121/150 |
| limits | lang-no | 120/152 | 112/152 | 118/152 |
| limits | position | 161/180 | 167/180 | 164/180 |
| limits | goapi | 29/40 | 32/40 | 28/40 |
| limits | loop-near | 26/40 | 24/40 | 22/40 |
| limits | lang-en, describes, options | 24/32, 37/40, 179/180 | 23/32, 37/40, 177/180 | 26/32, 37/40, 179/180 |
| limits | **total** | 806/974 | 763/974 | **827/974** |

**Verdict:**
- The 8-bit is level with optiq on decide: +2 on the recipe sets, +2 on why, −21 on limits, mostly injection (−10) and length (−13). It passes every Copilot session.
- Occamy is the weakest decider, and the gap is widest on claim injection: 94/160 against 122 and 132. It also fails a third of its Copilot sessions. The loop guard stopped three of them, two on a tool call missing its required arguments, and one R2 answer did not verify. Its frontier strength on decomposed edits (night 64-2) does not carry over to the autonomous Copilot path.
- For decide, neither candidate is better than the default optiq, so neither gets a `recommended_for` key from this night.
