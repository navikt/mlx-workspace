# Model Evaluation Notes

Observations from running models locally via `mlx_lm` on Apple Silicon (32GB Mac).
Focus going forward is **Qwen3.x** — Qwen2.5 variants are largely superseded.
Set the active model in `mise.toml`.

> **Note on sizes:** *Disk size* (from `mise run models-list`) and *VRAM footprint* are different.
> Disk includes tokenizer, configs, and bfloat16 safetensors. VRAM is the actual loaded inference footprint.

## How to switch models

```bash
# 1. Edit MLX_MODEL (and the matching params) in mise.toml
# 2. Start the server
mise run server

# 3. Check what's already downloaded
mise run models-list
```

---

## Quick comparison

| Model | Gen | VRAM | Headroom¹ | Speed | Tool calling | Status |
|---|---|---|---|---|---|---|
| Qwen2.5-Coder-7B-4bit | 2.5 | ~4.5 GB | ~20 GB | ⚡⚡⚡⚡ | ⚠️ loops | ⬛ skipped |
| **Qwen3.5-9B-MLX-4bit** ⭐ | 3.5 | ~6 GB | ~19 GB | ⚡⚡⚡ | ✅ strong | ✅ daily driver |
| Qwen2.5-Coder-14B-4bit | 2.5 | ~9 GB | ~16 GB | ⚡⚡ | ❌ malformed JSON | ⚠️ not viable for agents |
| Qwen3-Coder-30B-A3B-4bit | 3 | ~16 GB | ~9 GB | ⚡ | ⚠️ inconsistent | ⚠️ too slow in practice |
| Qwen2.5-Coder-32B-4bit | 2.5 | ~19 GB | ~6 GB | ⚡ | — | ❌ OOM crash — inconclusive |

¹ Headroom = 32GB − VRAM − ~7GB OS reserve

## Recommended server parameters

Switch model by uncommenting the right block in `mise.toml` `[env]`:

```toml
# Qwen3.5-9B — default, best balance
MLX_MODEL       = "mlx-community/Qwen3.5-9B-MLX-4bit"
MLX_CACHE_BYTES = "8589934592"   # 8 GB — model ~6GB VRAM, ~10GB headroom for cache
MLX_CACHE_SIZE  = "5"            # 5 concurrent conversation caches
MLX_MAX_TOKENS  = "8192"

# Qwen2.5-Coder-14B — reliable fallback
MLX_MODEL       = "mlx-community/Qwen2.5-Coder-14B-Instruct-4bit"
MLX_CACHE_BYTES = "9663676416"   # 9 GB — model ~9GB VRAM, ~8GB headroom
MLX_CACHE_SIZE  = "5"
MLX_MAX_TOKENS  = "8192"

# Qwen3-Coder-30B-A3B — tight RAM, watch for OOM
MLX_MODEL       = "mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit"
MLX_CACHE_BYTES = "6442450944"   # 6 GB — model ~16GB VRAM, only ~9GB headroom
MLX_CACHE_SIZE  = "4"
MLX_MAX_TOKENS  = "4096"         # lower to reduce peak memory during generation

# Qwen2.5-Coder-32B — run `mise run vram-set 26` first!
MLX_MODEL       = "mlx-community/Qwen2.5-Coder-32B-Instruct-4bit"
MLX_CACHE_BYTES = "4294967296"   # 4 GB — model ~19GB VRAM, critically low headroom
MLX_CACHE_SIZE  = "3"
MLX_MAX_TOKENS  = "4096"
```

## opencode declared context limits

`opencode-init` writes a `limit.context` for each model into `opencode.json`. This is what opencode uses to decide when to compact — without it the model is "unknown" and compaction never auto-triggers.

The values are set **lower than actual** so that compaction fires early (small history = fast local summarization):

| Model | Actual context | Declared to opencode | Auto-compact threshold |
|---|---|---|---|
| Qwen3.5-9B | 32k | **24k** | ~16k tokens |
| Qwen2.5-14B | 32k | **24k** | ~16k tokens |
| Qwen3-30B-A3B | 32k | **20k** | ~12k tokens (tight RAM — lower is safer) |
| Qwen2.5-32B | 32k | **16k** | ~8k tokens (critically low RAM — compact aggressively) |

> **Why not use the real 32k limit?**  
> At 32k tokens, compaction feeds ~32k tokens back to the model for summarization. On a 9B local model that takes 2–3 minutes. At 16–24k it's ~30 seconds. The tradeoff is more frequent compactions that each complete quickly, vs. infrequent compactions that stall everything.

To update the declared context for a model, edit `MLX_OPENCODE_CONTEXT` in the model's block in `mise.toml`.

---

## Models

### `mlx-community/Qwen3.5-9B-MLX-4bit` ⭐ current

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 9B |
| **VRAM footprint** | ~6 GB |
| **Context window** | 32k tokens |
| **Context headroom (32GB)** | ~19 GB |

**Traits:**
- Fast inference — best tokens/sec of tested models
- Strong tool calling with updated parsers in Qwen3.5
- Solid code generation for common languages
- Leaves ample RAM headroom for OS, clients, and large context

**Verdict:** Best balance of speed, RAM, and reliability for daily coding. Current default.

---

### `mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit` ⚠️ too slow

| | |
|---|---|
| **Architecture** | MoE (Mixture of Experts) |
| **Active parameters** | ~3.3B active per token |
| **VRAM footprint** | ~16 GB |
| **Context window** | 32k tokens |
| **Context headroom (32GB)** | ~9 GB |

**Traits:**
- MoE activates ~3.3B params per forward pass, but **all 30B weights stay in VRAM** — hence the 16GB footprint
- Despite low active params, inference was noticeably slow on this hardware
- Tool calling inconsistent in local testing despite excellent benchmark ratings
- Tight context headroom — risky with large codebases

**Verdict:** Not practical for daily use on 32GB Mac. Benchmarks suggest it should be good — worth re-evaluating on faster hardware or with a future mlx-lm release.

---

### `mlx-community/Qwen2.5-Coder-14B-Instruct-4bit` ⚠️ Qwen2.5 — superseded

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 14B |
| **VRAM footprint** | ~9 GB |
| **Context window** | 32k tokens |
| **Context headroom (32GB)** | ~16 GB |

**Traits:**
- Server started fine; adequate instruction following
- Tool calling produced frequent malformed JSON — not viable for aider/opencode
- Superseded by Qwen3.5-9B which is smaller, faster, and more reliable

**Verdict:** Skip. Not recommended for agentic tools. Qwen3.5-9B is strictly better.

---

### `mlx-community/Qwen2.5-Coder-32B-Instruct-4bit` ❌ OOM — inconclusive

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 32B |
| **VRAM footprint** | ~19 GB |
| **Context window** | 32k tokens |
| **Context headroom (32GB)** | ~6 GB |

**Traits:**
- Crashed with `kIOGPUCommandBufferCallbackErrorOutOfMemory` — insufficient headroom on 32GB Mac
- Would require aggressive VRAM tuning (`mise run vram-set 28`) and minimal cache settings
- Results inconclusive — could not evaluate quality or tool calling

**Verdict:** Not viable on 32GB Mac without significant memory tuning. May work on 64GB. Part of Qwen2.5 generation — not a priority to retry.

---

### `mlx-community/Qwen2.5-Coder-7B-Instruct-4bit` ⬛ skipped

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 7B |
| **VRAM footprint** | ~4.5 GB |
| **Context window** | 32k tokens |
| **Context headroom (32GB)** | ~20 GB |

**Verdict:** Not tested. Known tool calling issues in Qwen2.5-7B. Focus has shifted to Qwen3.x — no plans to evaluate this model.

---

## Testing checklist

When evaluating a new model, test these:

- [ ] `mise run chat` — basic back-and-forth, instruction following
- [ ] `mise run aider` — can it edit files correctly and commit?
- [ ] `mise run opencode` — tool calling (read/write/run), multi-step tasks
- [ ] Context size — does it handle a large file without truncating?
- [ ] Code correctness — does generated code run without edits?
- [ ] Tool calling stability — does it complete tool calls without looping or malformed JSON?
