# Quality frontier, night v2 validate: results

Written by `mise run night-run-3` from `.bench-logs/night3-20260929-074434/steps.jsonl` and the result files. The plan and the rules are [design.md](design.md). Local model(s) `qwen3.6-35b-a3b-optiq`, cloud reference `claude-sonnet-5`.

- Started 2026-09-29T07:44:58+02:00, last step ended 2026-09-29T08:53:12+02:00.
- Cloud spend: $0 of the $80 cap.

## Steps

| # | Part | Step | Classes | Variant | Status | Minutes | Result |
|---|---|---|---|---|---|---|---|
| 1 | local | base | create-file | base | OK | 36 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260929-074458.json` |
| 2 | local | base | edit-single | base | OK | 11 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260929-082055.json` |
| 3 | local | base | edit-multi-mechanical | base | OK | 13 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260929-083223.json` |
| 4 | local | base | debug | base | OK | 3 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260929-084457.json` |
| 5 | local | base | read-qa | base | OK | 6 | `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260929-084732.json` |

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

## Review (2026-09-29)

This section covers the five result files, checked against the queue's criteria (#89, #107) and the session transcripts `.bench-logs/qwen3.6-35b-a3b-optiq-20260929-0*.jsonl` (60 sessions). Every file carries the new `harness_sha` f7507f42e5f4 and `tasks_sha` 17d0cf33d776, and every sample's `served_model` is `mlx-community/Qwen3.6-35B-A3B-OptiQ-4bit`. No sample was invalid, none timed out, and no step stopped at preflight. The night took 68 minutes against the ~2 h 45 min expected, because the base steps finished quickly. Intervals are 95 % Wilson.

**#89, the in-session toolchain: fixed.**
- 29 `./gradlew` invocations ran in the sessions. 12 printed BUILD SUCCESSFUL, and 8 show the JDK 21 runtime (`java.base@21.0.12.1`) in their stack traces.
- The 15 BUILD FAILED are the model's own code: 9 are failing tests and 6 are `compileTestKotlin` errors (`e:` lines in the new test files). Of the 2 that printed neither, one is failing tests, and one is a `-q run` whose cause `head` cut off. None shows a toolchain error.
- No transcript mentions JDK 27.
- The only "Operation not permitted" lines (2, in one session) are the sandbox refusing `ls /Users/hans/` and `ls` of the repo root. That is the confinement working, not mise walking up.

**#107, daemon pile-up: fixed.** Samples record `daemons_stopped`: 11 on create-file and 1 on debug, the classes that build. After the night, no sandboxed Gradle or Kotlin daemon was running. Two daemons were left from 07:49, a Gradle daemon and its Kotlin daemon, with no cplt tmpdir. They are the verifier's, which v2 leaves alone by design, and they were stopped by hand after the night.

**Stray files:** no sample left one (`stray` empty in all 60), so the sweep was not exercised live this night. `night-run-3-selftest` covers it. #90 said it closes with #89 after this night; it stays open until a real stray is swept, which is stricter than its own done list.

**Against v1 on the same rungs** (optiq base):

| Cell | v2 | v1 | one-sided Fisher p (v2 > v1) |
|---|---|---|---|
| create-file r1–r3 | **12/12** [0.76–1.00], median 154–176 s | 3/12 [0.09–0.53] (night 1, 3c5708b4423f), and r1 5/20 at df7deb1af416 | < 0.001 |
| debug r1 | 3/4, median 31 s | 3/4, median 143 s (night 1) | – |
| edit-single r3–r5 | 9/12 | 15/24 (night 1) | – |
| edit-multi-mechanical r2–r4 | 11/12 | 25/30 (night 1) plus 14/16 at r4 (df7deb1af416) | 0.44 against night 1 |
| read-qa r1–r5 | 9/20 [0.26–0.66] | 18/40 (night 1) | – (no change, as expected: it builds nothing) |

**Verdict:** v2 does what it was built for. With a working JDK 21 in the session, optiq passes every create-file sample on rungs 1–3, against 3 of 12 under v1. Debug is also level on pass rate and 4–5× faster at n = 4. So v1's create-file ladder measured the broken toolchain more than the model. This is one model and variant (optiq base), but the direction holds for all of them: every create-file verdict for local models from before v2 (nights 1 and 2, 64-2, 64-5, follow-ups 1, the presence_penalty A/B) understates them, and the class needs its v2 base ladders re-run. read-qa and the edit classes move within their intervals. These are v2's first cells, at n = 4 per rung.
