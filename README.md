# mlx-workspace

Run LLMs locally on Apple Silicon with [MLX](https://github.com/ml-explore/mlx), point AI coding
tools at the local server, and measure what they can actually do. No cloud calls.

The measuring is the point. This workspace exists to answer one question for the nav-pilot alpha:
which local model is good enough to absorb the routine coding operations that otherwise burn a
Copilot premium request each.

## The decision

Ship one model: **`mlx-community/Qwen3.6-35B-A3B-OptiQ-4bit`** under mlx-lm, thinking disabled,
with `Qwen3.8-27B` held back because it hangs. The reasoning, the rejected candidates and how
far the numbers can be trusted are in
[reports/alpha-model-decision.md](reports/alpha-model-decision.md), which is the authority; this
paragraph is a pointer and should stay one sentence long so the two cannot drift apart.

## Where things are

| | Holds | Expect |
|---|---|---|
| [`reports/`](reports/README.md) | Finished write-ups | Reproducible, dated, safe to link from outside |
| [`working/`](working/) | Plans and trackers in progress | To change under you. Do not link from outside |
| [`runbooks/`](runbooks/) | Operational guides | To be read by someone on call, in a hurry |
| [`archive/`](archive/) | Superseded documents | To be wrong. Kept so we do not repeat ourselves |
| [`MODELS.md`](MODELS.md) | The append-only run log | To grow, never to be edited in place |
| [`BENCHMARKING.md`](BENCHMARKING.md) | How the harnesses work | To explain the bug behind each rule |
| [`bench/`](bench/) | Harnesses, targets, specs and raw result JSON | |
| [`workspaces/`](workspaces/README.md) | Benchmark checkouts, almost all gitignored | `git status` noise here to be a run, not a break |
| [`profiles/`](profiles/) | One file per model build | |
| [`AGENTS.md`](AGENTS.md) | Rules for agents working **on** this repo | Each one to cost a night if ignored |
| `manifest/` | `models.json`, generated from `profiles/` **for nav-pilot to fetch** | To be an external interface: do not restructure |

Naming: SHOUTING.md only at the root, and only for manuals covering the whole repo. Everything
inside a directory is kebab-case. A date suffix means the file is a snapshot of one day and
will not be updated.

## How it fits together

MLX loads model weights into RAM, `mlx_lm.server` exposes them over HTTP on `:8080`, and any
OpenAI-compatible client talks to that.

| Component | Role |
|---|---|
| Model | The LLM weights, which set capability and RAM usage |
| MLX / mlx-lm | Runs the model on the unified CPU/GPU/ANE of Apple Silicon |
| mlx_lm.server | Bridges the model to the OpenAI API format |
| mlx_lm.chat | Chat with the model, no server needed |
| opencode | AI coding agent with TUI, configured via `opencode.json` |
| aider | AI assistant that edits files, runs tests, and commits |
| Copilot CLI | GitHub Copilot routed to the local server instead of the cloud |

## Prerequisites

- Apple Silicon Mac. Tested on a 32 GB M1 Max and a 128 GB M5 Max, see [MODELS.md](MODELS.md)
- [mise](https://mise.jdx.dev) (`brew install mise`)
- `cplt` (`brew install cplt`), sandboxes every model client. Without it, runs continue
  unsandboxed with a warning
- Python 3.12 for aider (`brew install python@3.12`)
- `gh` CLI for the Copilot task (`brew install gh`)
- [rtk](https://github.com/rtk-ai/rtk) (`brew install rtk-ai/tap/rtk`), optional, compresses shell
  output 60 to 90% before it reaches the model context

## Setup

```bash
mise run setup                    # venv, mlx, mlx-lm, aider via pipx
mise run model-use qwen3.6-35b-a3b
mise run model-download qwen3.6-35b-a3b
mise run vram-set 26              # only if model-use warns the wired limit is wrong
```

For rtk, run `rtk init -g --opencode` once, then add
`"plugin": ["~/.config/opencode/plugins/rtk.ts"]` to `~/.config/opencode/opencode.json`. opencode
does not auto-discover plugins from that directory.

## Usage

```bash
mise run server        # OpenAI-compatible API at http://localhost:8080/v1
mise run server-wait   # blocks until the model answers, not just until the port binds
```

Then, in a second terminal:

```bash
mise run opencode   # opencode AI coding agent, sandboxed, in workspaces/<model-key>/
mise run aider      # aider pair programmer
mise run copilot    # GitHub Copilot CLI
mise run chat       # interactive chat, no server needed
mise run run        # single prompt, prints and exits
```

Benchmarks, all documented in [BENCHMARKING.md](BENCHMARKING.md):

```bash
mise run bench-cheap-ops     # eleven routine operations in a real Kotlin service
mise run bench-weather-cli   # build a Node CLI from scratch, then npm test it
mise run cache-probe         # prompt cache reuse across turns sharing a growing prefix
```

## Switching models

```bash
mise run model-list      # profiles, status, download state
mise run model-use <key> # activate one
mise run model-status    # what is active, and whether the server matches
mise run models-clean    # interactive picker to delete downloaded weights
```

A profile is `profiles/<key>.toml`: a `[meta]` block and a `[params]` block of `MLX_*` variables.
`model-use` writes them into `mise.local.toml`, which overrides the fallback in `mise.toml`, and
regenerates `opencode.json` and `.aider.conf.yml`. Never edit those two by hand. `model-use` exits
non-zero on an invalid profile, and every benchmark keys its results by the active profile, so
scripts must use `model-use <key> || exit 1`.

`mise run model-manifest` generates `manifest/models.json` from the profiles, which is the file
nav-pilot fetches to configure a user's machine.

## Unlocking more VRAM

CPU and GPU share one pool of RAM, and macOS caps the GPU at roughly 70 to 75% of it. Override the
cap at runtime, no reboot needed, and it resets on reboot:

```bash
mise run vram-status   # current limit
mise run vram-set 26   # set a GB value
mise run vram-reset    # restore the macOS default
```

Each profile carries its own ceiling as `gpu_wired_limit_gb`, and `model-use` warns when the current
limit does not match. Leave at least 4 to 6 GB for macOS: allocating too much causes hard lockups
and forced reboots.

Budget the cap as `model weights + KV cache held + ~6 GB activation buffer`. At 50k-token contexts
the forward pass alone needs 4 to 6 GB for intermediate activations and Metal command buffers, on
top of the cached KV state, and each cached session at ~80k tokens holds ~3 GB. If the server
crashes with `Insufficient Memory` or `kIOGPUCommandBufferCallbackErrorOutOfMemory`, lower
`MLX_CACHE_SIZE` to cap how many sessions accumulate. `MLX_CACHE_BYTES` will not help: mlx-lm builds
its prompt cache without a byte limit, so the setting is a no-op and cache slots are the only bound.

On macOS Ventura and older the sysctl key is `debug.iogpu.wired_limit` and takes bytes. The mise
tasks use the Sonoma+ key, `iogpu.wired_limit_mb`.

## Context and compaction

opencode compacts a session by feeding the full history back to the model for summarization, which
costs about 5s on a cloud model and 2 to 3 minutes on a local 9B. Auto-compaction only fires when
`model.limit.context` is non-zero, and models served by `mlx_lm.server` are not in opencode's
registry, so `opencode-init` declares the limit itself from `MLX_OPENCODE_CONTEXT` and
`MLX_OPENCODE_OUTPUT`. Compaction fires at the difference between the two. Per-profile values and
the reasoning are in [MODELS.md](MODELS.md#kv-cache-and-context-limits).
