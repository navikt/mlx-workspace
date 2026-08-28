# Cheap operations benchmark

The weather-cli benchmark measures a model building a complete application from scratch, the
hardest task shape available and the one we would never route to a local model. This one measures
the opposite. Short, routine operations that each consume a Copilot premium request at the same
rate as a hard architectural question. If a local model can absorb these, a heavy user's monthly
allowance stretches much further. If it cannot, the local-model project does not solve the problem
that prompted it.

Companion to `WEATHER_CLI_SPEC.md`. Same harness, same verification rules, different workload.

## Target

A real Nav Kotlin service, chosen by the survey in issue #1. Not greenfield, and not a toy. The
model works inside an existing codebase it did not write. The repository is cloned fresh into the
model's workspace before each run and reset between tasks, so no task sees another task's edits.

## The task set

Four kinds of operation: read-only questions, single-file edits, multi-file edits, and generated
text. The prompts, target files, symbol names and verification mode for each task live in
`bench/tasks.json`, which is the source of truth. Paths and symbols come from the repository survey
and are pinned before the first run, so every model gets exactly the same task set.

Each task is scored on time, on whether the result needed rework, and on an objective check where
one exists. A check is a compile, the test suite, a `grep` count, or human judgement where nothing
better is available.

## Models under test

Four, run against the identical task set:

| Profile | Size | Why it is here |
|---|---|---|
| `qwen3.8-27b-4bit` | 17.9 GB | Current best-quality candidate, 8.5/10 on weather-cli |
| `qwen3.6-35b-a3b` | 23.3 GB | Current fastest candidate, MoE with ~3B active |
| `qwen3-30b-a3b` | 16 GB | Code-specialist MoE. Never benchmarked. Tests whether a code-trained model of the same shape does better |
| `granite-4.1-8b` | 4 GB | Tests whether the job needs a big model at all. Apache 2.0 |

Every model runs with sampling from its own model card, under the 36 GB wired cap, sandboxed, in a
fresh workspace.

## What we record

Per task, per model: wall clock from prompt to usable answer, turn count, whether the objective
check passed, whether a human would have accepted the result without rework, and peak RSS.

## The bar, set before the numbers arrive

| Result | Meaning |
|---|---|
| Median under 30s and most checks pass | The premise holds. Proceed to the alpha |
| Median 30s to 60s | Marginal. Worth trying with the smallest model that passes |
| Median over 60s, or checks failing often | The premise fails. Stop, and say so |

A model that is fast but wrong is worse than no model. The developer pays the review cost and then
does the work anyway.

## Rules

Same as the weather-cli benchmark. Each was learned the hard way.

1. Verify results by hand. Run the test suite yourself, do not trust the model's claim.
2. Check the workspace is clean before every run. A previous task's edits invalidate the next.
3. Read the tests the model writes. A passing count means nothing if an assertion cannot fail.
4. Confirm sampling flags reach the process with `ps`, not just the profile loader.
5. Run everything sandboxed.
