# Night results, 31 August 2026

Written as each phase completed. Prediction and analysis were fixed in
`night-plan-2026-08-31.md` and committed before any of this ran.

## Phase 1: the predictor holds on a codebase it had never seen

The hypothesis was that the delegation ratio tracks how many steps the
*cloud-only* arm needs, not what language the codebase is in. Ordered by control
steps, with the frontend point added:

| Codebase | Rung | Control steps | Hybrid | Control | Ratio |
|---|---|---|---|---|---|
| Ktor | 6 | 19 | $0.134 | $0.339 | **0.40** |
| Frontend, TypeScript | 3 | 13 | $0.121 | $0.227 | **0.53** |
| Ktor | 3 | 5 | $0.085 | $0.106 | **0.80** |
| Spring | 6 | 2 | $0.164 | $0.092 | **1.78** |

Monotone across four points. The frontend was predicted before it ran: the
pre-registration said a control arm at five steps or more predicts a ratio below
1.0, and 13 steps produced 0.53.

Frontend detail, `navikt/familie-tilbake-frontend` at a pinned ref, rung 3:

- hybrid n=8, median $0.121, range $0.118–$0.208
- control n=8, median $0.227, range $0.130–$0.439
- one-sided exact Mann-Whitney p=0.0023
- 8 of 8 verified in both arms; **zero invalid samples** in either
- median 4 local calls per hybrid sample, 70s against the control's 60s

The language confound stands and is not closed by this: TypeScript is better
represented in the model's training data than Kotlin, so a cheaper TypeScript
result cannot separate "step count drives the ratio" from "the model is better
at TypeScript". What the four points do show is that the ratio is not a property
of the codebase's language alone, because Ktor appears twice with different
ratios at different rungs.

## What this changes

§7.2 of the report currently says the saving depends on the codebase. The
codebase is a proxy. The mechanism is how hard the task is *for the cloud model
in that repository*, and it is measurable in advance from the control arm before
anyone commits to dispatching.

For the alpha this is directly actionable: dispatch pays on work the cloud model
would otherwise grind through in many steps, and costs money on work it would
finish in two.

## Phase 0 (shipped)

`alpha local ask -p "..."` and per-machine request, token and time counters in
`alpha local status`. Committed as 2da449bb. Two defects found by running it:
stdin was read whenever it was not a terminal, which hangs on any script's open
pipe; and the server's 512-token default cap is not enough for a thinking model,
which spent all of it reasoning and returned a message with no content at all.

## Phase 3: not run

Cut for the reason Fable gave when it reviewed the plan: building a target is
hours of authoring before the first GPU minute. The same argument applied to
finishing Phase 2 at half past four, so it was left provisioned rather than
wired in a hurry.

## Phase 2: the model does not debug

Three tasks, one attempt each, on a green baseline of 61 files and 572 tests.

| Task | Break | Distance from symptom | Result | Time | Tool calls |
|---|---|---|---|---|---|
| X1 | wrong locale in `utils/land.ts` | test file beside it | failed | 782s | 38 |
| X2 | inverted predicate in `utils/sider.ts` | same directory | failed | 504s | 36 |
| X3 | `stores/sidebarStore.ts` opens shut | two directories away | timed out at 900s | 900s | — |

**0 of 3.** Every attempt edited exactly one file and left the suite red.

The guard against gaming never had to fire. Neither completed attempt touched a test file,
so these are three honest failures rather than three attempts to weaken an assertion. That
matters: the cheap way through every one of these tasks was available and not taken.

The easiest case failed too. X1 puts a wrong locale in a function whose test sits in the same
directory and names the expected values; 17 tests fail and say what they wanted. Thirteen
minutes and 38 tool calls did not fix it.

This is the applying-versus-deciding distinction in the shape that was predicted for it.
Every other task in the suite hands the model a decision and asks it to carry the decision
out. A failing test with no stated cause asks it to work out what is wrong, and that is the
half it cannot do. Nothing here contradicts the rename result: the same model renames 46
references across 10 files unaided.

What this does *not* establish, and the write-up must say so: this measures fault
localisation when a failing test already points at the behaviour, which is the easiest tier
of debugging. Reproduction, usually the hard part, is not measured at all. And n=1 per task
over three tasks is a capability probe, so the honest claim is "0 of 3", never a rate.

The practical consequence for the alpha is direct. Do not send debugging to the local model,
and the runbook's advice to hand it bounded, already-decided work is unchanged.

## Phase 2 as originally planned: authored, validated and coded

Three debug tasks against `familie-tilbake-frontend`, in
`bench/targets/frontend-debug.json`. Baseline is green at 61 files and 572 tests
**under Node 24**; under Node 20 the suite dies with 61 errors
(`webidl.util.markAsUncloneable is not a function`) that have nothing to do with
any break. Any run of this phase must pin Node 24 for the model's own shell too,
or it will be handed 61 failures to chase that are not there.

Each break was confirmed to fail that green baseline:

| Task | Break | Distance | Failures |
|---|---|---|---|
| X1 | `utils/land.ts`, wrong locale | test sits beside it | 3 files, 17 tests |
| X2 | `utils/sider.ts`, inverted predicate | same directory | 2 files, 2 tests |
| X3 | `stores/sidebarStore.ts`, opens shut | two directories away | 2 files, 2 tests |

### What remains for Phase 2

The tasks, the breaks and the harness support are done and committed. What is
left is target provisioning: the capability ladder reads `bench/tasks.json` and
a checkout at `workspaces/<profile>/kotlin`, so running this means swapping the
target file in and cloning the frontend repo there with its dependencies
installed. That is twenty minutes of setup plus a `pnpm install`, and the plan's
own rule says a phase that is not ready is skipped rather than wired at half
past four. It is a daytime job.

## Spring rung 3: abandoned, and why

Spring hybrid produced 0 valid samples in 6 attempts, all of them launches that
printed nav-pilot's help and exited in one second, while the frontend arms on
the same machine minutes earlier produced 16 of 16. Hand-run launches in the
same Spring checkout, with the same binary, argv and redirected stdin, work
every time. The difference between a hand launch and a harness launch on that
one target is not yet identified.

It was abandoned rather than chased because Spring rung 6 already supplies the
low-step end of the curve, and a fifth point on a four-point monotone
relationship is worth less than the time it was costing. The failure is written
down here so the next person starts from the contrast rather than from scratch.

## Harness defects found and fixed tonight

- A launch that never starts a session is a rate limit, not a measurement. The
  harness burned its whole attempt budget retrying at two seconds a go: 35
  non-results and one real sample. Now backs off.
- Those non-results then poisoned the results files: a file holding 18 invalid
  samples made the loop believe the arm was finished, so every later run exited
  without doing anything.
- `invalid_reason` is present and null on a valid sample, so a `.get(k, "")`
  default returns None. Crashed the run on its first good sample.
- The harness called the Homebrew nav-pilot, which is the release and has no
  `alpha` command at all. Runs need `BENCH_NAV_PILOT`.

## Method notes against myself

Running the frontend test suite to validate the Phase 2 breaks pushed load
average to 25, and the harness refused to measure. It was right to. The rule was
"GPU work is serial" and I broke it with CPU work.

Python block-buffers stdout when it is redirected to a file. Several times I
read an empty log as "the run exited immediately" when it was running normally.
The sample files, written after each sample, are the honest progress signal.
