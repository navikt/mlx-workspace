# Cheap operations benchmark

The weather-cli benchmark measures a model building a complete application from scratch. That
is the hardest task shape available, and the one we would never route to a local model.

This benchmark measures the opposite: the short, routine operations that consume a Copilot
premium request each, at the same rate as a hard architectural question. If a local model can
absorb these, a heavy user's monthly allowance stretches considerably further. If it cannot,
the local-model project does not solve the problem that prompted it.

Companion to `WEATHER_CLI_SPEC.md`. Same harness, same rules about verification, different
workload.

## Target

A real Nav Kotlin service, chosen by the survey in issue #1. Not a greenfield project, and not
a toy. The model works inside an existing codebase it did not write.

The repository is cloned fresh into the model's workspace before each run and reset between
tasks, so no task sees another task's edits.

## The task set

Twelve operations across four categories. Each is scored on time, whether the result needed
rework, and an objective check where one exists.

### Read-only (no edit, answer only)

| # | Task | Objective check |
|---|---|---|
| R1 | Explain what a named function does | Human judgement, is the explanation correct |
| R2 | Find where a named config value is read | Names the right file and line |
| R3 | List the call sites of a named function | Count matches `grep` |

### Small edits (single file)

| # | Task | Objective check |
|---|---|---|
| E1 | Add a KDoc block to a named public function | Compiles, doc mentions the real parameters |
| E2 | Add a null check plus its test | Test suite passes, new test fails when the check is removed |
| E3 | Add a log line with the surrounding context | Compiles, log includes the identifiers in scope |

### Multi-file edits

| # | Task | Objective check |
|---|---|---|
| M1 | Rename a function and update every call site | Compiles, `grep` finds no occurrences of the old name |
| M2 | Add a nullable field to a data class and update serialisation | Test suite passes, field appears in serialised output |
| M3 | Convert a blocking call to a suspend function | Compiles, test suite passes |

### Generated text (no code change)

| # | Task | Objective check |
|---|---|---|
| G1 | Draft a commit message for a staged diff | Human judgement, does it describe the diff |
| G2 | Write a test stub for a named function | Compiles, test runs, assertions are relevant |
| G3 | Summarise what changed in a given commit | Human judgement, matches the diff |

Concrete file paths and symbol names come from the repository survey and are pinned before the
first run, so every model gets exactly the same twelve tasks.

## Models under test

Four, run against the identical task set:

| Profile | Size | Why it is here |
|---|---|---|
| `qwen3.8-27b-4bit` | 17.9 GB | Current best-quality candidate, 8.5/10 on weather-cli |
| `qwen3.6-35b-a3b` | 23.3 GB | Current fastest candidate, MoE with ~3B active |
| `qwen3-30b-a3b` | 16 GB | Code-specialist MoE. Never benchmarked. Tests whether a code-trained model of the same shape does better |
| `granite-4.1-8b` | 4 GB | Tests whether the job needs a big model at all. Apache 2.0 |

Every model runs with sampling from its own model card, under the 36 GB wired cap, sandboxed,
in a fresh workspace.

## What we record

Per task, per model:

- Wall clock from prompt to usable answer
- Turn count
- Whether the objective check passed
- Whether a human would have accepted the result without rework
- Peak RSS

## The bar, set before the numbers arrive

| Result | Meaning |
|---|---|
| Median under 30s and most checks pass | The premise holds. Proceed to the alpha |
| Median 30s to 60s | Marginal. Worth trying with the smallest model that passes |
| Median over 60s, or checks failing often | The premise fails. Stop, and say so |

A model that is fast but wrong is worse than no model, because a developer pays the review cost
and then does the work anyway.

## Rules

Same as the weather-cli benchmark, and they exist because each was learned the hard way:

1. Verify results by hand. Run the test suite yourself, do not trust the model's claim.
2. Check the workspace is clean before every run. A previous task's edits invalidate the next.
3. Read the tests the model writes. A passing count means nothing if an assertion cannot fail.
4. Confirm sampling flags reach the process with `ps`, not just the profile loader.
5. Run everything sandboxed.
