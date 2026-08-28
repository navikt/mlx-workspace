# Which model for the nav-pilot alpha

Decision: **`mlx-community/Qwen3.6-35B-A3B-4bit`**, run under mlx-lm with thinking disabled.

Measured 27-28 August 2026 against `navikt/isoppfolgingstilfelle`, a real Nav Kotlin service with
Ktor, Kafka, Postgres and 151 tests. Full data in [`../MODELS.md`](../MODELS.md), task definitions
in `bench/tasks.json`.

## Why this one

**It does the work we want to route locally.** Eleven routine operations against an existing
codebase, each on a fresh server, verified by compiling and running the test suite rather than by
believing the model:

| Measure | Result |
|---|---|
| Median task time | **32.4s** |
| Verified pass | 5 of 7 objectively checkable tasks |
| Tasks with no tool calls | 0 of 11 |
| Resident memory | 18.6 GB |

It renames symbols across call sites, adds fields to DTOs, writes tests that pass, adds log lines
in the codebase's own style, and locates config values correctly.

**It fits the fleet.** 18.6 GB resident leaves room on a 32 GB machine and is comfortable on 48 GB.
No per-machine tuning required.

**It works through both clients.** Verified separately under opencode and GitHub Copilot CLI, the
two clients nav-pilot must support at GA. Under Copilot CLI it completed a rename across three
call sites in 22s and the result compiled.

**Architecture is why.** 256 experts with 8 active means roughly 3B parameters stream per token
against 27B for a dense model of similar quality. On bandwidth-bound Apple Silicon that is worth
about 4x, measured consistently across two different benchmarks.

## What was rejected, and why

| Model | Reason |
|---|---|
| **Qwen3.8-27B-4bit** | Writes the best code measured, 8.5/10 on a from-scratch build, but too slow on routine work even with thinking disabled. Measured on 4 of the 11 tasks before the run was abandoned: 61.2s median against 20.8s for the chosen model on those same four, a 2.9x gap. Also looped 77 identical tool calls on one task. Right model for the wrong workload |
| **Qwen3.6-35B-A3B-4bit-DWQ** | Clean A/B against the plain build, quantization the only variable: 2 of 7 verified against 5 of 7. Its lower median is an artifact of failing faster |
| **Qwen3-Coder-30B-A3B** | opencode discards its output entirely. The model calls tools correctly against the API, so this is a pairing failure, but a model that cannot drive a shipping client cannot ship. See issue #10 |
| **Granite 4.1 8B** | Same. Attractive on paper at 5.1 GB and Apache 2.0, and worth revisiting when #10 is understood |
| **Qwen3.5-9B** | Four attempts, four distinct failures: a repetition loop, a hallucinated CLI it tried to install, a stall, and form fields posted to a GET endpoint |
| **Qwen2.5-72B** | Never writes a file. Prints code into chat |
| **Gemma-4-31B** | Correct but 865 KB per token of KV cache, which rules out the 48 GB target regardless of quantization |
| **DeepSeek-V4-Flash** | 79 GB. Rig B only |

## What the alpha must handle

Three findings that are shipping requirements, not benchmark details.

**The server degrades over a long session.** After enough sessions against one server process the
model stops calling tools at all, and every later task fails silently. Demonstrated directly: a
task producing 0 turns and 0 tool calls passed with 6 turns and 9 tool calls after nothing changed
but a server restart. A developer using this all day is exactly the case that triggers it.
`nav-pilot local` needs to restart or reset the server periodically. Issue #11.

**Agent instructions are per-client.** opencode reads `AGENTS.md`; Copilot CLI reads
`.github/copilot-instructions.md`. Without the file, Copilot CLI found the three call sites it
needed to change, said it would edit them, and stopped, changing nothing. With it, the same model
completed the rename in 22s. nav-pilot must generate both from one source. Issue #8.

**Complex data mapping is the known limit.** Threading a new field through a database row class,
its mapper and every construction site took 19 turns and 29 tool calls and then broke the test
suite. Renames, field additions and test writing are within range; multi-file schema changes are
not. Worth telling alpha users plainly.

## How far this can be trusted

**One run per model, and not all on the same tasks.** Task times vary up to 1.7x between runs of
the same model on the same task, and one task flipped from pass to fail between two runs. Only the
chosen model and the DWQ build completed all 11 tasks. Qwen3.8-27B was abandoned after 4, so its
comparison is like-for-like on those 4 and nothing more. Single runs separate a 3x gap reliably.
They do not separate models within about 1.5x of each other.

**One client for most numbers.** Everything except the two Copilot CLI checks was measured through
opencode, and opencode is demonstrably not neutral: it discards output from two model families
entirely.

**One codebase, one language.** A single Kotlin service. Nothing here predicts performance on
TypeScript frontends or on repositories large enough to defeat a 98k-token context.

**The literature did not transfer.** Three recommendations from published work on small local
models failed against our own measurements: the five-tool threshold for Qwen3-Coder, DWQ
preserving tool-call formatting, and thinking hurting across the board rather than costing about
2.3x. Useful for hypotheses, not for settings.

## Recommended next steps

1. Fix the server degradation, or give nav-pilot a restart strategy. It affects every model.
2. Generate instructions for both clients from one source.
3. Run the benchmark three times on the chosen model to replace single samples with a range.
4. Revisit Granite and Qwen3-Coder once issue #10 is understood. Granite at 5.1 GB against
   18.6 GB would cut what we ask users to download by about three quarters.
