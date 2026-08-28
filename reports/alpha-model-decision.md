# Which models for the nav-pilot alpha

Decision: ship **two** models, one active at a time, with a switch command.

- **`mlx-community/Qwen3.6-35B-A3B-4bit`** is the default. Routine work against an existing
  codebase, fast enough that a developer waits for it.
- **`mlx-community/Qwen3.8-27B-4bit`** is opt-in, for work a user is willing to leave running.

Both run under mlx-lm with thinking disabled. Measured 28 August 2026 on rig B against
`navikt/isoppfolgingstilfelle`, a real Nav Kotlin service with Ktor, Kafka, Postgres and 151 tests,
and against a from-scratch Node.js CLI build. Full data in [`../MODELS.md`](../MODELS.md), task
definitions in `bench/tasks.json`.

## Why two

They fail in opposite directions, and the gap is large enough for a user to feel it.

| | Qwen3.6-35B-A3B-4bit | Qwen3.8-27B-4bit |
|---|---|---|
| Eleven routine operations | 13.4s median, 4 of 8 verified | still running, see below |
| Build an application from a spec | 438.8s, 13 files, its own test script fails | 1218.1s, 13 files, 29 of 29 tests pass |
| Resident memory | 18.6 GB | 14.6 GB |

Neither covers both workloads, so the alpha ships both and lets the user pick per task.

## The default: Qwen3.6-35B-A3B-4bit

Eleven routine operations against an existing codebase, each on a fresh server, verified by
compiling and running the test suite rather than by believing the model.

| Measure | Result |
|---|---|
| Median task time | **13.4s** |
| Verified pass | 4 of 8 objectively checkable tasks |
| Tasks with no tool calls | 0 of 11 |
| Timeouts | 0 of 11 |
| Resident memory | 18.6 GB |

It renames symbols across call sites, adds a KDoc block, adds a log line in the codebase's own
style, and locates config values correctly. It fails all three data-threading tasks, and those are
real failures rather than timeouts. 18.6 GB resident leaves room on a 32 GB machine and is
comfortable on 48 GB. Architecture is why it is quick: 256 experts with 8 active means roughly 3B
parameters stream per token against 27B for a dense model, and on bandwidth-bound Apple Silicon
that is worth about 4x.

## The opt-in: Qwen3.8-27B-4bit

It is the only model in the set that built a working application: thirteen files from a spec, a
`node:test` suite it wrote itself, 29 tests passing and none failing, in 1218.1 seconds. Its
eleven-task routine run on the clean harness is still going. So far it has three read tasks at a
64.9s median with one of one checkable task verified, and then E1 timed out.

**One thing blocks shipping it.** E1 adds a KDoc comment to one public function in one Kotlin file.
The model changed the file and then did not finish within a 1800 second cap. Under the earlier 420s
cap that read as budget pressure. At thirty minutes it is a defect. Either the cause is found, or
`nav-pilot local` needs its own timeout with an honest message, before this model reaches users.

## What was rejected, and why

| Model | Reason |
|---|---|
| **KAT-Coder-V2.5-Dev-OptiQ-4bit** | Run to challenge the default and did not displace it. Same `qwen3_5_moe` architecture, coder-tuned: 23.3s median against 13.4s, the identical 4 of 8, and it agrees task by task. Coder tuning bought one edit and lost another |
| **granite-4.1-8b-4bit** | Eleven tasks, 1 of 8 verified, and not one file written in the whole run. It reads and answers quickly, then stops: on one task it spent 24 turns and 24 tool calls exploring and wrote nothing. Attractive at 5.1 GB and Apache 2.0, but it does not edit |
| **Qwen3.8-27B-6bit** | 2599.7s on the same application build for 26 passing tests, and a read task that took 1546.8s where the 4-bit build of the same weights takes 30.1s. Quarantined, unexplained, a thinking-off control is queued |
| **Qwen3.6-35B-A3B-4bit-DWQ** | Lost a clean A/B against the plain build on the old harness, 2 of 7 verified against 5 of 7. Not re-run since the harness was fixed |
| **Qwen3.5-9B** | Four attempts, four distinct failures: a repetition loop, a hallucinated CLI it tried to install, a stall, and form fields posted to a GET endpoint |
| **Qwen2.5-72B** | Never writes a file. Prints code into chat |
| **gemma-4-31b-it-8bit** | Correct, but 865 KB per token of KV cache rules out the 48 GB target regardless of quantization |
| **DeepSeek-V4-Flash** | 79 GB. Rig B only |

## What the alpha must handle

**The server crashes.** Not degradation: `EXC_BAD_ACCESS` on a stack guard page with MLX's
recursive graph walk on the stack, and every later request refused. Restarting the server before
each task is what removed it from these results. `nav-pilot local` needs the same restart or reset
strategy. Issue #11.

**Agent instructions are per-client.** opencode reads `AGENTS.md`; Copilot CLI reads
`.github/copilot-instructions.md`. Without the file, Copilot CLI located the call sites it needed to
change, said it would edit them, and changed nothing. With it, the same model completed the rename.
nav-pilot must generate both from one source. Issue #8.

**Multi-file schema changes are the known limit of the default model.** Threading a new field
through a database row class, its mapper and every construction site took 17 turns and 26 tool calls
across five files and still broke the test suite. Renames, field additions and log lines are within
range. Tell alpha users plainly.

## How far this can be trusted

**The numbers moved because two of our own bugs were fixed.** Everything measured before commit
`9a2b324` went through a system prompt of instructions the benchmark never chose, which on one task
cost 8.5k tokens of input, and through an `AGENTS.md` bug whose unclosed think tag routed some
models' entire output into a field opencode discards. The same task set that read a 32.4s median and
5 of 7 verified now reads 13.4s and 4 of 8. The decision did not change; every number behind it did,
and no figure from before that commit appears in this report.

**One run per model.** Task times vary up to 1.7x between runs of the same model on the same task.
Single runs separate a 3x gap reliably. They do not separate models within about 1.5x of each other,
so the KAT-Coder comparison is a tie, not a win.

**One client, one codebase, one machine.** Almost everything was measured through opencode, which is
demonstrably not neutral about what a model emits, against a single Kotlin service on rig B. Nothing
here predicts TypeScript frontends, repositories large enough to defeat a 98k-token context, or the
48 GB Pro target the alpha is meant to run on.

**Independent corroboration of the slow model, not of our numbers.** Another Nav team runs
Qwen3.8-27B daily on an M4 Pro 48 GB through llama.cpp with an Unsloth Q6_K_XL, about 10 tok/s and
28 to 30 GB resident, and describes the same trade: good code, long waits, acceptable because it
runs in the background. Different runtime, quantization and hardware, so it confirms the shape of
the trade and none of our figures.

**The second slot may improve.** That 28 to 30 GB figure is the first evidence that a 27B at 6 to 8
bits fits the 48 GB target at all, so `Qwen3.8-27B-8bit` at 29.5 GB is queued. If it runs, the
opt-in slot could hold a better model rather than merely a slower one.

## Recommended next steps

1. Find the cause of the E1 timeout, or give the client a timeout with an honest message.
2. Fix the server crash, or give nav-pilot a restart strategy. It affects every model.
3. Generate instructions for both clients from one source.
4. Finish the Qwen3.8-27B-4bit routine run, then run the default three times for a range.
5. Run the builds queued for the 48 GB target, starting with `Qwen3.8-27B-8bit` at 29.5 GB.
