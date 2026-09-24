# Profile audit, 2026-09-24

Every file in `profiles/*.toml`, tracked and untracked, checked for one question: can it load at
all? A profile that loads but scores badly stayed in this pass; the user later removed seven of those (see the last removal section).

How each column was checked:

- **HF**: `GET https://huggingface.co/api/models/<id>` with a token. A 404 with a token means
  the repo is missing or private to someone else. No repo returned 403 or `gated`.
- **Format**: `config.json` carries an MLX `quantization` block, weights are safetensors, and
  the repo has the `mlx` tag. None was GGUF or CUDA-only.
- **Loader**: `_profiles.load(key)`, the call `model-use` makes, run without starting a server.
  All 37 passed. The architecture was also checked against the installed backend: mlx-lm
  0.32.0 and mlx-vlm 0.7.1 in `.venv`.
- **Refs**: mentions of the key outside `profiles/`. That covers `OFFERED` in
  `.mise/tasks/model-manifest`, queue and bench task scripts, Markdown docs and `bench/`
  result files. "none" means nothing outside the profile itself.

The machine has 128 GiB of unified memory.

## Removed

| Key | MLX_MODEL | Backend | Status | Why |
|---|---|---|---|---|
| `qwen3.8-27b-4bit-quasar` (untracked) | `mlx-community/Qwen3.8-27B-4bit-QUASAR` | mlx-lm | untested | The repo does not exist: 404 with a token. No MLX build of QUASAR exists anywhere. The only builds are NVFP4/compressed-tensors for vLLM on Blackwell (`QUASAR-QAT/Qwen3.8-27B-QUASAR-NVFP4`, created 2026-08-23, and its forks) and `LeanQuant/quasar-qwen3.8-27b*` (also compressed-tensors). The file was never committed, and no commit ever named that repo. PLAN.md §11 item 4 had already recorded "no native Apple Silicon/MLX port". |
| `deepseek-v2.5-4bit` | `mlx-community/DeepSeek-V2.5-4bit` | mlx-lm | testing | The repo does not exist: 404 with a token. The nearest MLX 4-bit builds, `mlx-community/DeepSeek-V2.5-MLX-AQ4_1_64` (same base) and `mlx-community/DeepSeek-V2.5-1210-4bit`, are 132.7 GB of weights, more than the 128 GiB machine. The profile assumed 115. The profile was never run: nothing references it. `mlx-community/DeepSeek-V2.5-1210-3bit` would fit if anyone wants this model back. |

## Repointed or fixed

| Key | MLX_MODEL | Backend | Status | Change |
|---|---|---|---|---|
| `command-r-plus-4bit` | `mlx-community/c4ai-command-r-plus-08-2024-4bit` | mlx-lm | testing | Was `mlx-community/Command-R-plus-08-2024-4bit` (404). The repo lives under its `c4ai-` name: MLX 4-bit, gs64, `cohere` arch, 58.4 GB. |
| `qwen3.8-flash-next-4bit` (was untracked, now committed) | `mlx-community/Qwen3.8-Flash-Next-4bit` | **mlx-vlm** | untested | The repo exists and is MLX 4-bit (gs32, `qwen4_exp`). It could not load as written: `qwen4_exp` is in mlx-vlm but not in mlx-lm 0.32.0, so the backend is now `mlx-vlm`. The weights are 111.5 GB, not 22 GB, so `model_vram_gb` is now 104 and `gpu_wired_limit_gb` is 118 (was 96). Under mlx-vlm the loader warns that `MLX_TOP_P/TOP_K/MIN_P`, the cache settings and `MLX_CHAT_TEMPLATE_ARGS` (`enable_thinking: false`) are ignored. mlx-vlm also clears the KV cache between requests. |

## Kept

All of these return 200, are MLX safetensors with an MLX quantization block, pass the loader, and
use an architecture the installed backend has.

| Key | MLX_MODEL | Backend | Status | Refs |
|---|---|---|---|---|
| `deepseek-v4-flash-3bit` | `mlx-community/DeepSeek-V4-Flash-0731-2.4bit-mixed` | omlx | recommended | docs |
| `gemma-4-12b` | `mlx-community/gemma-4-12B-it-4bit` | mlx-vlm | untested | docs |
| `gemma-4-26b-a4b` | `mlx-community/gemma-4-26b-a4b-it-4bit` | mlx-vlm | untested | docs |
| `gemma-4-31b-8bit` | `mlx-community/gemma-4-31b-it-8bit` | mlx-lm | testing | docs |
| `glm-4.6v-flash-9b` | `mlx-community/GLM-4.6V-Flash-4bit` | mlx-vlm | skipped | docs |
| `granite-4.1-8b` | `mlx-community/granite-4.1-8b-4bit` | mlx-lm | untested | docs, results |
| `kat-coder-v2.5` | `mlx-community/KAT-Coder-V2.5-Dev-OptiQ-4bit` | mlx-lm | untested | docs |
| `llama-3.1-70b-8bit` | `mlx-community/Meta-Llama-3.1-70B-Instruct-8bit` | mlx-lm | testing | none |
| `mistral-large-2-4bit` | `mlx-community/Mistral-Large-Instruct-2407-4bit` | mlx-lm | testing | none |
| `mixtral-8x22b-4bit` | `mlx-community/Mixtral-8x22B-Instruct-v0.1-4bit` | mlx-lm | testing | none |
| `qwen2.5-14b` | `mlx-community/Qwen2.5-Coder-14B-Instruct-4bit` | mlx-lm | untested | none |
| `qwen3-30b-a3b` | `mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit` | mlx-lm | untested | docs |
| `qwen3.5-9b` | `mlx-community/Qwen3.5-9B-MLX-4bit` | mlx-lm | recommended | setup task, mise.toml, docs |
| `qwen3.6-27b-4bit` | `mlx-community/Qwen3.6-27B-4bit` | mlx-lm | untested | docs |
| `qwen3.6-35b-a3b` | `mlx-community/Qwen3.6-35B-A3B-4bit` | mlx-lm | recommended | queue, docs, results |
| `qwen3.6-35b-a3b-dwq` | `mlx-community/Qwen3.6-35B-A3B-4bit-DWQ` | mlx-lm | recommended | none |
| `qwen3.6-35b-a3b-optiq` | `mlx-community/Qwen3.6-35B-A3B-OptiQ-4bit` | mlx-lm | untested | OFFERED, queue, docs, results |
| `qwen3.8-27b-4bit` | `mlx-community/Qwen3.8-27B-4bit` | mlx-lm | untested | OFFERED, queue, docs, results |
| `qwen3.8-27b-4bit-reppen` | `mlx-community/Qwen3.8-27B-4bit` | mlx-lm | testing | docs |
| `qwen3.8-27b-8bit` | `Jundot/Qwen3.8-27B-oQ8e-mtp` | omlx | testing | queue, docs, results |
| `qwen3.8-27b-8bit-mlx` | `mlx-community/Qwen3.8-27B-8bit` | mlx-lm | untested | OFFERED, queue, docs, results |
| `qwen3.8-27b-8bit-nocache` | `Jundot/Qwen3.8-27B-oQ8e-mtp` | omlx | testing | queue |
| `qwen3.8-27b-8bit-nopin` | `mlx-community/Qwen3.8-27B-8bit` | mlx-lm | testing | queue, docs, results |
| `qwen3.8-27b-8bit-nopin-c32k` | `mlx-community/Qwen3.8-27B-8bit` | mlx-lm | testing | docs |
| `qwen3.8-27b-8bit-nopin-c40k` | `mlx-community/Qwen3.8-27B-8bit` | mlx-lm | testing | docs |
| `qwen3.8-27b-8bit-nopin-c48k` | `mlx-community/Qwen3.8-27B-8bit` | mlx-lm | testing | docs |

## Removed 2026-09-24 (user decision)

All of these loaded. They were removed because of their recorded status, or for the abliterated build, by the user's decision. No script, queue or `OFFERED` entry referenced any of them. MODELS.md keeps their results. The two follow-up rows in MODELS.md that named them now say the profiles must be restored from git history first. `chat_templates/ministral-3-14b-patched.jinja` stays, because MODELS.md cites it.

| Key | MLX_MODEL | Backend | Status | Why |
|---|---|---|---|---|
| `ministral-3-14b` | `mlx-community/Ministral-3-14B-Instruct-2512-4bit` | mlx-lm | broken | broken: template error, then garbage output. PLAN.md:88 traces the garbage to a harness bug (`MLX_CHAT_TEMPLATE` passed as a path), so the verdict was never a clean test of the model. |
| `qwen2.5-72b-8bit` | `mlx-community/Qwen2.5-72B-Instruct-8bit` | mlx-lm | broken | broken: writes to the chat instead of making tool calls. |
| `qwen3.8-27b-6bit` | `lmstudio-community/Qwen3.8-27B-MLX-6bit` | mlx-lm | broken | broken: pathologically slow under mlx-lm (R2 1546.8 s). Its results stay in MODELS.md and `bench/weather-qwen3.8-27b-6bit.json`. |
| `glm-4.7-flash` | `mlx-community/GLM-4.7-Flash-4bit` | mlx-lm | failed | failed: OOM during prefill on a 26 GB cap. |
| `qwen2.5-32b` | `mlx-community/Qwen2.5-Coder-32B-Instruct-4bit` | mlx-lm | oom | oom on a 32 GB machine. |
| `qwen3.5-27b-opus-distilled` | `mlx-community/Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit` | mlx-lm | oom | oom on a 32 GB machine, plus a tool-call loop. |
| `qwen3.8-27b-8bit-48gb` | `mvid/Huihui-Qwen3.8-27B-abliterated-MTPLX-Q8` | omlx | testing | abliterated build (`mvid/Huihui-…-abliterated-MTPLX-Q8`). |

## Candidates for removal (they load but nothing uses them)

These are not removed, because they would load. Removing them is a separate decision. No
reference outside the profile: `llama-3.1-70b-8bit`, `mistral-large-2-4bit`,
`mixtral-8x22b-4bit`, `qwen2.5-14b`, `qwen3.6-35b-a3b-dwq`, and the repointed
`command-r-plus-4bit`.
