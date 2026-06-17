# mlx-workspace

Run LLMs locally on Apple Silicon with [MLX](https://github.com/ml-explore/mlx), and wire up AI coding tools to your local server — no cloud calls.

## How it fits together

```
┌─────────────────────────────────────────────────────┐
│  Model weights  (downloaded from HuggingFace)       │
│  e.g. mlx-community/Qwen3-Coder-30B-A3B-4bit        │
└───────────────────┬─────────────────────────────────┘
                    │ loaded into RAM by
                    ▼
┌─────────────────────────────────────────────────────┐
│  MLX  —  Apple's ML framework, runs inference on    │
│  the unified CPU/GPU/ANE of Apple Silicon.          │
│  mlx-lm wraps it with LLM-specific utilities.       │
└───────────────────┬─────────────────────────────────┘
                    │ exposed as
                    ▼
┌─────────────────────────────────────────────────────┐
│  mlx_lm.server  —  local HTTP server on :8080       │
│  speaks the OpenAI API, so any OpenAI-compatible    │
│  client can talk to it.                             │
└──────────┬──────────────┬──────────────┬────────────┘
           │              │              │
           ▼              ▼              ▼
   ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐
   │  aider      │ │  opencode   │ │  Copilot CLI     │
   │  AI pair    │ │  AI coding  │ │  GitHub Copilot  │
   │  programmer │ │  agent (TUI)│ │  in the terminal │
   └─────────────┘ └─────────────┘ └──────────────────┘
```

| Component | Role |
|---|---|
| **Model** | The LLM weights — determines capability and RAM usage |
| **MLX / mlx-lm** | Runs the model efficiently on Apple Silicon hardware |
| **mlx_lm.server** | Bridges the model to the OpenAI API format |
| **mlx_lm.chat** | Lightweight interactive chat directly with the model |
| **aider** | Code-aware AI assistant — edits files, runs tests, commits |
| **opencode** | AI coding agent with TUI, configured via `opencode.json` |
| **Copilot CLI** | GitHub Copilot routed to the local server instead of the cloud |

## Prerequisites

- Apple Silicon Mac (M1/M2/M3/M4)
- [mise](https://mise.jdx.dev) (`brew install mise`)
- Python 3.12 for aider (`brew install python@3.12`)
- `gh` CLI for the Copilot task (`brew install gh`)

## Setup

```bash
mise run setup
```

Installs `mlx` and `mlx-lm` into a local `.venv`, and `aider-chat` via pipx.

## Usage

### 1. Start the local model server

```bash
mise run server
```

Serves an OpenAI-compatible API at `http://localhost:8080/v1`.

### 2. Code with AI tools (new terminal)

```bash
mise run aider      # aider pair programmer
mise run opencode   # opencode AI coding agent
mise run copilot    # GitHub Copilot CLI
```

### One-off inference / chat

```bash
mise run chat   # interactive chat with the model (no server needed)
mise run run    # single prompt, prints and exits
```

### Model management

```bash
mise run models-list                                               # show downloaded models and sizes
mise run models-clean                                             # interactive picker to delete a model
mise run models-clean mlx-community/Qwen2.5-Coder-32B-Instruct-4bit  # delete by name directly
```

## Configuration

**One place to change the model:** `MLX_MODEL` in `mise.toml`.

```toml
MLX_MODEL = "mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit"
```

Every mise task reads this automatically:

- `server`, `chat`, `run` pass it straight to mlx-lm.
- `aider` and `copilot` point at the local server using `$MLX_MODEL`.
- `opencode` regenerates `opencode.json` from `$MLX_MODEL` on each launch (via `opencode-init`) — no manual edits needed.

Only `.aider.conf.yml` has a hardcoded model name, used if you run `aider` directly without mise. Update it there to match.

Popular options from [mlx-community](https://huggingface.co/mlx-community):

- `mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit` (~14GB RAM) ← default
- `mlx-community/Qwen2.5-Coder-14B-Instruct-4bit` (~14GB RAM)
- `mlx-community/Qwen2.5-Coder-32B-Instruct-4bit` (~32GB RAM)

## Unlocking more VRAM (Apple Silicon)

Apple Silicon uses unified memory — CPU and GPU share the same physical RAM. macOS caps GPU memory at ~70–75% of total RAM by default to keep the OS stable. On a 32GB Mac that means ~22–24GB available for models.

You can override this limit at runtime (no reboot required):

```bash
mise run vram-status        # check current limit
mise run vram-set           # set to 26GB (recommended default for 32GB Macs)
mise run vram-set 28        # set a custom GB value
mise run vram-reset         # restore macOS default
```

**Quick reference for 32GB Macs:**

| GPU allocation | OS headroom | Command |
|---|---|---|
| 24 GB | 8 GB (safe default) | `mise run vram-set 24` |
| 26 GB | 6 GB (recommended) | `mise run vram-set 26` |
| 28 GB | 4 GB (risky) | `mise run vram-set 28` |

> ⚠️ **Risks:** Allocating too much causes hard lockups, beachballs, or forced reboots. Always leave at least 4–6 GB for macOS. The setting resets on reboot.

> **macOS Ventura and older:** the sysctl key is `debug.iogpu.wired_limit` and takes bytes instead of MB — the mise tasks use the Sonoma+ key (`iogpu.wired_limit_mb`).
