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

| Model | Released | Server | Arch | VRAM | Native ctx | Headroom¹ | Speed | Tool calling | Status |
|---|---|---|---|---|---|---|---|---|---|
| Qwen2.5-Coder-7B | Nov 2024 | mlx-lm | Dense | ~4.5 GB | 32k | ~20 GB | ⚡⚡⚡⚡ | ⚠️ loops | ⬛ skipped |
| Qwen2.5-Coder-14B | Nov 2024 | mlx-lm | Dense | ~9 GB | 32k | ~16 GB | ⚡⚡ | ❌ malformed JSON | ⬛ superseded |
| Qwen2.5-Coder-32B | Nov 2024 | mlx-lm | Dense | ~19 GB | 32k | ~6 GB | ⚡ | — | ❌ OOM |
| Qwen3-Coder-30B-A3B | Jul 2025 | mlx-lm | MoE | ~16 GB | **256k** | ~9 GB | ⚡ | ⚠️ inconsistent | ⚠️ too slow |
| GLM-4.6V-Flash-9B | Dec 2025 | **mlx-vlm** ⚠️ | MoE hybrid | ~5.5 GB | 128k | ~19 GB | ⚠️ (mlx-vlm) | — | ⏭️ skipping² |
| Ministral-3-14B | Dec 2025 | mlx-lm | Dense | ~8.5 GB | 256k | ~16 GB | ⚡⚡ cache | ❌ role + halluc. | ❌ broken |
| **GLM-4.7-Flash** | Jan 2026 | mlx-lm | MoE | ~16 GB | 128–200k | ~9 GB | — | — | 🔬 testing |
| **Qwen3.5-9B-MLX** ⭐ | Feb 2026 | mlx-lm | Dense | ~6 GB | 262k | ~19 GB | ⚡⚡⚡ | ✅ strong | ✅ daily driver |
| Gemma-4-26B-A4B | Mar 2026 | **mlx-vlm** ⚠️ | MoE | ~14 GB | 256k | ~11 GB | ⚠️ (mlx-vlm) | — | ⏭️ skipping² |
| Qwen3.5-27B-Opus-Distilled | Mar 2026 | mlx-lm | Dense | ~14 GB | 262k | ~11 GB | ⚡ | — | 🔲 untested |
| Gemma-4-12B | May 2026 | **mlx-vlm** ⚠️ | Dense | ~7 GB | 256k | ~18 GB | ⚠️ 136s/turn | ❌ re-prefill | ⚠️ too slow |
| Granite-4.1-8B | May 2026 | mlx-lm | Dense | ~4.5 GB | 128k | ~20 GB | — | ✅ enterprise | 🔲 untested³ |

¹ Headroom = 32GB − VRAM − ~7GB OS reserve  
² mlx-vlm models skipped — same architecture as Gemma-4-12B, expected same ~2.5min/turn penalty  
³ Gated model: accept terms at huggingface.co/ibm-granite/granite-4.1-8b-instruct before downloading

### Successors & newer editions (as of Jun 2026)

| Model in list | Successor / newer edition | MLX 4bit? | Notes |
|---|---|---|---|
| Qwen2.5-Coder-14B (Nov 2024) | Qwen3-Coder-30B-A3B (Jul 2025) | ✅ in list | Direct successor line |
| Qwen2.5-Coder-32B (Nov 2024) | Qwen3-Coder-480B-A35B (Jul 2025) | ❌ server-only | Way too large |
| GLM-4.6V-Flash-9B (Dec 2025) | GLM-4.7-Flash (Jan 2026) → GLM-5.2 (Jun 2026) | ✅ 4.7 in list; GLM-5.2 no MLX yet | GLM-5 is 744B — not consumer hardware |
| GLM-4.7-Flash (Jan 2026) | GLM-5.2 (Jun 16, 2026) | ❌ not yet | GLM-5.2 has no MLX 4bit yet; likely very large |
| Qwen3-Coder-30B-A3B (Jul 2025) | Qwen3-Coder-Next (Feb 2026) | ⚠️ mxfp4 only | Preview model, not standard mlx-lm 4bit |
| Gemma-4-12B (May 2026) | Gemma-4-26B-A4B is the larger variant (same generation) | ✅ in list | Both use gemma4_unified / mlx-vlm — both expected too slow for agentic use |
| All others | No direct successor yet as of Jun 2026 | | |

---

## Server runtime: mlx-lm vs mlx-vlm

`mise run server` automatically selects the right server based on the active model profile. The decision is driven by `MLX_SERVER_TYPE` in each profile's `[params]`.

### The difference

| Feature | mlx-lm | mlx-vlm |
|---|---|---|
| **KV cache** | Persistent across requests — shared cache up to `MLX_CACHE_BYTES` | **Cleared after every request** (`Stream finished, cleared cache`) |
| **Prompt caching** | `--prompt-cache-bytes` / `--prompt-cache-size` | Not supported — no equivalent flags |
| **Per-turn cost** | Re-uses prior context; only new tokens prefilled | **Full conversation re-prefilled every tool call** |
| **Agentic impact** | Fast at steady state; grows slowly | Grows linearly — each tool call costs O(session_length) prefill |
| **Server logs** | Detailed `Prompt processing progress` lines | Minimal; no per-chunk progress |
| **Multimodal** | Text only (even for VLM model weights) | Text + images + audio/video |

### Why some models always need mlx-vlm

The MLX ecosystem splits model support across two packages. A model requires mlx-vlm when its `model_type` is **only implemented in mlx-vlm**, not in mlx-lm:

| model_type | Affected models | Notes |
|---|---|---|
| `gemma4_unified` | All Gemma 4 `-it` / multimodal HF variants | Google unified text+vision into one arch; no text-only path in mlx-lm |
| `glm4v` | GLM-4.6V-Flash and V-series | Z.AI vision models; `glm4v` ≠ `glm4` (text-only GLM) |
| `glm4v_moe` | GLM-4.6V MoE variants | Same family, MoE variant |

**In our workspace** (3 of 11 profiles use mlx-vlm):

| Profile | model_type | Server |
|---|---|---|
| `gemma-4-12b` | `gemma4_unified` | mlx-vlm |
| `gemma-4-26b-a4b` | `gemma4_unified` | mlx-vlm |
| `glm-4.6v-flash-9b` | `glm4v` | mlx-vlm |
| All others | `qwen3_5`, `glm4_moe_lite`, `qwen3_moe`, `qwen2`, `mistral3` | mlx-lm |

> **Note:** Models with dual support (e.g., `qwen3_vl` exists in both packages) run via mlx-lm in text-only mode — no image input but full KV cache persistence.

### Impact on agentic coding sessions

For opencode/aider workflows where the tool sends the full conversation with every tool call:

- **mlx-lm models**: The KV cache stores prior prefill. After the first message, subsequent tool calls only pay for new tokens (the diff from the cache). A 30k-token session costs ~30k prefill the first time, then ~500–2k per tool call.
- **mlx-vlm models**: Cache is cleared after every response. Every tool call re-prefills the entire conversation. A 30k-token session costs ~30k prefill **on every single tool call** — at 200 t/s that's 150 seconds before generation can start.

**Recommendation:** Use mlx-vlm models for short, focused tasks. For long multi-file agentic sessions, stick to mlx-lm models (Qwen3.5, GLM-4.7, etc.).

---

## Thinking mode (CoT reasoning tokens)

Several models in this workspace have built-in chain-of-thought ("thinking") mode — they generate `<think>…</think>` blocks before answering. This is controlled via `MLX_CHAT_TEMPLATE_ARGS` in the profile.

### Models with thinking tokens

| Model | Thinking tokens | Disable mechanism | Profile setting |
|---|---|---|---|
| GLM-4.7-Flash | `<think>`, `</think>`, `/nothink` | `</think>` pre-fill (hard switch) | `MLX_CHAT_TEMPLATE_ARGS = '{"enable_thinking": false}'` |
| Qwen3 series | `<think>`, `</think>` | `enable_thinking=false` or `/no_think` text token | Same pattern |
| GLM-4.5 | `/nothink` text token | `enable_thinking=false` → appends `/nothink` to user messages | Same |

> **GLM-4.7-Flash technical detail:** `enable_thinking=false` injects a `</think>` token as the opening of the assistant turn, immediately closing the thinking block. The model never generates thinking content — cost is 1 token. This is distinct from GLM-4.5 which appended `/nothink` to user messages.

### Thinking vs. non-thinking: when to use each

Research summary (sources: arxiv 2412.21187, GLM-4 repo benchmarks, Qwen3 technical report):

| Task type | Thinking helps? | Evidence |
|---|---|---|
| Competition math (AIME, MATH-500) | ✅ Strongly | DeepSeek-R1: 79.8% vs. V3: 39.2% on AIME 2024 |
| Competitive programming (Codeforces) | ✅ Strongly | R1 rating 2029 vs V3 1134 |
| PhD science (GPQA Diamond) | ✅ Moderately | R1: 71.5% vs V3: 59.1% |
| **Multi-turn tool calling (BFCL)** | ❌ Harmful | R1: **12.4%** vs V3: **35.8%** — thinking is 3× worse |
| **Agentic simulation (TAU-Bench)** | ❌ Harmful | R1: 33.0% vs V3: 60.7% — thinking model half as effective |
| **Agentic coding (opencode/Claude Code)** | ❌ Harmful | Overthinking on trivial decisions; same collapse as BFCL |
| Instruction following / format | ❌ Slightly worse | Thinking models score ~3pp below on IF-Eval |
| Simple boilerplate / CRUD | ❌ Not needed | Overhead only — no quality difference |

**Key finding (arxiv 2412.21187 — "Do NOT Think That Much for 2+3=?"):** Thinking models generate exhaustive reasoning for trivial decisions because they have no calibration for task difficulty. In an agentic session, a prompt like *"src/ is empty, what do I do?"* triggers the same extended reasoning loop as a hard math problem — observed as 3m 35s `<think>` block in GLM-4.7-Flash evaluation (2026-06-19).

### Current configuration

All profiles default to `enable_thinking=false` via `OPTIONAL_DEFAULTS` in the `model-use` task. Profiles that need thinking enabled should set `MLX_CHAT_TEMPLATE_ARGS` explicitly.

GLM-4.7-Flash **does** support turn-level thinking control (re-enable per-request via `chat_template_kwargs`), so a future enhancement could selectively enable thinking for heavy architecture turns only.

---

## Multi-model local strategy

A single 32GB M1 Max can only load one large model at a time. However, a **task-routing** approach can combine models without exceeding VRAM:

### The constraint

| Scenario | VRAM used | Feasible? |
|---|---|---|
| One large model (16 GB) | ~23–26 GB total | ✅ |
| Two large models simultaneously | ~32–40 GB | ❌ OOM |
| One large + one small simultaneously | ~22–28 GB | ⚠️ Tight (depends on sizes) |
| Sequential switching | Any | ✅ (30–60s reload cost) |

### Practical approaches

#### Option 1: Session-based routing (recommended now)
Use different model profiles for different *session types*. Switch with `mise run model-use <profile> && mise run server`.

| Session type | Recommended model | Reason |
|---|---|---|
| Agentic coding (opencode) | GLM-4.7-Flash or Qwen3.5-9B | Fast MoE + good tool calling |
| Architecture / design planning | Qwen3.5-27B-Opus-Distilled | Dense 27B — better at deep reasoning |
| Quick Q&A / chat | Qwen3.5-9B | Fastest, lowest VRAM |
| Enterprise/IBM stack code | Granite-4.1-8B (gated) | IBM-tuned for enterprise patterns |

Cost: ~30–60s server reload between session types. Acceptable if you work in sessions rather than task-by-task.

#### Option 2: opencode small_model + main_model split
opencode already has a `small_model` config field — used for title generation and lightweight background tasks. If a small model (e.g. Qwen3.5-9B at ~6 GB) and a large model (GLM-4.7-Flash at ~16 GB) fit together (~22 GB + ~7 GB OS = 29 GB), you can run both simultaneously:

```json
{
  "model": "mlx/mlx-community/GLM-4.7-Flash-4bit",
  "small_model": "mlx/mlx-community/Qwen3.5-9B-4bit"
}
```

> ⚠️ **Not yet implemented** — the workspace currently runs a single server on port 8080. Serving two models simultaneously would require a second server instance on a different port and a second opencode provider entry. VRAM headroom would need measurement.

#### Option 3: Turn-level model routing (future)
GLM-4.7-Flash supports turn-level thinking control already. A step further would be routing individual turns to different models (e.g. a planning step to the 27B model, tool-dispatch steps to the 9B). This requires a proxy layer not currently in the workspace.

#### Option 4: Thinking as the "reasoning mode" toggle
Rather than switching physical models, use `enable_thinking` as a proxy for "hard vs. easy" tasks within a single model:

- `enable_thinking=false` (default) → fast, direct answers, tool dispatch
- `enable_thinking=true` → deep reasoning for architecture questions

This is the lowest-friction multi-mode approach and works today with GLM-4.7-Flash.

### Recommended next step

Before investing in multi-model infrastructure, complete the current model evaluation:

1. Finish GLM-4.7-Flash evaluation (thinking disabled)
2. Test Qwen3.5-27B-Opus-Distilled — if it's significantly better at planning/architecture, session-based routing becomes compelling
3. Measure whether Qwen3.5-9B + GLM-4.7-Flash fit together in 32 GB (estimated ~29 GB — very tight)

---

## Dynamic model switching (no server restart)

`mlx_lm.server` supports **per-request model switching** natively. No restart is needed — the server process stays alive and handles the swap itself.

### How it works (source: `mlx_lm/server.py`)

Every incoming request includes a `"model"` field. The server's `ModelProvider.load()` compares the requested model path against the currently loaded model's key:

```python
# ModelProvider.load() — called on every request
model_key = (model_path, adapter_path, draft_model_path)
if self.model_key != model_key:
    self._load(*model_key)   # unload old, load new
```

`_load()` explicitly frees the old model before loading the new one:

```python
def _load(self, model_path, ...):
    self.model_key = None
    self.model = None        # → Python GC releases Metal buffers → VRAM freed
    self.tokenizer = None
    # ... then load new model weights
```

This means a single server on port 8080 can serve multiple models sequentially — the client just specifies different model IDs in each request.

### Caching behaviour across model switches

The **KV prompt cache (`LRUPromptCache`) is owned by `ResponseGenerator`, not `ModelProvider`** — it is never cleared on model switch. Cache entries are keyed by `(model_key, token_sequence)`, so:

| Event | Model weights | KV prompt cache |
|---|---|---|
| Request with same model | In VRAM ✅ | Hit if tokens match ✅ |
| Switch to model B | Old freed, B loaded | Old entries **stay in LRU** (different key, ignored) |
| Switch back to model A | A reloaded | Old A entries **still in LRU** — warm restart if not evicted ✅ |
| LRU eviction | — | Oldest entries dropped when cache hits `prompt_cache_size` limit |

**Key insight**: switching between two models and back is a **warm restart** for the original model, as long as the LRU hasn't evicted the old entries. The `MLX_CACHE_SIZE = "3"` in GLM's profile means only 3 cached sequences — switching to another model and back will likely evict them (the new model's sequences fill the LRU slots). Increase `MLX_CACHE_SIZE` if you plan to switch models frequently.

### VRAM peak during a switch

`_load()` does NOT clear the prompt cache before loading the new model. During the switch there is a brief window where:

```
VRAM peak = old_model_KV_cache (still held by LRU) + new_model_weights
```

For GLM-4.7-Flash → another 16 GB model:
```
6 GB (KV cache) + 16 GB (new model) + 7 GB (OS) = 29 GB  ← tight but within 32 GB
```

If `MLX_CACHE_BYTES` is set, the trim happens *during generation* (not during the switch itself), so the peak is real. Reduce `MLX_CACHE_BYTES` if you see OOM errors when hot-switching between large models.

### Thinking mode and the KV cache

Switching `enable_thinking` on the **same model** (`GLM-4.7-Flash`) does **not** change the `model_key` — the key is `(model_path, adapter_path, draft_model_path)` only. However, thinking mode changes the system prompt structure (`<think>` vs `</think>` prefix on the assistant turn), so **token sequences won't match** the old cache entries anyway. In practice, switching thinking on/off on the same server restart is a cold cache.

### Using dynamic switching today

To switch models without restarting, register multiple model IDs in `opencode.json` all pointing to `http://localhost:8080/v1`:

```json
{
  "provider": {
    "mlx": {
      "models": {
        "mlx-community/GLM-4.7-Flash-4bit": { "limit": { "context": 32768, "output": 4096 } },
        "mlx-community/Qwen3.5-9B-4bit":    { "limit": { "context": 131072, "output": 8192 } }
      }
    }
  }
}
```

The server will unload/load automatically when opencode switches models. Switch cost: ~30–60s reload time (same as server restart). Advantage: no tmux wrangling, KV cache for the previous model survives in LRU for fast switchback.

> **Not yet implemented in this workspace** — `opencode-init` currently writes a single model entry. Multi-model registration is a planned enhancement.

---

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
| gemma-4-26b-a4b | **256k** | 64k | ~60k tokens (shared KV cache may allow more) |
| qwen3.5-27b-opus-distilled | **262k** | 32k | ~28k tokens (tight 6GB KV budget) |
| glm-4.7-flash | 128–200k | 48k⁴ | ~40k tokens (OOM at 64k during prefill spike — see footnote ⁴) |
| qwen2.5-14b | 32k | 64k² | ~60k tokens |
| qwen3-30b-a3b | **256k** | 64k | ~60k tokens (tight RAM) |
| qwen2.5-32b | 32k | 16k | ~12k tokens (critically low RAM) |

¹ Declared below native: 14B+ models have larger KV footprint per token; 64k is safe for the cache budget.
² Declared context can exceed native — the KV cache bytes cap is the real safety guard.
⁴ GLM-4.7-Flash OOM confirmed at 64k (2026-06-19): Metal `kIOGPUCommandBufferCallbackErrorOutOfMemory` crash
  during prefill of a ~9k token prompt at ~27k session context (41% of 65k). Activation spike during
  prefill pushes peak VRAM above the 26GB wired cap. Reduced to 48k + 6GB KV cache. Drop to 32k if
  OOM recurs. 128k is not reachable — the 16GB model footprint leaves insufficient room.

> **GPU memory budget formula:**
> ```
> GPU cap  =  model weights  +  MLX_CACHE_BYTES  +  ~5–6GB activation buffer
>  26 GB   =     ~6 GB       +       14 GB        +       6 GB   (Qwen3.5-9B)
> ```
> Inference forward pass needs 4–6 GB beyond the declared KV cache — this is NOT covered by `MLX_CACHE_BYTES`. Leave enough headroom or OOM crashes will occur.

---

## Benchmark guide

Benchmarks that matter for agentic coding on local hardware, in priority order:

| # | Metric | How to measure | Why it matters |
|---|---|---|---|
| 1 | **Prefill speed** (t/s) | Read `Prompt processing progress` lines from server log; divide tokens by elapsed time | Determines how long you wait before generation starts on large codebases |
| 2 | **Decode speed** (t/s) | `mlx_lm.generate --model ... --prompt "..." --verbose`; look for `Tokens per second` | The "typing" speed users feel; most sensitive to context size |
| 3 | **Time to first token / TTFT** (s) | Time from HTTP request to first SSE token; visible in server log as gap between request line and first `progress` line | Latency for short tool-call responses; should be <2s for good UX |
| 4 | **Context degradation** (t/s at N tokens) | Decode speed at 8k / 32k / 64k / 96k context | Tells you the practical usable ceiling before sessions feel painful |
| 5 | **Tool call accuracy** (%) | Count tool call attempts vs valid-JSON successes in opencode session logs | Directly impacts agentic reliability; a bad model wastes all its speed on retries |
| 6 | **Max stable context** (tokens) | Largest context that completes without OOM crash | Hard ceiling — models that OOM at 40k are unusable for large repo tasks |

Measured data lives in `profiles/<key>.toml` under `[benchmarks]`. Collect decode speed with:
```bash
mlx_lm.generate --model mlx-community/Qwen3.5-9B-MLX-4bit \
  --prompt "Write a detailed explanation of Rust's borrow checker" \
  --max-tokens 512 --verbose
```

---

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

**Measured benchmarks (M1 Max 32GB, vram-set 26, 2026-06-18):**

| Metric | Value | Condition |
|---|---|---|
| Prefill — peak | ~245 t/s | First 2k tokens, fresh KV cache |
| Prefill — 44k prompt | ~205 t/s avg | Full 44k-token prefill from cold |
| Prefill — 14k prompt (cache-warm) | ~179 t/s avg | After a prior 44k session filled cache |
| Prefill degradation | 258→181 t/s | 4k tokens → 44k tokens in same run |
| Decode — extreme context | ~0.005 t/s (208 s/tok) | ~96k tokens — severe degrade, near unusable |

**Missing benchmarks to measure** (none collected yet):
- Decode t/s at 8k / 32k / 64k context (comfortable range)
- Time to first token (TTFT) for typical opencode requests
- Tool call JSON accuracy rate (% valid first attempt)
- Max stable context before OOM (currently estimated ~100k)

---

### `mlx-community/gemma-4-12B-it-4bit` ⚠️ too slow

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
- **Requires `mlx-vlm` server** (`model_type: gemma4_unified`) — handled automatically by `mise run server`

**⚠️ mlx-vlm caching — measured impact:**

Every tool call re-prefills the full conversation from scratch. What this looks like in practice (measured 2026-06-18, weather-cli opencode task):

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

**Result: 10 turns × 2m16s = 24 minutes → 0 files implemented** (only empty stubs created). Session aborted.

Compare to qwen3.5-9b at similar context: **~5–10 seconds/turn** (persistent KV cache — only new tokens prefilled).

**Verdict:** ⚠️ Inconclusive / impractical for agentic coding as of Jun 2026. The mlx-vlm per-request cache-clear makes multi-turn agentic sessions prohibitively slow on this hardware. May be usable for short single-turn queries. Re-evaluate if mlx-vlm adds persistent KV caching in a future version.

---

### `mlx-community/Ministral-3-14B-Instruct-2512-4bit` ❌ broken

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

**KV cache — excellent** (mlx-lm): cold prefill ~150 t/s; subsequent turns only 15–22 tokens (near-instant, 2.83 GB cache after turn 1).

**Fatal issue 1 — Mistral role alternation bug:**
The model's `chat_template.jinja` raises an exception when conversation roles don't follow strict `user→assistant→user→assistant` alternation. Root cause: the template's parity counter doesn't reset after tool-call rounds, so any `user` message following a tool round fires the exception. mlx-lm returns HTTP 404 for any exception during generation.

- Patched in `chat_templates/ministral-3-14b-patched.jinja` — removes the `raise_exception` call (one line). `ns.index` is provably unused after the check block so this is safe.
- `--use-default-chat-template` is a no-op for this model (only activates when no template exists).

**Fatal issue 2 — hallucinated garbage output (even with patch):**
After applying the template patch, the model generates fake YAML listing invented chat template file paths instead of responding to prompts. Likely cause: the template's default system message contains a literal `{today}` string (not a Jinja2 `{{ today }}` expression), which renders unexpanded and confuses the model into meta-level generation. Interaction with AGENTS.md may compound this.

**Verdict:** ❌ Broken for opencode agentic use as of Jun 2026. Both issues are fundamental — not config-tunable. The `chat_templates/` infrastructure created here is reusable for other Mistral-family models.

**Measured benchmarks (M1 Max 32GB, 2026-06-18):**

| Metric | Value |
|---|---|
| Prefill — cold (17.3k tokens) | ~150 t/s |
| Prefill — cached (turn 2) | 15 tokens (~0.3s) |
| KV cache after turn 1 | 2.83 GB |
| Turns before failure | 2 |

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
- **Requires `mlx-vlm` server** (`model_type: glm4v`) — handled automatically by `mise run server`

**⚠️ mlx-vlm caching limitation:**
`mlx-vlm` clears the KV cache after every completed request. Every opencode tool call re-prefills the full conversation from scratch. See the [Server runtime section](#server-runtime-mlx-lm-vs-mlx-vlm) for details.

**Verdict:** Untested locally. Unique proposition: vision-native tool calling for image/document analysis tasks. Best suited for short focused sessions due to cache limitation.

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

### `mlx-community/Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit` 🔬 testing

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 27B |
| **VRAM footprint** | ~14 GB (measured peak ~15.6 GB on M4 Pro 64GB) |
| **Native context** | 262k tokens (Qwen3.5-27B base) |
| **Practical context (32GB Mac)** | ~32k tokens (only 6GB KV headroom after model + activation) |
| **Context headroom (32GB)** | ~11 GB |

**Traits:**
- Community fine-tune: Qwen3.5-27B base distilled on Claude 4.6 Opus reasoning traces
- Deep chain-of-thought reasoning with internal `<think>` steps; optimised for technical planning and agentic coding
- Measured: ~15.7 t/s on M4 Pro 64GB — expect slower on 32GB M1 Max
- Tightest context budget of the tested models: dense 27B leaves only 6GB for KV cache → ~32–40k practical tokens
- Apache 2.0

**Verdict:** Untested locally. High reasoning quality claim. Context-limited on 32GB Mac — best for focused, shorter sessions where depth matters more than breadth.

---

### `mlx-community/gemma-4-26b-a4b-it-4bit` 🔬 testing

| | |
|---|---|
| **Architecture** | MoE (26B total / ~3.8–4B active per token) |
| **Active parameters** | ~4B per token |
| **VRAM footprint** | ~14 GB |
| **Native context** | 256k tokens |
| **Practical context (32GB Mac)** | ~64k declared; shared KV cache may extend effective capacity |
| **Context headroom (32GB)** | ~11 GB |
| **Multimodal** | Text, images, video |

**Traits:**
- Google Gemma 4 26B MoE (2026), Apache 2.0
- **Shared KV Cache:** final attention layers reuse KV from earlier layers — physically less RAM per token than standard models. Context budget stretches further than comparable 14GB dense models
- **Dual RoPE:** prevents context quality collapse at long range
- Hybrid local+global attention (always global at final layer)
- Fast inference despite large total param count — only 4B active per token
- MMLU Pro: 82.6%, AIME 2026: 88.3%, LiveCodeBench v6: 77.1% — strong benchmarks

**Verdict:** Untested locally. Most technically interesting of the new batch: MoE speed + shared KV cache gives more effective context per GB than any other ~14GB model. High priority for evaluation.

---

### `mlx-community/GLM-4.7-Flash-4bit` 🔬 testing

| | |
|---|---|
| **Architecture** | MoE (30B total / ~3–3.6B active per token) |
| **Active parameters** | ~3B per token |
| **VRAM footprint** | ~16 GB |
| **Native context** | 128–200k tokens |
| **Practical context (32GB Mac)** | ~32k tokens (measured: 32k total=20GB, 65k total=23GB which is risky) |
| **Context headroom (32GB)** | ~9 GB |

**Traits:**
- Zhipu/Z.AI GLM-4.7-Flash (2026): updated successor to GLM-4.6V-Flash
- MoE with 64 experts, 4 routed per token + 1 shared — ~10x throughput vs dense 30B
- Strong coding, tool use, and agentic workflows; different training paradigm from Qwen MoE
- Measured VRAM scaling: 4k≈17GB, 32k≈20GB, 65k≈23GB, 131k≈30GB
- 65k context leaves only 3GB for activations on 26GB cap — unsafe. 32k is the safe ceiling.
- Tighter context than GLM-4.6V-Flash-9B despite being a "Flash" model — simply because it's ~3× larger

**Verdict:** Untested locally. Alternative to Qwen3-30B-A3B MoE if tool calling proved inconsistent. Worth testing given different training origin.

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

