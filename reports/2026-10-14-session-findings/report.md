# Session findings, 12–14 October 2026

What the 12–14 October work established, with links to the merged reports, PRs and issues.
Every number below comes from those sources. Nothing here changes the manifest or routing.

## 1. Benchmark-harness integrity

Several "model results" in this window turned out to be harness faults. Each one is fixed or tracked.

- **The cloud arm ran without a JDK.** cplt resolves `~` grants against the temporary HOME, so
  mise's JDK and `~/.gradle` were blocked inside the sandbox (`libjli.dylib … sandbox blocked
  open()`). In the 13 Oct db-r3 transcripts the model could not run `./gradlew test` and gave up:
  rungs 1–2 passed only because the prompt names the failing code, and rung 3 scored 0/10.
  #250 added the toolchain grants. #255 fixed the gap #250 left: only `night-run-3` exported
  `CPLT_CONFIG`, so a direct `bench-frontier` cloud run still had no JDK. Cloud debug rows from
  harnesses before `0e3926c39d5a` are invalid as baselines and are kept apart. Local rows from those
  harnesses pool with `0e3926c39d5a`, because #250 and #255 changed only the cloud arm (#253).
- **SysV shared-memory leak.** Embedded Postgres killed mid-run leaked SysV segments until
  `kern.sysv.shmmni` (32) was exhausted. From then on every verifier `initdb` failed regardless of
  the model's code. On 13 Oct the cloud claude-sonnet-5.5 ladder scored 1/10, 0/10 and 0/10 on
  rungs 1–3 (#261, closed as invalid). The model's fixes were correct: the suite went green after
  `ipcrm`. #262 reaps orphaned, unattached segments at teardown.
- **The sandbox blocked SysV IPC for the agent.** Separate from the leak: inside cplt, `shmget`
  returns EPERM, so agents could not run the Postgres-backed tests themselves (17 qwen3.8 sessions
  on 13 Oct, one cloud session on 26 Sep). Verifier grading is unaffected, but rungs 2–3 ask the
  agent to run the tests, so those scores are likely depressed for every arm (#263). An opt-in
  `sandbox.allow_sysv_ipc` in cplt (navikt/cplt#761) stays open: the cplt owner blocked it because it
  weakens the sandbox. The fix instead: the harness runs Postgres outside the sandbox and the
  fixtures connect over localhost TCP (#277).
- **Home paths leaked into results.** Frontier result JSONs carried absolute home paths in
  `build_tail`. They were found in review of #267 and scrubbed by hand. #271 removed three more from
  `oq-launcher`. The harness-side scrub is #268 (open).
- **Timeout semantics.** The waiting-launcher template marks a pass FAILED when its last 60 log
  lines contain `TIMEOUT`, even after `exit 0` with every step finished and the report written
  (#252, open). Separately, timed-out samples count as failures in the frontier tables, which is
  why rungs 2–3 have small n (#249).

**Lesson:** when a strong model suddenly gets worse, suspect the harness first. The 13 Oct cloud
collapse (#261) and the cloud rung-3 0/10 (#250) were both harness faults.

## 2. Debug-class results

- **dbg2, Qwen3.8 27B, rungs 1–3 (#249, held).** Pooled over 12–13 Oct, Wilson one-sided 90 % LB,
  timeouts as failures:

  | Model | r1 | r2 | r3 | Timeouts |
  |---|---|---|---|---|
  | qwen3.8-27b-8bit-64g | 28/32 (0.78) | 1/9 (0.03) | 0/6 (0.00) | 8 |
  | qwen3.8-27b-optiq-4bit | 32/32 (0.95) | 1/6 (0.05) | 1/6 (0.05) | 2 |
  | claude-sonnet-5.5 | 10/10 (0.86) | 10/10 (0.86) | 0/10 (0.00) | 0 |

  Rungs 2–3 are provisional until #263 is fixed. The Sonnet r3 0/10 is the no-JDK fault above.
- **Pooling (#253, open):** local rows on the older harness SHAs pool with `0e3926c39d5a`. Cloud
  rows stay apart.
- **Batch 3 is blocked** (PLAN.md, row 7): debug rungs 2–3 on 8-bit and OptiQ plus a Sonnet 5.5
  ladder (~$5). It waits for the harness-run Postgres (#277); tracked in #278. The rerun
  scores replace dbg2.

## 3. Runtime experiments

Ranked and triaged in PLAN.md "Next experiments" (#259). All runs below use the same Qwen3.8-27B 8-bit weights unless stated.

| Server | debug r1 | debug r2 | cheap-ops | Timeouts (r1+r2 / ops) | median s/sample r1 / r2 / ops |
|---|---|---|---|---|---|
| mlx_lm (baseline) | 28/32, LB 0.72 | 1/9, LB 0.02 | 18/22, LB 0.61 | 6 / 2 | 241 / 739 / 54 |
| MTPLX | 9/10, LB 0.60 | 6/10, LB 0.31 | 64/65, LB 0.92 | 0 / 0 | 72 / 152 / 17 |
| Rapid-MLX 0.16.1 | 10/10, LB 0.72 | 4/10, LB 0.17 | 61/65, LB 0.85 | 2 / 2 | 164 / 288 / 66 |

Wilson 95 % LBs, from [D.md](../2026-10-14-final2/D.md). The baseline cheap-ops rows are from
27 Sep and cover 11 tasks, not 13, and the harness SHAs differ between servers.

- **MTPLX (#256, results #267): speed met, quality not compared.** Decode was 2.5–2.7x in an
  isolated probe and wall-clock was 3–5x per sample (3.4x r1, 4.9x r2, 3.2x cheap-ops). There were
  0 debug timeouts at rung 2. The pass rate is inside the baseline interval, but n is small and
  the harness changed, so we claim no quality gain. Output is near-lossless but not byte-identical
  at temp 0. An MTPLX bug made calibration report agreement 0.0 with a relative `--out`. It is
  filed upstream as youssofal/MTPLX#627. Evaluating MTPLX as a nav-pilot local runtime is
  navikt/copilot#1781. [Report](../2026-10-13-mtplx/mtplx-results.md).
- **Rapid-MLX (#257, results #270): fail.** It had no tool-call parse errors to fix (0 on every
  server). Timeouts rose to 4, against 0 for MTPLX, and debug r2 dropped from 6/10 to 4/10. It is
  faster than mlx_lm on debug but slower than MTPLX on every row. Not adopted.
- **DFlash (#258): parked after the speed probe.** Speed-up was 2.16x at 4k context, 1.83x at 16k
  and 1.65x at 32k, with the same near-tie drift at temp 0 as MTPLX. The owner skipped the 6 h
  bench because MTPLX covers the speed question.
- **Qwen3-Coder-Next 4-bit (#260): does not fit.** The server exited before ready ("generation
  thread died, most likely out of memory") under the 48 GiB wired limit of the 64g profile. The
  8 h run was skipped. Parked.
- **TypeScript F1/F2 on frontend-melosys-web (#269), first measurement.** qwen3.8-27b-8bit-64g and
  qwen3.6-35b-a3b-optiq-64g both scored 5/5 on F1 and 5/5 on F2 (Wilson LB 0.72 pooled), with 0
  timeouts. The tasks do not separate the two models. The 3.6 OptiQ is about 4x faster (11/28 s
  against 40/141 s per sample). A Qwen3.8 OptiQ TS measurement is still open.
  [Report](../2026-10-14-final2/C.md).

## 4. Applied test: local models upgrading nais/examples dependencies

One opencode session per model and task in the cplt sandbox, with a 25 min cap, graded outside the
sandbox (#272, results #273). [Plan](../2026-10-14-nais-examples-upgrade/PLAN.md),
[results](../2026-10-14-nais-examples-upgrade/results.md). Four models: qwen3.8-27b-8bit-mtplx,
qwen3.6-35b-a3b-optiq-64g, qwen3.6-35b-a3b-8bit-64g, qwen3.8-27b-optiq-4bit.

- **loadgen (Go): 4/4.** All four did a full upgrade: 8 modules moved, 0 behind. mtplx was
  fastest at 95 s.
- **frontend (pnpm/Next): 4/4 after a harness false negative.** The harness marked all four red:
  pnpm aborted with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` because the check ran without a
  TTY. A re-run with `CI=true` passed install, vitest, tsc, eslint and build on all four trees.
  Only TypeScript 7 was left behind, which is correct because typescript-eslint does not support it
  yet. (optiq-64g stayed on TypeScript 5.9.) qwen3.8-27b-optiq-4bit hit the cap, but its tree was
  already upgraded.
- **tools (mise pins, Dockerfile tags, action pins): 0/4.** Two models made no edits (optiq-64g
  stopped after reading files, and optiq-4bit timed out). The 8-bit stopped while looking up image
  tags and read from a wrong path. mtplx moved 19 pins, but its diff is unsafe: `watchexec 8.4.4`
  does not exist, pnpm is pinned to 12.11.2 while the lockfile needs pnpm 10, postgres goes from
  16 to 18 (existing data volumes will not start), and Node stays on 25.
- **Harness follow-ups (#274):** set `CI=true`, make the "behind" check verify that the version
  exists, keep watchdog retry logs, and four smaller items.
- **Not yet covered, follow-up in progress:** backend (Gradle's JDK could not finish TLS to the
  plugin portal) and analytics (no .NET SDK, NuGet unreachable inside cplt) were skipped in this
  run. Both are being attempted now as follow-up work.

## 5. Process lessons

- **Review the exact head.** Reviews pinned to a commit SHA caught real problems before merge:
  home paths in the #267 results, and the #272 harness not giving each session its own HOME, so
  opencode and cplt would have written to the real one.
- **Permission-classifier blocks** interrupted some agent steps mid-task, so the coordinator had to
  finish them.
- **Park policy.** Benchmarking is parked after the final GPU run (#264, PLAN.md "Parking"). Only
  a new model or a local-mode release triggers a run. Experiments without a clear payoff (DFlash's
  6 h bench, Coder-Next) are parked with their reason recorded in the issue.
