# Model evaluation notes

Observations from running models locally on Apple Silicon and driving them from `opencode` /
`aider`. Every measurement is tagged with the rig it was taken on. Numbers do not transfer between
rigs. How the benchmarks are run, verified and quarantined is in
[`BENCHMARKING.md`](BENCHMARKING.md); this file records what they produced.

> **Note on sizes:** *disk size* (from `mise run model-list`) and *VRAM footprint* are different.
> Disk includes tokenizer, configs and safetensors. VRAM is the loaded inference footprint.

## Verdict

Run **`mlx-community/Qwen3.6-35B-A3B-4bit`** under mlx-lm with thinking disabled. It is the model
for the nav-pilot alpha. Full reasoning and the rejected alternatives are in
[`reports/alpha-model-decision.md`](reports/alpha-model-decision.md).

- On the fixed harness it does eleven routine operations against a real Nav Kotlin service at a
  **13.4s median**, 4 of 8 checkable tasks verified, no task without tool calls, 18.6 GB resident.
- `KAT-Coder-V2.5-Dev-OptiQ-4bit`, the coder-tuned model of the same architecture, was run to
  challenge it and did not displace it: 23.3s median for the same 4 of 8.
- `Qwen3.8-27B-4bit` writes the best code measured and is far too slow for routine work.
- `granite-4.1-8b-4bit` reads and answers, and never edits a file.
- Nothing here was measured on the 48 GB Pro target. Capacity claims transfer, speed claims do not.
- Every number recorded before commit `9a2b324` is superseded, not merely old.

## Table of contents

- [Hardware](#hardware)
- [Current results](#current-results)
- [Superseded results](#superseded-results)
- [Mechanisms](#mechanisms)
- [Harness findings](#harness-findings)
- [What others report](#what-others-report)
- [Open questions and what to test next](#open-questions-and-what-to-test-next)
- [Archive: pre-2026 models](#archive-pre-2026-models)
- [Standard benchmark prompts](#standard-benchmark-prompts)
- [Code review rubric](#code-review-rubric)
- [Scheduled re-tests](#scheduled-re-tests)
- [Testing checklist](#testing-checklist)

---

## Hardware

| Rig | Machine | RAM | GPU wired cap | Backends | Models tested |
|---|---|---|---|---|---|
| **A** | M1 Max | 32 GB | 26 GB (`mise run vram-set`) | mlx-lm, mlx-vlm | 7B-35B, 4-bit (Jun 2026) |
| **B** | M5 Max | 128 GB | 96-115 GB (per profile `gpu_wired_limit_gb`) | mlx-lm, mlx-vlm, **oMLX** | 27B-284B, 8-bit / 3-bit mixed (Aug 2026) |

**Target hardware: 48 GB, Pro-class chip.** That is what most developers here run, and neither rig
represents it. Rig A is too small, rig B is both larger and much faster in memory bandwidth.

| Constraint | 48 GB Pro | Rig B (128 GB Max) |
|---|---|---|
| Wired ceiling (~75%) | ~36 GB | 96-115 GB |
| Memory bandwidth | roughly half of Max-class | baseline for all measurements here |
| Qwen3.8 8-bit (~27 GB weights) | ~35 GB needed, does not leave working room | comfortable |
| Qwen3.8 4-bit (~14 GB weights) | fits with room for a 12 GB KV cache | trivial |

On Pro-class silicon the 8-bit build is bandwidth-starved before it is memory-starved (see
[Dense vs MoE](#dense-vs-moe)). `profiles/qwen3.8-27b-4bit.toml`
(`mlx-community/Qwen3.8-27B-4bit`) exists for this reason. It runs **without MTP**: the drafter head
is published as `model_type: qwen3_5_mtp`, which only oMLX can load, and oMLX cannot serve this
4-bit build. Expect the plain mlx-lm decode rate, not the 8-bit MTPLX numbers.

**Untested on the target.** Every number here comes from rig A or rig B. Capacity arithmetic
transfers; bandwidth-bound throughput does not. Treat 48 GB Pro guidance as predicted until someone
measures it. Nothing from rig A was re-measured on rig B: rig A numbers are the reference for what
fits in 32 GB, rig B numbers are the current daily-driver data.

Rig B runs the 36 GB wired cap (`mise run vram-set 36`) when it stands in for the target machine.
That reproduces the memory ceiling and not the halved bandwidth.

```bash
mise run model-use              # interactive picker (fzf)
mise run model-use qwen3.5-9b   # switch directly
mise run model-list             # show all profiles + status + download state
mise run model-status           # show active profile + server state
mise run model-download <key>   # download weights without starting the server
mise run server                 # restart server with new model
mise run opencode               # launch opencode in workspaces/<key>/
```

---

## Current results

Only runs measured after commit `9a2b324` appear here. That commit removed the polluted system
prompt and the unclosed think tag that routed model output into the `reasoning` field, so it is the
line between a measurement of a model and a measurement of our own configuration. Everything older
is under [Superseded results](#superseded-results).

Two benchmarks, and they disagree, so both are kept.
[**Cheap operations**](#cheap-operations) runs eleven short routine tasks against an existing
codebase, which is the workload we intend to route to a local model.
[**weather-cli**](#weather-cli) builds a whole application from a spec, which is the workload we
never would. A model can be good at one and poor at the other, and most are. Task definitions,
verification rules and the quarantine convention are in [`BENCHMARKING.md`](BENCHMARKING.md).

| Model | Released | Rig | Backend | Architecture | VRAM | Status |
|---|---|---|---|---|---|---|
| **Qwen3.6-35B-A3B-4bit** | Apr 2026 | A, B | mlx-lm | MoE 35B, 256 experts, 8 active, MQA | 18.6 GB (B), ~21 GB (A) | ✅ **alpha model** |
| KAT-Coder-V2.5-Dev-OptiQ-4bit | 2026 | B | mlx-lm | MoE, `qwen3_5_moe`, coder-tuned | 22 GB (profile) | ⚠️ tested, did not displace |
| Qwen3.8-27B-8bit (MTPLX Q8) | Jul 2026 | B | **oMLX** | Dense 27B + MTP drafter | 28.9 GB | ✅ best all-round, too big for 48 GB |
| Qwen3.8-27B-4bit | Jul 2026 | B | mlx-lm | Dense 27B, no drafter | 14.6 GB | ⚠️ best code, slow on routine work |
| Qwen3.8-27B-6bit | Jul 2026 | B | mlx-lm | Dense 27B | — | ❌ quarantined, unexplained 50x slowdown |
| Qwen3.6-35B-A3B-4bit-DWQ | Apr 2026 | B | mlx-lm | MoE 35B, DWQ quantization | 18.9 GB | ❌ worse than the plain build |
| granite-4.1-8b-4bit | May 2026 | A, B | mlx-lm | Dense 8B | 5.1 GB (B), ~4.5 GB (A) | ❌ reads, never writes³ |
| DeepSeek-V4-Flash-0731-2.4bit-mixed | May 2026 | B | **oMLX** | MoE 284B, 256 experts, 6 active, MLA | 79 GB | ✅ rig B only |
| gemma-4-31b-it-8bit | 2026 | B | mlx-lm | Dense 31B, hybrid attention | 30.9 GB | ⚠️ 865 KB/token KV rules out 48 GB |
| Qwen3.5-9B-MLX-4bit | Feb 2026 | A, B | mlx-lm | Dense 9B, MLA | ~6 GB | ⭐ rig A daily driver, ❌ fails the rig B benchmark |
| gemma-4-12B-it-4bit | May 2026 | A | **mlx-vlm** ⚠️ | Dense 12B, hybrid attention | ~7 GB | ⚠️ too slow |
| gemma-4-26b-a4b-it-4bit | Mar 2026 | — | **mlx-vlm** ⚠️ | MoE 26B, ~4B active, shared KV | ~14 GB | 🔲 untested, highest priority of the untested |
| GLM-4.7-Flash-4bit | Jan 2026 | A | mlx-lm | MoE 30B, ~3-3.6B active, full MHA | ~16 GB | ❌ not viable |
| Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit | Mar 2026 | A | mlx-lm | Dense 27B | ~14 GB | 💥 OOM |
| Qwen3.6-27B-4bit | Apr 2026 | — | mlx-lm | Dense 27B | 16.1 GB disk | 🔲 queued for the 48 GB target |
| Qwen3.6-35B-A3B-OptiQ-4bit | Apr 2026 | — | mlx-lm | MoE 35B | 24.7 GB disk | 🔲 queued for the 48 GB target |
| Qwen3.8-27B-8bit (MLX) | Jul 2026 | — | mlx-lm | Dense 27B | 29.5 GB disk | 🔲 queued for the 48 GB target |

³ Gated model: accept the terms at huggingface.co/ibm-granite/granite-4.1-8b-instruct before
downloading. The mlx-community repo is `mlx-community/granite-4.1-8b-4bit`, not
`mlx-community/granite-4.1-8b-instruct-4bit`.

`Qwen3.6-35B-A3B-8bit` is excluded from the 48 GB queue at 37.7 GB, because it does not fit.
Models released in 2025 or earlier are in [the archive](#archive-pre-2026-models) and are not
candidates. Rig A headroom is `32 GB − VRAM − ~7 GB OS reserve`.

### Cheap operations

Target is `navikt/isoppfolgingstilfelle`, a real Nav Kotlin service. Ktor, Kafka, Postgres, 5,661
lines of main Kotlin, 151 tests that pass on a clean machine with no Nav-internal dependencies.
Every task is pinned to a symbol verified to exist in that repository. The runner hard-resets the
checkout between tasks, restarts the server before each one, and verifies results itself rather than
trusting the model's claim. Spec in `CHEAP_OPS_SPEC.md`, tasks in `bench/tasks.json`, run with
`mise run bench-cheap-ops`.

Measured 28 August 2026 on rig B under the 36 GB wired cap.

| Model | Tasks | Median | Verified | Zero-tool | Timeouts |
|---|---|---|---|---|---|
| granite-4.1-8b | 11 | 11.4s | 1 of 8 | 2 | 2 |
| kat-coder-v2.5 | 11 | 23.3s | 4 of 8 | 0 | 0 |
| **qwen3.6-35b-a3b** | 11 | **13.4s** | **4 of 8** | 0 | 0 |
| qwen3.8-27b-4bit | 3 | 64.9s | 1 of 1 | 0 | 0 |

The Qwen3.8-27B-4bit row is three tasks, not eleven: its full runs are quarantined, see
[Superseded results](#superseded-results).

#### `mlx-community/Qwen3.6-35B-A3B-4bit`

| Task | Time | Turns | Tools | Files | Result |
|---|---|---|---|---|---|
| R1 explain a domain function | 9.6s | 4 | 3 | 0 | needs a human |
| R2 find where a config value is read | 4.6s | 2 | 1 | 0 | 2 of 2 expected terms in the answer |
| R3 list call sites | 13.4s | 2 | 1 | 0 | needs a human |
| E1 add a KDoc block | 10.1s | 5 | 4 | 1 | compiles |
| E3 add a log line with context | 19.5s | 7 | 6 | 1 | compiles |
| M1 rename across call sites | 11.8s | 4 | 4 | 2 | renamed and compiles |
| M2 add a field to a DTO and map it | 19.9s | 5 | 6 | 2 | suite failed |
| G2 write a test for an untested util | 24.0s | 5 | 11 | 0 | no changes made |
| D1 explain PDL ident selection | 5.5s | 2 | 1 | 0 | needs a human |
| D2 thread a field through a row mapper | 136.0s | 17 | 26 | 5 | suite failed |
| D3 map a response field | 51.6s | 16 | 20 | 1 | suite failed |

It renames symbols across call sites, adds fields, adds log lines in the codebase's own style and
locates config values correctly. The three suite failures are all data-threading work: D2 touches
five files over 26 tool calls and still breaks the suite. That is the clearest limit found so far
and it is a real limit, not a timeout.

#### `mlx-community/KAT-Coder-V2.5-Dev-OptiQ-4bit`

| Task | Time | Turns | Tools | Files | Result |
|---|---|---|---|---|---|
| R1 explain a domain function | 16.1s | 4 | 4 | 0 | needs a human |
| R2 find where a config value is read | 6.1s | 2 | 1 | 0 | 2 of 2 expected terms in the answer |
| R3 list call sites | 16.2s | 2 | 1 | 0 | needs a human |
| E1 add a KDoc block | 15.9s | 6 | 5 | 1 | compiles |
| E3 add a log line with context | 39.1s | 6 | 8 | 1 | compiles |
| M1 rename across call sites | 23.3s | 5 | 7 | 2 | renamed and compiles |
| M2 add a field to a DTO and map it | 165.8s | 15 | 36 | 2 | suite failed |
| G2 write a test for an untested util | 55.5s | 8 | 17 | 1 | suite failed |
| D1 explain PDL ident selection | 13.5s | 4 | 3 | 0 | needs a human |
| D2 thread a field through a row mapper | 253.5s | 16 | 59 | 0 | no changes made |
| D3 map a response field | 127.2s | 13 | 35 | 1 | suite failed |

Same architecture as the alpha model (`qwen3_5_moe`), coder-tuned. Median 23.3s against 13.4s,
identical 4 of 8 verified, and the two agree task by task: both pass E1, E3 and the rename, both
fail M2, D2 and D3. Coder tuning bought one edit and lost another. It does not displace the alpha
model, which was the question it was run to answer.

#### `mlx-community/granite-4.1-8b-4bit`: reads, never writes

| Task | Time | Turns | Tools | Files | Result |
|---|---|---|---|---|---|
| R1 explain a domain function | 6.1s | 1 | 1 | 0 | needs a human |
| R2 find where a config value is read | 6.2s | 2 | 1 | 0 | 2 of 2 expected terms in the answer |
| R3 list call sites | 9.7s | 2 | 1 | 0 | needs a human |
| E1 add a KDoc block | 6.5s | 1 | 1 | 0 | no changes made |
| E3 add a log line with context | 6.8s | 1 | 1 | 0 | no changes made |
| M1 rename across call sites | 420.0s | 0 | 0 | 0 | timed out after 420s |
| M2 add a field to a DTO and map it | 120.8s | 24 | 24 | 0 | no changes made |
| G2 write a test for an untested util | 60.5s | 6 | 5 | 0 | no changes made |
| D1 explain PDL ident selection | 11.4s | 1 | 1 | 0 | needs a human |
| D2 thread a field through a row mapper | 65.0s | 3 | 2 | 0 | no changes made |
| D3 map a response field | 420.0s | 0 | 0 | 0 | timed out after 420s |

Median 11.4s, 1 of 8 checkable tasks verified, and **not one file written in the entire run**.

**The output bug is fixed and the verdict got worse, not better.** Before the fix Granite recorded
zero tool calls on every task because opencode discarded everything it produced. It now calls tools
on nine of eleven tasks, reads files, and answers read-only questions correctly and quickly: R2
returned both expected terms in 6.2 seconds. It never edits. M2 is the clearest case, 24 turns and
24 tool calls exploring the codebase before stopping without writing anything. That is the same
shape Copilot CLI showed when it had no instructions file: it locates the work, announces it, and
does not do it. Whether an instruction change would fix it is untested. On this evidence a 5 GB
install does not do routine Kotlin work.

The 0 turns and 0 tool calls on M1 and D3 are the timeout parser artifact, not a measurement. See
[Harness findings](#harness-findings).

### weather-cli

Every model builds the same Node.js CLI from `WEATHER_CLI_SPEC.md` (live Met.no + Geonorge APIs,
spec-named test files) in its own `workspaces/<key>/weather-cli/`, driven by the two prompts in
[Standard benchmark prompts](#standard-benchmark-prompts).

First unattended headless run of this benchmark, 28 August 2026, rig B:

| Model | Total | Plan | Implement | Files | Runner | Tests |
|---|---|---|---|---|---|---|
| granite-4.1-8b | 74.5s | 25.1s / 2 turns | 49.4s / 5 turns | 1 | None | exit None, pass None, fail None |
| qwen3.6-35b-a3b | 438.8s | 67.5s / 13 turns | 371.3s / 58 turns | 13 | mocha | exit 1, pass None, fail None |
| qwen3.8-27b-4bit | 1218.1s | 195.5s / 6 turns | 1022.6s / 27 turns | 13 | node:test | exit 0, pass 29, fail 0 |
| qwen3.8-27b-6bit | 2599.7s | 247.7s / 5 turns | 2352.0s / 20 turns | 13 | node:test | exit 0, pass 26, fail 0 |

Granite produced one file and no test runner, consistent with its cheap-operations result.
Qwen3.6-35B-A3B wrote thirteen files and left the suite failing, so speed here did not buy a working
artifact. The two Qwen3.8 builds are the only ones that finished with a green suite, at 20 and 43
minutes. The 6-bit build's time is not a model result, see
[Open questions](#open-questions-and-what-to-test-next).

None of these runs has been graded against the [code review rubric](#code-review-rubric); the
grades in [Superseded results](#superseded-results) are from the polluted-prompt runs.

---

## Superseded results

> **Read this once and apply it to everything below.** No number in this section was measured on
> the harness we now trust. Most were measured through the polluted system prompt, before commit
> `9a2b324`: 37,807 characters of instructions the benchmark never chose, and an unclosed think tag
> that routed model output into the `reasoning` field. The rest are quarantined for a named reason
> in the table below. The one task set re-measured since moved from a 32.4s median to 13.4s, so no
> absolute number here survives. Ranking between models may survive, because every model carried
> the same overhead, but nothing else does. This material is kept for provenance, not for reading.
> The warning is not repeated in the subsections.

### Quarantined result files

| File | Why it is not a result |
|---|---|
| `results-*.POLLUTED.json` | Measured through the polluted system prompt, before commit `9a2b324` |
| `results-granite-4.1-8b.INVALID.json`, `results-qwen3-30b-a3b.INVALID.json` | Measured while opencode discarded everything the model produced, [issue #10](https://github.com/navikt/mlx-workspace/issues/10) |
| `results-qwen3.6-35b-a3b.CONFOUNDED.json`, `results-qwen3.6-35b-a3b-dwq.CONFOUNDED.json` | The server crashed mid-run, [issue #11](https://github.com/navikt/mlx-workspace/issues/11) |
| `results-qwen3.8-27b-4bit.DISKCONTENTION.json` | Ran while a 22 GB model download competed for the same disk that every task restart reads weights from. Six of eleven timed out |
| `results-qwen3.8-27b-4bit.CAP420.json` | Quiet machine, still five of eleven timed out at the 420s cap, 352.0s median. Bounds the interactive case; says nothing about the background case |
| `results-qwen3.8-27b-6bit.MLX6BIT.json` | Four tasks kept as evidence. R2 took 1546.8s where the 4-bit build of the same weights takes 30.1s and Qwen3.6-35B-A3B takes 4.6s. R1 timed out at 1800s |
| `results-qwen3.8-27b-6bit.ABANDONED.json` | The same build at the 420s cap, stopped after six timeouts |

### Cheap operations, polluted prompt

**`mlx-community/Qwen3.8-27B-4bit`.** Partial run: five of eight tasks completed before the harness
timeout. E3 alone took twenty minutes and consumed the budget; the three multi-file tasks were never
reached. It works through opencode: 38 tool calls, both verifiable tasks passed.

| Task | 27B 4-bit | Qwen3.6 MoE | Result |
|---|---|---|---|
| R1 explain a function | 174.4s | 11.6s | **0 of 4 key terms** |
| R2 find a config value | 92.3s | 10.4s | 2 of 2 terms |
| R3 list call sites | 109.8s | 18.5s | 1 of 1 terms |
| E1 add a KDoc block | 167.4s | 21.1s | compiles |
| E3 add a log line | **1196.3s** | 29.1s | compiles |
| **Median** | **167.4s** | **25.1s** | |

**E3 is a tool-call loop, not slow generation.** Re-run with thinking disabled it hit the
2400-second timeout: 77 steps, every one ending `reason: tool-calls`, and from step 14 onward every
step emits exactly 97 output tokens. It calls a tool, reads the result, and calls it again
unchanged. The fix is an instruction never to repeat a failing tool call plus a harness-side
debounce blocking identical consecutive calls. Neither is in place; adding the rule changes
`AGENTS.md`, a benchmark input, so it requires re-running the baseline for comparability.

**Thinking costs about 2.3x, architecture about 4.1x**, measured by re-running with thinking off:

| Task | No-think | Thinking | Gain | Qwen3.6 MoE |
|---|---|---|---|---|
| R1 explain | 85.8s | 174.4s | 2.0x | 11.6s |
| R2 find config | 30.9s | 92.3s | 3.0x | 10.4s |
| R3 call sites | 55.9s | 109.8s | 2.0x | 18.5s |
| E1 add KDoc | 66.5s | 167.4s | 2.5x | 21.1s |
| **Median** | **61.2s** | **138.6s** | **2.3x** | **15.1s** |

Output tokens fell about 3x with thinking off. The model is still 4.1x slower than the MoE with
thinking off on both, which is the dense-versus-sparse decode gap: 4.7 against 22.4 tokens per
second. The two factors multiply to about 9.4x, matching the 8.8x measured across the full task
set. Tokens fell 3x while time fell only 2.3x, and the remainder is per-turn overhead thinking does
not explain, most likely the ~15.6k-token prefill carried on every request.

**`mlx-community/Qwen3.6-35B-A3B-4bit-DWQ`: worse than the plain build.** Controlled A/B, same
eleven tasks, same sampling, same 18.9 GB resident, fresh server before every task, quantization the
only variable.

| | DWQ | Plain 4-bit |
|---|---|---|
| Median | 23.8s | 32.4s |
| Mean | 62.4s | **52.9s** |
| **Verified** | **2 of 7** | **5 of 7** |
| Failures | compile error, 2x no edits, timeout, broken suite | 1x no edits, broken suite |

The lower median is an artifact of failing faster: G2 took 18.1s and made no edits where the plain
build spent 96.8s and passed. Its mean is worse because the failures include a 420-second timeout.
Testing elsewhere reports flat 4-bit losing tool-call formatting over a long context while DWQ stays
clean; that does not reproduce here. This is the third published recommendation to fail against our
own measurements, after the five-tool threshold for Qwen3-Coder and the framing that thinking hurts
across the board.

**`mlx-community/Qwen3.6-35B-A3B-4bit`, eleven tasks, fresh server before each**
(`results-qwen3.6-35b-a3b.POLLUTED.json`). Median 32.4s, mean 52.9s, 5 of 7 verified, zero tasks
with no tool calls.

| Task | | Time | Turns | Tools | Result |
|---|---|---|---|---|---|
| R2 | find where a config value is read | 10.1s | 2 | 1 | 2 of 2 terms |
| R1 | explain a domain function | 19.2s | 4 | 3 | 3 of 4 terms |
| D1 | explain PDL ident selection | 20.7s | 4 | 3 | 2 of 2 terms |
| M2 | add a field to a DTO and map it | 21.5s | 2 | 4 | ❌ made no edits |
| E1 | add a KDoc block | 22.3s | 5 | 4 | compiles |
| R3 | list call sites | 32.4s | 2 | 1 | 1 of 1 terms |
| M1 | rename across call sites | 35.1s | 5 | 6 | old symbol gone, compiles |
| E3 | add a log line with context | 46.2s | 8 | 7 | compiles |
| D3 | write a Kafka DTO deserialization test | 57.0s | 5 | 9 | suite passes |
| G2 | write a test for an untested util | 96.8s | 10 | 18 | suite passes |
| D2 | thread a field through a row mapper | 220.8s | 19 | 29 | ❌ broke the suite |

Earlier eleven-task run, confounded by the server crash, with `AGENTS.md` rule 8 forbidding a
repeated failing tool call and a 420-second per-task cap. Median 30.8s, mean 77.4s, 6 of 7 verified.

| Task | | Time | Turns | Tools | Files | Result |
|---|---|---|---|---|---|---|
| R2 | find where a config value is read | 7.6s | 2 | 1 | 0 | 2 of 2 terms |
| E1 | add a KDoc block | 12.5s | 4 | 3 | 1 | compiles |
| M1 | rename across call sites | 18.3s | 5 | 6 | 2 | old symbol gone, compiles |
| R1 | explain a domain function | 20.0s | 4 | 3 | 0 | 2 of 4 terms |
| D1 | explain PDL ident selection | 25.3s | 4 | 3 | 0 | 2 of 2 terms |
| R3 | list call sites | 30.8s | 2 | 1 | 0 | 1 of 1 terms |
| G2 | write a test for an untested util | 48.1s | 10 | 13 | 1 | suite passes |
| E3 | add a log line with context | 57.9s | 10 | 9 | 1 | compiles |
| M2 | add a field to a DTO and map it | 57.9s | 8 | 10 | 2 | suite passes |
| D3 | write a Kafka DTO deserialization test | 153.5s | 11 | 17 | 1 | suite passes |
| D2 | thread a field through a row mapper | **420.0s** | — | — | 6 | ❌ **timed out** |

First eight-task run, against a bar set in advance of a median under 30 seconds with most checks
passing. Median 25.1s, mean 38.9s, five of five objectively verified tasks passed, no truncation.

| Task | | Time | Turns | Tools | Input tokens | Result |
|---|---|---|---|---|---|---|
| R2 | find where a config value is read | **10.4s** | 2 | 1 | 15,890 | correct file and line |
| R1 | explain a domain function | **11.6s** | 4 | 3 | 17,979 | needs review |
| R3 | list call sites of a function | **18.5s** | 2 | 1 | 16,355 | needs review |
| E1 | add a KDoc block | **21.1s** | 4 | 3 | 16,241 | compiles |
| E3 | add a log line with context | **29.1s** | 8 | 7 | 20,845 | compiles |
| M1 | rename across call sites | **32.1s** | 5 | 6 | 18,474 | old symbol gone, compiles |
| M2 | add a field to a DTO and map it | **49.5s** | 13 | 16 | 25,302 | **151-test suite passes** |
| G2 | write a test file for an untested util | **138.6s** | 16 | 20 | 41,127 | **suite passes** |

Three findings from these runs still hold. **Run-to-run variance is large**: across the runs above
R1 moved 20.0s against 11.6s, R3 30.8s against 18.5s, E1 12.5s against 21.1s and R2 7.6s against
10.4s, so individual tasks swing up to 1.7x in both directions and single runs cannot separate
models within about 1.5x of each other. **The economics changed**: the nav-pilot analysis assumed
roughly six minutes of extra waiting per task, taken from weather-cli, and put break-even near ten
tasks a month; on routine operations the delta is tens of seconds, so break-even moves out by more
than an order of magnitude, and `reports/nav-pilot-path.md` still carries the old figure. **The
15.6k-token overhead floor was ours**: measured with the trivial prompt "Create a file called
probe.txt containing exactly the word: verified" at 15,628 input tokens, it fell to 5,687 on a real
task after `9a2b324` with the tool set unchanged, so it was configuration rather than tool schemas.

### weather-cli, polluted prompt

| Model | Rig | Plan | Implement | Total | Tests | Behaviour |
|---|---|---|---|---|---|---|
| Gemma-4-31B 8-bit | B | 4m 2s | 16m 21s | **20m 23s** | 16/16 | Code **6.0/10**. Correct mlx-lm backend. Twice the wall clock of Qwen3.8/DeepSeek; 31 turns at a 35s median. Pulled in **jest** instead of `node:test` |
| Gemma-4-31B 8-bit | B | 6m 7s | abandoned | — | — | Served by mlx-vlm by mistake, cache cleared per request; 43s median turn, 197s worst |
| DeepSeek-V4-Flash 2.4-bit | B | 4m 43s | 5m 26s | **10m 09s** | 17/17¹ | ✅ Rerun at parity; planned properly this time, dispatched a sub-agent, wrote its plan to a file |
| Qwen3.8-27B MTPLX Q8 | B | **1m 23s** | 8m 47s | **10m 10s** | 16/16 | ✅ Best run. Code **8.1/10**. Rule 7 + corrected spec UA warning |
| Qwen3.8-27B 4-bit | B (36 GB cap) | 5m 16s | 27m 5s | **32m 21s** | 25/25² | Code **8.5/10**. Same artifact as the Q8 at 3.2x the wall clock, no MTP. Ignored rule 7, drafted files inside `<think>` |
| Qwen3.6-35B-A3B 4-bit | B (36 GB cap) | **34.9s** | **6m 10s** | **6m 45s** | 20/20³ | ⚡ Fastest run. Code **6.8/10**. MoE ~3B active, **thinking disabled**, not a like-for-like process comparison |
| Qwen3.5-9B 4-bit | B (36 GB cap) | — | — | ❌ **4 attempts, no plan delivered** | — | Four distinct failures across four configs. Oldest model tested (Feb 2026); Qwen3.6 and 3.8 both work |
| Qwen3.8-27B MTPLX Q8 | B | 7m 58s | abandoned | — | — | Rule 7, old spec wording; plan phase lost ~5 min to a self-inflicted `example.com` 403 read as rate limiting |
| Qwen3.8-27B MTPLX Q8 | B | 2m 43s | 11m 22s | **14m 05s** | 17/17 | ✅ Complete. First run with `request_max_tokens=16384` in effect; no truncation |
| Qwen3.8-27B MTPLX Q8 | B | 2m 40s | aborted 3m 22s | — | — | Same `finish_reason=length`. The raised output cap had not reached `opencode.json` |
| Qwen3.8-27B MTPLX Q8 | B | 2m 52s | aborted 4m 36s | — | — | Tool calling healthy (10/13 turns), implement phase died on `finish_reason=length` |
| Qwen3.8-27B MTPLX Q8 | B | 3m 12s | 4m 21s | **7m 33s** | 22/22 | Probed both APIs during planning, then wrote correct code first try |
| DeepSeek-V4-Flash 2.4-bit | B | — | — | 11m 58s (14m 55s first run) | 13/13 | Assumed the API shapes, then debugged against failing tests |
| Qwen3.8-27B 8-bit (pre-MTP) | B | — | — | ~34 min | 18/18 | Ran unattended; found and fixed 3 errors in the spec by probing the live APIs |
| Qwen2.5-72B 8-bit | B | — | — | — | — | Never wrote a file, printed code into chat instead of calling tools |

¹ Self-reported. Qwen3.8 (16/16) and Gemma-4-31B (16/16) were re-run with `npm test` and confirmed;
DeepSeek's workspace was deleted before that check. Verify test counts before clearing a workspace.
² Independently verified: 25 tests, 24 hermetic plus 1 live test gated behind `WEATHER_LIVE=1`. Test
counts are not comparable across models, each chooses how finely to split its suite.
³ 19 tests that can fail plus one that cannot: `test/integration.test.js:37-50` wraps eight
assertions in a `try`/`catch` that swallows Node's `AssertionError`.

Two levers dominated these runs. Naming the Met.no 403/429 distinction in the spec cut the plan
phase to **1m 23s**, against a happy-path band of 2m 52s / 2m 40s / 2m 43s and a 7m 58s worst case
when the model had to work the ambiguity out itself. Adding *"Check the external apis do not assume
the data model"* to the plan prompt moved DeepSeek-class debugging loops into a 3-minute research
phase and cut Qwen 3.8's total time by roughly 4x. Plan time measures what the model ran into, so
treat a long plan phase as a signal to check what it was wrestling with.

### Model notes from the polluted era

**`mlx-community/Qwen3.8-27B MTPLX Q8` (`mvid/Huihui-Qwen3.8-27B-abliterated-MTPLX-Q8`), oMLX.**
Dense 27B plus MTP drafter, ~27-28 GB RSS at `gpu_wired_limit_gb = 96`, 131,072 declared context,
`qwen_template.jinja` bound explicitly. 11.3-14.3 t/s without MTP, 18-38 t/s with it; typical
tool-call turns land 25-33 t/s at 20-35k context, dropping 34.8 t/s at 18k to 20.6 at 34k to 18.0 at
34.9k while MTP acceptance holds at 80-95%, so that is backbone prefill cost and not drafter decay.
Responses in ~8s at small context. The only model tested that reliably researches external APIs
before writing code.

Best run (2026-08-26, 16k output cap, rule 7, corrected spec), against the previous best:

| Metric | Value | vs previous |
|---|---|---|
| Wall clock | 1m 23s plan + 8m 47s implement = **10m 10s** | −28% (was 2m 43s + 11m 22s = 14m 05s) |
| Tests | 16/16 passing | 17/17, self-reported |
| Turns | 16: 13 `tool_calls`, 3 `stop`, no truncation | same 16 / 13 / 3, zero truncations |
| Generated | 11,996 tokens in 623s → **19.2 tok/s** | 14,892 tokens in 841s → 17.7 tok/s |
| Median turn | **338 tokens** | −28% (was 468) |
| Largest turn | 3,299 tokens | −18% (was 3,999, which the old 4,096 cap would have cut off) |
| Peak context | 31.7k | 16.4k → 34.9k |
| MTP | 2.88 tok/cycle, 62-97% acceptance | 2.91 avg (1.75-3.67), 50-99% |

Two bugs were fixed getting here. The HF tokenizer shipped no `chat_template`, which produced
4-minute prefills and a 44 GB KV cache spike on trivial prompts; binding the Qwen Jinja template via
`MLX_CHAT_TEMPLATE` fixed it. And at the default `MLX_OPENCODE_OUTPUT = 4096` the model spent its
whole budget inside a `<think>` block, hit `finish_reason=length` after 3m 48s and returned no tool
call; raised to 16384 with `MLX_MAX_TOKENS = 32768`. Two quirks remain: the abliterated build
follows instructions worse than the base instruct model and sometimes drafts the whole
implementation inside `<think>` then emits EOS without a tool call (`AGENTS.md` rule 6), and like
Qwen 2.5 it occasionally emits single-quoted tool-call JSON (rule 2).

**Not a spec error, a model-invented one.** The run reported that the spec's example User-Agent
returns 403. It does not. Verified directly, 2026-08-26:

| User-Agent | Result |
|---|---|
| `weather-cli/1.0 github.com/yourname` (the spec's example) | 200 |
| `weather-cli/1.0` / `curl/8` / `test/1.0 someone@example.org` | 200 |
| `weather-cli/1.0 contact@example.com` | **403** |
| `weather-cli/1.0 (contact@example.com)` | **403**, parentheses are irrelevant |

Met.no blocks the literal placeholder domain `example.com`. The 403 is a 162-byte nginx HTML page
with no `Retry-After` and no `RateLimit-*` headers; real throttling returns 429. A later run misread
this 403 as rate limiting and spent minutes on backoff that could never succeed, inflating its plan
phase to 7m 58s. Three failures worth tracking per model: substituting a placeholder into a working
spec, blaming the spec for it, then diagnosing a hard block as throttling.

Code review **8.1/10**: correctness 8, error handling 7, structure 9, test quality 8, idiom 9. Six
traps avoided, one hit. `closestEntry` compares epoch milliseconds and scans the whole timeseries;
`format.js:1-6` uses strict `>` at 75/50/25; `geocode.js:14` destructures `const [lon, lat]`
correctly; every URL is built from an axios `params` object; `parseArgs.js:10-11` bounds ±90/±180
inclusively. The miss is missing fields: `format.js` has no guards, so a night payload without
`ultraviolet_index_clear_sky` prints `UV Index: undefined` and exits 0, and a missing
`cloud_area_fraction` reports a confident "Clear". The `http = axios` default parameter on `geocode`
and `fetchWeather` is the cleanest mock boundary in the batch and the only submission that stays
inside the spec's single dependency. Two real minor findings: `geocode.js:14` walks
`hit.geojson.geometry.coordinates` unguarded, and `integration.test.js` calls the live APIs with no
environment gate so `npm test` fails offline.

**`mlx-community/DeepSeek-V4-Flash-0731-2.4bit-mixed`, oMLX.** MoE 284B total / ~13B active, MLA
attention, ~84 GB wired (82.8 GB RSS) at `gpu_wired_limit_gb = 115`, 131,072 declared context,
`MLX_MAX_TOKENS = 32768`, `deepseek_template.jinja`. 25-31 t/s decode, holding 25-26 t/s at 35,230
tokens; TTFT on an 18k prompt ~3.3s thanks to oMLX's paged cache; CPU stays near 1.25 cores.

| Metric | DeepSeek V4 Flash | Qwen3.8 MTPLX |
|---|---|---|
| Total | **10m 09s** | 10m 10s |
| Plan / implement | 4m 43s / 5m 26s | 1m 23s / 8m 47s |
| Tests | 17/17 | 16/16 |
| Turns | **30** (26 `tool_calls`, 4 `stop`) | 16 (13 / 3) |
| Median turn | **166 tok** | 338 |
| Mean / max turn | 365 / 2,038 | 750 / 3,299 |
| Tokens generated | 10,964 | 11,996 |
| Throughput | 19.1 t/s | 19.2 t/s |
| Peak context | 29.4k | 31.7k |
| RSS | 79 GB | 28.9 GB |

Two opposite routes to the same wall clock: DeepSeek runs twice as many turns at half the size,
front-loading a written plan and delegating to a sub-agent, visible in the log as the parent context
dropping from 18.6k to 11.0k. Its median turn of 166 tokens is the lowest measured on either rig.
The "code first, debug later" trait turned out to be promptable: under the corrected spec plus rule
7 it planned for 4m 43s and wrote `IMPLEMENTATION_PLAN.md` to disk. Persisting a plan as a file
survives compaction and costs one cheap re-read instead of riding in every later prompt. Qwen3.8
never delegated across four runs. Cost: 79 GB resident against 28.9 GB for the same wall clock.
The earlier ~20% second-run speedup was **not** custom kernels, which never compiled on this
machine; it came from `MLX_OPENCODE_CONTEXT` 16k → 131k ending a compaction loop and temperature
locked to 0.6 stopping repeated tool calls.

**`mlx-community/gemma-4-31b-it-8bit`, mlx-lm.** Dense 31B with hybrid sliding-window attention and
an MoE block, ~31 GB weights / 30.9 GB RSS, `model_type: gemma4` so mlx-lm serves it, 131,072
declared context. 20m 23s total, 16/16 verified with `npm test`, roughly 2x the wall clock of
Qwen3.8 and DeepSeek for the same outcome.

| Metric | Gemma-4-31B | Qwen3.8 MTPLX | DeepSeek V4 |
|---|---|---|---|
| Total | 20m 23s | 10m 10s | 10m 09s |
| Implement turns | 31 | 16 | 30 |
| Median turn | **35s** | ~12s | ~9s |
| Worst turn | 121s | 88s | — |
| Prefill | ~328 t/s | — | — |

The turn count matches DeepSeek's almost exactly; every turn costs ~4x as long, and there is no
drafter for Gemma. **KV cache is expensive**: 1.65 GB for 1,907 tokens ≈ **865 KB/token**, against
64 KB for Qwen3.5-9B and 20 KB for Qwen3.6-35B-A3B. At 30k context that is ~26 GB of cache on top of
31 GB of weights, so it cannot fit the 48 GB target, and quantizing the weights does not help
because the cache does not shrink with them. This build of mlx-lm has no `--kv-bits`.

Code review **6.0/10**: correctness 5, error handling 6, structure 8, test quality 5, idiom 7. Three
traps avoided, three hit, one not applicable. Avoided: `geocode.js:21-22` swaps the GeoJSON pair
correctly, `geocode.js:4` encodes the place name, `output.js:4-6` uses strict `>` at 75/50/25. Hit:
`weather.js:19` takes `timeseries[0]` outright; no field is guarded, so a payload without
`ultraviolet_index_clear_sky` prints `UV Index: undefined` and exits 0; and there is no coordinate
range validation, so `weather "999 999"` reaches Met.no. **The real bug is the argument parser**:
`parser.js:2` reads `args[0]` only and the coordinate regex expects both numbers in that one string,
so unquoted `weather 59.91 10.75` is sent to Geonorge as a place name and `weather Bergen sentrum`
searches for "Bergen". The spec quotes its own example, so this is defensible rather than a
violation, but it is the sharpest usability failure in the batch. The 16 tests are all real, but
`output.test.js` exercises cloud fractions of 10, 30, 60 and 80, so changing every `>` to `>=` would
not fail one, and `integration.test.js:44-48` re-implements `main()` by hand so the entry point,
exit codes and the `args[0]` bug are untested. It silently added **jest** where the spec names only
`axios`. Structure is genuinely good: five flat modules, 131 lines, a 40-line entry point.

**`mlx-community/Qwen3.8-27B-4bit`, mlx-lm.** First model measured under the 36 GB wired cap. Dense
27B, `model_type: qwen3_5`, no MTP. Peak RSS **14.57 GB** against the Q8's 28.9 GB, KV cache 3.28 GB
over 3 sequences, plan 5m 16s + implement 27m 5s = **32m 21s**, 22 turns, 25/25 verified by hand,
code **8.5/10**. Capacity comfortable, speed not: 3.2x the Q8 on identical work, because the Q8 had
MTP and this build has none. On this rig the drafter is worth more than the bandwidth saved by the
smaller weights. Quantization degraded instruction-following rather than output quality: it ignored
`AGENTS.md` rule 7 and drafted entire file contents inside `<think>` (the workspace copy of
AGENTS.md was verified byte-identical to the root), and it stalled ~4 minutes on the User-Agent
question that the Q8 read and moved past. The code has no severe bugs and avoids every trap on the
checklist; three minor risks are all the same family, `?? {}` and `?? 0` on missing Met.no fields
printing `undefined°C` or fabricating "Clear" with exit 0, where the empty-timeseries path correctly
throws. It is the first model whose self-report survived a hand check unchanged, including both
disclosed deviations: `Oslo` resolving to "Oslo fylke", and the spec's `temperature`/`humidity`
field names not existing in Met.no v2, correctly mapped to `air_temperature`/`relative_humidity`.

**`mlx-community/Qwen3.6-35B-A3B-4bit` on rig B, mlx-lm.** Same 36 GB cap, spec, prompts and
harness. MoE 35B / ~3B active, `model_type: qwen3_5_moe`, thinking disabled, peak RSS 18.64 GB, KV
cache 4.70 GB, plan 34.9s + implement 6m 10s = **6m 45s**, 27 turns, 20/20 tests, code **6.8/10**.
Speed comes from cheap turns, not fewer of them: it took *more* turns than the Qwen3.8 4-bit's 22,
backtracking to fix bugs, and still finished in a fifth of the time. Two effects compound and should
not both be credited to architecture: ~3B active parameters instead of 27B dense, and no reasoning
tokens at all. The cache figure isolates the architectural half, **0.30 GB across 4 sequences after
warm-up**, against the dense 4-bit's 1.10 GB and Gemma-4-31B's 865 KB/token. The thinking caveat is
load-bearing: this profile disables thinking because it degrades Qwen3-class models on multi-turn
tool use, mainly by spending the output budget inside the thinking block (arXiv 2606.09662, tested
on Qwen3 1.7B-32B). An earlier version of this note cited "BFCL 12.4% vs 35.8%" here; those are the
DeepSeek R1 vs V3 numbers from [Thinking mode](#thinking-mode), copied across model families by
mistake. So this is a fair comparison of deployed configurations and an unfair one of models, and it
cannot be credited with obeying rule 7 either, because with no `<think>` block drafting code inside
one is not a thing it can do. Six of seven traps avoided: UTC-safe selection, full timeseries scan,
strict `>` correct at exactly 75/50/25, `new URL` plus `searchParams` on every URL, inclusive
±90/±180 bounds. It hit missing fields harder than the dense 4-bit, with no per-field checks at all.
Two more defects: `index.js:6` calls `parseArgs` outside the `try` that starts at line 14, so
validation errors escape the catch at 32-34 as a raw Node stack trace, and `package.json` declares
`devDependencies` twice. It knowingly broke the dependency spec, `test/geocode.test.js:7-9`: *"spec
says only axios. However, tests need mocking. We'll add nock as dev dependency."*

**`mlx-community/Qwen3.5-9B-MLX-4bit` on rig B: does not complete the benchmark.** Four attempts
under the 36 GB cap, each fixing the previous attempt's failure. It never delivered a plan.

| Attempt | Config change | Failure |
|---|---|---|
| 1 | profile defaults (`top_k` disabled) | `webfetch` returned a **truncated** Met.no payload; it groped at the fragment with `Grep "\{"` and `Grep "property"`, then produced a single **8m 18s** thought block and collapsed into `DIDIDIDI…`, a degenerate repetition loop |
| 2 | `MLX_TOP_K = 20` | Plan in **23.4s**, the fastest in the benchmark. Then wrote `index.js` to shell out to a `geonorge` CLI that does not exist, and tried to conjure it: `npm install -g`, four `brew install` variants, a `brew tap` that cloned into `/opt/homebrew` |
| 3 | + cplt sandbox | Diagnosed the Met.no 403 **correctly and immediately**, better than Qwen3.8-27B Q8, which read the same 403 as rate limiting. Then a **9m 51s** turn that never completed |
| 4 | + `top_p = 0.95`, thinking **disabled** | POSTed multipart form fields (`lat`, `lon`, `User-Agent`, `Content-Type`, an invented `apikey=demo`) to a **GET** endpoint → `405 Not Allowed`. **8m 35s**, no plan |

The levers worked and only moved the failure. `top_k=20` ended the repetition loop; the sandbox
stopped the install flailing; disabling thinking cut the response to "reply with exactly: ok" from
**159 output tokens to 2**, so attempt 1 was spending roughly 80x the necessary output on a one-word
answer. Attempt 4 settles it: sending headers as form fields to a GET endpoint is a broken model of
HTTP, not a sampling artifact, and it reused `hans@example.com` after attempt 3 had correctly
identified that exact placeholder as the cause of a 403, because with thinking off the reasoning
that reached that conclusion was gone. What it was good at: it diagnosed the 403 by saving the
response body to `/tmp/metno.json` and reading it rather than inferring from a status code, the best
debugging method observed in the benchmark. With rule 7 in force and thinking enabled it obeyed
cleanly, ~400ms of thought then a tool call, where Qwen3.8-27B 4-bit drafted whole files inside
`<think>`. This is the oldest model tested and Qwen3.6 and Qwen3.8
both work, so read it as a verdict on this build rather than on 9B-class models. **The 6 GB rung
stays unmeasured.**

**`mlx-community/Qwen3.5-9B-MLX-4bit` on rig A: the daily driver there.** Dense 9B, ~6 GB VRAM, 262k
native context (`max_position_embeddings: 262144`), practically ~128k with ~19 GB headroom, MLA
giving a 64 KB/token KV cache. Strong tool calling with the updated Qwen3.5 parsers, no tool call
loops, no OOM, clean code output in the June 2026 head-to-head.

| Metric | Value | Condition |
|---|---|---|
| Prefill, peak | ~245 t/s | First 2k tokens, fresh KV cache |
| Prefill, 44k prompt | ~205 t/s avg | Full 44k-token prefill from cold |
| Prefill, 14k prompt (cache-warm) | ~179 t/s avg | After a prior 44k session filled cache |
| Prefill degradation | 258→181 t/s | 4k tokens → 44k tokens in same run |
| Decode, extreme context | ~0.005 t/s (208 s/tok) | ~96k tokens, severe degrade, near unusable |

**Generation speed degrades at large context.** Beyond ~80k tokens generation slows; at ~96k a
single token was observed taking **3 min 28 s**, which made opencode stop silently: the SSE chunk
timeout fired mid-generation, the connection dropped, and opencode exited the loop with no error.
`MLX_OPENCODE_CHUNK_TIMEOUT` is set to `600000` to cover it. Comfortable range is ~50-70k tokens.
Diagnose silent stops by grepping `~/.local/share/opencode/log/opencode.log` for `"exiting loop"`
and querying `~/.local/share/opencode/opencode.db` for messages with `parts: 0`. Still unmeasured:
decode t/s at 8k / 32k / 64k, TTFT for typical requests, tool call JSON accuracy, and max stable
context before OOM, estimated ~100k from the KV measurements.

**`mlx-community/Qwen3.6-35B-A3B-4bit` on rig A.** MoE with MQA: 35B total / ~3B active, 256 experts
with 8 active, 2 KV heads, 40 layers, ~21 GB VRAM, 262k native context, 96k declared, ~3.3 GB
headroom at 96k. mlx-lm uses 8-bit KV cache compression: **18.3 KB/token measured** against 40
KB/token float16 theoretical, so KV ≈ 1.7 GB and wired ≈ 22.7 GB at 96k, KV ≈ 2.3 GB and wired ≈
23.3 GB at 128k, leaving 3.3 GB and 2.7 GB of headroom respectively. Prefill **~386 t/s avg at 26k tokens**, 1.5-1.7x faster than Qwen3.5-9B's 245 t/s
peak, with generation speed matching it in practice. TodoWrite, tool calling and task planning all
work. Cache slots must be ≥5: with 3 slots, system(2) + user(1) fills capacity and nothing is cached
for the assistant. Qwen3.6-27B-4bit was not profiled for rig A: 0.22 MB/token KV limits it to ~32k
safely at 4x slower decode. weather-cli, 2026-06-19: 35/35 tests across 5 files, 1,076 lines, ES
module with vitest and nock, 8 LLM turns, no loops, stalls or OOM. It chose `fast-xml-parser`,
presumably an XML fallback for Met.no.

**`mlx-community/gemma-4-12B-it-4bit`: too slow.** Dense 12B, encoder-free multimodal, ~7 GB VRAM,
256k native context declared down to ~64k, ~18 GB headroom, Apache 2.0, Jun 2026. Requires mlx-vlm
(`model_type: gemma4_unified`). Hybrid attention with `sliding_window=1024` makes KV expensive:
~360 KB/token f16, 180 KB at 8-bit, so ~11 GB of cache at 64k. mlx-vlm re-prefills the whole
conversation every tool call, measured 2026-06-18 on weather-cli:

| Turn | Input tokens | Output tokens | Duration |
|---|---|---|---|
| 1 | 16,876 | 15 | 120s |
| 2 | 16,912 | 215 | 116s |
| 3 | 17,156 | 26 | 137s |
| 4 | 17,214 | 47 | 147s |
| 5 | 17,919 | 400 | 151s |
| 6 | 18,334 | 81 | 140s |
| 7 | 18,562 | 128 | 167s |
| 8 | 18,699 | 215 | 173s |
| 9 | 18,962 | 161 | 149s |
| 10 | 19,125 | 162 | 165s |
| **Avg** | | **141 tokens out** | **~136s (2m16s)** |

Ten turns at 2m16s is 24 minutes and 0 files implemented. At similar context Qwen3.5-9B takes ~5-10
seconds per turn. **Not gradeable and not a submission**: `workspaces/gemma-4-12b/weather-cli/` holds
`src/{index,parser,geocoder,weather,formatter}.js` plus the five spec-named test files and all ten
are **0 bytes**; only `package.json` has content. [Issue
#5](https://github.com/navikt/mlx-workspace/issues/5) listed this run among the ungraded submissions
and it is not one. Re-evaluate if mlx-vlm adds persistent KV caching.

**`mlx-community/Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit`: OOM.** Community fine-tune of
Qwen3.5-27B base on Claude 4.6 Opus reasoning traces, Apache 2.0, dense 27B, ~14 GB VRAM (measured
peak ~15.6 GB on an M4 Pro 64 GB), 262k native context but ~32k practical on 32 GB, ~15.7 t/s on the
M4 Pro and slower on the M1 Max. Crashed 3x with Metal
`kIOGPUCommandBufferCallbackErrorOutOfMemory`, always at ~6144 tokens into prefill, plus 3 tool call
JSONDecodeErrors in the first 2 turns and an infinite tool loop: it repeatedly called the same wrong
path (a `mlx-workscope` typo), detected "path is wrong" in `<think>` each iteration, and re-issued
the identical broken call 8+ times. Opus distillation preserves error *detection* but not error
*correction*. Prefill ~68-71 t/s against ~350-386 t/s for Qwen3.6-35B-A3B. Root cause is
architectural, see [Dense vs MoE](#dense-vs-moe): 14 GB model + 4.4 GB KV cache + prefill spike >
26 GB wired cap.

It did produce an artifact. `workspaces/qwen3.5-27b-opus-distilled/weather-cli/` holds a complete
submission timestamped 2026-06-19: four source modules, a `bin/weather` entry point, four of the
five spec-named test files, 749 lines. Written against the June spec, so not comparable with the
August runs. Code review **4.6/10**: correctness 2, error handling 6, structure 8, test quality 3,
idiom 6. Six traps avoided, one hit, in its worst form: `weather.js:63` falls back to `uvIndex: 0`,
so a payload without a UV index reports a confident **0** rather than a visibly wrong `undefined`,
and the four-deep ternary at `weather.js:64` ends in `?? 0`, so a missing cloud fraction becomes
"Clear". **It cannot succeed once against the live APIs**, four invented response shapes, any one
fatal on its own:

| Location | Reads | Actual |
|---|---|---|
| `geocode.js:23` | `data.features` | `/stedsnavn/v1/sted` returns `{ navn: [...] }` |
| `weather.js:27` | `data.timeseries` | `data.properties.timeseries` |
| `weather.js:48` | `closestEntry.instant` | `entry.data.instant` |
| `weather.js:62` | `instant.pressure` | `instant.air_pressure_at_sea_level` |

So `weather Oslo` always prints `Error: No location found for "Oslo"` and `weather "59.91 10.75"`
always prints `Error: No weather data available`, both exiting 1, which is the spec's error code for
entirely the wrong reason. Its 32 green tests are the reason: every assertion is real, thresholds
are pinned at exactly 25/50/75 in `output.test.js:31-49`, the ±90/±180 bounds are covered, and the
mocks sit at the HTTP layer via `nock`, the strictest mock boundary any submission chose. All of it
confirms the model's own guesses. This is the clearest case in the benchmark of a suite that locks
in an assumption instead of checking an API, and it is the strongest evidence for the plan-prompt
rule about checking external APIs. `integration.test.js` is absent, and chai, mocha and nock are all
beyond the spec's single `axios`, added without disclosure. Structure is the best organised of the
batch, `bin/` plus `src/`, four modules with one job each, a 61-line entry, JSDoc on every export
and a consistent `{ success, error }` convention; against that, `weather.js:29-31` builds a `Date`,
formats it to ISO and parses it back for no reason.

**`mlx-community/GLM-4.7-Flash-4bit`: not viable.** Zhipu/Z.AI, 2026. MoE with 64 routed experts
plus 1 shared, 4 active per token, 30B total / ~3-3.6B active, ~16 GB VRAM, 128-200k native context
but 48k practical, ~9 GB headroom with a 6 GB KV cache at 48k. **Full MHA, 20 KV heads for 20
attention heads, no GQA**: KV ≈ 374 KB/token f16, 187 KB at 8-bit, so ~8.5 GB of cache at 48k, which
leaves almost nothing for activations and made the OOM inevitable. Published τ²-Bench agentic score
79.5%, measured with structured scaffolding and greedy decoding, not representative of opencode use.

| Failure mode | Root cause | Status |
|---|---|---|
| Repetition degeneration loop | `temp=0.0` default (greedy) | ✅ Fixed: `MLX_TEMP=0.7` |
| Thinking stalls (3m35s on trivial decisions) | Thinking mode enabled | ✅ Fixed: `enable_thinking=false` |
| Metal OOM at 64k context | Prefill activation spike at 27k tokens (41%) | ✅ Mitigated: reduced to 48k |
| Tool call loop | Repeatedly called `ls` same dir without progress | ❌ Unfixable |
| Generated code with typos | `location3`, `lon3` in 411-line output | ❌ Model quality issue |

**Not gradeable.** `workspaces/glm-4.7-flash/weather-cli/index.js` does not parse: the 411 lines are
one `try` block repeated dozens of times, `const { lat, lon }` is redeclared repeatedly in the same
scope, and line 14 reads `const { lat, lon3 } = parseLocation(location3)` against two names that do
not exist. `parser.js` reads `values._[0]`, which `node:util`'s `parseArgs` does not return, and no
test file was written. The infrastructure failures were all fixable; the tool call loop and the code
quality are not.

---

## Mechanisms

The explainers behind the numbers. These are properties of the runtimes and the architectures, not
results, so the prompt pollution does not touch them.

### Server backends: mlx-lm vs mlx-vlm vs oMLX

`mise run server` selects the backend from `MLX_SERVER_TYPE` in the active profile's `[params]`
(`mlx-lm`, `mlx-vlm`, or `omlx`).

| Feature | mlx-lm | mlx-vlm |
|---|---|---|
| **KV cache** | Persistent across requests, bounded in slots by `MLX_CACHE_SIZE` | **Cleared after every request** (`Stream finished, cleared cache`) |
| **Prompt caching** | `--prompt-cache-size` (slots); `--prompt-cache-bytes` is parsed and never applied | Not supported, no equivalent flags |
| **Per-turn cost** | Re-uses prior context; only new tokens prefilled | **Full conversation re-prefilled every tool call** |
| **Agentic impact** | Fast at steady state; grows slowly | Grows linearly, each tool call costs O(session_length) prefill |
| **Server logs** | Detailed `Prompt processing progress` lines | Minimal; no per-chunk progress |
| **Multimodal** | Text only (even for VLM model weights) | Text + images + audio/video |

opencode and aider send the full conversation with every tool call. On mlx-lm a 30k-token session
costs ~30k prefill once, then ~500-2k per tool call. On mlx-vlm it costs ~30k prefill **on every
tool call**, which at 200 t/s is 150 seconds before generation starts. Use mlx-vlm models for short
focused tasks only.

A model requires mlx-vlm when its `model_type` is implemented only there:

| model_type | Affected models | Notes |
|---|---|---|
| `gemma4_unified` | Gemma 4 variants published with the unified arch | No text-only path in mlx-lm |
| `glm4v` | GLM-4.6V-Flash and V-series | Z.AI vision models; `glm4v` ≠ `glm4` (text-only GLM) |
| `glm4v_moe` | GLM-4.6V MoE variants | Same family, MoE variant |

In our workspace `gemma-4-12b` and `gemma-4-26b-a4b` are `gemma4_unified` and `glm-4.6v-flash-9b` is
`glm4v`, so those three use mlx-vlm. `gemma-4-31b-8bit` is plain **`gemma4`** and uses **mlx-lm**,
because `mlx_lm/models/gemma4.py` reads `text_config` and skips the vision tower. Everything else is
`qwen3_5`, `qwen3_5_moe`, `glm4_moe_lite`, `qwen3_moe`, `qwen2`, `granite` or `mistral3` on mlx-lm.

> ⚠️ **Check `model_type` exactly, not by prefix.** `gemma4` and `gemma4_unified` are different
> architectures with different backends. Assuming every Gemma 4 needs mlx-vlm cost a full benchmark
> run: `gemma-4-31b-8bit` was served by mlx-vlm, which clears the KV cache after every request, and
> its turn times climbed to a 43s median and 197s worst against ~12s for oMLX models. Models with
> dual support (`qwen3_vl` exists in both packages) run via mlx-lm in text-only mode: no image
> input, but full KV cache persistence.

`oMLX` is a third backend, added because mlx-lm has no support for DeepSeek V4 and no MTP
speculative decoding. Its KV cache is paged and persisted to SSD, with prompt boundary snapshots
reused across requests. HF repo slashes are rewritten to double dashes
(`mlx-community--DeepSeek-V4-Flash-0731-2.4bit-mixed`); `opencode-init` and `aider-init` translate
this automatically.

> ⚠️ **The custom Metal kernels have never been built on rig B.** `OMLX_WITH_CUSTOM_KERNEL=1` needs
> `xcrun metal`, which ships with full Xcode; this machine has only Command Line Tools, so the build
> fails with `unable to find utility "metal"`. `mise run setup` detects this and installs oMLX
> without the kernels rather than dying in a cmake traceback. **Every oMLX number in this document
> was measured without them.** DeepSeek's 25-31 t/s and 3.3s TTFT are the un-accelerated baseline.

Three gotchas found on rig B: `~/.omlx/settings.json` ships `max_context_window: 32768` and silently
truncates anything larger, raised to `131072`; the default sampling temperature of `1.0` made
DeepSeek emit repeating tool calls, locked to `0.6`; and oMLX pins `mlx==0.32.0`, so `mise run setup`
installs both mlx packages in one pip invocation to keep the resolution consistent.

> ⚠️ **oMLX ignores most profile params.** `omlx serve` takes no model, sampling or template flags,
> so `MLX_MAX_TOKENS`, `MLX_TEMP`, `MLX_CHAT_TEMPLATE`, `MLX_CACHE_BYTES` and `MLX_CACHE_SIZE` have
> **no effect** for oMLX profiles. oMLX reads `~/.omlx/settings.json` instead. `mise run server`
> prints which params it cannot apply.

### Dense vs MoE

Decode is bandwidth-bound: what matters is bytes streamed per token, not parameter count on disk.
Dense models load every parameter into every forward pass, and during prefill the activation tensors
for the whole input must coexist with the weights. That spike is what breaches the wired-memory cap.
MoE routes each token through a few experts only, so activation memory stays low regardless of total
size. The Qwen3.5-27B-Opus-Distilled OOM on rig A (2026-06-19) makes it concrete:

| Model | Total params | Active per token | VRAM | Prefill t/s | Result |
|---|---|---|---|---|---|
| Qwen3.5-27B-Opus | **27B dense** | 27B | 14 GB | 68-71 t/s | 💥 OOM at 6-17k tokens |
| Qwen3.6-35B-A3B | 35B MoE | **~3B** | 21 GB | 350-386 t/s | ✅ 96k context, stable |

Qwen3.6-35B-A3B is 3x larger by total params, 5x faster at prefill, and peaks lower than the 27B
dense model. **On 32 GB: prefer MoE above ~14B total params.**

Total parameter count sets capacity; active count sets speed.

| | Qwen3.8-27B (dense, 4-bit) | Qwen3.6-35B-A3B (MoE, 4-bit) |
|---|---|---|
| Total params | 27B | 35B, *larger* |
| Active per token | **27B** | **~3B** |
| Weights read per token | ~16 GB | ~2 GB |
| KV cache | ~60-80 KB/token (estimated) | **20 KB/token** (measured, rig A) |
| Download | 16.3 GB | 20.4 GB |

On a 128 GB Max there is bandwidth to spare and the dense 3.8 wins outright. On a 48 GB Pro, where
bandwidth is roughly halved, the dense model reads ~16 GB per token and is throughput-bound long
before it is capacity-bound. The MoE reads about an eighth of that and carries a KV cache three to
four times cheaper.

**The 3.8 line has no small MoE to sidestep the trade with.** Qwen ships `Qwen3.8-27B` dense and
`Qwen3.8-2.4T-A95B`, a frontier-scale MoE with 95B active. MLX has only `Qwen3.8-27B-4bit` and its
drafter; the one MoE build, `Qwen3.8-Whittle-MoE-27B-A17.8B`, is an unofficial merge with 17.8B
active, nearly dense in bandwidth terms. Qwen3.6 shipped both a dense 27B and a small MoE, 3.8 did
not, and there is no Qwen3.7 at all. Wanting MoE economics means going back a version: for local
hardware, whether the family shipped a small MoE matters more than the version number. So 3.8 is the
better model and 3.6-A3B may be the better fit. On 128 GB the rule softens: a dense 27B at 8-bit
fits with ~100 GB to spare, and with MTP it outruns the 284B MoE on wall-clock task time.

### Thinking mode

Several models generate `<think>…</think>` blocks before answering, controlled via
`MLX_CHAT_TEMPLATE_ARGS` in the profile.

| Model | Thinking tokens | Disable mechanism |
|---|---|---|
| GLM-4.7-Flash | `<think>`, `</think>`, `/nothink` | `enable_thinking=false` injects a `</think>` opening the assistant turn, closing the block immediately, so the cost is 1 token |
| Qwen3 series | `<think>`, `</think>` | `enable_thinking=false` or a `/no_think` text token |
| GLM-4.5 | `/nothink` text token | `enable_thinking=false` appends `/nothink` to user messages |

Research summary (sources: arxiv 2412.21187, GLM-4 repo benchmarks, Qwen3 technical report):

| Task type | Thinking helps? | Evidence |
|---|---|---|
| Competition math (AIME, MATH-500) | ✅ Strongly | DeepSeek-R1: 79.8% vs V3: 39.2% on AIME 2024 |
| Competitive programming (Codeforces) | ✅ Strongly | R1 rating 2029 vs V3 1134 |
| PhD science (GPQA Diamond) | ✅ Moderately | R1: 71.5% vs V3: 59.1% |
| **Multi-turn tool calling (BFCL)** | ❌ Harmful | R1: **12.4%** vs V3: **35.8%**, thinking is 3x worse |
| **Agentic simulation (TAU-Bench)** | ❌ Harmful | R1: 33.0% vs V3: 60.7%, thinking model half as effective |
| **Agentic coding (opencode/Claude Code)** | ❌ Harmful | Overthinking on trivial decisions; same collapse as BFCL |
| Instruction following / format | ❌ Slightly worse | Thinking models score ~3pp below on IF-Eval |
| Simple boilerplate / CRUD | ❌ Not needed | Overhead only, no quality difference |

Thinking models generate exhaustive reasoning for trivial decisions because they have no calibration
for task difficulty (arxiv 2412.21187, "Do NOT Think That Much for 2+3=?"). In an agentic session
*"src/ is empty, what do I do?"* triggers the same extended reasoning loop as a hard math problem,
observed as a 3m 35s `<think>` block in the GLM-4.7-Flash evaluation (2026-06-19).

`model-use` resets `MLX_CHAT_TEMPLATE_ARGS` to empty for profiles that do not set it, which is
**not** the same as disabling thinking. A profile only suppresses thinking if it sets
`MLX_CHAT_TEMPLATE_ARGS = '{"enable_thinking": false}'` *and* its chat template honours the flag.
`qwen_template.jinja` has no `enable_thinking` branch, so `qwen3.8-27b-8bit` thinks on every turn
regardless of configuration. Measured cost on rig B (2026-08-26): a 2,488-token thinking turn raised
the next turn's prompt from 19,897 to 22,417 tokens. The whole block is fed back, so each reasoning
token is paid once at decode (~27 t/s) and again as prefill on every later turn.

Front-loading reasoning into the *plan* phase is worth it: one block, paid once, and it is what cut
the weather-cli run from ~34 min to 7m 33s. Reasoning inside the *implement* phase is not, it recurs
per tool call and matches the BFCL/TAU-Bench collapse. `AGENTS.md` rule 7 asks for short thinking
during implementation; a template-level toggle is the stronger fix if that is not enough.
GLM-4.7-Flash supports turn-level thinking control via `chat_template_kwargs`, so a later change
could enable thinking for heavy architecture turns only.

### KV cache and context limits

`opencode-init` writes a `limit.context` per model into `opencode.json`. Without it the model is
"unknown" and compaction never auto-triggers. Values are set **lower than native** so compaction
fires before the session grows unmanageable, and live in `profiles/<key>.toml` as
`MLX_OPENCODE_CONTEXT`.

| Profile | Native context | Declared | Auto-compact threshold | KV/token (8-bit) |
|---|---|---|---|---|
| qwen3.5-9b | **262k** | 128k | ~127k tokens | 64 KB |
| granite-4.1-8b | 128k | 128k | ~127k tokens | — |
| gemma-4-12b | **256k** | 64k¹ | ~60k tokens | 180 KB (hybrid window) |
| gemma-4-26b-a4b | **256k** | 64k | ~60k tokens (shared KV cache may allow more) | — |
| qwen3.5-27b-opus-distilled | **262k** | 32k | ~28k tokens (tight 6 GB KV budget) | — |
| glm-4.7-flash | 128-200k | 48k⁴ | ~40k tokens | 187 KB (no GQA) |
| qwen3.6-35b-a3b | **262k** | 96k | ~90k tokens | **20 KB** (measured 18.3 KB) |
| kat-coder-v2.5 | — | 64k | ~60k tokens | — |
| qwen3.8-27b-8bit | 262k | 131k | max output 8,192 | — |
| deepseek-v4-flash-3bit | 128k+ | 131k | max output 32,768 | — |

¹ Declared below native: 14B+ models have a larger KV footprint per token; 64k is safe for the cache
budget. Declared context *can* exceed native, because the KV cache is the real constraint and
`MLX_CACHE_SIZE` is the only setting that bounds it.
⁴ GLM-4.7-Flash OOM confirmed at 64k (2026-06-19): Metal
`kIOGPUCommandBufferCallbackErrorOutOfMemory` during prefill of a ~9k token prompt at ~27k session
context, 41% of 65k. The activation spike pushes peak VRAM above the 26 GB wired cap. Reduced to 48k
with a 6 GB KV cache. 128k is not reachable with a 16 GB model footprint.

> **`MLX_OPENCODE_OUTPUT` is a hard client-side cap**, not just compaction math. opencode sends it
> as `max_tokens`. 4096 is too small for a thinking model: it truncates mid-`<think>` and the turn
> ends with no tool call. Budget reasoning tokens *plus* the tool call.

> **Editing a profile is not enough.** `mise.local.toml` is written only by `mise run model-use`, so
> a profile edit stays inert until the profile is re-activated. `opencode-init` reads
> `profiles/<active-key>.toml` directly for this reason; `aider-init` still reads the mise env, so
> re-run `model-use` after editing a profile if you use aider.

> **Compaction loops:** declaring a context *too small* is as bad as too large. DeepSeek at 16k
> spent the session compacting instead of working; opencode's own system prompt and tool definitions
> eat several thousand tokens before your first message.

> **GPU memory budget formula:**
> ```
> GPU cap  =  model weights  +  KV cache held  +  ~5-6 GB activation buffer
>  26 GB   =     ~6 GB       +     14 GB       +       6 GB   (Qwen3.5-9B)
> ```
> Nothing in it is enforced by `MLX_CACHE_BYTES`, which is a no-op
> ([issue #11](https://github.com/navikt/mlx-workspace/issues/11)). The KV term is what the cached
> sessions actually hold, so the only lever is `MLX_CACHE_SIZE`, in slots. Leave headroom or the
> server OOMs.

### Speculative decoding (MTP)

Qwen 3.8 ships an MTP (multi-token prediction) drafter head as a separate `mtp.safetensors`. When
oMLX absorbs those weights into the model index it drafts several tokens per forward pass and
verifies them in one go. Measured on rig B (`mvid/Huihui-Qwen3.8-27B-abliterated-MTPLX-Q8`, oMLX):

| | Without MTP | With MTP |
|---|---|---|
| Decode speed | 11.3-14.3 t/s | 18-38 t/s (37.7 t/s peak on short prompts) |
| Tokens per forward cycle | 1.0 | 2.8-3.5 |
| Draft acceptance rate | — | 80-95% (depth 1-3) |

Short tool-call turns land at the top of the range; long `<think>` blocks at 21k+ context drop back
to ~11-18 t/s. The drafter is worth roughly 2-3x on the same weights, which is what makes a dense
27B competitive with a 284B MoE.

### Dynamic model switching

`mlx_lm.server` supports per-request model switching natively. Every request carries a `"model"`
field, and `ModelProvider.load()` compares it against the currently loaded model's key
(source: `mlx_lm/server.py`):

```python
# ModelProvider.load(), called on every request
model_key = (model_path, adapter_path, draft_model_path)
if self.model_key != model_key:
    self._load(*model_key)   # unload old, load new
```

`_load()` clears `model_key`, `model` and `tokenizer` first, so Python's GC releases the Metal
buffers before the new weights load. One server on port 8080 can serve models sequentially. The KV
prompt cache (`LRUPromptCache`) is owned by `ResponseGenerator`, not `ModelProvider`, and is never
cleared on switch; entries are keyed by `(model_key, token_sequence)`:

| Event | Model weights | KV prompt cache |
|---|---|---|
| Request with same model | In VRAM ✅ | Hit if tokens match ✅ |
| Switch to model B | Old freed, B loaded | Old entries **stay in LRU** (different key, ignored) |
| Switch back to model A | A reloaded | Old A entries **still in LRU**, warm restart if not evicted ✅ |
| LRU eviction | — | Oldest entries dropped when the cache hits `prompt_cache_size` |

A round trip is a warm restart if the LRU has not evicted the old entries. `MLX_CACHE_SIZE = "3"`
means only 3 cached sequences, so a round trip will likely evict them.

**VRAM peak during a switch** is `old_model_KV_cache (still held by LRU) + new_model_weights`,
because `_load()` does not clear the prompt cache first. For a 6 GB KV cache plus a new 16 GB model
plus 7 GB of OS, that is 29 GB: tight but within 32 GB. `MLX_CACHE_BYTES` does not trim at all,
because mlx-lm constructs `LRUPromptCache` without `max_bytes` (`server.py:1743`), so it stays at
`1 << 63` and the byte eviction at `cache.py:1733` never fires. The only byte enforcement left is an
opportunistic trim in the batch-add path, which wipes the whole cache when a single in-flight batch
exceeds the limit.

**Thinking mode is always a cold cache.** Toggling `enable_thinking` does not change the
`model_key`, which is `(model_path, adapter_path, draft_model_path)` only, but it changes the prompt
structure (`<think>` vs `</think>` prefix on the assistant turn), so token sequences never match.

Using it today means registering multiple model IDs in `opencode.json`, for example
`mlx-community/GLM-4.7-Flash-4bit` and `mlx-community/Qwen3.5-9B-4bit`, all pointing at
`http://localhost:8080/v1`, each with its own `limit`. Switch cost is ~30-60s reload, the same as a
server restart; the gain is no tmux wrangling and a surviving KV cache for a fast switchback.
**Not yet implemented in this workspace**: `opencode-init` writes a single model entry.

### Which levers actually matter

Ranked by measured effect, largest first. The first three all beat changing model.

1. **Prompt hygiene.** Removing the imported `AGENTS.md` and 38 global skills cut one task's input
   from 14,224 tokens to 5,687 and a median from 32.4s to 13.4s. Nothing else here is that large.
2. **Spec precision.** Naming the Met.no 403/429 distinction cut the plan phase from 7m 58s to
   **1m 23s**. Two sentences, roughly 6x on that phase.
3. **Output cap.** `MLX_OPENCODE_OUTPUT` at 4096 truncated runs mid-file with
   `finish_reason=length`. 16384 fixed it. A profile that still carries 4096 is a run waiting to die.
4. **Backend choice.** Gemma served by mlx-vlm cleared its cache every request: 43s median turn. On
   mlx-lm: 27s. Check `model_type` exactly, never by prefix.
5. **Sampling.** `top_k = 20` turned a repetition loop into a 23.4s plan on Qwen3.5-9B. Both Qwen
   profiles shipped with it disabled. Follow the model card.
6. **Thinking on/off.** Disabling it cut a one-word answer from 159 output tokens to 2, and about
   2.3x on the Qwen3.8-27B task set. It also deletes reasoning the model needed: the same run then
   reused a placeholder contact it had previously diagnosed as causing a 403.
7. **`AGENTS.md` rule 7.** Cut the median turn ~28% on the models that obey it. Qwen3.8-27B **4-bit
   ignores it**; the Q8 of the same model does not.
8. **Model choice.** Real, but smaller than the above and rarely the first thing to change.

---

## Harness findings

The benchmark has found more bugs in itself than in any model. Each is stated once here. How the
harness runs, verifies and quarantines is in [`BENCHMARKING.md`](BENCHMARKING.md).

### opencode drops output from some models

[Issue #10](https://github.com/navikt/mlx-workspace/issues/10), fixed in commit `9a2b324`. The
single most important finding from the cheap-operations round, and the cause was ours.

opencode reported zero tool calls and no reply text for Qwen3-Coder-30B-A3B (`qwen3_moe`) and
Granite 4.1 8B (`granite`) while the token counter showed the model generating output. Asked "What
is 7+5", Qwen3-Coder produced three output tokens and opencode displayed nothing. Both return
correct tool calls against the same running server directly, with proper `finish_reason: tool_calls`
and well-formed arguments.

**The cause was our own `AGENTS.md`.** It contained the literal think tags in rules 6 and 7, and the
last opening tag came after the last closing one. `mlx_lm/server.py:568-574` sets the initial
generation state by scanning the rendered prompt: if the last think-start is after the last
think-end, generation starts in reasoning state, everything the model emits goes to
`delta.reasoning` instead of `delta.content`, and opencode renders nothing.

Evidence was captured with a byte-level TCP tee between opencode and the server, then replayed with
curl. Same model, same prompt:

| Request body | Model output lands in |
|---|---|
| opencode's exact body | `{"reasoning": "12\n"}` |
| the same body with a one-sentence system prompt | `{"content": "12\n"}` |
| the same body with 1 tool instead of 10 | `reasoning` |
| the same body with no tools at all | `reasoning` |

Tool count is irrelevant; the system prompt is the trigger. The tool-count threshold reported
elsewhere for Qwen3-Coder, roughly five tools before it emits tool syntax as text, was ranked first
in our research review and is not what we were looking at. Verified directly against each tokenizer
with an unclosed think tag in the system prompt:

| Model | Template default | With `enable_thinking: false` |
|---|---|---|
| Qwen3.6-35B-A3B | reasoning | normal, the Qwen3 template emits an empty think pair whose closing tag lands after our stray opening one |
| Qwen3-Coder-30B | reasoning | reasoning, it is not a thinking model and its template emits no closing tag |
| Granite 4.1 8B | reasoning | reasoning, same position as Qwen3-Coder |

Every model behind the alpha decision has `enable_thinking: false` in its profile, so those results
were protected by accident. `check_prompt()` in `_sandbox.py` now refuses to launch on an unclosed
think tag, so the class of fault cannot recur silently.

**What this costs us.** Any result from this harness partly measures the harness rather than model
capability, so a model can look unusable here and be perfectly good. Granite was written up as
"never calls tools" on exactly this evidence, and that entry has been corrected. Treat a
zero-tool-call result as a harness result until the model has been checked directly.

### The server crashes, it does not degrade

[Issue #11](https://github.com/navikt/mlx-workspace/issues/11), open. Crash report
`~/Library/Logs/DiagnosticReports/python3.11-2026-08-28-003856.ips` is timestamped inside the minute
the DWQ run went dead: `EXC_BAD_ACCESS` (SIGBUS), `KERN_PROTECTION_FAILURE` on a stack guard page
immediately below a 16 MB thread stack, with `compile_dfs` frames from MLX's recursive graph walk,
on the generation thread. The logs agree: the first failing benchmark log ends with
`error APIError "Cannot connect to API: Unable to connect"`, the four logs after it are 909 bytes
each and contain only that error, and the log after the restart is 40 KB with 9 tool calls.
Connection refused, not bad output.

The likely mechanism, at medium confidence, is recursion depth in the prompt cache. Cache entries
are stored unevaluated (`cache.py:1080-1086`, `server.py:869-877`), and the one place the graph is
collapsed (`mx.eval` in `generate.py:1161-1170`) is skipped when a cache hit leaves a single token
to process, so depth grows with the number of high-hit requests. Confidence is high that this is a
crash rather than degradation, medium that the prompt cache is the specific accumulator, because the
crash backtrace is truncated. Kulman's M5 Pro account under
[What others report](#what-others-report) is independent evidence of the same class of failure.

Two related findings from the same read of the server: `--prompt-cache-bytes` is parsed and never
applied, so `MLX_CACHE_BYTES` does nothing and the real bound is `MLX_CACHE_SIZE`; and an exact
prompt cache hit indexes an empty list in `insert_segments` (`generate.py:1645-1646`), killing the
generation thread, so the server keeps accepting connections and never answers. Restarting the
server before every task is what removed this from the results, at the cost of a cold cache each
time.

### Prompt pollution

[Issue #12](https://github.com/navikt/mlx-workspace/issues/12), fixed. The benchmark was sending
37,807 characters of system prompt, most of it a nav-pilot exported `AGENTS.md` and 38 global skills
from the personal opencode config, none of it chosen by the benchmark. Runs now use
`opencode --pure` and `XDG_CONFIG_HOME=bench/opencode-home`, which cuts the system prompt to 11,191
characters and one task's input from 14,224 tokens to 5,687. Every result recorded before commit
`9a2b324` was measured through the polluted prompt and is quarantined with a `.POLLUTED` suffix.

### False passes

Compile and test checks certify that the repository is healthy, not that the model did the work, so
an untouched checkout passes both. Granite scored four false passes that way before every edit task
was made to require a non-empty `git status` first.

### The timeout parser artifact

A task killed at the cap never prints the summary line the parser reads, so turns and tool calls
default to zero. Granite's M1 and D3 are recorded as 420.0s with 0 turns and 0 tool calls; the D3
log shows a session in progress when the cap fired. Do not read those zeros as evidence of anything.
**Not yet fixed.**

### Closed and standing

- [Issue #4](https://github.com/navikt/mlx-workspace/issues/4) closed: sampling penalties reach the
  model through the generated `opencode.json`, because `mlx_lm` has no CLI flag for them.
- [Issue #5](https://github.com/navikt/mlx-workspace/issues/5) closed: three submissions graded,
  three found ungradeable.
- **No model downloads during a run.** Every task restart re-reads the weights from disk, so a
  concurrent download competes for the same disk and inflates every task.
  `results-qwen3.8-27b-4bit.DISKCONTENTION.json` is what that looks like.
- **Both benchmark tasks retry the server start.** A server launched while the previous one is
  releasing the port exits on the bind, and `server-wait` then blocks for its full timeout.

---

## What others report

External claims, labelled by what kind of evidence they are. None of it was measured by us.

| Claim | Kind | Source |
|---|---|---|
| MLX is about 1.8x llama.cpp at 4-bit. M4 Max 128 GB, Qwen3.5-35B-A3B: MLX Python 130 tok/s, MLX over HTTP 107, llama.cpp Q4_K_XL 71, Ollama 43-48 | measurement, same prompt across runtimes | [antekapetanovic.com](https://antekapetanovic.com/blog/qwen3.5-apple-silicon-benchmark/) |
| MLX loses about half its decode throughput at long context. M3 Ultra: 25 vs 32 tok/s at 30k, 5.95 vs 12.12 at 146k against llama.cpp | measurement | [ml-explore/mlx-lm#763](https://github.com/ml-explore/mlx-lm/issues/763), open |
| 6-bit MLX has real Metal kernels and measured faster than 8-bit | measurement by the PR author | [ml-explore/mlx#1613](https://github.com/ml-explore/mlx/pull/1613) |
| An M5 Pro 48 GB user hit Metal OOM crashes running Qwen3.6-27B 4-bit and Qwen3.6-35B-A3B 8-bit under mlx-lm, attributed to unbounded KV growth: "the system does not even detect memory pressure, it just crashes". Moved to Ollama for stability | first-hand account | [blog.kulman.sk](https://blog.kulman.sk/running-local-llm-coding-server/) |
| `mlx_lm.server` does not expose `--kv-bits`, `--quantized-kv-start` or `--max-kv-size`, so KV quantisation is unavailable on the HTTP server | open issues | [mlx-lm#1308](https://github.com/ml-explore/mlx-lm/issues/1308), [#615](https://github.com/ml-explore/mlx-lm/issues/615), [#1043](https://github.com/ml-explore/mlx-lm/issues/1043) |
| DWQ targets 2 to 4 bits, and distillation at 6 to 8 bit is explicitly discouraged. `--group-size 32` beats 64 | documentation | mlx-lm `LEARNED_QUANTS.md` |
| opencode does not get prompt caching against an MLX server; issue closed not planned | issue | [opencode#21419](https://github.com/sst/opencode/issues/21419) |
| `--prompt-cache-dir` would persist the LRU across restarts | open PR | [ml-explore/mlx-lm#1405](https://github.com/ml-explore/mlx-lm/pull/1405) |

**No trustworthy public tok/s number exists for M4 Pro or M5 Pro on our two models.** The aggregator
sites that carry such numbers are AI-generated pages with no reproducible method.

### What another Nav team runs, and what it is not

Audun Sorheim's team: llama.cpp, Unsloth GGUF Q6_K_XL of Qwen3.8-27B, M4 Pro 48 GB, about 10 tok/s,
28 to 30 GB resident, 65k context split 57k input and 8k output, medium reasoning preserved. They
report good code quality, long task times, and run it as background work. They also hit cplt sandbox
limits and fixed it by adding hints to the agent instructions, and they built a focused mode that
loads only essential skills because the context budget is far below cloud Copilot.

Our `qwen3.8-27b-6bit` profile does not reproduce that: different runtime, different quantization,
different hardware. It is an MLX 6-bit result and nothing more. Their 28 to 30 GB figure is the first
evidence that a 27B at 6 to 8 bits fits the 48 GB target at all, which is why
`mlx-community/Qwen3.8-27B-8bit` at 29.5 GB is now queued.

---

## Open questions and what to test next

### The MLX 6-bit result is not yet explained

Three candidate causes, one ruled out:

- **Not a missing kernel.** MLX PR [ml-explore/mlx#1613](https://github.com/ml-explore/mlx/pull/1613)
  added real Metal kernels for 3 and 6 bit, and the author measured 6-bit as faster than 8-bit. No
  mlx or mlx-lm issue matches a 50x slowdown.
- **The profile changed two variables at once.** It is the only profile with thinking left on, and
  thinking measured about 2.3x on this model family. A thinking-off control on the same weights is
  queued.
- **Our instrument may not see the tokens that explain the time.** mlx-lm routes thinking output
  into the `reasoning` field, the same field behind issue #10, and opencode reports `reasoning: 0`.
  A model generating thousands of reasoning tokens would look to us like a model generating almost
  nothing very slowly.

### Queued

Thinking-off control on the 6-bit weights first, then three builds sized for the 48 GB target:
`Qwen3.6-27B-4bit` at 16.1 GB, `Qwen3.6-35B-A3B-OptiQ-4bit` at 24.7 GB and `Qwen3.8-27B-8bit` at
29.5 GB. `Qwen3.6-35B-A3B-8bit` is excluded at 37.7 GB because it does not fit. The full config
backlog is in [Scheduled re-tests](#scheduled-re-tests).

`mlx-community/gemma-4-26b-a4b-it-4bit` has a profile and has never been run, and it is the highest
priority of the untested. Gemma 4 26B MoE, Apache 2.0, 26B total / ~3.8-4B active, ~14 GB VRAM, 256k
native declared to ~64k, multimodal. It pairs a **shared KV cache**, where the final attention
layers reuse KV from earlier layers, with **dual RoPE** against long-range quality collapse, so it
should give more effective context per GB than any other ~14 GB model. Published benchmarks: MMLU
Pro 82.6%, AIME 2026 88.3%, LiveCodeBench v6 77.1%. It needs mlx-vlm, so its per-request cache clear
has to be measured before any turn time from it is comparable.

### How far these results can be trusted

The readable version of this table, with per-claim confidence levels written out, is published as
[`reports/48gb-question.md`](reports/48gb-question.md).

| Claim | Confidence | Why |
|---|---|---|
| Both 4-bit builds fit a 48 GB Pro | **high** | Measured peak RSS across full runs under the cap, at ~half the ceiling. Capacity transfers between machines |
| Attention architecture, not size, drives KV cost | **high** | Consistent across four architectures from 9B to 284B, with a mechanistic explanation |
| Harness levers beat model choice | **high** | Six independent levers, large effects; the largest single change this session was to our own prompt |
| Qwen3.6-35B-A3B is the right alpha model | **medium** | Two clean eleven-task runs against a coder-tuned model of the same architecture agree task by task. Still one run each |
| Qwen3.6-35B-A3B is ~5x faster than the dense 27B | medium | One run each, and the two are not like-for-like (thinking on vs off). The gap is too large to be noise; the magnitude is one sample |
| Qwen3.8-27B 4-bit writes better code | **low** | 8.5 vs 6.8, one run each, one unaudited reviewer, and both scores predate the prompt fix. That margin sits inside plausible run-to-run spread |
| The MLX 6-bit slowdown is a model property | **low** | Two variables changed at once and the instrument may not see reasoning tokens |
| Anything about a real 48 GB Pro's speed | **untested** | The wired cap reproduces the ceiling, not the halved bandwidth. Expect roughly half these speeds |
| Any timing under [Superseded results](#superseded-results) | **superseded** | Measured with 8.5k tokens of instructions the benchmark did not choose. The one re-measured task set moved from a 32.4s median to 13.4s |

**Every run is n = 1.** Single samples of a stochastic process at temperature 0.6, no repeats, no
variance estimate. Wall-clock gaps of 5x survive that; a 1.7-point code-score gap does not.

**Both headline weather-cli runs used sampling we now believe is wrong.** Each ran with
`MLX_TOP_K = 0` and `MLX_TOP_P = 1.0`, against the model card's `top_k 20` / `top_p 0.95`, the exact
setting whose absence turned Qwen3.5-9B's run into a repetition loop. Re-running Qwen3.6 three times
with corrected sampling closes the n=1 gap and the sampling gap together, in about half an hour.

**Two workloads, and only one of them is the target.** Cheap operations is eleven short tasks in one
Kotlin repository; weather-cli is one CLI against two HTTP APIs. Nothing here licenses a claim about
refactoring at scale, debugging, or anything stateful.

**`reports/alpha-model-decision.md` still quotes the polluted 32.4s median and 5 of 7 verified.**
The clean numbers are 13.4s and 4 of 8. The decision does not change; the report needs the update.

---

## Archive: pre-2026 models

Models released in 2025 or earlier, kept for provenance and not candidates. We are not carrying them
forward into further testing: the field moves faster than a run costs, so the runs go to current
weights. Nothing here is a verdict on a current model.

| Model | Released | What happened | Why it is out |
|---|---|---|---|
| `mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit` | Jul 2025 | MoE 30.5B total / ~3.3B active, 128 experts with 8 active, ~16 GB VRAM, 256k native (YaRN-extendable to 1M), ~9 GB rig A headroom, 24 KB/token KV, 64k declared. Slow on rig A with inconsistent tool calling. On rig B opencode surfaced nothing at all | Dropped on age, not on capability. **Its empty output was our own prompt bug, not the model**: it returns correct tool calls directly and works through opencode since `9a2b324`. That correction is why the harness is trusted now |
| `mlx-community/Ministral-3-14B-Instruct-2512-4bit` | Dec 2025 | Dense 14B (13.5B language + 0.4B vision), ~8.5 GB VRAM, 256k native declared to 64k, 100 KB/token KV. Cold prefill ~150 t/s, 2.83 GB cache after turn 1, then failed after 2 turns | Two fundamental faults, neither config-tunable |
| `mlx-community/GLM-4.6V-Flash-9B-4bit` | Dec 2025 | MoE hybrid, 9B active, ~5.5 GB VRAM plus vision encoder, 128k native and declared. Never run | `glm4v` forces mlx-vlm and its per-request cache clear, which confines it to short sessions |
| `mlx-community/Qwen2.5-Coder-14B-Instruct-4bit` | Nov 2024 | Dense 14B, ~9 GB VRAM on rig A / 7.8 GB on rig B, 32k native, 64k declared, 96 KB/token KV. Frequent malformed tool-call JSON | Superseded by Qwen3.5-9B on every dimension |
| `mlx-community/Qwen2.5-Coder-32B-Instruct-4bit` | Nov 2024 | Dense 32B, ~19 GB VRAM, 32k native, 16k declared, 128 KB/token KV. Crashed with `kIOGPUCommandBufferCallbackErrorOutOfMemory`: after model plus a 4 GB KV cache only ~3 GB was left for activations | Inconclusive, never evaluated for quality. May work on 64 GB |
| `mlx-community/Qwen2.5-Coder-7B-Instruct-4bit` | Nov 2024 | Dense 7B, ~4.5 GB VRAM, 32k native. Never tested | Known Qwen2.5-7B tool calling issues; focus moved to Qwen3.x |
| `mlx-community/Qwen2.5-72B-Instruct-8bit` | Sep 2024 | Dense 72B, ~72 GB footprint at `gpu_wired_limit_gb = 115`, 128k declared. Answers well in chat; in opencode and aider it prints markdown code blocks instead of emitting tool calls. `workspaces/qwen2.5-72b-8bit/weather-cli/` holds `package.json` and `src/{index,parser,geocode,weather,output}.js`, all six **0 bytes** | Broken for tool calling. Strict-JSON prompting did not fix it. 72 GB spent on a chat model |
| `mlx-community/Mistral-Large-2-4bit` | Jul 2024 | Dense 123B, ~69 GB. Downloaded, never run | Age |

Ministral's chat template is the one finding worth carrying: its `chat_template.jinja` raises an
exception when roles do not follow strict `user→assistant→user→assistant` alternation, because the
template's parity counter does not reset after tool-call rounds, and mlx-lm returns HTTP 404 for any
exception during generation. `chat_templates/ministral-3-14b-patched.jinja` removes the one-line
`raise_exception`, which is safe because `ns.index` is provably unused after the check block;
`--use-default-chat-template` is a no-op here, it only activates when no template exists. Patched,
the model then generated fake YAML listing invented chat template file paths, most likely because
the template's default system message contains a literal `{today}` string rather than a Jinja2
`{{ today }}` expression. The `chat_templates/` infrastructure built for it is reusable.

---

## Standard benchmark prompts

Use these two prompts verbatim for every weather-cli run so runs are comparable. Both are issued
inside `workspaces/<model-key>/` (see `mise run opencode`), where `weather-cli/WEATHER_CLI_SPEC.md`
and `AGENTS.md` are provisioned.

**1. Plan prompt**

> Read the weather-cli/WEATHER_CLI_SPEC.md and make a short and concrete implementation plan make
> sure you have a good understanding about the external services and their data strucure for input /
> output data. Check the external apis do not assume the data model

**2. Implementation prompt**

> Lets start implementing, check your work and ensure tests and the final cli works according to the
> supplied specification

The "check the external apis do not assume the data model" clause was added after observing models
invent the Met.no and Geonorge response shapes and then spend the majority of the run repairing that
guess. It moves the cost into the plan phase, ~3m 12s for Qwen3.8-27B MTPLX, and makes
implementation more direct.

---

## Code review rubric

Wall-clock and a passing test count say nothing about what the model wrote. A model can pass every
test with code that silently prints `undefined°C` on a partial API payload. This rubric exists so
every submission is judged against the same questions, by the same scale.

**Process.** Functional verification comes first and is done by hand, not by the model's self-report:
run `npm test`, run the live suite, check the output line count, check every exit code without a pipe
(`$?` after a pipeline is the last command's status, not the program's). Only then hand the workspace
to a read-only review agent along with this rubric. The reviewer never runs the tests. It judges what
tests cannot.

**Dimensions.** Each scored 1-10, then averaged with these weights:

| Dimension | Weight | The question |
|---|---|---|
| Correctness risks | 30% | What breaks that the tests do not cover? Every finding must name the input that triggers it |
| Error handling | 20% | Are network errors, non-2xx, malformed payloads and empty data explicit and actionable, or do they reach a stack trace, or worse, exit 0 with garbage? |
| Structure | 20% | Is the module split meaningful or cosmetic? Is the entry point thin? Is anything abstracted with one caller? |
| Test quality | 20% | Real assertions at a sensible mock boundary, or trivia that cannot fail? Are the spec's exact boundary values pinned? |
| Idiom and readability | 10% | Naming, dead code, copy-paste; do comments explain *why* or restate the code? |

**Fixed trap checklist.** Every reviewer checks these, because they are where one-shot code actually
fails on this spec. Report each as avoided or hit:

1. Timezone: Met.no timestamps carry `Z`; is "closest to now" compared in UTC?
2. Sorted-input assumption: is the timeseries scanned, or is `series[0]` trusted?
3. Cloud-cover thresholds: the spec uses strict `>`. Check the exact boundary values (25 / 50 / 75), not values near them
4. Coordinate order: Geonorge GeoJSON is `[lon, lat]`; `representasjonspunkt` is `nord`/`øst`
5. Missing fields: does `?? 0` / `?? {}` fabricate a confident answer from an incomplete payload?
6. Injection: is user input validated before URL interpolation, and are place names encoded?
7. Float comparison and latitude/longitude range validation at the exact bounds (±90 / ±180)

**Grading discipline.** Judge the submission as a one-shot from a local quantized model, not against
a production codebase. Separate "real bug" from "stylistic preference" explicitly, and state plainly
where the code is genuinely good. A review that only lists complaints is not usable evidence. If
there are no real bugs, say so rather than inventing some. `axios` is required by
`WEATHER_CLI_SPEC.md`, so its presence is compliance and must not be counted against a model;
anything *beyond* the spec's dependency list (e.g. jest, where the spec names test files but no
framework) is a genuine finding.

---

## Scheduled re-tests

Config capability added after these models were measured. Each is a plausible gain that the recorded
numbers do **not** include. Nothing here invalidates a recorded result: every number stands for the
config it was measured with. These are upside tests, not corrections.

| Model | Change to test | Expected effect | Priority |
|---|---|---|---|
| `qwen3.8-27b-6bit` | thinking **disabled** on the same weights | The only way to separate the 50x slowdown from the one variable the profile changed alongside quantization | **high**, blocks the 48 GB queue |
| `qwen3.6-35b-a3b` | thinking **enabled** (drop the profile's `enable_thinking: false`) | The only way to separate "MoE is fast" from "no reasoning tokens is fast". Also tests whether its two silent-wrong-answer paths survive deliberation | **high**, the headline result rests on this being config, not model |
| `qwen3.8-27b-4bit` | `MLX_CHAT_TEMPLATE_ARGS = '{"enable_thinking": false}'` | Its rule 7 violation and 4-minute User-Agent stall are both thinking-phase costs. Qwen3.6 with thinking off ran 5x faster | **high**, cheapest experiment with the largest predicted payoff |
| `glm-4.7-flash`, `qwen3.5-27b-opus-distilled` | `MLX_PREFILL_STEP_SIZE` (lower) | Both were failed as **OOM during prefill**. A smaller prefill batch shrinks exactly that spike and may make them viable | **high**, could overturn two ❌ verdicts |
| `gemma-4-31b-8bit` | `MLX_DRAFT_MODEL` (mlx-lm speculative decoding), paired with a small Gemma 4 | 1.5-3x decode, the same lever MTP gives Qwen3.8 | **high**, the slowest model with no drafter |
| `qwen3.5-9b`, `qwen3.6-35b-a3b` (rig A) | `MLX_TOP_K = 20`, `MLX_MIN_P` per Qwen model card | Output quality and stability, not speed | medium |
| `qwen3.6-35b-a3b`, `qwen3.5-9b` | raise `MLX_CACHE_SIZE` above the rig-A slot count | Both are rig-A tuned for a 26 GB cap and Qwen3.6 overshot to 4.70 GB at 36 GB with no visible thrash, so there is headroom the profiles never knew about. This was written as raising `MLX_CACHE_BYTES`, which cannot do anything, so slots are the only knob that reaches the headroom | medium |
| `qwen3.8-27b-8bit`, `deepseek-v4-flash-3bit` | oMLX `--memory-guard`, `--hot-cache-max-size` | Cache and OOM behaviour; both ran entirely on defaults | low |

---

## Testing checklist

Standing rules first, because they are what the benchmark learned the hard way:

- **Verify the model's claims before clearing anything.** Run `npm test` yourself. Check exit codes
  without a pipe. `$?` after a pipeline is the last command's status, not the program's.
- **A passing test count is only as good as its weakest test.** One submission wrapped eight
  assertions in a `try`/`catch` meant for network errors; Node's `assert` throws, so the catch
  swallowed them. 20/20 was really 19 that could fail and one that could not.
- **Check the workspace is empty before a run.** Two of three workspaces used in one session held a
  previous run's implementation. A model that finds working code in place is not being measured.
- **Sandbox the run.** Models escape: one listed every sibling workspace's solution, another tried
  to `npm install -g` and `brew tap` a package it had invented. `mise run opencode` launches under
  `cplt`.
- **Grade code against the [rubric](#code-review-rubric), not impressions.** Speed and quality came
  apart in both directions: the slowest model wrote the best code, the fastest wrote the worst.
- **A zero-tool-call result is a harness result** until the model has been checked directly against
  the server.

When evaluating a new model (`mise run model-download <key>`, `mise run model-use <key>`, then
`mise run server`):

- [ ] `mise run chat`: basic back-and-forth, instruction following
- [ ] `mise run aider`: can it edit files correctly and commit?
- [ ] `mise run opencode`: tool calling (read/write/run), multi-step tasks; runs in `workspaces/<key>/`
- [ ] **Cheap operations**: `mise run bench-cheap-ops`, record median, verified count, zero-tool tasks
- [ ] **weather-cli challenge**: run both [standard prompts](#standard-benchmark-prompts), record plan time, implement time, tests passing
- [ ] Does it actually write files, or only print code into the chat?
- [ ] Context size: does it handle a large file without truncating?
- [ ] Code correctness: does generated code run without edits?
- [ ] Tool calling stability: completes tool calls without looping or malformed JSON?
- [ ] OOM check: monitor server logs for Metal OOM errors at larger context lengths
