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

## Phase 2: authored and validated, not yet run

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
