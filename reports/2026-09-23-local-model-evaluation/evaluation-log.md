# Qwen3.8-27B 8-bit (nopin) as an optional nav-pilot model: evaluation log

Started 2026-09-23. This is a running log, updated as each benchmark completes.

**Hypothesis under test:** `qwen3.8-27b-8bit-nopin` (`mlx-community/Qwen3.8-27B-8bit` on mlx-lm,
without the `reasoning_effort` pin) is good enough to ship as an *optional*, non-default local
model in nav-pilot. The refutation criteria were set before any results came in (PLAN.md §12,
commit 3c10544).

## Corrections to the previous session's handoff

The session that ended on the morning of 2026-09-23 reported several things that did not hold:

| Claim | Reality |
|---|---|
| nopin scored "7/7" on 09-18 | 7/11: 7 passed, 1 timed out, 3 unscored ("needs a human") |
| A 6-run validation queue was running | It never started, and when started it failed every run in seconds: `assert_serving_profile` was a no-op stub defined after its caller (fixed in 9cc6ba3) |
| System One was "merged into navikt/copilot" | It was bundled into open PR #928 under an unrelated title. It was removed from there, fixed, and now lives on the unpushed branch `feat/local-system-one-loop-guard` (e72319e0) |
| `bench-results` validity key fix | The patch broke the script's schema handling (fixed in 41f4f95) |
| oMLX MTPLX speed comparison | Both oMLX profiles pointed at `mvid/Huihui-Qwen3.8-27B-abliterated-MTPLX-Q8`, a finetune with safety training removed. Repointed to `Jundot/Qwen3.8-27B-oQ8e-mtp`, published by the oMLX author (9c660c3) |

A baseline run of the current default, `results-qwen3.6-35b-a3b-optiq-20260902-081512-01.json`,
was served by 7 different models over the run and has to be excluded.

## Harness changes today

- `bench-models` can wait for a running queue with `BENCH_WAIT=1` instead of refusing (39658a1).
- `bench-np-e2e` runs a profile through nav-pilot's own guard, on nav-pilot's own runtime
  (mlx-lm 0.31.3), and measures memory footprint and latency (01d8070).

## Cheap-ops quality (bench-cheap-ops, 10 scored tasks; D2 is retired)

| Run | Passed | Failed | Median s/task |
|---|---|---|---|
| nopin 09-18 (old harness) | 7/11 | D2 timeout, 3 unscored | 149 |
| nopin 09-23 run 1 | 8/10 | R1 (1 of 4 terms), G2 (420 s timeout) | 145 |
| nopin 09-23 run 2 | 9/10 | R1 | 136 |
| nopin 09-23 run 3 | 6/10 | R1; M2, G2, D3 timed out at 420 s | 96 |
| nopin 09-23 run 4 | 8/10 | R1, D3 (timeout) | 115 |
| **nopin 09-23, n=4** | **mean 7.75/10 (31/40)** | R1 4/4; timeouts G2 ×2, D3 ×2, M2 ×1 | |
| optiq 09-23 run 1 (first ~3 min under the cplt CPU stress) | **9/10** | R1 | 12.7 |
| optiq 09-23 run 2 | 8/10 | R1, D3 | 12.8 |
| optiq 09-23 run 3 | 5/10 | R1; E3 (compile failed), M2 and D3 (made no edit), G2 (suite failed) | 10.9 |
| **optiq 09-23, n=3** | **mean 7.3/10 (22/30)**, range 5–9 | failures are wrong/empty edits, not timeouts | |
| optiq replacement run (for run 1) | 6/10 | R1, M2, G2, D3 | 12.2 |
| **optiq, n=4 incl. run 1** | **28/40 (7.0/10)** | | ~12 |
| optiq, n=3 excl. the stress-overlapped run 1 | 19/30 (6.3/10) | | |

The only clean optiq baseline so far (2026-09-03, older harness) scored 2, 3, 2 and 4 of 11.
It is not directly comparable, which is why optiq is being re-measured.

R1 has failed in every nopin run, so either the task or the model has a consistent problem.
Check it against the optiq re-runs.

## Risks known before measuring

- **Memory.** Weights are 29.5 GB. By arithmetic the peak at 60k context is 37–41 GB. The
  live server used 33.5 GB, which is already above the manifest's 36 GB wired limit.
- **Decode speed on smaller machines.** Decode speed is bound by memory bandwidth, and the
  model reads about 29.5 GB per token. A Pro-class chip (273 GB/s) caps at about 9 tok/s;
  a 48 GB Max-class chip (546 GB/s, like the M4 Max in the August study) at about 18 tok/s.
  Which machines Nav developers actually have decides this.
- **Manifest collision.** nav-pilot selects manifest entries by model id, and nopin shares its
  id with `qwen3.8-27b-8bit-mlx`. Shipping it means dropping that entry's
  `reasoning_effort` pin. mlx-lm reads `reasoning_effort` only through
  `chat_template_kwargs`, so the pin may already be a no-op.
- **All measurements are from one M5 Max with 128 GB.** No run happens on 48 GB hardware.

## Decision frame (user, 11:35)

Ship nopin as an optional model unless a major blocker turns up, backed by a head-to-head
comparison with the models already in the manifest. The manifest already offers
`qwen3.8-27b-8bit-mlx` (same weights, with the `reasoning_effort` pin, described as "the
quality build, weakest here"). So "shipping nopin" means updating that entry: dropping the
pin, rewriting its role, and possibly raising `min_ram_gb`. It does not mean adding a new model.

Blocker vs caveat: a failure through the nav-pilot path, an OOM, or classifier false
positives are blockers. Slow decode and high memory are caveats, to be documented in the
entry's role/requirements, since the model is opt-in.

Head-to-head set, same harness: optiq (default), qwen3.8-27b-4bit, qwen3.8-27b-8bit-mlx (pinned),
nopin. Cheap-ops ×3 each (nopin ×4), latency/memory probes for optiq, 4bit and nopin.

## Blocker found: Metal OOM at about 51k context (11:30)

Through nav-pilot's own server (mlx-lm 0.31.3, wired limit 36 GB set by nav-pilot), the 60k
latency probe died during prefill at about 51k tokens:

    RuntimeError: [METAL] Command buffer execution failed: Insufficient Memory
    (kIOGPUCommandBufferCallbackErrorOutOfMemory)   mlx_lm/generate.py:1161

- Peak process footprint was 43.8 GB, on an M5 Max with 128 GB. The limit comes from the
  wired/Metal budget, not physical RAM.
- The generation thread died, but HTTP stayed up. Every later request hung until the client's
  900 s timeout. nav-pilot did not notice. The end-to-end sessions would have hung for about
  3 hours, so the job was stopped at 11:45.
- **The already-shipped entry `qwen3.8-27b-8bit-mlx` serves the same weights with the same
  params**, and opencode declares a 65,536-token context. Users who select it today can hit
  this. It is a fleet bug regardless of the nopin decision. (Investigation running.)
- The classifier and reasoning_effort probes did not run (the probe script crashed on the
  timeout), and the end-to-end sessions did not run either. Both must be re-run after a fix.

Measured before the crash (nopin, M5 Max, nav-pilot runtime):

| Prompt | Cold TTFT | Decode | Criterion |
|---|---|---|---|
| 2k | 4.3 s | 14.8 tok/s | |
| 30k | 59.6 s | 13.8 tok/s | TTFT > 30 s: caveat |
| 60k | OOM | | blocker |

### Root cause (investigation, 11:55)

- The binding cap is `iogpu.wired_limit_mb` = 36 GiB. mlx-lm pins its working set to it. nav-pilot only checks it and never sets it.
- mlx 0.32.0 ships no fused attention kernel for head_dim 256, so each 2048-token prefill chunk
  materialises the full score matrix: about 5 GB at 51k context.
- Baseline at about 49k: 29.5 GB weights + 4.1 GB resident prompt cache + 3.2 GB KV + about 1 GB
  overhead ≈ 38 GB, plus the 5–6 GB chunk spike. It failed at about 44 GB footprint.
- Nothing enforces a maximum context: the guard doesn't count tokens and mlx-lm has no flag. Copilot
  CLI gets `COPILOT_PROVIDER_MAX_PROMPT_TOKENS=65536`, so it can legitimately send about 64k.

Exposure of shipped entries at their declared context:

| Entry | Declared context | Estimated peak | Exposed |
|---|---|---|---|
| qwen3.8-27b-8bit-mlx | 65,536 | ~45.5 GB | yes, past about 50k |
| qwen3.8-27b-4bit | 131,072 | ~51 GB with a warm cache | yes, past about 85k |
| qwen3.6-35b-a3b-optiq (default) | 65,536 | ~36 GB | no |

A dead generation thread goes undetected: `EnsureOwnServer` only checks the PID and the port, so new
sessions attach to the zombie and the user sees a spinner for 900 s per attempt.

Fixes in progress (both on branches, unpushed):
1. Manifest: cap the 8-bit entry at 32k/8k (estimated peak about 40 GB) and the 4-bit entry at 64k.
2. nav-pilot: make the server exit when its generation thread dies, so the existing
   `local_server_lost` handling reports it instead of hanging.

Later: `--prefill-step-size 512` (needs a nav-pilot flag whitelist change and has to be measured)
could restore a larger context.

## Blocker 2: Copilot CLI refuses the 32k cap (12:42)

All 12 end-to-end sessions (nopin at 32768/8192 through nav-pilot and Copilot CLI) ended within 6 s:

    ! Static system messages and tool definitions exceed the model's usable context budget.
      Reduce static context or switch to a larger-context model.

Copilot CLI's static context (system prompt, the `nais-platform` agent and tool definitions)
doesn't fit in 32768 − 8192. **The 32k cap in navikt/mlx-workspace#20 would make the 8-bit entry
unusable with Copilot CLI, nav-pilot's default client.** The PR was converted to draft at 12:50.
The 4-bit entry's 64k cap is unaffected: optiq at 65k worked through Copilot CLI on 29 Aug.

So the 8-bit weights sit between two limits on a 36 GB wired budget: Copilot CLI needs more context
than 24k, and the Metal OOM starts at about 51k. The workable window, if it exists, is roughly 40–48k
and has to be measured. Options: a 40–48k context with a smaller output and prompt cache,
`--prefill-step-size 512` (needs a nav-pilot change), or dropping the 8-bit entry for the 36 GB tier.

The System One real sessions failed for the same reason, so no real-session classifier data exists.

## System One classifier probe (nopin, 12:40, guard prompt from e72319e0)

7 scenarios × 3 repetitions. Temperature 0, so the repetitions are identical.

| Scenario | Legitimate | P(A = loop) | Would block at > 0.9 |
|---|---|---|---|
| poll-ci | yes | 0.42 | no |
| rerun-tests | yes | 0.69 | no |
| poll-pr-checks | yes | 0.69 | no |
| recompile | yes | 0.78 | no |
| rerun-go-test | yes | 0.78 | no |
| reread-file | **no (loop)** | 0.88 | **no** |
| same-grep | **no (loop)** | 0.88 | **no** |

Latency: p50 about 0.5 s, first call 0.97 s, all under the guard's 1.5 s timeout.

- 0 false positives, but also **0 true positives**. At the 0.9 threshold the classifier never
  blocks anything, so it only adds about 0.5 s per checked call.
- The classes are only 0.10 apart (legit max 0.78, loop 0.88). A threshold of 0.85 would separate
  these 7, but that is fitting to 7 hand-written scenarios.
- The structural problem: the classifier sees only the repeated call and the count, not the tool
  results. A poll that eventually succeeds and a real loop look the same at the call level. What
  distinguishes them is whether the *result* changes.
- A deterministic alternative needs no model: count only runs where the call **and its result**
  are identical. `repeatedToolCall` already walks the messages and skips the tool results, so it could
  hash them instead. That would catch both loop scenarios and none of the legitimate polls, and it
  costs no GPU time.

reasoning_effort probe: `chat_template_kwargs` high, no kwargs, and top-level high all returned
200/OK. The pin is harmless, so dropping it from the 8bit-mlx entry changes nothing.

Latency at 32k cap: 2k cold TTFT 3.0 s, 24k cold TTFT 42.6 s, decode 13.9 tok/s. No OOM.

## Head-to-head: latency and memory (nav-pilot runtime, M5 Max, wired limit 36 GB)

| Model | Cold TTFT 2k / 30k / 60k | Warm TTFT 30k | Decode 30k | Peak footprint |
|---|---|---|---|---|
| optiq (default) | 1.0 / 11.1 / 33.8 s | 0.5 s | 58.6 tok/s | 34.3 GB |
| nopin | 4.3 / 59.6 s / **OOM** | not measured | 13.8 tok/s | 43.8 GB (crashed) |
| 4bit | queued | | | |

optiq passes all of its latency and memory criteria, even at 60k. nopin decodes 4.2× slower
and needs 5.4× longer to the first token at 30k.

## 8-bit context window (13:05)

Question: is there a context setting where Copilot CLI starts a session and the server does not hit
the Metal OOM at about 51k?

### How big Copilot CLI's static context is

Copilot CLI records `systemTokens` and `toolDefinitionsTokens` in each session's `session.shutdown`
event (`~/.copilot/session-state/*/events.jsonl`), counted by its own estimator:

| sessions | system | tools | total | first request, Qwen tokens |
|---|---|---|---|---|
| 2 Sep, nopin and optiq through nav-pilot | 16.6k | 2.3k | 18.9k | 20.4k (stats.jsonl, 3 Sep) |
| 23 Sep, all 14 blocked sessions (12 E2E, 2 System One) | 36.8k | 8.4k | 45.2k | never sent |

The 23 Sep system prompt is 136,600 characters, and about 70,000 of them are duplicate copies of
the same `*.instructions.md` set (the index section alone appears four times). nav-pilot sets
`COPILOT_CUSTOM_INSTRUCTIONS_DIRS=~/.copilot` (`copilot_launch.go`, `copilotEnv`). Copilot CLI
searches that directory recursively, so it also loads the `instructions/` directories of git
worktrees that other agent sessions left under `~/.copilot/session-state/<id>/files/`
(`a4734d79…/files/copilot-worktree`, and `fbe281f6…/files/{article,benchmark,models}-worktree`).
The static context depends on what else is lying around in `~/.copilot`, not on the model.

### Where the gate is

I reproduced the gate without a server by pointing Copilot CLI 1.0.89-0 at a dead port with
nav-pilot's env (the check fires before the first model call). The output-token setting made no
difference.

| static context | 24576 | 28672 | 32768 | 40960 | 49152 | 57344 |
|---|---|---|---|---|---|---|
| 44.2k (`~/.copilot` as it is) | | | blocked | blocked | blocked (90%) | starts, warns at 77% |
| 21.4k (a copy of `~/.copilot` without `session-state`) | blocked (87%) | starts (74%) | starts | | | |

Copilot CLI refuses once static context goes above roughly 80% of `COPILOT_PROVIDER_MAX_PROMPT_TOKENS`.

- **With `~/.copilot` as it is now**, the window has to be at least about 56k. That is past the
  51k OOM, so neither 40k nor 48k can start a session. There is no window.
- **With the stray worktrees gone**, static context is about 21k (about 23k Qwen tokens), and the
  32k cap already passes the gate. Blocker 2 was caused by the environment, not by the cap.

### Candidates

New profiles are copies of `qwen3.8-27b-8bit-nopin` with 4096 output and a 2 GiB prompt cache
(`--prompt-cache-size 2` unchanged):

| profile | context | latency targets (cold, warm ≥30k and at the top) |
|---|---|---|
| `qwen3.8-27b-8bit-nopin-c48k` | 49152 | 2k, 30k, 45k |
| `qwen3.8-27b-8bit-nopin-c40k` | 40960 | 2k, 30k, 36k |
| `qwen3.8-27b-8bit-nopin-c32k` | 32768 | 2k, 28k |

I checked the pass-through: `_np_checks.py manifest` copies every `MLX_*` param into the manifest
entry, nav-pilot's `serverFlags` maps `MLX_CACHE_BYTES` to `--prompt-cache-bytes`, and
`copilotLocalEnv` sends `MLX_OPENCODE_CONTEXT`/`_OUTPUT` as
`COPILOT_PROVIDER_MAX_PROMPT_TOKENS`/`_MAX_OUTPUT_TOKENS`. nav-pilot has no mapping for
`MLX_PREFILL_STEP_SIZE`, so a smaller prefill chunk still needs a nav-pilot change.

All three are queued in `bench-np-e2e`, full mode, one after another
(`.bench-logs/np-8bit-window-queue.sh`, log `.bench-logs/np-8bit-window-queue.log`). After each run
the wrapper saves that run's slice of nav-pilot's `server.log` and counts `Insufficient Memory`
lines. It also lists the Copilot static-context numbers for the run's sessions. If the stray
worktrees are still in `~/.copilot` when a run starts, c48k and c40k E2E fail at the gate again,
and only their memory and latency results mean anything.

Pass criteria: E2E verified ≥ 5/6 on R2/E1/M1 through nav-pilot, no `Insufficient Memory`, peak
footprint ≤ 41 GB, and a warm follow-up at the top latency target.

Results: pending.

## Decisions and open PRs (13:30)

- optiq stays the default. The user judged its ~10× speed worth the small, non-significant quality gap.
- The 8-bit Qwen3.8 is withdrawn from the 48 GB tier and moved to the 64 GB backlog; its window tests were cancelled.
- The System One LLM classifier is replaced by a deterministic result-aware rule. Branch
  `feat/local-system-one-loop-guard` is superseded and stays local, unpushed.

| PR | What | State |
|---|---|---|
| navikt/mlx-workspace#20 | 4-bit context 131k → 64k; stop offering the 8-bit | draft |
| navikt/copilot#931 | the server exits with status 70 when its generation thread dies; nav-pilot reports it | open |
| navikt/copilot#932 | Copilot custom instructions scoped to `~/.copilot/.github/instructions` (was recursive over `~/.copilot`, +26k static tokens per request, cloud too) | open |
| navikt/copilot#933 | loop guard counts identical call **and result** (4), backstop 8 identical calls | open |

## Queue

1. nopin cheap-ops runs 3–4
2. ~~oMLX with MTP on the official build~~: dropped. The user decided (12:00) to keep the 36 GB wired limit that fits 48 GB machines and not run anything at 96 GB for now.
3. optiq cheap-ops ×3: re-measured baseline
4. `bench-np-e2e` nopin: end-to-end through nav-pilot, memory, latency, classifier probe
5. `bench-np-e2e` optiq, latency and memory only
6. cheap-ops ×3 for qwen3.8-27b-4bit and for qwen3.8-27b-8bit-mlx (pinned), interleaved
7. `bench-np-e2e` qwen3.8-27b-4bit, latency and memory only

Once the queue is done: System One integration and testing in real nav-pilot sessions.

## Results log

- 08:39 queue relaunched after the harness fix.
- 09:15 nopin run 1: 8/10.
- 09:58 nopin run 2: 9/10.
- 11:27 first probe: 2k cold TTFT 4.3 s, decode 14.8 tok/s, peak footprint 37.3 GB (at risk).
- 11:48 oMLX runs refused by oMLX's own prefill memory guard: 30 GB of weights already exceed 90% of the 36 GB Metal cap. Both oMLX profiles ask for `gpu_wired_limit_gb = 96`, and the machine is at 36 (model-use only recommends the change, and `vram-set` needs sudo). The oMLX numbers need a separate batch at 96 GB and are not relevant to a 48 GB fleet anyway.
- 11:43 another session (navikt/cplt) started a CPU stress test: 22 `yes` processes for about 40 Chrome test runs. Every cheap-ops run that overlaps it is invalid (CPU contention slows the agent loop and can cause timeouts). The user decided to let it finish and re-run the affected runs. optiq run 1 (11:55) is affected.
- 15:48 4-bit run `143323-02`: 6/10. 4-bit n=3 clean: 17/30.
- 15:14 4-bit clean runs: `125734-01` 6/10 (median 59 s), `143323-01` 5/10 (median 122 s). The 4-bit is below both optiq and nopin, and slower than optiq.
- 13:47–13:55 **Two queues ran lockless at the same time.** Killing the head-to-head queue with TERM only ran its trap (which removes the lock) and did not stop it, so it went on next to the queue that took the lock. Invalid: 4-bit `20260923-125734-03`, the 8bit-mlx `20260923-125734-02` (irrelevant now), and 4-bit `20260923-134745-01/02`. Fixed in d827d81 (INT/TERM now exit). Two clean 4-bit runs were requeued. The only clean 4-bit run so far is `20260923-125734-01`.
- 12:57 optiq replacement run: 6/10. nopin 31/40 vs optiq 28/40: Fisher p=0.61; vs 19/30 excluding run 1: p=0.29. nopin's edge is not significant at this n. optiq is about 10× faster per task.
- 12:39 optiq run 3: 5/10. optiq fails differently from nopin: fast, wrong or empty edits ("no changes made" in 8 s) where nopin times out. n=3 so far: 22/30 vs nopin 31/40, a statistical tie at 10× the speed. Variance is high for both (5–9 and 6–9).
- 12:35 Re-prioritized (user): the head-to-head for 4bit and pinned 8bit is deferred until the nopin e2e and System One jobs finish, since optiq already leads decisively.
- 12:27 optiq run 2: 8/10 (R1, D3), median 12.8 s. Served model verified.
- 12:14 **optiq run 1: 9/10 at a median of 12.7 s/task.** On the current harness the default matches nopin's best run and is about 10× faster. The old 2–4/11 baseline was a harness artefact, not the model. The stress test ended at 11:58, so only the first ~3 minutes overlapped. A replacement run is queued anyway.
- 12:00 PRs opened: navikt/mlx-workspace#20 (context caps) and navikt/copilot#931 (dead generation thread exits with status 70).
- 12:00 nopin profile capped at 32k/8k (cbe77ea), so the re-test covers what would ship.
- 11:47 optiq latency/memory done: every criterion passes (34.3 GB peak at 60k).
- 11:45 nopin e2e stopped: the server's generation thread died on a Metal OOM at about 51k tokens (see the blocker section).
- 11:35 head-to-head queued (4bit and pinned 8bit cheap-ops ×3, 4bit latency).
- 11:25 nopin run 4: 8/10. Across n=4 on the current harness: 31/40, range 6–9. Medians recomputed over the 10 scored tasks, excluding D2.
- 11:25 `bench-np-e2e` for nopin took the lock ahead of the oMLX and optiq queues (the waiters don't queue in order).
- 10:45 nopin run 3: 6/10. Three timeouts at the 420 s cap and no loops (longest identical run 1). Variance so far is 6–9/10, so timeouts are the main failure mode, not wrong answers.
