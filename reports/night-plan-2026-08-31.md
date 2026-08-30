# Night plan, 31 August 2026

Roughly seven idle GPU hours on one machine, so GPU work is strictly serial. Reviewed by
Fable before execution; its three substantive changes are adopted and marked below.

## Phase 0, no GPU. Done, committed as 2da449bb

`status` now reports requests, tokens and time from a local append-only file; `alpha local
ask -p "..."` puts one question to the model. Eight tests. Two defects found by running it
rather than reading it: stdin was read whenever it was not a terminal, which hangs on any
script's open pipe, and the server's default 512-token cap is not enough for a thinking
model, which spent all of it reasoning and returned no content at all.

## Forensics: why Spring reversed

Adopted from Fable's review, which pointed out that mining the existing 183 samples costs
no GPU and converts the next run from a third anecdote into a hypothesis test.

Median per arm, cloud cost in dollars:

| | control steps | hybrid | control | ratio |
|---|---|---|---|---|
| Ktor, rung 6 | 19 | $0.134 | $0.339 | 0.40 |
| Ktor, rung 3 | 5 | $0.085 | $0.106 | 0.80 |
| Spring, rung 6 | 2 | $0.164 | $0.092 | 1.78 |

The three points are perfectly ordered by one variable, and it is not the codebase. It is
how many steps the *cloud-only* arm needs. Where the cloud model flounders (19 steps,
490k cached tokens read, 4066 output), handing the mechanical part to a local worker saves
a lot. Where it walks the task in two steps, dispatch adds an orchestration round trip and
costs more.

This is a better claim than the one in §7.2 of the report, which says the saving depends on
the codebase. The codebase is a proxy. The mechanism is task difficulty *for the cloud
model in that repository*, and it is measurable in advance from the control arm.

## Pre-registration, written before the run

Fable's point: this experiment was chosen because two existing points disagreed, so the
analysis has to be fixed in advance or the third point inherits the post-hoc smell.

- **Primary statistic.** Median per-sample cloud cost per arm; ratio = hybrid ÷ control.
- **Test.** One-sided exact Mann-Whitney U on per-sample cost, the enumeration already in
  `bench/analyse.py`. No other test will be substituted after seeing the data.
- **Hypothesis.** The ratio decreases as the control arm's median step count rises.
  Break-even is between 3 and 5 steps.
- **Point prediction.** For the frontend at rung 3: control-arm median steps ≥ 5 predicts a
  ratio below 1.0 (dispatch saves). Control-arm median steps ≤ 3 predicts a ratio above 1.0
  (dispatch costs more).
- **Labels fixed now.** "Ktor-like" is ratio < 1.0, "Spring-like" is ratio > 1.0. A ratio
  within 0.95–1.05 is neither and will be reported as no effect.
- **Falsification.** A frontend control arm at 2 steps that still saves money, or one at 19
  steps that costs more, kills the hypothesis outright.

## Phase 1. Rung 3 on the frontend and on Spring

Rung 6 is task `D2`, which the frontend target does not have. All three targets share `M1`,
rung 3, "rename a symbol across call sites". Ktor already has both arms at rung 3 (n=8+8),
so running the other two targets at that rung gives three codebases on one identical task
shape rather than a comparison across mixed rungs.

- 1a: frontend `familie-tilbake`, rung 3, control then hybrid, n=8 per arm.
- 1b: Spring `ia-tjenester-metrikker`, rung 3, control then hybrid, n=8 per arm.

Verification is each target's own suite, both already proven: the frontend runs 61 files
and 572 tests in 9.11s under vitest with a two-tsconfig typecheck.

Honest framing, per Fable: these are three paired within-codebase experiments, not one task
run three times. Each ratio is reported with its own interval and they are never averaged.
Two confounds are acknowledged rather than closed: TypeScript is better represented in the
model's training data than Kotlin, so a cheap frontend result cannot separate "structure
drives the ratio" from "the model is simply better at TypeScript"; and rung 3 is a milder
task than rung 6, so the effect sizes are expected to be smaller throughout.

## Phase 2. Debugging as a task kind

Every task we have is read-or-apply-a-specified-edit. Nobody has measured the model on a
failing test with an unknown cause.

Fable's three guards, all adopted, because without the first this phase measures nothing:

1. **No edits to test files.** The model can go green by weakening the assertion or
   hard-coding the expected value. Any sample whose diff touches a test path is invalid.
2. **No history to revert.** A broken commit is discoverable with `git log`, and reverting
   it measures git skill. The break is applied as uncommitted working-tree state.
3. **At least one break distant from its symptom.** Three one-line breaks next to their
   failing test would measure search in a five-line radius. One break goes in the mapper
   and fails at the controller test.

Named honestly in the write-up: this measures fault localisation when a failing test
already points at the behaviour, which is the easiest tier of debugging. Reproduction, the
hard part, is not measured. n=1 per task over three tasks is a capability probe, so results
are reported as "passed k of 3" and never as a rate.

## Phase 3. Warm cache across a session

Replaces the Python target, on Fable's argument, which I accept: building a new target is
more than two hours of authoring before the first GPU minute, scheduled for the end of the
night, which is exactly the "fixing preflight at 2am" this plan forbids. Python is a
daytime job.

"Usually slower" was measured cold and single-task, and "nobody has used it for a full
working day" is the biggest acknowledged gap. Three consecutive dispatches against one warm
server against cold-starting each: measures how much of the wait is amortised across a real
working session. It is the number that most changes the advice to users, which neither
Phase 1 nor Phase 2 touches.

## Rules

- Results written before the next phase starts. Nothing held in memory.
- No harness edited without running its `--self-check` first.
- **Every phase records its invalid-sample count and reports the denominator.** "183 valid"
  implies discards; a phase that hides its discard rate invites the question it cannot
  answer.
- Per-run timeout set before Phase 2 starts, not discovered during it.
- A phase that fails preflight is skipped and the reason written down, not fixed at 2am.
- The report and the news article are not touched tonight. They are consistent with the
  data as it stands, and a half-finished run must not leave them describing numbers that do
  not yet exist.
