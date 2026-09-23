# Local models for nav-pilot: decision and action list, 2026-09-23

For a Nav platform engineer who was not part of today's work. Every number is re-derived from the
raw file it cites. `bench/` files are in this repo; `.bench-logs/` is git-ignored and exists only
on the benchmark machine (M5 Max, 128 GB, `iogpu.wired_limit_mb` = 36864 to emulate a 48 GB
machine, nav-pilot's runtime mlx-lm 0.31.3 / mlx 0.32.0).

Background detail is in `reports/qwen3.8-nopin-evaluation-2026-09-23.md` (running log),
`reports/nav-pilot-e2e-2026-09-23.md` and `reports/hardware-tier-test-backlog.md`.

## 1. Decision summary

1. `qwen3.6-35b-a3b-optiq` stays the only default. Its quality is level with the best local alternative (28/40 vs 31/40, Fisher p = 0.61), and it is about 9× faster per task.
2. The 8-bit Qwen3.8-27B (`qwen3.8-27b-8bit-mlx`, and the `-nopin` variant) is withdrawn from the 48 GB tier. At 36 GB wired it hit a Metal OOM at about 51k tokens once and slows about 6× past 40k.
3. The 8-bit moves to the 64 GB backlog. Nothing about it gets shipped today.
4. `qwen3.8-27b-4bit` is capped at 65,536 context (from 131,072) in navikt/mlx-workspace#20. It verified an E1 session through nav-pilot at that cap and peaked at 29.6 GB.
5. **Recommendation:** stop offering the 4-bit as well, in a follow-up to #20. It scored 17/30, below optiq, at about 6.6× the time per task and less than half optiq's decode speed. It wins on nothing.
6. The LLM loop classifier ("System One") is dropped. At its 0.9 threshold it blocked none of 7 probe scenarios, loops included.
7. It is replaced by a deterministic rule (navikt/copilot#933): block after 4 identical calls with identical results, and keep a backstop at 8 identical calls.
8. Two nav-pilot fixes go with it: #931 (a dead generation thread makes the server exit, so it no longer hangs) and #932 (Copilot static context 45.1k → 21.7k tokens).
9. All four PRs were tested together end to end, and every scenario passed after a re-run that fixed the test design.
10. Not measured: real 48 GB hardware or Pro-chip decode speed. The 4-bit at 60k works on 36 GB wired but is slow: 109 s to first token, 22 tok/s, peaking at 39.0 GB.

## 2. Action list

All actions are for the user (Hans). Suggested order follows the table.

| # | Action | Link | Evidence | Risk if not done |
|---|---|---|---|---|
| 1 | Merge navikt/copilot#932 (scope `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` to `~/.copilot/.github/instructions`) | https://github.com/navikt/copilot/pull/932 | Static context 21,709 / 21,700 / 21,704 tokens with it, 45.1k without (§3.4). CI green, mergeable | Every Copilot session, including cloud sessions, carries ~23k duplicate instruction tokens per request, and local 32k models can't start at all |
| 2 | Merge navikt/copilot#931 (the server exits with status 70 when its generation thread dies) | https://github.com/navikt/copilot/pull/931 | `bench/navpilot-e2e-rerun-20260923-154926.json` `e`: server gone 0.5 s after an injected fault, and the next launch prints "generation thread died, most likely out of memory" after 2.0 s. The PR body still says "not yet verified"; update it (fault injection, not a real OOM) | After an OOM, sessions attach to the dead server and hang for 900 s per attempt |
| 3 | Merge navikt/copilot#933 (result-aware loop guard) | https://github.com/navikt/copilot/pull/933 | Re-run `d`: the loop was blocked at 4 with "same result" after 20 s. A poll with changing output ran 7 identical calls to READY without being blocked | The guard keeps treating a legitimate poll like a loop (it fires at 8 regardless of the result), and a genuinely stuck loop runs until call 8 |
| 4 | Mark navikt/mlx-workspace#20 ready and merge it (4-bit capped at 64k, 8-bit no longer offered) | https://github.com/navikt/mlx-workspace/pull/20 | Draft, mergeable, CodeQL green. Manifest `9a6e7ff` was used in the combined e2e run. The fallback for users who configured the 8-bit exists (`local.Chosen` falls back to the default) | Users who select the 8-bit on 48 GB machines hit an OOM or a 6× slowdown past 40k |
| 5 | Open an issue: "Launch failed" exits 0 | new issue in navikt/copilot | `.bench-logs/navpilot-rerun-fault-launch-20260923-155023.log`, `launch.exit: 0` in the re-run JSON. The cause is in `offerLaunchCopilot` (`internal/cli/interactive.go:1092-1096`), which prints the error and returns. That code is on `main` already and wasn't introduced by #931, so it should be a **separate issue**, not a #931 follow-up | Scripts and CI that wrap nav-pilot can't tell a failed launch from a successful one |
| 6 | Decide what to do about the rtk instructions reaching local sessions (options below) | `~/.copilot/copilot-instructions.md`, `~/.copilot/hooks/rtk-rewrite.json` | §3.6 | Small local models burn turns on `rtk` output they can't read |
| 7 | Commit today's `bench/*.json` and merge `fix/bench-results-schema` into mlx-workspace `main` (details below) | branch `fix/bench-results-schema` | 38 commits ahead of `main` | Harness fixes stay off `main`. Today's raw results are **untracked**, although `.gitignore:23` says `bench/results-*.json` is tracked evidence |
| 8 | Correct PLAN.md (details below) | `PLAN.md:104`, `:371`, `:376-379` | §4 | The next reader believes the 8-bit went 7/7 and that System One shipped |
| 9 | Remove stale branches and worktrees after the merges (details below) | | | Disk use, and the main copilot checkout stays on a superseded branch |
| 10 | Your call: remove the `~/.copilot/session-state` worktrees | 5 directories, listed below | They caused the 45.1k static context | After #932 they no longer reach nav-pilot sessions. Before #932 they do |

**Merge order and dependencies.** #932 → #931 → #933 → #20. None depends on another. They were
merged together without conflicts into `test/e2e-combined` (915e27c6) and passed
`go test -race` and the e2e run. #932 goes first because it also cuts cloud cost. #20 goes last,
so that when the manifest stops offering the 8-bit, nav-pilot already reports a dead server
instead of hanging on one. After #20, open the follow-up that stops offering the 4-bit, if you
accept recommendation 5.

**rtk options (#6), undecided:**

- A. Delete the `<!-- rtk-instructions v2 -->` block from `~/.copilot/copilot-instructions.md`. Simple, but cloud Copilot sessions lose rtk's savings too.
- B. Have nav-pilot/cplt give local sessions a Copilot config without that file. Needs a code change; whether Copilot can skip `copilot-instructions.md` per session has not been checked.
- C. Keep it. #933 already stops the resulting repeat at 4 calls; the cost is wasted turns.
- D. Configure rtk not to collapse short `find`/`grep` output to "N filtered". This keeps rtk but has to be tested against rtk's own configuration.

**`fix/bench-results-schema` (#7), notable commits:** harness repairs 41f4f95 (bench-results
schema) and 9cc6ba3 (`assert_serving_profile` was a no-op, so every run failed in seconds);
39658a1/fe47f33 (`BENCH_WAIT=1`: queues wait instead of refusing); d827d81 (INT/TERM now exit.
Before, killing a queue ran only its lock-removing trap and the queue kept going without the lock,
which is how two queues ran at once at 13:47–13:55); new tasks 01d8070 `bench-np-e2e`, 6af4d80
`bench-system-one`, 9724e1b `bench-navpilot-e2e`, 8c69310 `bench-navpilot-e2e-rerun`; profile
cap cbe77ea. Before merging, commit the untracked `bench/*-20260923-*.json`, including the invalid
runs, which the report cites as excluded, and the 4-bit latency file once it is complete. Decide
whether to keep the two untracked profiles `profiles/qwen3.8-27b-4bit-quasar.toml` and
`profiles/qwen3.8-flash-next-4bit.toml`.

**PLAN.md (#8):**

- Line 104 ("7/7 on all mechanically verified tasks … zero tool loops") and line 371 (§11.5, "1 stellar run (7/7, 0 loops)"): the run was 7 passed out of 11 (D2 timed out, R1/R3/D1 unscored), `bench/results-qwen3.8-27b-8bit-nopin-20260918-104324-01.json`. The current-harness figure is 31/40.
- Lines 376–379 (§11.6, "PROVEN & INTEGRATED … merged into `navikt/copilot`"): it was never merged. It sat in an unrelated PR (#928), then on local branch `feat/local-system-one-loop-guard`, and it is now superseded by #933. The 4/4 probe did not hold up on 7 scenarios (§3.5).

**Stale branches and worktrees (#9):**

- `feat/local-system-one-loop-guard` (e72319e0): local only, superseded by #933. The main checkout `~/go/src/github.com/navikt/copilot` is **on** this branch; switch it to `main` before deleting the branch.
- Today's copilot worktrees, to remove once their PR merges: `copilot-deadthread` (#931), `copilot-instrdirs` (#932), `copilot-loopguard` (#933), `copilot-e2e` (`test/e2e-combined`, local only; it built `.bench-logs/bin/nav-pilot-combined-915e27c6`).
- `/Users/hans/mlx-workspace-hotfix`: worktree for #20's branch, clean. Remove after #20 merges.
- 39 other `~/go/src/github.com/navikt/copilot-*` worktrees predate today and were not reviewed here.
- `~/.copilot/session-state` (#10): `a4734d79…/files/{copilot-worktree,cplt-worktree}` and `fbe281f6…/files/{article,benchmark,models}-worktree`.

## 3. Evidence

### 3.1 Head-to-head (cheap-ops, 10 scored tasks, D2 retired)

| Model | Valid runs | Pass | Median s/task (pooled) | TTFT / decode at 2k | TTFT / decode at 30k | Peak footprint |
|---|---|---|---|---|---|---|
| optiq (default) | 4 (`115543-01/02/03`, `124337-01`) | 28/40 (70%) | 12.2 | 0.99 s / 68.6 tok/s | 11.1 s / 58.6 tok/s | 34.3 GB at 60k |
| optiq, without stress-overlapped `115543-01` | 3 | 19/30 (63%) | 11.9 | | | |
| 8-bit nopin | 4 (`083958-01..04`) | 31/40 (78%) | 115 | 4.3 s / 14.8 tok/s | 59.6 s / 13.8 tok/s | 43.8 GB, then OOM |
| 4-bit | 3 (`125734-01`, `143323-01/02`) | 17/30 (57%) | 80 | 2.5 s / 30.1 tok/s | 47.0 s / 25.1 tok/s | 39.0 GB at 60k (TTFT 109 s, 22.2 tok/s) |
| 8-bit pinned (`8bit-mlx`) | 0 valid | | | not measured | | |

Sources: `bench/results-<profile>-20260923-<run>.json`; latency from `bench/np-e2e-qwen3.6-35b-a3b-optiq-20260923-114534.json`,
`np-e2e-qwen3.8-27b-8bit-nopin-20260923-112533.json` and `np-e2e-qwen3.8-27b-4bit-20260923-155027.json` (cold
probes, 256 output tokens). Peaks: optiq from its np-e2e `memory.peak_gb`; nopin from
`.bench-logs/np-e2e-qwen3.8-27b-8bit-nopin-20260923-112533.footprint` (max 43,828,073,688 bytes);
4-bit from `bench/navpilot-e2e-20260923-140805.json` `memory.peak_gb_by_phase.c-E1`.
Excluded as invalid (two queues ran at once): 4-bit `125734-03` and `134745-02`, 8bit-mlx `125734-02`.
The 4-bit latency run (15:50–15:56) finished all targets. 60k: TTFT 109 s, decode 22.2 tok/s, peak 39.0 GB, no OOM.

Per-run pass counts: optiq 9, 8, 5, 6. nopin 8, 9, 6, 8. 4-bit 6, 5, 6. R1 failed in all 11 valid
runs across the three models, so it probably tests the task, not the model.

### 3.2 Significance (two-sided Fisher exact, computed here, confirmed with scipy)

| Comparison | p |
|---|---|
| nopin 31/40 vs optiq 28/40 | 0.61 |
| nopin 31/40 vs optiq 19/30 (without `115543-01`) | 0.29 |
| optiq 28/40 vs 4-bit 17/30 | 0.32 |
| optiq 19/30 vs 4-bit 17/30 | 0.79 |
| nopin 31/40 vs 4-bit 17/30 | 0.07 |

None of the differences is significant at this n. Speed is: the difference is 9–10× per task.

### 3.3 The OOM

In the nav-pilot runtime, the nopin 60k probe died during prefill at about 51k tokens with
`[METAL] Command buffer execution failed: Insufficient Memory` (`.bench-logs/server-restart.log:84885`),
after a peak of 43.8 GB. The generation thread died while HTTP stayed up, so later requests hung.
That is what #931 fixes. According to the running log, the cause is the 36 GB wired cap plus
mlx 0.32.0 having no fused attention kernel for head_dim 256, which gives a ~5 GB score-matrix spike
per 2048-token chunk. The OOM is not deterministic. A later 8-bit run with a 59,210-token prompt
peaked at 46.31 GB without an OOM (`bench/navpilot-e2e-20260923-140805.json`, `e-crash`), but its
prefill slowed from 3.5–4.5 s per 2048 tokens below 36k to 25–30 s past 49k
(`.bench-logs/navpilot-e2e-crash-20260923-143030.server.log`). At the 32k cap the 8-bit peaked at
37.23 GB without an OOM (`bench/np-e2e-qwen3.8-27b-8bit-nopin-20260923-123952.json`).

### 3.4 Copilot static context: 45.1k → 21.7k

Copilot CLI refuses to start when static context exceeds about 80% of
`COPILOT_PROVIDER_MAX_PROMPT_TOKENS`. On 23 Sep the blocked sessions recorded `systemTokens`
36,749–36,753 plus `toolDefinitionsTokens` 8,358 ≈ 45.1k (`session.shutdown` events in
`~/.copilot/session-state/*/events.jsonl`; the log rounds this to 45.2k). The cause was
`COPILOT_CUSTOM_INSTRUCTIONS_DIRS=~/.copilot`, searched recursively into agent worktrees under
`session-state`. With #932: 13,351 + 8,358 = 21,709, and 21,700 and 21,704 on the other two
sessions (`bench/navpilot-e2e-20260923-140805.json`, scenario `a`). All 12 nopin e2e sessions at
32k ended within 6–9 s at that gate and produced no quality data
(`np-e2e-qwen3.8-27b-8bit-nopin-20260923-123952.json`, `e2e`).

### 3.5 Classifier probe (nopin, guard prompt from e72319e0)

7 scenarios × 3 repetitions at temperature 0, all identical. Values from
`bench/system-one-qwen3.8-27b-8bit-nopin-20260923-124307.json` (same values in `np-e2e-…-123952.json`).

| Scenario | Actually a loop | P(A = loop) | Blocks at > 0.9 |
|---|---|---|---|
| poll-ci | no | 0.417 | no |
| rerun-tests | no | 0.687 | no |
| poll-pr-checks | no | 0.687 | no |
| recompile | no | 0.779 | no |
| rerun-go-test | no | 0.779 | no |
| reread-file | yes | 0.883 | **no** |
| same-grep | yes | 0.883 | **no** |

The probe had no false positives and no true positives. Latency p50 was 0.49 s and p95 0.52 s.
The classifier sees the call and the count but not the result, and the result is what separates a
poll from a loop. #933 uses the result.

### 3.6 Combined e2e (#931 + #932 + #933 + #20 manifest)

`bench/navpilot-e2e-20260923-140805.json`, and for d and e `bench/navpilot-e2e-rerun-20260923-154926.json`:

- a, Copilot + optiq: R2 and E1 verified. M1 made no edit ("no changes made"). This counts as a model miss, not an integration failure, so it doesn't block the merges. Static context was 21.7k.
- b, opencode cloud main with `local-worker`: verified, 2 local calls, $0.0242 of cloud cost.
- c, Copilot + 4-bit at 65,536: E1 verified in 60.2 s, no OOM, peak 29.58 GB.
- d, loop guard: the first run was invalid because the session ran in the wrong cwd. The re-run passed: the loop was blocked at 4 and the poll finished at call 7.
- e, crash reporting: the first run did not reproduce the OOM. The re-run with an injected fault passed, but the failed launch exits 0 (action 5).

rtk, from events in `~/.copilot/session-state/958221ad-…/events.jsonl` (the first poll session):
the model issued `rtk grep`/`rtk find` because `copilot-instructions.md` tells it to. Inside the
repo, rtk **ran** (exit 0), but it reduced the output to `... (51 filtered) [+51 hidden: rtk recall …]`,
so the model never saw the file list and repeated the call. The later calls on `/Users/hans` were
denied by Copilot's permission layer, and the plain `find` was denied just the same. The
denial is about the path, not about rtk. The four identical denied `rtk find` calls tripped #933,
correctly.

## 4. What the previous handoff got wrong

- "nopin 7/7": the run was 7/11 (above). PLAN.md still says 7/7.
- "System One merged into navikt/copilot": it was never merged, and it has been superseded.
- "A 6-run validation queue is running": it never started, and when it was started every run failed within seconds because of the `assert_serving_profile` stub (9cc6ba3).
- The `bench-results` validity fix broke the schema (41f4f95).
- The oMLX MTP comparison pointed at an abliterated finetune (fixed in 9c660c3).
- The same-day e2e report says the poll session's `rtk find` got "Permission denied" each time. Only the calls outside the repo were denied; inside it, rtk ran and hid its output (§3.6).
- "The 8-bit OOMs at ~51k" held once. A second attempt reached 59k without an OOM but ran about 6× slower, which leads to the same decision.
- "The 4-bit is below both optiq and nopin": that is true of the point estimates only (p = 0.32 and 0.79 against optiq).

## 5. Open questions and what was not measured

- **Real 48 GB hardware.** Everything above ran on a 128 GB M5 Max with the wired limit set to 36 GB. Whole-system pressure with an IDE, a browser and Copilot running (48 − 36 = 12 GB for everything else) is unmeasured.
- **Pro-chip decode.** Decode is bandwidth-bound. The running log estimates about 9 tok/s for the 8-bit on a 273 GB/s Pro chip, and for the 4-bit and optiq it is unmeasured. Which chips Nav developers actually have decides whether any dense model is usable.
- **4-bit at 60k** (`bench/np-e2e-qwen3.8-27b-4bit-20260923-155027.json`): no OOM, peak 39.0 GB, cold TTFT 109 s (a repeat gave 123 s), decode 22.2 tok/s. This fails the §12 latency criteria (cold TTFT at 30k is 47.0 s against a 30 s limit, and at 60k 109 s against 90 s), which supports recommendation 5.
- **`min_ram_gb` is not enforced by nav-pilot**, so per-tier manifest entries do nothing until it is.
- **Quality n is small.** 3–4 runs per model can't separate 57–78% pass rates. Variance within a model (optiq 5–9/10) is as large as the differences between models.
- Tests for the 64 GB and 128 GB tiers (8-bit at full context, `--prefill-step-size 512`, oMLX MTP, Qwen3.8-Flash-Next) are listed in `reports/hardware-tier-test-backlog.md`.
