# Model Evaluation Notes

Observations from running models locally via `mlx_lm` on Apple Silicon (32GB Mac).
Switch models with `mise run model-use` — see `profiles/` for all available configurations.

> **Note on sizes:** *Disk size* (from `mise run models-list`) and *VRAM footprint* are different.
> Disk includes tokenizer, configs, and bfloat16 safetensors. VRAM is the actual loaded inference footprint.

## How to switch models

```bash
mise run model-use              # interactive picker (fzf)
mise run model-use qwen3.5-9b  # switch directly
mise run model-list             # show all profiles + status + download state
mise run model-status           # show active profile + server state
mise run server                 # restart server with new model
```

---

## Quick comparison

| Model | Arch | VRAM | Native ctx | Headroom¹ | Speed | Tool calling | Status |
|---|---|---|---|---|---|---|---|
| Qwen2.5-Coder-7B | Dense | ~4.5 GB | 32k | ~20 GB | ⚡⚡⚡⚡ | ⚠️ loops | ⬛ skipped |
| Granite-4.1-8B | Dense | ~4.5 GB | 128k | ~20 GB | — | ✅ enterprise | 🔬 testing |
| GLM-4.6V-Flash-9B | MoE hybrid | ~5.5 GB | 128k | ~19 GB | — | — | 🔬 testing |
| **Qwen3.5-9B-MLX** ⭐ | Dense | ~6 GB | 262k | ~19 GB | ⚡⚡⚡ | ✅ strong | ✅ daily driver |
| Gemma-4-12B | Dense | ~7 GB | 256k | ~18 GB | — | — | 🔬 testing |
| Ministral-3-14B | Dense | ~8.5 GB | 256k | ~16 GB | — | — | 🔬 testing |
| Qwen2.5-Coder-14B | Dense | ~9 GB | 32k | ~16 GB | ⚡⚡ | ❌ malformed JSON | ⬛ superseded |
| Qwen3-Coder-30B-A3B | MoE | ~16 GB | **256k** | ~9 GB | ⚡ | ⚠️ inconsistent | ⚠️ too slow |
| Qwen2.5-Coder-32B | Dense | ~19 GB | 32k | ~6 GB | ⚡ | — | ❌ OOM |

¹ Headroom = 32GB − VRAM − ~7GB OS reserve

## opencode declared context limits

`opencode-init` writes a `limit.context` for each model into `opencode.json`. This is what opencode uses to decide when to compact — without it the model is "unknown" and compaction never auto-triggers.

The values are set **lower than native** so that compaction fires before the session grows unmanageable. All values live in `profiles/<key>.toml` as `MLX_OPENCODE_CONTEXT`.

| Profile | Native context | Declared (MLX_OPENCODE_CONTEXT) | Auto-compact threshold |
|---|---|---|---|
| qwen3.5-9b | **262k** | 128k | ~127k tokens |
| granite-4.1-8b | 128k | 128k | ~127k tokens |
| glm-4.6v-flash-9b | 128k | 128k | ~127k tokens |
| gemma-4-12b | **256k** | 64k¹ | ~60k tokens |
| ministral-3-14b | **256k** | 64k¹ | ~60k tokens |
| qwen2.5-14b | 32k | 64k² | ~60k tokens |
| qwen3-30b-a3b | **256k** | 64k | ~60k tokens (tight RAM) |
| qwen2.5-32b | 32k | 16k | ~12k tokens (critically low RAM) |

¹ Declared below native: 14B+ models have larger KV footprint per token; 64k is safe for the cache budget.
² Declared context can exceed native — the KV cache bytes cap is the real safety guard.

> **GPU memory budget formula:**
> ```
> GPU cap  =  model weights  +  MLX_CACHE_BYTES  +  ~5–6GB activation buffer
>  26 GB   =     ~6 GB       +       14 GB        +       6 GB   (Qwen3.5-9B)
> ```
> Inference forward pass needs 4–6 GB beyond the declared KV cache — this is NOT covered by `MLX_CACHE_BYTES`. Leave enough headroom or OOM crashes will occur.

---

## Models

### `mlx-community/Qwen3.5-9B-MLX-4bit` ⭐ current

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 9B |
| **VRAM footprint** | ~6 GB |
| **Native context** | 262k tokens (`max_position_embeddings: 262144`) |
| **Practical context (32GB Mac)** | ~128k tokens (KV cache budget) |
| **Context headroom (32GB)** | ~19 GB |

**Traits:**
- Fast inference — best tokens/sec of tested models
- Strong tool calling with updated parsers in Qwen3.5
- Solid code generation for common languages
- MLA (Multi-head Latent Attention) = 64KB/token KV cache — very efficient

**Known issue — generation speed degrades at large context:**
Token generation slows significantly beyond ~80k tokens. At ~96k tokens, a single token was observed taking **3 min 28 s** on a 32GB Mac. This caused opencode to silently stop: the SSE chunk timeout fired mid-generation, the connection dropped, the model returned an empty response, and opencode exited the loop with no error message.

- `MLX_OPENCODE_CHUNK_TIMEOUT` is set to `600000` (10 min) to cover this worst case
- Practical comfortable operating range is **~50–70k tokens**; sessions approaching 100k will feel slow
- Diagnose silent stops: check `~/.local/share/opencode/log/opencode.log` for `"exiting loop"` and query `~/.local/share/opencode/opencode.db` for messages with `parts: 0`

**Verdict:** Best balance of speed, RAM, and reliability for daily coding. Current default.

---

### `mlx-community/gemma-4-12B-it-4bit` 🔬 testing

| | |
|---|---|
| **Architecture** | Dense, encoder-free |
| **Active parameters** | 12B |
| **VRAM footprint** | ~7 GB |
| **Native context** | 256k tokens |
| **Practical context (32GB Mac)** | ~64k tokens declared (15GB KV budget; 128k = ~8GB KV/session) |
| **Context headroom (32GB)** | ~18 GB |
| **Multimodal** | Text, images, audio, video (35M vision embedder + direct audio projection — no separate heavy encoders) |

**Traits:**
- Google Gemma 4 (Jun 2026), Apache 2.0
- Encoder-free multimodal: vision/audio fed directly into LLM backbone — lower latency than encoder-based models
- Reported strong function-calling / JSON schema adherence
- Tool calling via opencode requires text-only mode (mlx-lm does not support audio/vision input from CLI)

**Verdict:** Untested locally. Promising for strict JSON tool calling. Priority for evaluation.

---

### `mlx-community/Ministral-3-14B-Instruct-4bit` 🔬 testing

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 14B (13.5B language + 0.4B vision encoder) |
| **VRAM footprint** | ~8.5 GB |
| **Native context** | 256k tokens |
| **Practical context (32GB Mac)** | ~64k tokens declared (14GB KV budget; 14B models ~160KB/token KV overhead) |
| **Context headroom (32GB)** | ~16 GB |
| **Multimodal** | Text + images + PDFs (410M ViT encoder) |

**Traits:**
- Mistral AI Ministral 3 14B (Dec 2025, Apache 2.0); HF: `mistralai/Ministral-3-14B-Instruct-2512`
- 256k native context with multimodal capability (vision via separate ViT encoder)
- Reported highly decisive agent — prefers to read logs and edit multiple files directly
- Dense architecture despite the "Ministral" name (Mistral's edge-optimized line)

**Verdict:** Untested locally. High potential for multi-file agentic editing. Priority for evaluation.

---

### `mlx-community/granite-4.1-8b-instruct-4bit` 🔬 testing

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 8B |
| **VRAM footprint** | ~4.5 GB |
| **Native context** | 131,072 tokens (128k) — confirmed via OpenRouter + IBM docs |
| **Practical context (32GB Mac)** | ~128k tokens (small model, generous headroom) |
| **Context headroom (32GB)** | ~20 GB |

**Traits:**
- IBM Granite 4.1 (2025), Apache 2.0
- Enterprise-reinforced tool calling: Go, Java, C++, Rust, language-server adherence
- Dense model, claimed to outperform much larger MoE models on enterprise benchmarks
- Smallest footprint of tested models — leaves massive headroom for KV cache

> **⚠️ HF path note:** The mlx-community model may be `mlx-community/granite-4.1-8b-4bit` (without `-instruct`) — verify before downloading.

**Verdict:** Untested locally. Best VRAM profile for long-context experiments. Priority for evaluation.

---

### `mlx-community/GLM-4.6V-Flash-9B-4bit` 🔬 testing

| | |
|---|---|
| **Architecture** | MoE hybrid (not pure Dense despite small size) |
| **Active parameters** | 9B |
| **VRAM footprint** | ~5.5 GB+ (vision encoder adds overhead) |
| **Native context** | 128k tokens |
| **Practical context (32GB Mac)** | ~128k tokens (16GB KV budget; vision overhead may reduce practical limit) |
| **Context headroom (32GB)** | ~19 GB |
| **Multimodal** | Text, images (up to 4K), video frames, documents, PDFs — native vision tool use |

**Traits:**
- Z.AI GLM-4.6V-Flash, open source
- Vision-language model with native multimodal tool use (no conversion to text required)
- Optimized for low-latency local deployment
- MoE hybrid architecture — active params lower than total suggests; inference characteristics may differ from pure dense models

**Verdict:** Untested locally. Unique proposition: vision-native tool calling for image/document analysis tasks.

---

### `mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit` ⚠️ too slow

| | |
|---|---|
| **Architecture** | MoE (Mixture of Experts) — 128 experts, 8 active per token |
| **Total / active parameters** | 30.5B total / ~3.3B active per token |
| **VRAM footprint** | ~16 GB |
| **Native context** | **256k tokens** (YaRN-extendable to 1M) |
| **Context headroom (32GB)** | ~9 GB |

**Traits:**
- MoE activates ~3.3B params per forward pass, but **all 30B weights stay in VRAM** — hence the 16GB footprint
- Despite low active params, inference was noticeably slow on this hardware
- Tool calling inconsistent in local testing despite excellent benchmark ratings
- Pretrained on 7.5T tokens (70% code) — excellent code generation quality
- Tight context headroom — risky with large codebases

**Verdict:** Not practical for daily use on 32GB Mac. Worth re-evaluating on faster hardware or future mlx-lm releases.

---

### `mlx-community/Qwen2.5-Coder-14B-Instruct-4bit` ⬛ superseded

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 14B |
| **VRAM footprint** | ~9 GB |
| **Native context** | 32k tokens |
| **Context headroom (32GB)** | ~16 GB |

**Traits:**
- Tool calling produced frequent malformed JSON — not viable for aider/opencode
- Superseded by Qwen3.5-9B which is smaller, faster, and more reliable

**Verdict:** Skip. Qwen3.5-9B is strictly better in every dimension.

---

### `mlx-community/Qwen2.5-Coder-32B-Instruct-4bit` ❌ OOM — inconclusive

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 32B |
| **VRAM footprint** | ~19 GB |
| **Native context** | 32k tokens |
| **Context headroom (32GB)** | ~6 GB |

**Traits:**
- Crashed with `kIOGPUCommandBufferCallbackErrorOutOfMemory` — insufficient headroom on 32GB Mac
- Critical: only ~3GB left for activation buffer after model + 4GB KV cache
- Results inconclusive — could not evaluate quality or tool calling

**Verdict:** Not viable on 32GB Mac. May work on 64GB. Part of Qwen2.5 generation — not a priority to retry.

---

### `mlx-community/Qwen2.5-Coder-7B-Instruct-4bit` ⬛ skipped

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 7B |
| **VRAM footprint** | ~4.5 GB |
| **Native context** | 32k tokens |
| **Context headroom (32GB)** | ~20 GB |

**Verdict:** Not tested. Known tool calling issues in Qwen2.5-7B. Focus has shifted to Qwen3.x and newer architectures.

---

## Testing checklist

When evaluating a new model (`mise run model-use <key>` then `mise run server`):

- [ ] `mise run chat` — basic back-and-forth, instruction following
- [ ] `mise run aider` — can it edit files correctly and commit?
- [ ] `mise run opencode` — tool calling (read/write/run), multi-step tasks
- [ ] Context size — does it handle a large file without truncating?
- [ ] Code correctness — does generated code run without edits?
- [ ] Tool calling stability — completes tool calls without looping or malformed JSON?
- [ ] OOM check — monitor server logs for Metal OOM errors at larger context lengths

