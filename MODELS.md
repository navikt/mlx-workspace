# Model Evaluation Notes

Observations from running models locally on Apple Silicon and driving them from
`opencode` / `aider`. Every measurement is tagged with the rig it was taken on.
Numbers do not transfer between rigs.

Switch models with `mise run model-use`. See `profiles/` for all configurations.
Each model gets its own scratch workspace under `workspaces/<profile-key>/`.

> **Note on sizes:** *Disk size* (from `mise run models-list`) and *VRAM footprint* are different.
> Disk includes tokenizer, configs, and safetensors. VRAM is the actual loaded inference footprint.

## Table of Contents

- [Hardware](#hardware)
- [How to switch models](#how-to-switch-models)
- [Quick comparison: rig A (32 GB)](#quick-comparison-rig-a-32-gb)
- [Quick comparison: rig B (128 GB)](#quick-comparison-rig-b-128-gb)
- [Server backends: mlx-lm vs mlx-vlm vs oMLX](#server-backends-mlx-lm-vs-mlx-vlm-vs-omlx)
- [Thinking mode (CoT reasoning tokens)](#thinking-mode-cot-reasoning-tokens)
- [Speculative decoding (MTP)](#speculative-decoding-mtp)
- [Dense vs MoE](#dense-vs-moe)
- [Dynamic model switching (no server restart)](#dynamic-model-switching-no-server-restart)
- [opencode declared context limits](#opencode-declared-context-limits)
- [Benchmark guide](#benchmark-guide)
- [opencode drops output from some models](#opencode-drops-output-from-some-models)
- [Cheap-operations results](#cheap-operations-results)
- [weather-cli challenge results](#weather-cli-challenge-results)
- [Model evaluations: rig B (M5 Max 128 GB)](#model-evaluations-rig-b-m5-max-128-gb)
- [Model evaluations: rig A (M1 Max 32 GB)](#model-evaluations-rig-a-m1-max-32-gb)
- [Recommendations](#recommendations)
- [Scheduled re-tests](#scheduled-re-tests)
- [Testing checklist](#testing-checklist)
- [Standard benchmark prompts](#standard-benchmark-prompts)
- [Code review rubric](#code-review-rubric)

---

## Hardware

| Rig | Machine | RAM | GPU wired cap | Backends | Models tested |
|---|---|---|---|---|---|
| **A** | M1 Max | 32 GB | 26 GB (`mise run vram-set`) | mlx-lm, mlx-vlm | 7B–35B, 4-bit (Jun 2026) |
| **B** | M5 Max | 128 GB | 96–115 GB (per profile `gpu_wired_limit_gb`) | mlx-lm, mlx-vlm, **oMLX** | 27B–284B, 8-bit / 3-bit mixed (Aug 2026) |

**Target hardware: 48 GB, Pro-class chip.** That is what most developers here run, and neither rig
represents it. Rig A is too small, and rig B is both larger and much faster in memory bandwidth.
Recommendations must be qualified against it:

| Constraint | 48 GB Pro | Rig B (128 GB Max) |
|---|---|---|
| Wired ceiling (~75%) | ~36 GB | 96–115 GB |
| Memory bandwidth | roughly half of Max-class | baseline for all measurements here |
| Qwen3.8 8-bit (~27 GB weights) | ~35 GB needed, does not leave working room | comfortable |
| Qwen3.8 4-bit (~14 GB weights) | fits with room for a 12 GB KV cache | trivial |

A dense model streams all its weights per token, so decode speed ≈ bandwidth ÷ weight size. On
Pro-class silicon the 8-bit build is bandwidth-starved *before* it is memory-starved. Halving the
weights with a 4-bit quant roughly doubles the achievable tokens/sec, on top of freeing 13 GB.
`profiles/qwen3.8-27b-4bit.toml` (`mlx-community/Qwen3.8-27B-4bit`) exists for this reason. It runs
**without MTP**: the drafter head is published as `model_type: qwen3_5_mtp`, which only oMLX can
load, and oMLX cannot serve this 4-bit build. Expect the plain mlx-lm decode rate, not the 8-bit
MTPLX numbers.

**Untested on the target.** Every number in this document comes from rig A or rig B. Capacity
arithmetic transfers; bandwidth-bound throughput does not. Treat 48 GB Pro guidance as predicted
until someone measures it.

Nothing from rig A was re-measured on rig B. Rig A numbers stay as the reference for
what fits in 32 GB; rig B numbers are the current daily-driver data.

---

## How to switch models

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

## Quick comparison: rig A (32 GB)

| Model | Released | Server | Arch | VRAM | Native ctx | Headroom¹ | Speed | Tool calling | Status |
|---|---|---|---|---|---|---|---|---|---|
| Qwen2.5-Coder-7B | Nov 2024 | mlx-lm | Dense | ~4.5 GB | 32k | ~20 GB | ⚡⚡⚡⚡ | ⚠️ loops | ⬛ skipped |
| Qwen2.5-Coder-14B | Nov 2024 | mlx-lm | Dense | ~9 GB | 32k | ~16 GB | ⚡⚡ | ❌ malformed JSON | ⬛ superseded |
| Qwen2.5-Coder-32B | Nov 2024 | mlx-lm | Dense | ~19 GB | 32k | ~6 GB | ⚡ | — | ❌ OOM |
| Qwen3-Coder-30B-A3B | Jul 2025 | mlx-lm | MoE | ~16 GB | **256k** | ~9 GB | ⚡ | ⚠️ inconsistent | ⚠️ too slow |
| GLM-4.6V-Flash-9B | Dec 2025 | **mlx-vlm** ⚠️ | MoE hybrid | ~5.5 GB | 128k | ~19 GB | ⚠️ (mlx-vlm) | — | ⏭️ skipped² |
| Ministral-3-14B | Dec 2025 | mlx-lm | Dense | ~8.5 GB | 256k | ~16 GB | ⚡⚡ cache | ❌ role + halluc. | ❌ broken |
| GLM-4.7-Flash | Jan 2026 | mlx-lm | MoE | ~16 GB | 128–200k | ~9 GB | — | ❌ loops + OOM | ❌ not viable |
| **Qwen3.5-9B-MLX** ⭐ | Feb 2026 | mlx-lm | Dense | ~6 GB | 262k | ~19 GB | ⚡⚡⚡ | ✅ strong | ✅ recommended |
| Gemma-4-26B-A4B | Mar 2026 | **mlx-vlm** ⚠️ | MoE | ~14 GB | 256k | ~11 GB | ⚠️ (mlx-vlm) | — | ⏭️ skipped² |
| Qwen3.5-27B-Opus-Distilled | Mar 2026 | mlx-lm | Dense | ~14 GB | 262k | ~11 GB | ⚡ | ❌ tool failures | 💥 OOM |
| **Qwen3.6-35B-A3B** | Apr 2026 | mlx-lm | MoE | ~21 GB | 262k | ~3.3 GB | ⚡⚡ | ✅ strong | ✅ recommended |
| Gemma-4-12B | May 2026 | **mlx-vlm** ⚠️ | Dense | ~7 GB | 256k | ~18 GB | ⚠️ 136s/turn | ❌ re-prefill | ⚠️ too slow |
| Granite-4.1-8B | May 2026 | mlx-lm | Dense | ~4.5 GB | 128k | ~20 GB | — | ✅ enterprise | 🔲 untested³ |

¹ Headroom = 32 GB − VRAM − ~7 GB OS reserve
² mlx-vlm models skipped. Same architecture as Gemma-4-12B, expected same ~2.5 min/turn penalty
³ Gated model: accept terms at huggingface.co/ibm-granite/granite-4.1-8b-instruct before downloading

---

## Quick comparison: rig B (128 GB)

| Model | Released | Server | Arch | VRAM | Declared ctx | Decode speed | Tool calling | Status |
|---|---|---|---|---|---|---|---|---|
| Qwen2.5-72B-Instruct-8bit | Sep 2024 | mlx-lm | Dense 72B | ~72 GB | 128k | — | ❌ never calls tools | ❌ broken |
| **DeepSeek-V4-Flash-0731** (2.4-bit mixed) | May 2026 | **oMLX** | MoE 284B / ~13B active | ~84 GB wired | 128k | 25–31 t/s | ✅ strong | ✅ recommended |
| **Qwen3.8-27B-Instruct-8bit** (MTPLX Q8) | Jul 2026 | **oMLX** | Dense 27B + MTP head | ~27–28 GB | 128k | 11–14 t/s plain, 25–38 t/s with MTP | ✅ strong ⚠️ see quirks | ✅ recommended |
| Mistral-Large-2-4bit | Jul 2024 | mlx-lm | Dense 123B | ~69 GB | — | — | — | 🔲 downloaded, untested |
| Mistral Medium 3.5 (6-bit) | 2026 | mlx-lm | Dense 128B | ~96 GB | — | — | — | 🔲 candidate |
| Gemma-4-31B-8bit | 2026 | mlx-vlm | Dense 31B | ~33 GB | — | — | — | 🔲 candidate |

At 128 GB the binding constraint flips. Weights are no longer the problem, **tool-calling
reliability is**. The 72B dense model is the fastest way to burn 72 GB on a model that
cannot drive `opencode`.

## Server backends: mlx-lm vs mlx-vlm vs oMLX

`mise run server` selects the backend from `MLX_SERVER_TYPE` in the active profile's `[params]`
(`mlx-lm`, `mlx-vlm`, or `omlx`).

### The difference

| Feature | mlx-lm | mlx-vlm |
|---|---|---|
| **KV cache** | Persistent across requests, shared cache up to `MLX_CACHE_BYTES` | **Cleared after every request** (`Stream finished, cleared cache`) |
| **Prompt caching** | `--prompt-cache-bytes` / `--prompt-cache-size` | Not supported, no equivalent flags |
| **Per-turn cost** | Re-uses prior context; only new tokens prefilled | **Full conversation re-prefilled every tool call** |
| **Agentic impact** | Fast at steady state; grows slowly | Grows linearly, each tool call costs O(session_length) prefill |
| **Server logs** | Detailed `Prompt processing progress` lines | Minimal; no per-chunk progress |
| **Multimodal** | Text only (even for VLM model weights) | Text + images + audio/video |

### Why some models always need mlx-vlm

The MLX ecosystem splits model support across two packages. A model requires mlx-vlm when its `model_type` is **only implemented in mlx-vlm**, not in mlx-lm:

| model_type | Affected models | Notes |
|---|---|---|
| `gemma4_unified` | Gemma 4 variants published with the unified arch | No text-only path in mlx-lm |
| `glm4v` | GLM-4.6V-Flash and V-series | Z.AI vision models; `glm4v` ≠ `glm4` (text-only GLM) |
| `glm4v_moe` | GLM-4.6V MoE variants | Same family, MoE variant |

**In our workspace** (3 of 11 profiles use mlx-vlm):

| Profile | model_type | Server |
|---|---|---|
| `gemma-4-12b` | `gemma4_unified` | mlx-vlm |
| `gemma-4-26b-a4b` | `gemma4_unified` | mlx-vlm |
| `gemma-4-31b-8bit` | **`gemma4`** | **mlx-lm**. `mlx_lm/models/gemma4.py` reads `text_config` and skips the vision tower |
| `glm-4.6v-flash-9b` | `glm4v` | mlx-vlm |
| All others | `qwen3_5`, `glm4_moe_lite`, `qwen3_moe`, `qwen2`, `mistral3` | mlx-lm |

> ⚠️ **Check `model_type` exactly, not by prefix.** `gemma4` and `gemma4_unified` are different
> architectures with different backends. Assuming every Gemma 4 needs mlx-vlm cost a full
> benchmark run: `gemma-4-31b-8bit` was served by mlx-vlm, which clears the KV cache after every
> request, and its turn times climbed to a 43s median / 197s worst against ~12s for oMLX models.

> **Note:** Models with dual support (e.g., `qwen3_vl` exists in both packages) run via mlx-lm in text-only mode. No image input, but full KV cache persistence.

### Impact on agentic coding sessions

For opencode/aider workflows where the tool sends the full conversation with every tool call:

- **mlx-lm models**: The KV cache stores prior prefill. After the first message, subsequent tool calls only pay for new tokens (the diff from the cache). A 30k-token session costs ~30k prefill the first time, then ~500–2k per tool call.
- **mlx-vlm models**: Cache is cleared after every response. Every tool call re-prefills the entire conversation. A 30k-token session costs ~30k prefill **on every single tool call**. At 200 t/s that's 150 seconds before generation can start.

**Recommendation:** Use mlx-vlm models for short, focused tasks. For long multi-file agentic sessions, stick to mlx-lm models (Qwen3.5, GLM-4.7, etc.).

### oMLX (rig B)

`oMLX` is a third backend, added because `mlx-lm` has no support for DeepSeek V4 and no MTP
speculative decoding. It adds paged SSD KV caching that survives server restarts, and Metal
kernels tuned for DeepSeek's sparse attention.

| Feature | oMLX |
|---|---|
| **KV cache** | Paged, persisted to SSD; prompt boundary snapshots reused across requests |
| **Model naming** | HF repo slashes are rewritten to double dashes (`mlx-community--DeepSeek-V4-Flash-0731-2.4bit-mixed`). `opencode-init`/`aider-init` translate this automatically |
| **Custom kernels** | `OMLX_WITH_CUSTOM_KERNEL=1` builds Metal kernels for DeepSeek's sparse attention. **Never actually built on rig B**, see below |
| **Speculative decoding** | MTP drafter heads, see [Speculative decoding](#speculative-decoding-mtp) |

> ⚠️ **The custom kernels have never been built on rig B.** Compiling them needs `xcrun metal`,
> which ships with full Xcode; this machine has only Command Line Tools, so the build fails with
> `unable to find utility "metal"`. `mise run setup` now detects this and installs oMLX without the
> kernels rather than dying in a cmake traceback. **Every oMLX number in this document was measured
> without them.** DeepSeek's 25–31 t/s and 3.3s TTFT are the un-accelerated baseline, and there is
> untested upside if Xcode is installed and `mise run setup --force` is re-run.

Gotchas found on rig B:

- `~/.omlx/settings.json` ships `max_context_window: 32768` and silently truncates anything
  larger. Raised to `131072`.
- Default sampling temperature is `1.0`, which made DeepSeek emit repeating tool calls.
  Locked to `0.6`.
- oMLX pins `mlx==0.32.0`; installing it alongside a newer `mlx` produces a pip resolver
  conflict. `mise run setup` installs both in one pip invocation to keep the resolution consistent.

---

## Thinking mode (CoT reasoning tokens)

Several models in this workspace have built-in chain-of-thought ("thinking") mode. They generate `<think>…</think>` blocks before answering. This is controlled via `MLX_CHAT_TEMPLATE_ARGS` in the profile.

### Models with thinking tokens

| Model | Thinking tokens | Disable mechanism | Profile setting |
|---|---|---|---|
| GLM-4.7-Flash | `<think>`, `</think>`, `/nothink` | `</think>` pre-fill (hard switch) | `MLX_CHAT_TEMPLATE_ARGS = '{"enable_thinking": false}'` |
| Qwen3 series | `<think>`, `</think>` | `enable_thinking=false` or `/no_think` text token | Same pattern |
| GLM-4.5 | `/nothink` text token | `enable_thinking=false` → appends `/nothink` to user messages | Same |

> **GLM-4.7-Flash technical detail:** `enable_thinking=false` injects a `</think>` token as the opening of the assistant turn, immediately closing the thinking block. The model never generates thinking content, so the cost is 1 token. This is distinct from GLM-4.5 which appended `/nothink` to user messages.

### Thinking vs. non-thinking: when to use each

Research summary (sources: arxiv 2412.21187, GLM-4 repo benchmarks, Qwen3 technical report):

| Task type | Thinking helps? | Evidence |
|---|---|---|
| Competition math (AIME, MATH-500) | ✅ Strongly | DeepSeek-R1: 79.8% vs. V3: 39.2% on AIME 2024 |
| Competitive programming (Codeforces) | ✅ Strongly | R1 rating 2029 vs V3 1134 |
| PhD science (GPQA Diamond) | ✅ Moderately | R1: 71.5% vs V3: 59.1% |
| **Multi-turn tool calling (BFCL)** | ❌ Harmful | R1: **12.4%** vs V3: **35.8%**, thinking is 3× worse |
| **Agentic simulation (TAU-Bench)** | ❌ Harmful | R1: 33.0% vs V3: 60.7%, thinking model half as effective |
| **Agentic coding (opencode/Claude Code)** | ❌ Harmful | Overthinking on trivial decisions; same collapse as BFCL |
| Instruction following / format | ❌ Slightly worse | Thinking models score ~3pp below on IF-Eval |
| Simple boilerplate / CRUD | ❌ Not needed | Overhead only, no quality difference |

**Key finding (arxiv 2412.21187, "Do NOT Think That Much for 2+3=?"):** Thinking models generate exhaustive reasoning for trivial decisions because they have no calibration for task difficulty. In an agentic session, a prompt like *"src/ is empty, what do I do?"* triggers the same extended reasoning loop as a hard math problem. Observed as a 3m 35s `<think>` block in the GLM-4.7-Flash evaluation (2026-06-19).

### Current configuration

`model-use` resets `MLX_CHAT_TEMPLATE_ARGS` to empty for profiles that do not set it, which is
**not** the same as disabling thinking. A profile only suppresses thinking if it sets
`MLX_CHAT_TEMPLATE_ARGS = '{"enable_thinking": false}'` *and* its chat template honours the flag.

`qwen_template.jinja` has no `enable_thinking` branch, so `qwen3.8-27b-8bit` thinks on every turn
regardless of configuration. Measured cost on rig B (2026-08-26): a 2,488-token thinking turn
raised the next turn's prompt from 19,897 to 22,417 tokens. The whole block is fed back, so each
reasoning token is paid once at decode (~27 t/s) and again as prefill on every later turn.

Front-loading reasoning into the *plan* phase is worth it (one block, paid once, and it is what
cut the weather-cli run from ~34 min to 7m 33s). Reasoning inside the *implement* phase is not:
it recurs per tool call and matches the BFCL/TAU-Bench collapse above. `AGENTS.md` rule 7 asks for
short thinking during implementation; a template-level toggle is the stronger fix if that is not
enough.

GLM-4.7-Flash **does** support turn-level thinking control (re-enable per-request via `chat_template_kwargs`), so a later change could enable thinking for heavy architecture turns only.

---

## Speculative decoding (MTP)

Qwen 3.8 ships an MTP (multi-token prediction) drafter head as a separate `mtp.safetensors`.
When oMLX absorbs those weights into the model index it drafts several tokens per forward
pass and verifies them in one go.

Measured on rig B (`mvid/Huihui-Qwen3.8-27B-abliterated-MTPLX-Q8`, oMLX):

| | Without MTP | With MTP |
|---|---|---|
| Decode speed | 11.3–14.3 t/s | 18–38 t/s (37.7 t/s peak on short prompts) |
| Tokens per forward cycle | 1.0 | 2.8–3.5 |
| Draft acceptance rate | — | 80–95% (depth 1–3) |

Speed varies with what is being generated: short tool-call turns land at the top of the range,
long `<think>` blocks at 21k+ context drop back to ~11–18 t/s. The drafter is worth roughly a
2–3× speedup on the same weights, which is what makes a dense 27B competitive with a 284B MoE.

---

## Dense vs MoE

The Qwen3.5-27B-Opus-Distilled OOM on rig A (2026-06-19) makes the tradeoff concrete:

| Model | Total params | Active per token | VRAM | Prefill t/s | Result |
|---|---|---|---|---|---|
| Qwen3.5-27B-Opus | **27B dense** | 27B | 14 GB | 68–71 t/s | 💥 OOM at 6–17k tokens |
| Qwen3.6-35B-A3B | 35B MoE | **~3B** | 21 GB | 350–386 t/s | ✅ 96k context, stable |

Dense models load every parameter into every forward pass; during prefill the activation
tensors for the whole input must coexist with the weights, and that spike is what breaches
the wired-memory cap. MoE routes each token through a few experts only, so activation memory
stays low regardless of total size. Qwen3.6-35B-A3B is 3× larger by total params, 5× faster
at prefill, and peaks lower than the 27B dense model.

**On 32 GB (rig A):** prefer MoE for anything above ~14B total params.

### Why an older version can be the better choice

Expect the question "why test Qwen3.6 when 3.8 exists?". The answer is architecture, not recency:
decode speed on Apple Silicon tracks **active** parameters, because every active weight is read
from memory for every token. Total parameter count sets capacity; active count sets speed.

| | Qwen3.8-27B (dense, 4-bit) | Qwen3.6-35B-A3B (MoE, 4-bit) |
|---|---|---|
| Total params | 27B | 35B, *larger* |
| Active per token | **27B** | **~3B** |
| Weights read per token | ~16 GB | ~2 GB |
| KV cache | ~60–80 KB/token (estimated) | **20 KB/token** (measured, rig A) |
| Download | 16.3 GB | 20.4 GB |

On a 128 GB Max there is bandwidth to spare and the dense 3.8 wins outright. On a 48 GB Pro, where
bandwidth is roughly halved, the dense model reads ~16 GB per token and is throughput-bound long
before it is capacity-bound. The MoE reads about an eighth of that and carries a KV cache
three to four times cheaper.

There is no MoE in the 3.8 line to sidestep the trade with: MLX has only `Qwen3.8-27B-4bit` and its
drafter, and the one MoE build (`Qwen3.8-Whittle-MoE-27B-A17.8B`) is an unofficial merge with 17.8B
active, nearly dense in bandwidth terms. Wanting MoE economics means going back a version.

**So: 3.8 is the better model, 3.6-A3B may be the better fit.** A newer version buys capability per
token; on halved bandwidth you may not be able to afford those tokens. Test the dense build first as
the quality anchor, and keep the MoE as the fallback that was designed for this constraint.

**On 128 GB (rig B):** the rule softens. A dense 27B at 8-bit fits with ~100 GB to spare, and
with MTP it outruns the 284B MoE on wall-clock task time. The 284B MoE still wins on raw
capability per token; the dense 27B wins on responsiveness and leaves the machine usable.


## Dynamic model switching (no server restart)

`mlx_lm.server` supports **per-request model switching** natively. No restart is needed. The server process stays alive and handles the swap itself.

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

This means a single server on port 8080 can serve multiple models sequentially. The client just specifies different model IDs in each request.

### Caching behaviour across model switches

The **KV prompt cache (`LRUPromptCache`) is owned by `ResponseGenerator`, not `ModelProvider`**. It is never cleared on model switch. Cache entries are keyed by `(model_key, token_sequence)`, so:

| Event | Model weights | KV prompt cache |
|---|---|---|
| Request with same model | In VRAM ✅ | Hit if tokens match ✅ |
| Switch to model B | Old freed, B loaded | Old entries **stay in LRU** (different key, ignored) |
| Switch back to model A | A reloaded | Old A entries **still in LRU**, warm restart if not evicted ✅ |
| LRU eviction | — | Oldest entries dropped when cache hits `prompt_cache_size` limit |

Switching between two models and back is a **warm restart** for the original model, as long as the LRU hasn't evicted the old entries. The `MLX_CACHE_SIZE = "3"` in GLM's profile means only 3 cached sequences, so switching to another model and back will likely evict them (the new model's sequences fill the LRU slots). Increase `MLX_CACHE_SIZE` if you plan to switch models frequently.

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

Switching `enable_thinking` on the **same model** (`GLM-4.7-Flash`) does **not** change the `model_key`. The key is `(model_path, adapter_path, draft_model_path)` only. However, thinking mode changes the system prompt structure (`<think>` vs `</think>` prefix on the assistant turn), so **token sequences won't match** the old cache entries anyway. In practice, switching thinking on/off on the same server restart is a cold cache.

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

> **Not yet implemented in this workspace.** `opencode-init` currently writes a single model entry. Multi-model registration is planned.

---

## opencode declared context limits

`opencode-init` writes a `limit.context` for each model into `opencode.json`. This is what opencode uses to decide when to compact. Without it the model is "unknown" and compaction never auto-triggers.

The values are set **lower than native** so that compaction fires before the session grows unmanageable. All values live in `profiles/<key>.toml` as `MLX_OPENCODE_CONTEXT`.

| Profile | Native context | Declared (MLX_OPENCODE_CONTEXT) | Auto-compact threshold | KV/token (8-bit) |
|---|---|---|---|---|
| qwen3.5-9b | **262k** | 128k | ~127k tokens | 64 KB |
| granite-4.1-8b | 128k | 128k | ~127k tokens | — |
| glm-4.6v-flash-9b | 128k | 128k | ~127k tokens | — |
| gemma-4-12b | **256k** | 64k¹ | ~60k tokens | 180 KB (hybrid window) |
| ministral-3-14b | **256k** | 64k¹ | ~60k tokens | 100 KB |
| gemma-4-26b-a4b | **256k** | 64k | ~60k tokens (shared KV cache may allow more) | — |
| qwen3.5-27b-opus-distilled | **262k** | 32k | ~28k tokens (tight 6GB KV budget) | — |
| glm-4.7-flash | 128–200k | 48k⁴ | ~40k tokens (OOM at 64k during prefill spike, see footnote ⁴) | 187 KB (no GQA!) |
| qwen2.5-14b | 32k | 64k² | ~60k tokens | 96 KB |
| qwen3-30b-a3b | **256k** | 64k | ~60k tokens (tight RAM) | 24 KB |
| qwen2.5-32b | 32k | 16k | ~12k tokens (critically low RAM) | 128 KB |
| qwen3.6-35b-a3b | **262k** | 96k | ~90k tokens | **20 KB** (measured 18.3 KB) |

Rig B profiles (128 GB, where context is no longer the scarce resource):

| Profile | Native context | Declared (MLX_OPENCODE_CONTEXT) | Max tokens | Notes |
|---|---|---|---|---|
| qwen3.8-27b-8bit | 262k | 131k | 8,192 | Ran at 16k during early debugging; raised once the chat-template fix removed the prefill blowup |
| deepseek-v4-flash-3bit | 128k+ | 131k | 32,768 | oMLX `max_context_window` must be raised to 131072 in `~/.omlx/settings.json` or it truncates silently |
| qwen2.5-72b-8bit | 128k | 131k | 8,192 | Never exercised, model is broken for tool calling |

> **`MLX_OPENCODE_OUTPUT` is a hard client-side cap**, not just compaction math. opencode sends it
> as `max_tokens`. 4096 is too small for a thinking model: it truncates mid-`<think>` and the turn
> ends with no tool call. Budget reasoning tokens *plus* the tool call.

> **Editing a profile is not enough.** `mise.local.toml` is written only by `mise run model-use`,
> so a profile edit stays inert until the profile is re-activated. `opencode-init` now reads
> `profiles/<active-key>.toml` directly for this reason; `aider-init` still reads the mise env,
> so re-run `model-use` after editing a profile if you use aider.

> **Compaction loops:** declaring a context *too small* is as bad as too large. DeepSeek at 16k
> spent the session compacting instead of working; opencode's own system prompt and tool
> definitions eat several thousand tokens before your first message.

¹ Declared below native: 14B+ models have larger KV footprint per token; 64k is safe for the cache budget.
² Declared context can exceed native. The KV cache bytes cap is the real safety guard.
⁴ GLM-4.7-Flash OOM confirmed at 64k (2026-06-19): Metal `kIOGPUCommandBufferCallbackErrorOutOfMemory` crash
  during prefill of a ~9k token prompt at ~27k session context (41% of 65k). Activation spike during
  prefill pushes peak VRAM above the 26GB wired cap. Reduced to 48k + 6GB KV cache. Drop to 32k if
  OOM recurs. 128k is not reachable. The 16GB model footprint leaves insufficient room.

> **GPU memory budget formula:**
> ```
> GPU cap  =  model weights  +  MLX_CACHE_BYTES  +  ~5–6GB activation buffer
>  26 GB   =     ~6 GB       +       14 GB        +       6 GB   (Qwen3.5-9B)
> ```
> The inference forward pass needs 4–6 GB beyond the declared KV cache. `MLX_CACHE_BYTES` does NOT cover this. Leave enough headroom or the server OOMs.

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
| 6 | **Max stable context** (tokens) | Largest context that completes without OOM crash | Hard ceiling. Models that OOM at 40k are unusable for large repo tasks |

Measured data lives in `profiles/<key>.toml` under `[benchmarks]`. Collect decode speed with:
```bash
mlx_lm.generate --model mlx-community/Qwen3.5-9B-MLX-4bit \
  --prompt "Write a detailed explanation of Rust's borrow checker" \
  --max-tokens 512 --verbose
```

---

## opencode drops output from some models

The single most important finding from the cheap-operations round, and it is about the harness
rather than any model.

**Three models, three different outcomes through the same opencode setup:**

| Model | `model_type` | Through opencode | Direct API |
|---|---|---|---|
| Qwen3.6-35B-A3B | `qwen3_5_moe` | works, 1 to 20 tool calls per task | works |
| Qwen3-Coder-30B-A3B | `qwen3_moe` | **nothing surfaces** | works |
| Granite 4.1 8B | `granite` | **nothing surfaces** | works |

For the two that fail, opencode reports zero tool calls and no reply text, while the token counter
shows the model generated output. Asked "What is 7+5", Qwen3-Coder produced three output tokens
and opencode displayed nothing at all. This is not a tool-calling failure. Everything the model
returns is discarded.

**The models are fine.** Both were tested directly against the same running server and both return
correct tool calls on the first attempt, with proper `finish_reason: tool_calls` and well-formed
arguments.

**Every server-side explanation was tested and eliminated** against Qwen3-Coder:

| Condition | Result |
|---|---|
| 1, 3, 5, 8, 12, 15 tools | tool calls correct at every count |
| 26,551-token system prompt | correct |
| Two system messages | correct |
| Streaming (`stream: true`) | correct, `tool_calls` present in the delta |

The tool-count threshold reported elsewhere for Qwen3-Coder, roughly five tools before it starts
emitting tool syntax as text, **did not reproduce here**. That was the change ranked first in our
research review, and it is not our problem.

The remaining candidate is a chat template or response-parser mismatch on the opencode side,
which matches the general pattern in the literature that tool-calls-as-text problems are template
mismatches rather than prompt problems. An attempt to capture opencode's exact request through a
logging proxy did not complete, because opencode would not talk to a non-default local port under
the sandbox. That capture is the obvious next step.

**What this costs us.** Any benchmark result from this harness partly measures opencode
compatibility rather than model capability. A model can look unusable here and be perfectly good.
Granite was written up as "never calls tools" on exactly this evidence, and that entry has been
corrected. Results for a model that produces zero tool calls should be treated as a harness
result until the model has been checked directly.

**It also raises the priority of the Copilot CLI comparison.** nav-pilot must support both clients
at GA. If a model's usability depends this strongly on which client drives it, then the client is
part of the recommendation and has to be measured, not assumed.

---

## Cheap-operations results

The weather-cli benchmark measures building a whole application, which is the hardest task shape
and the one we would never route to a local model. This one measures the opposite: the short,
routine operations that consume a Copilot premium request each. Spec in `CHEAP_OPS_SPEC.md`,
tasks in `bench/tasks.json`, run with `mise run bench-cheap-ops`.

Target is `navikt/isoppfolgingstilfelle`, a real Nav Kotlin service. Ktor, Kafka, Postgres,
5,661 lines of main Kotlin, 151 tests that pass on a clean machine with no Nav-internal
dependencies. Every task is pinned to a symbol verified to exist in that repository. The runner
hard-resets the checkout between tasks and verifies results itself, never trusting the model's
claim.

### `mlx-community/Qwen3.8-27B-4bit` — slow on routine work

Partial run: five of eight tasks completed before the harness timeout. E3 alone took twenty
minutes, which consumed the budget. The three multi-file tasks were not reached.

| Task | 27B 4-bit | Qwen3.6 MoE | Result |
|---|---|---|---|
| R1 explain a function | 174.4s | 11.6s | **0 of 4 key terms** |
| R2 find a config value | 92.3s | 10.4s | 2 of 2 terms |
| R3 list call sites | 109.8s | 18.5s | 1 of 1 terms |
| E1 add a KDoc block | 167.4s | 21.1s | compiles |
| E3 add a log line | **1196.3s** | 29.1s | compiles |
| **Median** | **167.4s** | **25.1s** | |

**It works through opencode**: 38 tool calls, both verifiable tasks passed. That matters for
[the harness bug](#opencode-drops-output-from-some-models), because this is `qwen3_5`, the same
family as the working MoE, while the two models opencode discards are `qwen3_moe` and `granite`.
Family looks like the discriminator.

**The weather-cli trade does not survive this workload.** Building a whole CLI, this model wrote
the best code measured, 8.5/10, and its 4.8x slowness bought something. On routine operations it
is **6.7x slower than the MoE** and got the explain task wrong where the MoE got it partly right
in a fifteenth of the time. Twenty minutes to add one log line is not a trade, it is a
disqualification.

**Thinking is the obvious suspect.** This is the only model in this round with reasoning enabled,
verified from the response carrying a `reasoning` field. Published work on Qwen3 1.7B-32B found
thinking helps planning constraints and hurts precision ones, which is most of this task set. The
scheduled re-test with thinking disabled is now the highest-value experiment for this model, and
until it runs these numbers measure a configuration rather than the model.

### `mlx-community/granite-4.1-8b-4bit` ⚠️ incompatible with opencode, not incapable

| Task | Time | Turns | Tool calls | Files changed | Result |
|---|---|---|---|---|---|
| R1 explain a function | 13.6s | 1 | **0** | 0 | answered without reading the file, 2 of 4 key terms |
| R2 find a config value | 547.9s | 1 | **0** | 0 | 0 of 2 terms |
| R3 list call sites | 2743.9s | 1 | **0** | 0 | 0 of 1 terms |
| E1 add a KDoc block | 9.8s | 1 | **0** | 0 | no edit |
| E3 add a log line | 9.0s | 1 | **0** | 0 | no edit |
| M1 rename across call sites | 9.2s | 1 | **0** | 0 | no edit |
| M2 add a DTO field | 9.6s | 1 | **0** | 0 | no edit |
| G2 write a test file | 11.3s | 1 | **0** | 0 | no edit |

**Zero tool calls across every task.** One turn each, no file ever opened, no file ever written.
This is the same failure class as Qwen2.5-72B in the weather-cli benchmark: the model answers in
chat instead of using the tools it was given.

On R1 it explained a Kotlin function it had not read, matching only the two most common digits in
the expected answer while missing both distinctive thresholds. A fast, fluent, fabricated answer.

**It exposed a bug in our harness, which is the more useful outcome.** The compile and test checks
certify that the repository is healthy, not that the model did the work. An untouched checkout
compiles and its suite passes, so Granite scored four false passes. Only the rename task caught it,
because that check greps for the old symbol rather than trusting the build. Every edit task now
requires a non-empty `git status` before its check counts, and files-changed is recorded per task.
Qwen3.6's results predate the fix but are unaffected: it made 1 to 20 tool calls per task and its
rename passed the symbol grep.

**The two slow tasks were not slow generation.** R2 at 548s and R3 at 2744s bracket a 46-minute
window in which the server received no requests at all. The model was not working; the client was
stalled. Granite's real per-task time is around 10 seconds.

**Correction: this was recorded as "never calls tools" and that was wrong.** Tested directly
against the same server, with the same model, Granite returns a correct tool call on the first
attempt:

```
finish_reason: tool_calls
tool_calls: [{"function": {"name": "read_file", "arguments": "{\"path\": \"build.gradle.kts\"}"}}]
```

The model is capable. The pairing with opencode is not. Every number in the table above measures
that pairing, not the model, and none of it should be read as a verdict on Granite.

**Verdict:** ⚠️ untested. At 5.12 GB and Apache 2.0 it remains the most attractive candidate on
paper, and we still do not know how it performs on real work. Re-run once the opencode
incompatibility is understood, or measure it through Copilot CLI instead. See
[opencode drops output from some models](#opencode-drops-output-from-some-models).

### `mlx-community/Qwen3.6-35B-A3B-4bit`

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

**Median 25.1s, mean 38.9s. Five of five objectively verified tasks passed. No truncation.**
The bar set in advance was a median under 30 seconds with most checks passing, so this clears it.

**This is a different machine to the weather-cli numbers.** The same model took 6m 45s to build a
whole CLI. On routine operations against an existing codebase it is a different tool: most tasks
finish in under half a minute, and the two that do not are the two that write substantial new
code.

**It changes the economics.** The nav-pilot analysis assumed roughly six minutes of extra waiting
per task, taken from the build-an-application benchmark, and put break-even near ten tasks a
month. Against Copilot on this workload the delta is tens of seconds, not minutes. Break-even
moves out by more than an order of magnitude. `reports/nav-pilot-path.md` still carries the old
figure and needs revising.

**The overhead floor is 15.6k tokens.** Every turn carries roughly 15,600 input tokens of system
prompt and tool schemas before the request itself. Measured with the trivial prompt "Create a file
called probe.txt containing exactly the word: verified", which cost 15,628 input tokens. Task
input rises with conversation length, from 15.9k on the shortest task to 41.1k on the longest.
Published work on another harness measured tool schemas at 81% of a comparable payload, so a
reduced tool set is the obvious lever and is untested here.

**Verified, not reported.** M2 added a field to a REST DTO, mapped it at the construction site,
and the existing suite still passed. M1's rename was checked by grepping for the old symbol before
compiling, because a rename that misses a call site still compiles if the caller was deleted.

---

## weather-cli challenge results

Every model builds the same Node.js CLI from `WEATHER_CLI_SPEC.md` (live Met.no + Geonorge
APIs, spec-named test files) in its own `workspaces/<key>/weather-cli/`, driven by the two
prompts in [Standard benchmark prompts](#standard-benchmark-prompts).

| Model | Rig | Plan | Implement | Total | Tests | Behaviour |
|---|---|---|---|---|---|---|
| Gemma-4-31B 8-bit | B | 4m 2s | 16m 21s | **20m 23s** | 16/16 | Correct mlx-lm backend. Twice the wall clock of Qwen3.8/DeepSeek; 31 turns at a 35s median. Pulled in **jest** instead of `node:test` |
| Gemma-4-31B 8-bit | B | 6m 7s | abandoned | — | — | Served by mlx-vlm by mistake, cache cleared per request; 43s median turn, 197s worst |
| DeepSeek-V4-Flash 2.4-bit | B | 4m 43s | 5m 26s | **10m 09s** | 17/17¹ | ✅ Rerun at parity; planned properly this time, dispatched a sub-agent, wrote its plan to a file |
| Qwen3.8-27B MTPLX Q8 | B | **1m 23s** | 8m 47s | **10m 10s** | 16/16 | ✅ Best run. Rule 7 + corrected spec UA warning |
| Qwen3.8-27B 4-bit | B (36 GB cap) | 5m 16s | 27m 5s | **32m 21s** | 25/25² | Code **8.5/10**. Same artifact as the Q8 at 3.2× the wall clock, no MTP. Ignored rule 7, drafted files inside `<think>` |
| Qwen3.6-35B-A3B 4-bit | B (36 GB cap) | **34.9s** | **6m 10s** | **6m 45s** | 20/20³ | ⚡ Fastest run. Code **6.8/10**. MoE ~3B active, **thinking disabled**, not a like-for-like process comparison |
| Qwen3.5-9B 4-bit | B (36 GB cap) | — | — | ❌ **4 attempts, no plan delivered** | — | Four distinct failures across four configs. Oldest model tested (Feb 2026); Qwen3.6 and 3.8 both work |
| Qwen3.8-27B MTPLX Q8 | B | 7m 58s | abandoned | — | — | Rule 7, old spec wording; plan phase lost ~5 min to a self-inflicted `example.com` 403 read as rate limiting |
| Qwen3.8-27B MTPLX Q8 | B | 2m 43s | 11m 22s | **14m 05s** | 17/17 | ✅ Complete. First run with `request_max_tokens=16384` in effect; no truncation |
| Qwen3.8-27B MTPLX Q8 | B | 2m 40s | aborted 3m 22s | — | — | Same `finish_reason=length`. The raised output cap had not reached `opencode.json` (see trap below) |
| Qwen3.8-27B MTPLX Q8 | B | 2m 52s | aborted 4m 36s | — | — | Tool calling healthy (10/13 turns), but the implement phase died on `finish_reason=length`, see output-cap bug below |
| Qwen3.8-27B MTPLX Q8 | B | 3m 12s | 4m 21s | **7m 33s** | 22/22 | Probed both APIs during planning, then wrote correct code first try |
| DeepSeek-V4-Flash 2.4-bit | B | — | — | 11m 58s (14m 55s first run) | 13/13 | Assumed the API shapes, then debugged against failing tests |
| Qwen3.8-27B 8-bit (pre-MTP) | B | — | — | ~34 min | 18/18 | Ran unattended; found and fixed 3 errors in the spec by probing the live APIs |
| Qwen2.5-72B 8-bit | B | — | — | — | — | Never wrote a file, printed code into chat instead of calling tools |

Naming the 403/429 distinction in the spec halved the plan phase: **1m 23s**, against a
happy-path band of **2m 52s / 2m 40s / 2m 43s** and a 7m 58s worst case when the model had to
work the ambiguity out itself. Two sentences of precision in the spec bought more than any
model or backend change measured so far.

Plan-phase time was otherwise repeatable while the model stayed on the happy path, **2m 52s /
2m 40s / 2m 43s** across three runs, but a run that actually hits the spec's Met.no 403
User-Agent trap during planning cost **7m 58s**, roughly 3× the others. Plan time therefore
measures *what the model ran into*, not just how it reasons; compare implement time and test
count across runs, and treat a long plan phase as a signal to check what it was wrestling with.

¹ Self-reported. Qwen3.8 (16/16) and Gemma-4-31B (16/16) were re-run with `npm test` after the
fact and confirmed; DeepSeek's workspace was deleted before that check, so its count rests on the
model's own claim. **Verify test counts before clearing a workspace.** The number is the result,
and the artifacts are the only proof of it.

² Independently verified: 25 tests, 24 pass hermetic + 1 live test gated behind `WEATHER_LIVE=1`
(25/25 with it set). Test counts are not comparable across models, each chooses how finely to
split its suite, so read the count as "did it verify its own work", not as a score. Qwen3.8-4bit
is the first model whose self-report matched a hand check in every particular, including its two
disclosed spec deviations.

³ 19 tests that can fail, plus one that cannot: `test/integration.test.js:37-50` wraps all eight of
its assertions in a `try`/`catch` intended to tolerate a network outage. Node's `assert` throws
`AssertionError`, which that same bare `catch` swallows. A passing count is only as good as the
weakest test in it. Check for swallowed assertions before recording the number.

The single biggest lever was the prompt, not the model: adding *"Check the external apis do not
assume the data model"* to the plan prompt moved DeepSeek-class debugging loops into a 3-minute
research phase and cut Qwen 3.8's total time by ~4×.

---

## Model evaluations: rig B (M5 Max 128 GB)

### `mlx-community/Qwen3.5-9B-MLX-4bit` ❌ does not complete the benchmark

The 6 GB floor of the ladder. Four attempts under the 36 GB cap, each with the
previous attempt's failure fixed. It never delivered a plan.

| Attempt | Config change | Failure |
|---|---|---|
| 1 | profile defaults (`top_k` disabled) | `webfetch` returned a **truncated** Met.no payload; it groped at the fragment with `Grep "\{"` and `Grep "property"`, then produced a single **8m 18s** thought block and collapsed into `DIDIDIDI…`, a degenerate repetition loop |
| 2 | `MLX_TOP_K = 20` | Plan in **23.4s**, the fastest in the benchmark. Then wrote `index.js` to shell out to a `geonorge` CLI that does not exist, and tried to conjure it: `npm install -g`, four `brew install` variants, a `brew tap` that cloned into `/opt/homebrew` |
| 3 | + cplt sandbox | Diagnosed the Met.no 403 **correctly and immediately**, better than Qwen3.8-27B Q8, which read the same 403 as rate limiting. Then a **9m 51s** turn that never completed |
| 4 | + `top_p = 0.95`, thinking **disabled** | POSTed multipart form fields (`lat`, `lon`, `User-Agent`, `Content-Type`, an invented `apikey=demo`) to a **GET** endpoint → `405 Not Allowed`. **8m 35s**, no plan |

**The levers worked; they just moved the failure.** Each fix did what it was
supposed to. `top_k=20` ended the repetition loop and produced a 23.4s plan. The
sandbox stopped the install flailing. Disabling thinking cut the response to
"reply with exactly: ok" from **159 output tokens to 2**. Attempt 1 was spending
roughly 80× the necessary output on a one-word answer, which is what a stall looks
like before it becomes one. None of it produced a finished plan.

**Attempt 4 is the one that settles it.** Sending headers as form fields to a GET
endpoint is not a sampling artifact or a context problem. It is a broken model of
HTTP. And it reused `hans@example.com` after attempt 3 had correctly identified that
exact placeholder as the cause of a 403. With thinking off, the reasoning that
reached that conclusion was gone. The levers traded one failure mode for another.

**What it was good at.** Two things no larger model did better. It diagnosed the
403 by *saving the response body and reading it* (`/tmp/metno.json`) rather than
inferring from a status code, the best debugging method observed in the benchmark.
And with rule 7 in force and thinking enabled it obeyed cleanly: ~400ms of thought,
then a tool call, where Qwen3.8-27B 4-bit drafted whole files inside `<think>`.

**Verdict:** ❌ for agentic coding on this harness. This is the oldest model tested
(Feb 2026) and Qwen3.6 and Qwen3.8 both work, so read this as a verdict on this
build rather than on 9B-class models. The capability that fails is multi-step tool
use against real APIs, not code generation. It never got far enough to write much.

**The 6 GB rung is unmeasured.** No conclusion about the floor of the ladder follows
from this; a working small model has yet to be tested there.

### `mlx-community/Qwen3.6-35B-A3B-4bit` ⚡ fastest run

MoE: 35B total, **~3B active per token**. Measured under the same 36 GB wired cap as the Qwen3.8
4-bit, same spec, same prompts, same harness.

| | |
|---|---|
| **Architecture** | MoE 35B total / ~3B active, `model_type: qwen3_5_moe` |
| **Backend** | mlx-lm |
| **Thinking** | **disabled** (`enable_thinking: false` in the profile) |
| **Peak RSS** | 18.64 GB |
| **KV cache** | 4.70 GB (MQA + 8-bit KV compression) |
| **Wall clock** | plan **34.9s** + implement **6m 10s** = **6m 45s** |
| **Turns** | 27 |
| **Tests** | 20/20 verified, but see the caveat below |
| **Code quality** | **6.8/10** |

**Speed comes from cheap turns, not fewer of them.** It took *more* turns than the Qwen3.8 4-bit
(27 vs 22), backtracking to fix bugs and fill gaps, and still finished in a fifth of the time.
Two effects compound and should not both be credited to the architecture: ~3B active parameters
instead of 27B dense, and no reasoning tokens at all. The cache figure isolates the architectural
half cleanly: **0.30 GB across 4 sequences after warm-up**, against the dense 4-bit's 1.10 GB, and
against Gemma-4-31B's 865 KB/token.

**The thinking caveat is load-bearing.** Both Qwen3.8 runs had thinking on; this profile disables
it because thinking degrades Qwen3-class models on multi-turn tool use, mainly by spending the
output budget inside the thinking block (arXiv 2606.09662, tested on Qwen3 1.7B-32B). An earlier
version of this note cited "BFCL 12.4% vs 35.8%" here. Those are the DeepSeek R1 vs V3 numbers
from the thinking-mode table above, copied across model families by mistake. That
makes this a fair comparison of *deployed configurations* and an unfair one of *models*. In
particular it cannot be credited with obeying AGENTS.md rule 7. With no `<think>` block, drafting
code inside one is not a thing it can do. What the contrast does establish is that the 4-bit's
rule 7 violation is **fixable by configuration**, which is now a scheduled re-test.

**Faster, but the code is worse.** Six of seven traps avoided: UTC-safe selection, full timeseries
scan rather than trusting `series[0]`, strict `>` thresholds correct at exactly 75/50/25,
`new URL` + `searchParams` on every URL (injection-proof, and rare in one-shot output), inclusive
±90/±180 bounds. It hit the missing-fields trap harder than the dense 4-bit did: no per-field
checks at all, so a Met.no entry lacking `ultraviolet_index_clear_sky`, which happens at night,
prints `UV Index: undefined` and exits **0**, and a missing `cloud_area_fraction` fabricates a
confident "Clear".

**Two defects worth naming:**

- `index.js:6` calls `parseArgs` *outside* the `try` that starts at line 14, so validation errors
  escape the catch at 32-34 and surface as a raw Node stack trace. `node index.js 999 10`
  demonstrates it. A geocode miss, going through the try, prints cleanly. Same program, two
  different error experiences depending on which side of line 14 the throw happens.
- `package.json` declares `devDependencies` **twice**. Last-wins under `JSON.parse` so npm works,
  but any strict tool or human merge will trip on it.

**It knowingly broke the dependency spec.** `test/geocode.test.js:7-9`: *"spec says only axios.
However, tests need mocking. We'll add nock as dev dependency."* Deliberate and disclosed, unlike
Gemma's silent jest. Still a deviation, though, and the other models covered the same ground with
plain injection.

**Verdict:** the throughput result of the benchmark and the strongest argument yet that active
parameter count, not total size, is what matters on bandwidth-bound hardware. But it ships two
silent-wrong-answer paths and a test that cannot fail, so it is fast, not finished. Re-test with
thinking enabled before concluding anything about the model rather than the config.

### `mlx-community/Qwen3.8-27B-4bit`: the 48 GB target candidate

First model measured under the **36 GB wired cap** that simulates a 48 GB Pro machine
(`mise run vram-set 36`). The spec, prompts, AGENTS.md, and harness are identical to the
Q8 run above it in the results table, so the two differ only in quantization.

| | |
|---|---|
| **Architecture** | Dense 27B, `model_type: qwen3_5` |
| **Backend** | mlx-lm (no MTP, the drafter head is `qwen3_5_mtp`, oMLX-only) |
| **Peak RSS** | **14.57 GB** (Q8: 28.9 GB) |
| **KV cache** | 3.28 GB at end of run, 3 sequences |
| **Wall clock** | plan 5m 16s + implement 27m 5s = **32m 21s** |
| **Turns** | 22 |
| **Tests** | 25/25 verified by hand |
| **Code quality** | **8.5/10** |

**Capacity: comfortable. Speed: not.** RSS never moved off 14.5 GB and never approached the 36 GB
ceiling. Memory was never the binding constraint. The problem is the clock: **3.2× the Q8's
10m 10s on identical work**. Halving the weights did not halve the time because the Q8 run had MTP
speculative decoding and this build has none. On this rig the drafter is worth more than the
bandwidth saved by the smaller weights.

**Quantization degraded instruction-following, not output quality.** Two process failures the Q8
did not exhibit under the same rules:

- It **ignored AGENTS.md rule 7** and drafted entire file contents inside `<think>`, then rewrote
  them through tool calls. The workspace copy of AGENTS.md was verified byte-identical to the root.
  The Q8 obeyed the rule, and its thinking became visibly more compact once rule 7 was added.
- It stalled ~4 minutes on the User-Agent question, from the *corrected* spec that gives a working
  example. The Q8 read the same line and moved on.

Both burn output tokens without improving the artifact. This is the cost of 4-bit here. It shows
up as wasted process, not as worse code.

**The code is good.** Reviewed against the [Code review rubric](#code-review-rubric): no severe
bugs, and it avoided every trap on the checklist: UTC-safe closest-entry selection with no
sorted-input assumption, cloud thresholds matching the spec's strict `>` exactly at 75/76, correct
GeoJSON `[lon, lat]` swap with `representasjonspunkt` preferred, `encodeURIComponent` on place
names. Three minor risks, all one family: `?? {}` and `?? 0` on missing Met.no fields print
`undefined°C` or fabricate "Clear" with exit 0, where the empty-timeseries path correctly throws.

**Honest self-report.** The first model whose claims survived a hand check unchanged, including
both disclosed deviations: `Oslo` resolving to "Oslo fylke" (faithful application of the
first-hit rule) and the spec's `temperature`/`humidity` field names not existing in Met.no v2
(correctly mapped to `air_temperature`/`relative_humidity`).

**Verdict:** thorough but slow. It fits the target machine with room to spare and writes the best
code measured so far, but takes half an hour to do what the Q8 does in ten minutes. Recommend it
for the 48 GB target **only** where the Q8 will not fit. Re-test the moment a 4-bit build
with a loadable drafter appears, because that is the entire gap.

### `mlx-community/Qwen2.5-72B-Instruct-8bit` ❌ broken

| | |
|---|---|
| **Architecture** | Dense 72B |
| **VRAM footprint** | ~72 GB (`gpu_wired_limit_gb = 115`) |
| **Backend** | mlx-lm |
| **Declared context** | 128k |

**Result: fails tool calling.** It answers well in chat, but in `opencode` and `aider` it
prints markdown code blocks instead of emitting tool calls, so nothing is ever written to disk.
Strict-JSON prompting ("use strict valid JSON with double quotes") did not fix it. Marked
`status = "broken"` in `profiles/qwen2.5-72b-8bit.toml`.

**Verdict:** unusable for autonomous coding. 72 GB spent for a chat model.

---

### `mvid/Huihui-Qwen3.8-27B-abliterated-MTPLX-Q8` ✅ recommended

| | |
|---|---|
| **Architecture** | Dense 27B + MTP drafter head |
| **VRAM footprint** | ~27–28 GB RSS (`gpu_wired_limit_gb = 96`) |
| **Backend** | oMLX |
| **Declared context** | 131,072 (`MLX_OPENCODE_CONTEXT`) |
| **Chat template** | `qwen_template.jinja` (bound explicitly, see below) |

**Performance:** 11.3–14.3 t/s without MTP, 18–38 t/s with it. Typical tool-call turns land
25–33 t/s at 20–35k context. Leaves ~100 GB of RAM free; zero swap.

**Agentic behaviour:** Fast, autonomous tool use: sequential `bash` + `edit` calls without
babysitting, responses in ~8s at small context. It is the only model tested that reliably
follows an instruction to research external APIs *before* writing code, which is what produced
the 7m 33s weather-cli run.

**Bug fixed: missing chat template.** Out of the box the HF tokenizer had no `chat_template`,
which produced 4-minute prefills and a 44 GB KV cache spike on trivial prompts. Fixed by binding
the Qwen Jinja template via `MLX_CHAT_TEMPLATE`.

**Bug fixed: output cap truncated thinking.** `MLX_OPENCODE_OUTPUT` (written into `opencode.json`
as `limit.output`) is what opencode sends as `max_tokens`; the profile's `MLX_MAX_TOKENS` cannot
raise it. At the default 4096 the model spent its entire budget inside a `<think>` block reasoning
about test design, hit `finish_reason=length` after 3m 48s, and returned a truncated message with
no tool call. opencode then stopped, looking exactly like the abliteration quirk below. Raised to
`MLX_OPENCODE_OUTPUT = 16384` / `MLX_MAX_TOKENS = 32768`. Any thinking model needs headroom beyond
its reasoning budget to actually emit the call.

**⚠️ Quirk: abliteration regression.** This abliterated MTPLX build follows instructions worse
than the base instruct model. It sometimes drafts the entire implementation *inside* a `<think>`
block and then emits EOS without ever calling a tool. Prompting it to use its tools recovers it;
rule 6 in `AGENTS.md` ("THINK AND ACT") exists for this.

**⚠️ Quirk: JSON formatting.** Like Qwen 2.5 it occasionally emits single-quoted tool-call JSON.
Rule 2 in `AGENTS.md` covers it.

**Best run (2026-08-26, 16k output cap, `AGENTS.md` rule 7, corrected spec):**

| Metric | Value | vs previous |
|---|---|---|
| Wall clock | 1m 23s plan + 8m 47s implement = **10m 10s** | −28% (was 14m 05s) |
| Tests | 16/16 passing | 17/17 |
| Turns | 16: 13 `tool_calls`, 3 `stop`, no truncation | same 16 / 13 / 3 |
| Generated | 11,996 tokens in 623s → **19.2 tok/s** | −19% tokens, +8% speed |
| Median turn | **338 tokens** | −28% (was 468) |
| Largest turn | 3,299 tokens | −18% (was 3,999) |
| Peak context | 31.7k | 34.9k |
| MTP | 2.88 tok/cycle, 62–97% acceptance | 2.91, 50–99% |

Same 16 turns and same tool-call ratio, but each turn is smaller: the model reached the same
place having generated 2,900 fewer tokens. It still verified the API shapes before writing,
which is the behaviour worth keeping, but stopped drafting whole files inside `<think>`.

Two changes landed together here (rule 7 and the spec wording), so the split between them is not
isolated; the spec fix owns most of the plan-phase gain, rule 7 most of the per-turn shrink.

**Previous complete run (16k output cap, before rule 7, old spec):**

| Metric | Value |
|---|---|
| Wall clock | 2m 43s plan + 11m 22s implement = **14m 05s** |
| Tests | 17/17, **self-reported, not verified** (workspace deleted before an independent `npm test`) |
| Turns | 16: 13 `tool_calls`, 3 `stop`, zero truncations |
| Generated | 14,892 tokens in 841s → **17.7 tok/s** average, 10.8–34.8 per turn |
| Context | 16.4k → 34.9k prompt tokens |
| Largest turn | 3,999 tokens, which the old 4,096 cap would have cut off |
| MTP | 2.91 tok/cycle avg (1.75–3.67), acceptance 50–99% |

Files: `src/{parse,geocode,weather,output,index}.js` + 5 spec-named test files.

**Not a spec error, a model-invented one.** The run reported that the spec's example User-Agent
returns 403. It does not: the spec says `weather-cli/1.0 github.com/yourname`, which returns
**200**. The model substituted `contact@example.com` on its own and then attributed the resulting
403 to the spec. Verified directly (2026-08-26):

| User-Agent | Result |
|---|---|
| `weather-cli/1.0 github.com/yourname` (the spec's example) | 200 |
| `weather-cli/1.0` / `curl/8` / `test/1.0 someone@example.org` | 200 |
| `weather-cli/1.0 contact@example.com` | **403** |
| `weather-cli/1.0 (contact@example.com)` | **403**, parentheses are irrelevant |

Met.no blocks the literal placeholder domain `example.com`. The 403 is a 162-byte nginx HTML page
with no `Retry-After` and no `RateLimit-*` headers; real throttling returns 429. A later run
misread this 403 as rate limiting and spent minutes on backoff that could never succeed, which is
what inflated its plan phase to 7m 58s.

**Scored dimension:** substituting a placeholder into a working spec, then blaming the spec, then
diagnosing a hard block as throttling. Three separate failures, all worth tracking per model.

Throughput drops steadily with context: 34.8 t/s at 18k prompt, 20.6 t/s at 34k, 18.0 t/s at
34.9k. MTP acceptance holds (mostly 80–95%), so this is backbone prefill cost, not drafter decay.

**Verdict:** the daily driver on rig B. Fast, cheap on memory, strong tool calling, and the only
model whose planning phase can be steered.

---

### `mlx-community/DeepSeek-V4-Flash-0731-2.4bit-mixed` ✅ recommended

| | |
|---|---|
| **Architecture** | MoE, 284B total / ~13B active per token, MLA attention |
| **VRAM footprint** | ~84 GB wired (82.8 GB RSS), `gpu_wired_limit_gb = 115` |
| **Backend** | oMLX (required, `mlx-lm` has no DeepSeek V4 support) |
| **Declared context** | 131,072, `MLX_MAX_TOKENS = 32768` |
| **Chat template** | `deepseek_template.jinja` |

**Performance:** 25–31 t/s decode, holding 25–26 t/s at 35,230 tokens of context. TTFT on an
18k-token prompt ~3.3s thanks to oMLX's paged cache. CPU stays around 1.25 cores. The work is
all on the GPU. MLA keeps the 131k KV cache small enough that context is not the constraint.

**Behaviour:** "code first, debug later", and stubbornly so. Even with an explicit instruction
to probe the APIs first it assumed the response shapes, wrote the implementation, and used
failing tests as its feedback loop. Still finished in 11m 58s with 13/13 tests passing.

**Parity rerun (2026-08-26, 16k output cap, rule 7, corrected spec):** **10m 09s** total
(4m 43s plan + 5m 26s implement), 17/17 tests, down from 11m 58s, and a dead heat with
Qwen3.8's 10m 10s.

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

Two opposite routes to the same wall-clock: DeepSeek runs **twice as many turns at half the size**,
front-loading a written plan and delegating to a sub-agent; Qwen3.8 takes fewer, larger turns and
plans in-context. Median turn 166 tokens is the lowest measured on either rig. This model acts
rather than deliberates, which is exactly the profile the BFCL/TAU-Bench numbers predict.

**Behaviour change: the "code first, debug later" trait is promptable after all.** The earlier run
ignored an explicit instruction to probe the APIs first; under the corrected spec plus `AGENTS.md`
rule 7 it planned for 4m 43s, wrote `IMPLEMENTATION_PLAN.md` to disk, and dispatched a sub-agent
(visible in the log as the parent context dropping from 18.6k to 11.0k). Persisting the plan as a
file is the smarter pattern: it survives compaction and costs one cheap re-read instead of riding
in every later prompt. Qwen3.8 never delegated across four runs.

**Cost note:** it buys that at 79 GB resident vs 28.9 GB. Same speed, same wall clock, 2.7× the
memory. On this hardware the 27B is the better default and the 284B is what you reach for when
the task actually needs it.

**Bugs fixed getting here:** oMLX alias translation (`/` → `--`) in `opencode-init`/`aider-init`;
`~/.omlx/settings.json` `max_context_window` raised from 32,768 to 131,072; temperature locked to
0.6 to stop repeating tool calls.

**Correction: the ~20% second-run speedup was not custom kernels.** It was originally recorded as
such, but the kernels never compiled on this machine (no `xcrun metal`, see the oMLX section). The
gain came from the context and sampling changes made in the same session: raising
`MLX_OPENCODE_CONTEXT` from 16k to 131k stopped the compaction loop, and locking temperature to 0.6
stopped repeated tool calls. Kernel acceleration remains untested.

**Verdict:** the capability ceiling on this machine, and it fits with ~38 GB to spare. Slower in
wall-clock terms than Qwen 3.8 on agentic tasks purely because of how it approaches problems.

---

### `mlx-community/gemma-4-31b-it-8bit` ⚠️ slow but correct

| | |
|---|---|
| **Architecture** | Dense 31B, hybrid sliding-window attention, MoE block |
| **VRAM footprint** | ~31 GB weights, 30.9 GB RSS |
| **Backend** | **mlx-lm**, `model_type: gemma4` (only `gemma4_unified` needs mlx-vlm) |
| **Declared context** | 131,072 |

**Result: correct, and slow.** 20m 23s total (4m 2s plan + 16m 21s implement), 16/16 tests
passing, verified independently with `npm test`, not taken on the model's word. Roughly **2× the wall
clock** of Qwen3.8 (10m 10s) and DeepSeek (10m 09s) for the same task and the same test outcome.

| Metric | Gemma-4-31B | Qwen3.8 MTPLX | DeepSeek V4 |
|---|---|---|---|
| Total | 20m 23s | 10m 10s | 10m 09s |
| Implement turns | 31 | 16 | 30 |
| Median turn | **35s** | ~12s | ~9s |
| Worst turn | 121s | 88s | — |
| Prefill | ~328 t/s | — | — |

The turn count matches DeepSeek's 30 almost exactly; every turn simply costs ~4× as long. There is
no drafter for Gemma. See [Scheduled re-tests](#scheduled-re-tests), where pairing it with
`MLX_DRAFT_MODEL` is the highest-value experiment outstanding.

**⚠️ KV cache is expensive.** Measured 1.65 GB for 1,907 tokens ≈ **865 KB/token**, against 64 KB
for Qwen3.5-9B and 20 KB for Qwen3.6-35B-A3B. At 30k context that is ~26 GB of cache on top of
31 GB of weights. It fits rig B's 96 GB ceiling with room; it **cannot fit the 48 GB Pro target**,
and quantizing the weights does not help because the cache does not shrink with them. This build
of mlx-lm has no `--kv-bits`, so there is no lever for it today.

**Behavioural notes:** it kept an explicit todo list and worked through it. DeepSeek did the same,
so this is a two-of-four trait, not a Gemma distinctive. It also added **jest** as a dependency rather than using the built-in `node:test` the
other models chose, heavier, and the spec does not ask for it. Its coordinate output reads
`Weather in 59.91, 10.75` (comma inserted) where other models emit the input verbatim; the spec
does not pin the form, so this is a divergence rather than a failure.

**Verdict:** correct and well-organised, but priced out on this hardware. Twice the time for the
same result, and a KV footprint that rules out the target machine. Re-test with a draft model
before drawing a final conclusion.

---

## Model evaluations: rig A (M1 Max 32 GB)


### `mlx-community/Qwen3.5-9B-MLX-4bit` ⭐ recommended

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 9B |
| **VRAM footprint** | ~6 GB |
| **Native context** | 262k tokens (`max_position_embeddings: 262144`) |
| **Practical context (32GB Mac)** | ~128k tokens (KV cache budget) |
| **Context headroom (32GB)** | ~19 GB |

**Traits:**
- Fast inference, best tokens/sec of tested models
- Strong tool calling with updated parsers in Qwen3.5
- Solid code generation for common languages
- MLA (Multi-head Latent Attention) = 64KB/token KV cache, very efficient

**Known issue: generation speed degrades at large context.**
Token generation slows beyond ~80k tokens. At ~96k tokens, a single token was observed taking **3 min 28 s** on a 32GB Mac. This caused opencode to silently stop: the SSE chunk timeout fired mid-generation, the connection dropped, the model returned an empty response, and opencode exited the loop with no error message.

- `MLX_OPENCODE_CHUNK_TIMEOUT` is set to `600000` (10 min) to cover this worst case
- Practical comfortable operating range is **~50–70k tokens**; sessions approaching 100k will feel slow
- Diagnose silent stops: check `~/.local/share/opencode/log/opencode.log` for `"exiting loop"` and query `~/.local/share/opencode/opencode.db` for messages with `parts: 0`

**Verdict:** Recommended daily driver. Best balance of speed, RAM, and reliability in head-to-head evaluation (Jun 2026): no tool call loops, no OOM, clean code output. Qwen3.6-35B-A3B is a strong candidate to supersede it if evaluation continues well.

**Measured benchmarks (M1 Max 32GB, vram-set 26, 2026-06-18):**

| Metric | Value | Condition |
|---|---|---|
| Prefill, peak | ~245 t/s | First 2k tokens, fresh KV cache |
| Prefill, 44k prompt | ~205 t/s avg | Full 44k-token prefill from cold |
| Prefill, 14k prompt (cache-warm) | ~179 t/s avg | After a prior 44k session filled cache |
| Prefill degradation | 258→181 t/s | 4k tokens → 44k tokens in same run |
| Decode, extreme context | ~0.005 t/s (208 s/tok) | ~96k tokens, severe degrade, near unusable |

**Missing benchmarks to measure** (none collected yet):
- Decode t/s at 8k / 32k / 64k context (comfortable range)
- Time to first token (TTFT) for typical opencode requests
- Tool call JSON accuracy rate (% valid first attempt)
- Max stable context before OOM (estimated ~100k based on KV measurements)

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
| **Multimodal** | Text, images, audio, video (35M vision embedder + direct audio projection, no separate heavy encoders) |

**Traits:**
- Google Gemma 4 (Jun 2026), Apache 2.0
- Encoder-free multimodal: vision/audio fed directly into LLM backbone, lower latency than encoder-based models
- Reported strong function-calling / JSON schema adherence
- **Requires `mlx-vlm` server** (`model_type: gemma4_unified`), handled automatically by `mise run server`
- **Hybrid attention: `sliding_window=1024`.** Most layers use local attention (1024-token window), only some layers use full global attention. Effectively limits attended context per layer despite 256k native ctx. Also means KV per token is high (~360 KB/token f16 / 180 KB 8-bit). At 64k tokens that's ~11 GB KV alone.

**⚠️ mlx-vlm caching, measured impact:**

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

Compare to qwen3.5-9b at similar context: **~5–10 seconds/turn** (persistent KV cache, only new tokens prefilled).

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
- Reported highly decisive agent, prefers to read logs and edit multiple files directly
- Dense architecture despite the "Ministral" name (Mistral's edge-optimized line)

**KV cache is excellent** (mlx-lm): cold prefill ~150 t/s; subsequent turns only 15–22 tokens (near-instant, 2.83 GB cache after turn 1).

**Fatal issue 1: Mistral role alternation bug.**
The model's `chat_template.jinja` raises an exception when conversation roles don't follow strict `user→assistant→user→assistant` alternation. Root cause: the template's parity counter doesn't reset after tool-call rounds, so any `user` message following a tool round fires the exception. mlx-lm returns HTTP 404 for any exception during generation.

- Patched in `chat_templates/ministral-3-14b-patched.jinja`, which removes the `raise_exception` call (one line). `ns.index` is provably unused after the check block so this is safe.
- `--use-default-chat-template` is a no-op for this model (only activates when no template exists).

**Fatal issue 2: hallucinated garbage output (even with patch).**
After applying the template patch, the model generates fake YAML listing invented chat template file paths instead of responding to prompts. Likely cause: the template's default system message contains a literal `{today}` string (not a Jinja2 `{{ today }}` expression), which renders unexpanded and confuses the model into meta-level generation. Interaction with AGENTS.md may compound this.

**Verdict:** ❌ Broken for opencode agentic use as of Jun 2026. Both issues are fundamental, not config-tunable. The `chat_templates/` infrastructure created here is reusable for other Mistral-family models.

**Measured benchmarks (M1 Max 32GB, 2026-06-18):**

| Metric | Value |
|---|---|
| Prefill, cold (17.3k tokens) | ~150 t/s |
| Prefill, cached (turn 2) | 15 tokens (~0.3s) |
| KV cache after turn 1 | 2.83 GB |
| Turns before failure | 2 |

---

### `mlx-community/granite-4.1-8b-instruct-4bit` 🔲 untested

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 8B |
| **VRAM footprint** | ~4.5 GB |
| **Native context** | 131,072 tokens (128k), confirmed via OpenRouter + IBM docs |
| **Practical context (32GB Mac)** | ~128k tokens (small model, generous headroom) |
| **Context headroom (32GB)** | ~20 GB |

**Traits:**
- IBM Granite 4.1 (2025), Apache 2.0
- Enterprise-reinforced tool calling: Go, Java, C++, Rust, language-server adherence
- Dense model, claimed to outperform much larger MoE models on enterprise benchmarks
- Smallest footprint of tested models, leaves the most headroom for KV cache

> **⚠️ HF path note:** The mlx-community model may be `mlx-community/granite-4.1-8b-4bit` (without `-instruct`). Verify before downloading.

**Verdict:** Untested locally. Best VRAM profile for long-context experiments. Priority for evaluation.

---

### `mlx-community/GLM-4.6V-Flash-9B-4bit` 🔲 untested

| | |
|---|---|
| **Architecture** | MoE hybrid (not pure Dense despite small size) |
| **Active parameters** | 9B |
| **VRAM footprint** | ~5.5 GB+ (vision encoder adds overhead) |
| **Native context** | 128k tokens |
| **Practical context (32GB Mac)** | ~128k tokens (16GB KV budget; vision overhead may reduce practical limit) |
| **Context headroom (32GB)** | ~19 GB |
| **Multimodal** | Text, images (up to 4K), video frames, documents, PDFs, with native vision tool use |

**Traits:**
- Z.AI GLM-4.6V-Flash, open source
- Vision-language model with native multimodal tool use (no conversion to text required)
- Optimized for low-latency local deployment
- MoE hybrid architecture, active params lower than total suggests; inference characteristics may differ from pure dense models
- **Requires `mlx-vlm` server** (`model_type: glm4v`), handled automatically by `mise run server`

**⚠️ mlx-vlm caching limitation:**
`mlx-vlm` clears the KV cache after every completed request. Every opencode tool call re-prefills the full conversation from scratch. See the [Server backends section](#server-backends-mlx-lm-vs-mlx-vlm-vs-omlx) for details.

**Verdict:** Untested locally. Unique proposition: vision-native tool calling for image/document analysis tasks. Best suited for short focused sessions due to cache limitation.

---

### `mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit` ⚠️ too slow

| | |
|---|---|
| **Architecture** | MoE (Mixture of Experts), 128 experts, 8 active per token |
| **Total / active parameters** | 30.5B total / ~3.3B active per token |
| **VRAM footprint** | ~16 GB |
| **Native context** | **256k tokens** (YaRN-extendable to 1M) |
| **Context headroom (32GB)** | ~9 GB |

**Traits:**
- MoE activates ~3.3B params per forward pass, but **all 30B weights stay in VRAM**, hence the 16GB footprint
- Despite low active params, inference was noticeably slow on this hardware
- Tool calling inconsistent in local testing despite excellent benchmark ratings
- Pretrained on 7.5T tokens (70% code), excellent code generation quality
- Tight context headroom, risky with large codebases

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
- Tool calling produced frequent malformed JSON, not viable for aider/opencode
- Superseded by Qwen3.5-9B which is smaller, faster, and more reliable

**Verdict:** Skip. Qwen3.5-9B is strictly better in every dimension.

---

### `mlx-community/Qwen2.5-Coder-32B-Instruct-4bit` ❌ OOM, inconclusive

| | |
|---|---|
| **Architecture** | Dense |
| **Active parameters** | 32B |
| **VRAM footprint** | ~19 GB |
| **Native context** | 32k tokens |
| **Context headroom (32GB)** | ~6 GB |

**Traits:**
- Crashed with `kIOGPUCommandBufferCallbackErrorOutOfMemory`, insufficient headroom on 32GB Mac
- Critical: only ~3GB left for activation buffer after model + 4GB KV cache
- Results inconclusive, could not evaluate quality or tool calling

**Verdict:** Not viable on 32GB Mac. May work on 64GB. Part of the Qwen2.5 generation, not a priority to retry.

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

### `mlx-community/Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit` 💥 OOM

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
- Measured: ~15.7 t/s on M4 Pro 64GB, expect slower on 32GB M1 Max
- Tightest context budget of the tested models: dense 27B leaves only 6GB for KV cache → ~32–40k practical tokens
- Apache 2.0

**Verdict:** 💥 **OOM + broken tool loop.** Crashed 3× with Metal `kIOGPUCommandBufferCallbackErrorOutOfMemory` (always at ~6144 tokens into prefill). Also exhibited 3× tool call JSONDecodeError in first 2 turns, and an **infinite tool loop**: the model repeatedly called the same wrong path (`mlx-workscope` typo), detected "path is wrong" in `<think>` each iteration, but re-issued the identical broken call 8+ times. Opus distillation preserves error *detection* but not error *correction*. **Measured prefill: ~68–71 t/s** (vs ~350–386 t/s for Qwen3.6-35B-A3B). Not viable on 32 GB M1 Max.

**Root cause:** Dense 27B means every forward pass activates all 27B parameters. During prefill, activation tensors for the full sequence length must coexist with the model weights: 14 GB model + 4.4 GB KV cache + prefill activation spike > 26 GB GPU wired cap. No configuration tuning can fix this. It is an architecture constraint.

---

### `mlx-community/gemma-4-26b-a4b-it-4bit` 🔲 untested

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
- **Shared KV Cache:** final attention layers reuse KV from earlier layers, physically less RAM per token than standard models. Context budget stretches further than comparable 14GB dense models
- **Dual RoPE:** prevents context quality collapse at long range
- Hybrid local+global attention (always global at final layer)
- Fast inference despite large total param count, only 4B active per token
- MMLU Pro: 82.6%, AIME 2026: 88.3%, LiveCodeBench v6: 77.1%, strong benchmarks

**Verdict:** Untested locally. Most technically interesting of the new batch: MoE speed + shared KV cache gives more effective context per GB than any other ~14GB model. High priority for evaluation.

---

### `mlx-community/GLM-4.7-Flash-4bit` ❌ not viable

| | |
|---|---|
| **Architecture** | MoE (30B total / ~3–3.6B active per token) |
| **Active parameters** | ~3B per token |
| **VRAM footprint** | ~16 GB |
| **Native context** | 128–200k tokens |
| **Practical context (32GB Mac)** | 48k (OOM at 64k, prefill spike exceeds 26GB cap) |
| **Context headroom (32GB)** | ~9 GB (6GB KV cache at 48k) |

**Traits:**
- Zhipu/Z.AI GLM-4.7-Flash (2026): MoE with 64 routed experts + 1 shared, 4 active per token
- **Full MHA: 20 KV heads = 20 attention heads (no GQA).** KV ≈ 374 KB/token f16 (187 KB 8-bit). At 48k context that's ~8.5 GB KV alone, which leaves almost nothing for activations and explains why OOM was inevitable
- Supports thinking mode (`<think>`/`</think>`/`/nothink`), must be disabled for agentic use
- τ²-Bench: 79.5% agentic score (but with structured scaffolding + greedy decoding, not representative of opencode use)

**Evaluation results (2026-06-19, weather-cli task):**

| Failure mode | Root cause | Status |
|---|---|---|
| Repetition degeneration loop | `temp=0.0` default (greedy) | ✅ Fixed: `MLX_TEMP=0.7` |
| Thinking stalls (3m35s on trivial decisions) | Thinking mode enabled | ✅ Fixed: `enable_thinking=false` |
| Metal OOM at 64k context | Prefill activation spike at 27k tokens (41%) | ✅ Mitigated: reduced to 48k |
| Tool call loop | Repeatedly called `ls` same dir without progress | ❌ Unfixable |
| Generated code with typos | `location3`, `lon3` in 411-line output | ❌ Model quality issue |

**Verdict:** Not viable as daily driver for agentic coding. Multiple infrastructure failures overcome, but fundamental tool call loop and code quality issues cannot be fixed via config. The τ²-Bench score does not translate to reliable opencode use.

---

### `mlx-community/Qwen3.6-35B-A3B-4bit` ✅ recommended

| | |
|---|---|
| **Architecture** | MoE (35B total / ~3B active per token, 256 experts, 8 active, MQA) |
| **Active parameters** | ~3B per token |
| **VRAM footprint** | ~21 GB |
| **Native context** | 262k tokens |
| **Practical context (32GB Mac)** | 96k declared (measured: 8-bit KV = 18.3 KB/token → 1.7 GB at 96k, 22.7 GB wired) |
| **Context headroom (32GB)** | ~3.3 GB at 96k |

**Traits:**
- Qwen/Alibaba Qwen3.6-35B-A3B (April 2026). MoE with MQA: 256 experts, 8 active per token, 2 KV heads, 40 layers
- mlx-lm uses 8-bit KV cache compression: **18.3 KB/token measured** (vs 40 KB/token float16 theoretical)
- At 96k: KV ≈ 1.7 GB, wired ≈ 22.7 GB (3.3 GB headroom, comfortable)
- At 128k: KV ≈ 2.3 GB, wired ≈ 23.3 GB (2.7 GB headroom, feasible)
- Prefill: **~386 t/s avg at 26k tokens**, 1.5–1.7× faster than Qwen3.5-9B (245 t/s peak)
- Generation speed: ~3B active params per forward pass (same as Qwen3.5-9B in practice)
- TodoWrite, tool calling, and task planning working correctly
- Same Qwen3 thinking token mechanism; disabled in profile (`enable_thinking=false`)
- Qwen3.6-27B-4bit was NOT profiled: 0.22 MB/token KV limits to ~32k safely, 4× slower decode
- cache slots must be ≥5: with 3 slots system(2)+user(1) fills all capacity → no assistant caching

**weather-cli benchmark (2026-06-19):**
- 35/35 tests passing (5 files: parser, geocode, weather, output, integration)
- 1,076 lines of code produced (ES module, vitest, nock for HTTP mocking)
- 8 LLM turns to complete; no tool call loops, no stalls, no OOM
- Used `fast-xml-parser`, an interesting dependency choice (XML fallback for Met.no?)
- Session context stayed well within 96k window throughout

**Verdict:** Recommended. Performs on par with or better than Qwen3.5-9B. Faster prefill (1.5–1.7×), larger context (96k vs practical ~64k for 9B at same memory), equal tool calling reliability. Preferred choice when context depth matters.

---

## Recommendations

> Published summary: [`reports/48gb-question.md`](reports/48gb-question.md),
> the readable version of this section, with per-claim confidence levels.

What the benchmark supports today. Every number comes from rig A or rig B; the 48 GB Pro target
is reasoned about, not measured, so capacity claims transfer and speed claims do not.

### Which model

| If you… | Run | Why |
|---|---|---|
| have 96 GB+ and want the best speed/quality balance | **Qwen3.8-27B MTPLX Q8** (oMLX) | 10m 10s with 16/16, the reference run. MTP speculative decoding is what makes it fast, and only oMLX can load the drafter |
| are targeting **48 GB** and value correctness | **Qwen3.8-27B 4-bit** (mlx-lm) | 14.6 GB resident, best code measured (**8.5/10**), fits with a 12 GB cache. But **32m 21s**, no drafter exists for this build |
| are targeting **48 GB** and value turnaround | **Qwen3.6-35B-A3B 4-bit** (mlx-lm) | **6m 45s**, 18.6 GB resident. Ships two silent-wrong-answer paths (**6.8/10**). Review its output, do not trust it |
| have 128 GB and want a second opinion | DeepSeek-V4-Flash 2.4-bit (oMLX) | 10m 09s, dispatches sub-agents, plans to a file. 79 GB resident, a rig B luxury |
| want Gemma | reconsider | Correct but **20m 23s**, and an **865 KB/token** KV cache rules it out of 48 GB regardless of quantization |
| want a 6 GB model | nothing yet | Qwen3.5-9B failed four times. The rung is unmeasured, not disproven |

**There is no single answer for 48 GB.** The fast model writes worse code and the careful model
takes five times longer. Both fit. Pick against what you are doing, and if you take the fast one,
budget the review time you saved on inference.

### Which levers actually matter

Ranked by measured effect, largest first. The first three all beat changing model.

1. **Spec precision.** Naming the Met.no 403/429 distinction cut the plan phase from 7m 58s to
   **1m 23s**. Two sentences, ~6× on that phase.
2. **Output cap.** `MLX_OPENCODE_OUTPUT` at 4096 truncated runs mid-file with
   `finish_reason=length`. 16384 fixed it. A profile that still carries 4096 is a run waiting to die.
3. **Backend choice.** Gemma served by mlx-vlm cleared its cache every request: 43s median turn.
   On mlx-lm: 27s. Check `model_type` in `config.json` against an existing backend module,
   exactly, never by prefix.
4. **Sampling.** `top_k = 20` turned a repetition loop into a 23.4s plan on Qwen3.5-9B. Both
   Qwen profiles shipped with it disabled. Follow the model card.
5. **Thinking on/off.** Disabling it cut a one-word answer from 159 output tokens to 2. It also
   deleted reasoning the model needed. The same run then reused a placeholder contact it had
   previously diagnosed as causing a 403.
6. **`AGENTS.md` rule 7.** Cut the median turn ~28% on the models that obey it. Qwen3.8-27B
   **4-bit ignores it**; the Q8 of the same model does not.
7. **Model choice.** Real, but smaller than the above and rarely the first thing to change.

### How far these results can be trusted

| Claim | Confidence | Why |
|---|---|---|
| Both 4-bit builds fit a 48 GB Pro | **high** | Measured peak RSS across full runs under the cap, at ~half the ceiling. Capacity transfers between machines |
| Attention architecture, not size, drives KV cost | **high** | Consistent across four architectures from 9B to 284B, with a mechanistic explanation |
| Harness levers beat model choice | **high** | Five independent levers, large effects; three of four failures this session were harness-permitted |
| Qwen3.6-35B-A3B is ~5× faster | medium | One run each, and the two are not like-for-like (thinking on vs off). The gap is too large to be noise; the magnitude is one sample |
| Qwen3.8-27B 4-bit writes better code | **low** | 8.5 vs 6.8, one run each, one unaudited reviewer. That margin sits inside plausible run-to-run spread |
| Anything about a real 48 GB Pro's speed | **untested** | The wired cap reproduces the ceiling, not the halved bandwidth. Expect roughly half these speeds |

**Every run is n = 1.** Single samples of a stochastic process at temperature 0.6, no repeats,
no variance estimate. Wall-clock gaps of 5× survive that; a 1.7-point code-score gap does not.

**Both headline runs used sampling we now believe is wrong.** Each ran with `MLX_TOP_K = 0` and
`MLX_TOP_P = 1.0`, against the model card's `top_k 20` / `top_p 0.95`, the exact setting whose
absence turned Qwen3.5-9B's run into a repetition loop. Re-running Qwen3.6 three times with
corrected sampling closes the n=1 gap and the sampling gap together, in about half an hour, and
is the highest value per minute in the backlog.

**One task.** A CLI against two HTTP APIs. Nothing here licenses a claim about refactoring,
debugging, or anything stateful.

### Standing rules

- **Verify the model's claims before clearing anything.** Run `npm test` yourself. Check exit
  codes without a pipe. `$?` after a pipeline is the last command's status, not the program's.
- **A passing test count is only as good as its weakest test.** One submission wrapped eight
  assertions in a `try`/`catch` meant for network errors; Node's `assert` throws, so the catch
  swallowed them. 20/20 was really 19 that could fail and one that could not.
- **Check the workspace is empty before a run.** Two of three workspaces used today held a
  previous run's implementation. A model that finds working code in place is not being measured.
- **Sandbox the run.** Models escape: one listed every sibling workspace's solution, another
  tried to `npm install -g` and `brew tap` a package it had invented. `mise run opencode` now
  launches under `cplt`.
- **Grade code against the [rubric](#code-review-rubric), not impressions.** Speed and quality
  came apart in both directions today. The slowest model wrote the best code, the fastest wrote
  the worst.

---

## Scheduled re-tests

Config capability added after these models were measured. Each is a plausible speed gain that
the recorded numbers do **not** include:

| Model | Change to test | Expected effect | Priority |
|---|---|---|---|
| `gemma-4-31b-8bit` | `MLX_DRAFT_MODEL` (mlx-lm speculative decoding), paired with a small Gemma 4 | 1.5–3× decode, the same lever MTP gives Qwen3.8 | **high**, it is the slowest model with no drafter |
| `qwen3.5-9b`, `qwen3.6-35b-a3b` (rig A) | `MLX_TOP_K = 20`, `MLX_MIN_P` per Qwen model card | Output quality/stability, not speed | medium |
| `glm-4.7-flash`, `qwen3.5-27b-opus-distilled` | `MLX_PREFILL_STEP_SIZE` (lower) | Both were failed as **OOM during prefill**. A smaller prefill batch shrinks exactly that spike and may make them viable | **high**, could overturn two ❌ verdicts |
| `qwen3.8-27b-8bit`, `deepseek-v4-flash-3bit` | oMLX `--memory-guard`, `--hot-cache-max-size` | Cache/OOM behaviour; both ran entirely on defaults | low |
| `qwen3.8-27b-4bit` | `MLX_CHAT_TEMPLATE_ARGS = '{"enable_thinking": false}'` | Its rule 7 violation and 4-minute User-Agent stall are both thinking-phase costs. Qwen3.6 with thinking off ran 5× faster | **high**, cheapest experiment with the largest predicted payoff |
| `qwen3.6-35b-a3b` | thinking **enabled** (drop the profile's `enable_thinking: false`) | The only way to separate "MoE is fast" from "no reasoning tokens is fast". Also tests whether its two silent-wrong-answer paths survive deliberation | **high**, today's headline result rests on this being config, not model |
| harness | expose `repetition_penalty` / `frequency_penalty` per profile | The installed `mlx_lm.server` accepts these **per request** but has no CLI flag, so a profile cannot reach them. This is the textbook remedy for the degenerate loop that killed Qwen3.5-9B attempt 1, and we had no lever for it | **high**, a known gap the benchmark already hit |
| `qwen3.6-35b-a3b`, `qwen3.5-9b` | raise `MLX_CACHE_BYTES` above 3 GB | Both are rig-A tuned for a 26 GB cap. Qwen3.6 overshot to 4.70 GB at 36 GB with no visible thrash. There is headroom the profiles never knew about | medium |

Nothing here invalidates a recorded result. Every number stands for the config it was measured
with. These are upside tests, not corrections.

> ⚠️ **oMLX ignores most profile params.** `omlx serve` takes no model/sampling/template flags, so
> for oMLX profiles `MLX_MAX_TOKENS`, `MLX_TEMP`, `MLX_CHAT_TEMPLATE`, `MLX_CACHE_BYTES` and
> `MLX_CACHE_SIZE` have **no effect**. oMLX reads `~/.omlx/settings.json` instead. `mise run server`
> now prints exactly which params it cannot apply. Anything that must change for an oMLX model has
> to be set in that settings file.

## Testing checklist

When evaluating a new model (`mise run model-download <key>`, `mise run model-use <key>`,
then `mise run server`):

- [ ] `mise run chat`: basic back-and-forth, instruction following
- [ ] `mise run aider`: can it edit files correctly and commit?
- [ ] `mise run opencode`: tool calling (read/write/run), multi-step tasks; runs in `workspaces/<key>/`
- [ ] **weather-cli challenge**: run both [standard prompts](#standard-benchmark-prompts), record plan time, implement time, tests passing
- [ ] Does it actually write files, or only print code into the chat?
- [ ] Context size: does it handle a large file without truncating?
- [ ] Code correctness: does generated code run without edits?
- [ ] Tool calling stability: completes tool calls without looping or malformed JSON?
- [ ] OOM check: monitor server logs for Metal OOM errors at larger context lengths


---

## Standard benchmark prompts

Use these two prompts verbatim for every model so runs are comparable. Both are
issued inside `workspaces/<model-key>/` (see `mise run opencode`), where
`weather-cli/WEATHER_CLI_SPEC.md` and `AGENTS.md` are provisioned.

**1. Plan prompt**

> Read the weather-cli/WEATHER_CLI_SPEC.md and make a short and concrete implementation plan make sure you have a good understanding about the external services and their data strucure for input / output data. Check the external apis do not assume the data model

**2. Implementation prompt**

> Lets start implementing, check your work and ensure tests and the final cli works according to the supplied specification

The "check the external apis do not assume the data model" clause was added after
observing models invent the Met.no / Geonorge response shapes and then spend the
majority of the run repairing that guess. It moves the cost into the plan phase
(~3m 12s for Qwen3.8-27B MTPLX) and makes implementation more direct.

---

## Code review rubric

Wall-clock and a passing test count say nothing about what the model actually wrote.
A model can pass every test with code that silently prints `undefined°C` on a partial
API payload. This rubric exists so every submission is judged against the same
questions, by the same scale, and the resulting grades are comparable.

**Process.** Functional verification comes first and is done by hand, not by the
model's self-report: run `npm test`, run the live suite, check the output line count,
check every exit code without a pipe (`$?` after a pipeline is the last command's
status, not the program's). Only then hand the workspace to a read-only review agent
along with this rubric. The reviewer never runs the tests. It judges what tests cannot.

**Dimensions.** Each scored 1–10, then averaged with these weights:

| Dimension | Weight | The question |
|---|---|---|
| Correctness risks | 30% | What breaks that the tests do not cover? Every finding must name the input that triggers it |
| Error handling | 20% | Are network errors, non-2xx, malformed payloads and empty data explicit and actionable, or do they reach a stack trace, or worse, exit 0 with garbage? |
| Structure | 20% | Is the module split meaningful or cosmetic? Is the entry point thin? Is anything abstracted with one caller? |
| Test quality | 20% | Real assertions at a sensible mock boundary, or trivia that cannot fail? Are the spec's exact boundary values pinned? |
| Idiom and readability | 10% | Naming, dead code, copy-paste; do comments explain *why* or restate the code? |

**Fixed trap checklist.** Every reviewer checks these same items, because they are
where one-shot code actually fails on this spec. Report each as avoided or hit:

1. Timezone: Met.no timestamps carry `Z`; is "closest to now" compared in UTC?
2. Sorted-input assumption: is the timeseries scanned, or is `series[0]` trusted?
3. Cloud-cover thresholds: the spec uses strict `>`. Check the exact boundary values (25 / 50 / 75), not values near them
4. Coordinate order: Geonorge GeoJSON is `[lon, lat]`; `representasjonspunkt` is `nord`/`øst`
5. Missing fields: does `?? 0` / `?? {}` fabricate a confident answer from an incomplete payload?
6. Injection: is user input validated before URL interpolation, and are place names encoded?
7. Float comparison and latitude/longitude range validation at the exact bounds (±90 / ±180)

**Grading discipline.** Judge the submission as a one-shot from a local quantized
model, not against a production codebase. Separate "real bug" from "stylistic
preference" explicitly, and state plainly where the code is genuinely good. A review
that only lists complaints is not usable evidence. If there are no real bugs, say so
rather than inventing some.

**Dependencies are spec-mandated.** `axios` is required by `WEATHER_CLI_SPEC.md`; its
presence is compliance and must not be counted against a model. Anything *beyond* the
spec's dependency list (e.g. jest, where the spec names test files but no framework)
is a genuine finding.
