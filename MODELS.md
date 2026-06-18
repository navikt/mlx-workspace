# Model Evaluation Notes

Observations from running models locally via `mlx_lm` on Apple Silicon.
Update this as you test more models. Set the active model in `mise.toml`.

> **Note on sizes:** *Disk size* (from `mise run models-list`) and *VRAM footprint* are different.
> Disk includes tokenizer, configs, and bfloat16 safetensors. VRAM is the actual loaded inference footprint.

## How to switch models

```bash
# 1. Edit MLX_MODEL in mise.toml
# 2. Start the server
mise run server

# 3. Check what's already downloaded
mise run models-list
```

---

## Quick comparison

| Model | VRAM | Disk | Context headroom¹ | Speed | Code quality | Tool calling |
|---|---|---|---|---|---|---|
| Qwen2.5-Coder-7B-4bit | ~4.5 GB | — | ~20 GB | ⚡⚡⚡⚡ | ★★★ | ⚠️ loops |
| **Qwen3.5-9B-MLX-4bit** ⭐ | ~6 GB | 11 GB | ~19 GB | ⚡⚡⚡ | ★★★★ | ✅ strong |
| Qwen2.5-Coder-14B-4bit | ~9 GB | 15 GB | ~16 GB | ⚡⚡ | ★★★★ | ⚠️ inconsistent |
| Qwen3-Coder-30B-A3B-4bit | ~16 GB | 32 GB | ~9 GB | ⚡⚡ | ★★★★ | ✅ excellent² |
| Qwen2.5-Coder-32B-4bit | ~19 GB | 34 GB | ~6 GB | ⚡ | ★★★★★ | ✅ excellent |

¹ Context headroom = 32GB Mac unified RAM − VRAM footprint − ~7GB OS reserve  
² Tested as excellent per spec; local testing showed inconsistency — may be version-dependent

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

To update `opencode-init` for a different model, edit the `MODEL_CONTEXT` and `MODEL_OUTPUT` constants at the top of `.mise/tasks/opencode-init`.

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

### `mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit`

| | |
|---|---|
| **Architecture** | MoE (Mixture of Experts) |
| **Active parameters** | ~3.3B per token |
| **VRAM footprint** | ~16 GB |
| **Context window** | 32k tokens |
| **Context headroom (32GB)** | ~9 GB |

**Traits:**
- MoE — activates only ~3.3B params per forward pass, so faster than weight count suggests
- All weights still loaded into VRAM (hence 16GB footprint despite ~3.3B active)
- Tool calling rated excellent per benchmarks; local opencode testing showed inconsistency (possibly version/config issue)
- Tight context headroom — be cautious with large codebases

**Verdict:** Worth retesting with latest mlx-lm. Good for aider where context fits; watch for tool calling regressions in opencode.

---

### `mlx-community/Qwen2.5-Coder-14B-Instruct-4bit`

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 14B |
| **VRAM footprint** | ~9 GB |
| **Context window** | 32k tokens |
| **Context headroom (32GB)** | ~16 GB |

**Traits:**
- Previous daily driver — stable and well-tested
- Good instruction following
- Tool calling inconsistent (prone to malformed JSON)
- Superseded by Qwen3.5-9B for most tasks

**Verdict:** Reliable fallback. Skip for opencode; fine for aider and chat.

---

### `mlx-community/Qwen2.5-Coder-32B-Instruct-4bit`

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 32B |
| **VRAM footprint** | ~19 GB |
| **Context window** | 32k tokens |
| **Context headroom (32GB)** | ~6 GB |

**Traits:**
- Best raw code quality of all tested models
- Requires VRAM unlock on 32GB Mac: `mise run vram-set 26`
- Only ~6GB left for context — avoid large files or long sessions
- Slow first-token latency

**Verdict:** Use for complex one-shot refactors where quality matters more than speed. Always unlock VRAM first.

---

### `mlx-community/Qwen2.5-Coder-7B-Instruct-4bit` *(not yet tested locally)*

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 7B |
| **VRAM footprint** | ~4.5 GB |
| **Context window** | 32k tokens |
| **Context headroom (32GB)** | ~20 GB |

**Traits:**
- Smallest footprint — huge context headroom
- Tool calling prone to looping (known Qwen2.5-7B issue)
- May suit simple tasks or low-RAM machines

**Verdict:** Not recommended for agentic tools (aider/opencode). May be worth testing for chat/run tasks.

---

## Testing checklist

When evaluating a new model, test these:

- [ ] `mise run chat` — basic back-and-forth, instruction following
- [ ] `mise run aider` — can it edit files correctly and commit?
- [ ] `mise run opencode` — tool calling (read/write/run), multi-step tasks
- [ ] Context size — does it handle a large file without truncating?
- [ ] Code correctness — does generated code run without edits?
- [ ] Tool calling stability — does it complete tool calls without looping or malformed JSON?
