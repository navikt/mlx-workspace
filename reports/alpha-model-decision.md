# Which model the nav-pilot alpha ships

Decision: ship **one** model, `mlx-community/Qwen3.6-35B-A3B-4bit`. No opt-in second slot.

Measured 28-29 August 2026 on rig B (M5 Max 128 GB): one clean pass, nine configurations, eleven
tasks each, a 900s cap, a fresh server per task, and machine state recorded before and after every
run. Swap stayed flat at about 9.3 GB and memory 95% free throughout, so no run was contended. The
tasks run against `navikt/isoppfolgingstilfelle`, a Nav Kotlin service with Ktor, Kafka, Postgres
and 151 tests. Full data in [`../MODELS.md`](../MODELS.md), tasks in `bench/tasks.json`.

## Why this model

Eleven routine operations against an existing codebase, verified by compiling and running the test
suite rather than by asking the model.

| Measure | Result |
|---|---|
| Median task time | **12.7s** |
| Verified pass | 4 of 8 objectively checkable tasks |
| Timeouts | 0 of 11 |
| Tasks with a repetition loop | 0 of 11 |
| Longest run of identical tool calls, any task | 1 |
| Resident memory | 18.6 GB |

It renames symbols across call sites, adds a KDoc block, adds a log line in the codebase's own
style, and locates config values correctly. Its slowest task is 104.2s, threading a field across
five files, and it finishes rather than hangs. Architecture is why it is quick: roughly 3B
parameters stream per token against 27B dense, worth about nine times against its own dense sibling
on bandwidth-bound Apple Silicon.

## Why Qwen3.8-27B is held back

The earlier two-model plan assumed the 27B was slow but reliable. It is not reliable. Across three
configurations it timed out on 3 to 4 of 11 tasks and looped in every one.

| Configuration | Median | Verified | Timeouts | Tasks with a loop |
|---|---|---|---|---|
| 4-bit | 88.4s | 3 of 8 | 4 | 1 |
| 4-bit, `repetition_penalty` 1.05 | 67.0s | 3 of 8 | 3 | 1 |
| 8-bit | 194.5s | 2 of 8 | 4 | 2 |
| 6-bit | 284.2s | 2 of 8 | 2 | 0 |

`repetition_penalty` at 1.05 is the textbook remedy and it cuts both ways: the median improves from
88.4s to 67.0s, and the surviving loop gets worse, 15 identical consecutive tool calls becoming 40.
The failure mode is not a slow answer. On one task the model ran the same `rg` command 113 times
after a successful edit. A model that hangs after editing a file is worse for a first alpha user
than no local model at all, and these users are the ones whose Copilot allowance already ran out.

**The case for revisiting it stays open.** It is still the better writer: 1218.1s to build a
thirteen-file Node.js CLI from a spec with 29 of 29 tests passing, where the chosen model builds
thirteen files in 438.8s and its own test script exits 1. Once the loop is understood, that is a
better model, not merely a slower one.

## What was rejected, and why

| Candidate | Verdict |
|---|---|
| **OptiQ quantization of the chosen model** | Tie. 12.8s and 4 of 8 against 12.7s and 4 of 8. No reason to carry a second build |
| **KAT-Coder-V2.5, coder-tuned, same architecture** | 17.5s against 12.7s at the identical 4 of 8. Coder tuning bought nothing and cost speed |
| **Qwen3.6-27B dense, same family** | 112.8s median. Nine times slower than its own MoE sibling for 4 of 8, the same score |
| **Granite 4.1 8B** | Fastest at 11.4s and it never writes. 1 of 8 verified, zero files changed across eleven tasks, 2 timeouts. Attractive at 5.1 GB and Apache 2.0, and it does not edit |
| **Qwen3.8-27B at 6-bit and 8-bit** | Both fit, both too slow, both no better. 194.5s and 284.2s medians at 2 of 8 |

## What the alpha must handle

**The server crashes rather than degrades.** `EXC_BAD_ACCESS` on a stack guard page inside MLX's
recursive graph walk, on the generation thread. The socket dies with it and every later request gets
connection refused. Restarting the server before each task is what removed this from the results.
`nav-pilot local` needs the same restart or reset strategy. Issue #11.

**KV growth has no bound the alpha can set.** `mlx_lm.server` does not expose `--kv-bits`,
`--quantized-kv-start` or `--max-kv-size`, though the library supports all three and
`stream_generate` takes them as keyword arguments. `--prompt-cache-bytes` is parsed and never
applied: `LRUPromptCache` is constructed without `max_bytes` at `server.py:1743`, so byte eviction
never fires and `MLX_CACHE_SIZE` is the only real bound. Three upstream issues have been open since
November with no PR. This is a contained patch, not a missing feature.

**Agent instructions are per-client.** opencode reads `AGENTS.md`, Copilot CLI reads
`.github/copilot-instructions.md`. Without the file, Copilot CLI located the call sites it needed to
change, said it would edit them, and changed nothing. nav-pilot must generate both from one source.
Issue #8.

**Multi-file schema changes are the known limit.** Threading a new field through a row class, its
mapper and every construction site took 28 turns and 37 tool calls across five files and still broke
the test suite. Renames, field additions and log lines are within range. Tell alpha users plainly.

## How far this can be trusted

**The numbers moved because our own bugs were fixed, and every pre-fix figure is gone.** Our
`AGENTS.md` carried an unclosed think tag, and `mlx_lm/server.py:568-574` starts generation in
reasoning state when the last think-start follows the last think-end, so two models looked broken
for a day (issue #10). opencode was adding 37,807 characters of personal config and global skills;
`--pure` plus a benchmark-only `XDG_CONFIG_HOME` cut that to 11,191 and one task's input from 14,224
tokens to 5,687 (issue #12). A run overlapping a 22 GB download timed out six times, and a machine
at 15 of 16 GB swap with six orphaned clients made three tasks twelve times slower, which without a
state log reads as a model result. Every number here comes from the clean pass after all of it.

**One run per model.** Task times vary up to 1.7x between runs of the same model on the same task.
That separates a 3x gap reliably and does not separate models within about 1.5x, so OptiQ is a tie
and KAT-Coder is a loss only on speed.

**One client, one codebase, one machine.** Everything ran through opencode, which is demonstrably
not neutral about what a model emits, against a single Kotlin service on rig B. Nothing here
predicts TypeScript frontends, repositories large enough to defeat a 98k-token context, or the
48 GB Pro the alpha targets, whose halved bandwidth is not reproduced by capping wired memory.

**Prompt caching works and is not the variable.** 99.3 to 99.5% hit rates on every model tested,
first turn 1.2 to 8.1s falling to 0.26 to 0.82s. mlx-lm issue #980 reports the opposite for the
Qwen3.5 family and does not reproduce here.

## Next steps

1. Find the cause of the Qwen3.8-27B tool-call loop. It is what stands between the alpha and a
   model that writes better code.
2. Fix the server crash or ship a restart strategy. It affects every model. Issue #11.
3. Patch `mlx_lm.server` to pass through the KV flags the library already supports.
4. Generate `AGENTS.md` and `.github/copilot-instructions.md` from one source. Issue #8.
5. Compose with `navikt/grillmester` rather than rebuilding it: feed `manifest/models.json` into its
   agentpakke contract. Issue #14.
