# The 64 GB tier: which local worker to benchmark, and how, 2026-09-26

Design and desk research. No GPU was used, nothing was downloaded and there are no new
measurements. It builds on [hardware-tier-backlog.md](../2026-09-23-local-model-evaluation/hardware-tier-backlog.md)
(64 GB section), which stays the list of fit tests; this plan adds the model choice, the
worker-role suites and the night order. Facts carry a source; lines marked *estimate* or
*inference* are ours.

## Question

On a 64 GB Mac, which local model saves the most cloud credits **as a worker directed by a
cloud orchestrator**, at the same end-to-end pass rate as cloud-only? If one does, nav-pilot gets
a 64 GB manifest entry, and some classes that are `cloud` today (create-file, edit-multi past
12 call sites, debug) may move to `delegate`. If none does, the 48 GB entries stay the only
offer and 64 GB machines simply run them with more headroom.

The role is fixed by the user: the local model takes a scoped, well-specified subtask from a
stronger model (nav-pilot's local worker and dispatch policy, navikt/copilot#941) and reports
back. It is not an autonomous agent. That decides what we select on and what we measure.

## What shipped

Nothing. This is a plan.

## 1. The memory budget on 64 GB

| Term | Value | Source |
|---|---|---|
| Physical RAM | 64 GB | |
| nav-pilot's rule `wired + minFreeGB ≤ RAM`, minFreeGB = 12 | wired ≤ **52 GB** | `model-manifest` derives `min_ram_gb = wired_limit_gb + 12` (`.mise/tasks/model-manifest:180`) |
| macOS default GPU wired limit | about ¾ of RAM, **≈ 48 GB** | secondary sources only; Apple does not document it ([measurement](https://marianposaceanu.com/projects/apple-silicon-gpu-wired-memory-benchmark)). The 48 GB tier's 36 GB is the same ¾ |
| Pass criterion | peak footprint ≤ wired − 2 GB | backlog, 64 GB table |

**Recommendation:** profile the tier at **48 GB wired** (the default, no `sudo sysctl` on the
user's machine) and treat 52 as the ceiling that a profile may need only with a stated reason.
An entry at 48 wired derives `min_ram_gb` = 60, so every 64 GB profile sets
`machine_min_ram_gb = 64` explicitly (the override exists at `model-manifest:180`).

**The weights do not decide fit.** What we measured at 36 GB wired: Qwen3.8-27B 8-bit peaked at
37.2 GB at 32k and 38.3 GB at 43.7k with a 512-token prefill step, and died with a Metal OOM
near 51k at the default 2048 step ([decision.md §3.3](../2026-09-23-local-model-evaluation/decision.md#33-the-oom)).
The repo's peak formula ([qwen38-tuning.md §4](../2026-09-23-local-model-evaluation/qwen38-tuning.md#4-the-pruned-grid)):

> peak ≈ weights + KV(ctx + out) + prompt cache (one full window) + score transient + 1 GB overhead + 1.6 GB calibration

The transient is about 5 GB × tokens / 51k at a 2048 step for head_dim 256 models, linear in the
step (mlx 0.32.0 has no fused SDPA for head_dim 256). It came in 1.4–1.7 GB conservative against
measurement at 29k and 43.7k.

## 2. Candidates, April–September 2026

Release dates are the Hugging Face `createdAt` of the vendor repo, checked through the HF API
on 2026-09-26. Sizes are the sum of `*.safetensors` files in the MLX repo (HF API, `blobs=true`).
KV bytes per token = full-attention layers × KV heads × head_dim × 2 (K, V) × 2 bytes (bf16),
from each `config.json`. Linear-attention (DeltaNet, Mamba) state and sliding-window caches are
fixed-size and left out. Benchmark numbers are **vendor-reported** unless marked (I).

### 2.1 Fits, and runs on the mlx-lm we have

| Model | Released | Params (total / active) | License | KV / token | Native ctx | Vendor benchmarks | MLX builds (size) | mlx-lm |
|---|---|---|---|---|---|---|---|---|
| Qwen3.8-27B | public 2026-08-14 (repo created 08-05) | 27B dense, 16 of 64 layers full attention | Apache-2.0 | 64 KiB | 262k | SWE-Pro 61.7, TB 2.1 73.0, LCB v6 90.3; no SWE-V on the card. (I) Artificial Analysis index 34, "very verbose" | `mlx-community/Qwen3.8-27B-8bit` 29.5 GB, `-OptiQ-4bit` 20.7 GB, `-4bit` 16.1 GB (all already in the cache) | `qwen3_5`, 0.31.3 and git |
| Qwen3.6-35B-A3B | 2026-04-15 | 35B / 3B MoE, 10 of 40 full | Apache-2.0 | 20 KiB | 262k | SWE-V 73.4, TB 2.0 51.5, LCB v6 80.4; IFEval 86.9 and BFCL v4 63.19 as quoted on Occamy's card | `mlx-community/Qwen3.6-35B-A3B-8bit` **37.7 GB**, `-6bit` 29.1 GB, `-OptiQ-4bit` 24.7 GB (the default, cached) | `qwen3_5_moe`, 0.31.3 and git |
| Occamy-1.0 (Accio-Lab) | 2026-08-13 | post-train of Qwen3.6-35B-A3B, same architecture | Apache-2.0 | 20 KiB | 262k | against its base: IFEval 91.53 vs 86.90, BFCL v4 65.40 vs 63.19, TB 2.1 59.0 vs 49.5, Claw-Eval 82.2 vs 69.5 | `Accio-Lab/occamy-1.0-MLX-4bit` **19.5 GB** (2026-09-18), `-MLX-3bit`; no mlx-community build | `qwen3_5_moe`, 0.31.3 and git |
| Laguna XS 2.1 (Poolside) | 2026-06-20 | 33B / 3B MoE, 10 of 40 full, 30 sliding (512) | OpenMDW-1.1 | 40 KiB + ~63 MB fixed | 262k | SWE-V 70.9, SWE-Multilingual 63.1, SWE-Pro 47.6, TB 2.0 37.5 | `mlx-community/Laguna-XS-2.1-8bit` **35.5 GB**, `-6bit` 27.2, `-4bit` 18.8, `-OptiQ-4bit` 21.0; `poolside/Laguna-XS-2.1-NVFP4-mlx` 21.6 | `laguna` model and tool parser **only in the workspace's git mlx-lm** (872ae88), not in nav-pilot's 0.31.3 |
| Qwen3-Coder-Next | 2026-01-30 (mxfp4 build 2026-05-06); outside the window, kept as the only non-thinking coder that fits | 80B / 3B MoE, 12 of 48 full | Apache-2.0 | 24 KiB | 262k | SWE-V 70.6, TB 2.0 36.2 | `mlx-community/Qwen3-Coder-Next-mxfp4` 42.4 GB, `-4bit` 44.8 GB | `qwen3_next`, 0.31.3 and git |

Sources: [Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B), [its config](https://huggingface.co/Qwen/Qwen3.8-27B/raw/main/config.json),
[AA](https://artificialanalysis.ai/models/qwen3-8-27b); [Qwen3.6-35B-A3B](https://huggingface.co/Qwen/Qwen3.6-35B-A3B);
[Occamy-1.0](https://huggingface.co/Accio-Lab/occamy-1.0); [Laguna XS 2.1](https://huggingface.co/poolside/Laguna-XS-2.1),
[its config](https://huggingface.co/poolside/Laguna-XS-2.1/raw/main/config.json);
[Qwen3-Coder-Next](https://huggingface.co/Qwen/Qwen3-Coder-Next). mlx-lm support was read from
the installed packages: `~/.nav-pilot/local/venv/.../mlx_lm/models/` (0.31.3) and the
workspace `.venv` (git 0.32.0, commit 872ae88).

### 2.2 Considered and left out

| Model | Released | Why not |
|---|---|---|
| BigBang-v1 (endless-frontier, Qwen3.6-35B-A3B post-train) | 2026-08-02 | Its own card reports SWE-Pro 54.2 against 43.6 for the base, but Occamy's card lists it at TB 2.1 33.7, below the base's 49.5. Conflicting third-party numbers; `mlx-community/BigBang-v1-MLX-oQ4e` (21.1 GB) is an oMLX oQ build, loader untested. Reserve |
| IBM Granite 4.2 30B dense | 2026-08-25 | KV 256 KiB/token (64 layers × 8 × 128, no sliding window): 18.9 GB at 72k, the same again for a prompt cache that holds the window. Vendor SWE-V 57, TB 2.1 29.2, BFCL v4 61.4 are below the Qwen options. Official `ibm-granite/granite-4.2-30b-q8-mlx` 31.1 GB |
| Meta Muse Glimmer-30B | 2026-08 | Vendor SWE-V 76.0, but mlx-lm has no parser for its `<atem:function_calls>` tool format; the mlx-community build was made with mlx-vlm. (I) AA: weak agentic Elo, 82 % hallucination rate |
| Cohere North-Mini-Code-1.0 (30.5B / 3B) | 2026-06-05 | mlx-lm has no `cohere2_moe` and no parser for its action format |
| NVIDIA Nemotron 3.5 Lightning 30B-A3B | 2026-08-01 | Loads (`nemotron_h`, OptiQ-4bit 22.8 GB) and its KV is almost free, but vendor SWE-V 51.6 and TB 2.1 24.6 are the weakest here |
| Gemma 4 31B / 26B-A4B | 2026-04-02 | 31B measured at 865 KB/token of KV ([48gb-question.md](../48gb-question.md)); 26B-A4B needs mlx-vlm, which drops the prompt cache per request |
| Qwen3.5-122B-A10B | 2026-02-24 | 4-bit is 69.6 GB; the OptiQ-2bit (46.9 GB) is 2-bit and leaves no room |
| LongCat-Flash-Lite-Sparse (69B / 3B) | 2026-07-31 | No MLX port, no mlx-lm support for its sparse attention |
| Too big even at 3-bit | | DeepSeek-V4 / V4.1 Flash and Pro, GLM-5.x incl. 5.3-Flash (320B), Kimi K2.6 / K2.7-Code / K3, MiniMax M2.7 / M3, MiMo-V2.6, Step-3.7-Flash, Hunyuan Hy3, Laguna S 2.1 (118B), Ling-3.0-flash, Mistral Small 4 (119B), Nemotron 3 Super, Qwen3.8-Flash-Next |
| Nothing new that fits | | OpenAI (no gpt-oss successor), Microsoft (no Phi-5), Meta Llama, Mistral/Devstral (Devstral Small 2 is Dec 2025), ByteDance Seed-OSS, Moonshot Kimi-Linear, AI2 OLMo |

### 2.3 Which benchmarks speak to the worker role

| Benchmark | Measures | For a directed worker |
|---|---|---|
| IFEval | following explicit format and content constraints | **Yes**: spec adherence |
| BFCL v4, τ-bench | tool-call correctness, argument schemas, multi-turn tool use | **Yes**: tool reliability |
| LiveCodeBench | writing a function to a stated contract | **Yes**: code quality on a scoped task |
| Aider polyglot | applying an edit in a given format to named files | **Yes**, but the leaderboard's last entry is from 2025 and lists none of these models |
| SWE-bench Verified / Pro, Terminal-Bench | finding the problem, planning, many turns alone | **Mostly no**: autonomy, which the orchestrator supplies |
| Claw-Eval, AutomationBench | long-horizon agent tasks | No |

The published numbers for our candidates are almost all autonomy benchmarks, and all are
vendor-reported. Only Qwen3.8-27B (LCB 90.3), Qwen3.6-35B-A3B (LCB 80.4, IFEval, BFCL) and Occamy
(IFEval, BFCL) have worker-relevant numbers at all, and no independent source has measured any of
them on IFEval, BFCL or Aider. That is why the ranking below leans on our own measurements and on
architecture, and why the nights measure the worker role directly.

## 3. Shortlist

Wired at 64k = the formula in §1 at 64k context plus an 8k reply (73,728 tokens), a prompt cache
sized to one full window, and a 512-token prefill step for head_dim-256 models. MoE rows are
anchored on optiq's measured 34.3 GB at 60k (24.7 GB of weights, so 9.6 GB over weights with a
12 GiB cache). All are **estimates** until night 64-1 measures them.

| # | Model and build | Released | Params | MLX size | Est. peak at 64k | Profile (weights / wired / min RAM / context) | Why |
|---|---|---|---|---|---|---|---|
| 1 | Qwen3.8-27B 8-bit, 64k | 2026-08-14 | 27B dense | 29.5 GB, **cached** | ≈ 43.6 GB (29.5 + 4.8 KV + 4.8 cache + 1.8 transient + 2.6) | 30 / 48 / 64 / 64k + 8k, cache 4.5 GiB, step 512 | The best local quality we have measured (cheap-ops 31/40), and in August the 8-bit followed the "no drafting in `<think>`" rule that the 4-bit broke. The 48 GB tier caps it at 48k; 64 GB lifts that. No download. Cost: decode ≈ 14 tok/s on this M5 Max, about half on an M5 Pro |
| 2 | Qwen3.6-35B-A3B 8-bit | 2026-04-15 | 35B / 3B | **37.7 GB** | ≈ 41–47 GB (37.7 + 9.6 at a 12 GiB cache; less with 6 GiB) | 38 / 52 (48 if a 6 GiB cache keeps it ≤ 46) / 64 / 64k + 16k | The default model without the 4-bit loss. The only variable against optiq is precision, so it answers "does more precision make a better worker?" at optiq's speed class (3B active). Runs on nav-pilot's current runtime, so it could ship first |
| 3 | Occamy-1.0 MLX-4bit | 2026-08-13 | 35B / 3B | **19.5 GB** | ≈ 29 GB (19.5 + 9.6) | 20 / 36 or 48 / 48 or 64 / 64k–128k | Same architecture as the default. Its card claims gains exactly on the worker axes (IFEval +4.6, BFCL +2.2), vendor-reported. It also fits the 48 GB tier, so a win here helps both tiers. Caveats: `Accio-Lab` is not in the manifest's `ALLOWED_ORGS`, so shipping it needs that decision; benchmarking it through nav-pilot works with the bench-only override (§5.3). The card recommends temp 1.0 and presence_penalty 1.5 |
| 4 | Laguna XS 2.1 8-bit | 2026-06-20 | 33B / 3B | **35.5 GB** | ≈ 45 GB (35.5 + 3.0 KV + 3.0 cache + ≤ 1 transient + 2.6) | 36 / 52 / 64 / 64k + 16k | The only non-Qwen coder that fits, loads and has a tool parser. Coding-specialised; head_dim 128, so no score-matrix spike. Needs the git mlx-lm, so it can run in cheap-ops and the frontier (workspace server) but not through nav-pilot (np-e2e, hybrid) until nav-pilot's runtime moves past 0.31.3. Card sampling: temp 1.0, top_k 20, top_p 1.0 |
| R | Qwen3-Coder-Next mxfp4 (reserve) | 2026-01-30 | 80B / 3B | 42.4 GB | ≈ 49.6 GB (42.4 + 1.8 + 1.8 + ≤ 1 + 2.6) | 42 / 52 / 64 / 64k | Non-thinking coder, which suits a worker. Only fits at 52 wired with 2.4 GB of margin, and its download does not fit in the 100 GB budget together with 2 and 4. Download only if 2 or 4 is dropped |

**Ranking rationale.** 1 costs nothing to download and starts from the best measured quality. 2
isolates one variable against the default and needs no runtime change to ship. 3 is the cheapest
bet on the worker axes and helps the 48 GB tier too. 4 is the one real alternative family, ranked
last because it cannot enter the nav-pilot suites without a runtime update. Autonomy scores
(SWE-V: Laguna 70.9, Coder-Next 70.6, Qwen3.6 73.4) are close together and were not used to rank.

**What each could unlock against optiq.** Today optiq's `delegate` verdict is `trusted` only for
edit-multi-mechanical; create-file, debug, read-qa and edit-single are `cloud`
(`manifest/models.json`). On the frontier, optiq's open frontier for mechanical edits is rung 3
(5–8 call sites) and it breaks at rung 4 (9–16); create-file is `cloud` from rung 1 (1/4);
the cloud clears rung 5 (17–40) ([night-1.md](../2026-09-25-quality-frontier/night-1.md)).
The hypotheses to test:

| Class (as a dispatched subtask) | optiq today | Target for a 64 GB worker |
|---|---|---|
| edit-multi-mechanical, `decompose` | not measured (base breaks at rung 4, 9–16 sites) | open frontier ≥ rung 5 (17–40 sites) with one subtask per file |
| create-file (test from a named spec) | 1/4 at rung 1; retry2 3/4 | open frontier ≥ rung 2 with retry2 |
| edit-single, retry2 | open frontier 2 with retry2 | ≥ rung 4 |
| debug rung 1 (file and function named) | 3/4 | not-yet or better; rungs 3–4 stay cloud |

## 4. Current mlx-lm: what matters for this tier

- **Versions.** No mlx-lm release since v0.31.3 (2026-04-22) ([PyPI](https://pypi.org/project/mlx-lm/#history)). nav-pilot runs 0.31.3 with mlx 0.32.0. The workspace runs a git install at 872ae88 (2026-09-15), labelled 0.32.0, which adds `laguna`, `muse_glimmer` and the `--kv-bits` server flags.
- **Prompt cache.** `LRUPromptCache` enforces `--prompt-cache-bytes` and evicts from the LRU end. On hybrid models (DeltaNet `ArraysCache`, not trimmable) a request that diverges inside a cached turn cannot reuse the longer entry, only a stored shorter prefix (`mlx_lm/models/cache.py:1652-1673`, `:164`). The cache-size rule from qwen38-tuning §2 still holds: the cache must hold a full window. More RAM mostly buys a bigger cache.
- **KV quantisation.** Only the git server has `--kv-bits`/`--quantized-kv-start` (`server.py:1905-1925`). Setting it turns batching off (`server.py:648-653`), the quantised path is not fused, and on hybrid models only the full-attention layers are quantised. nav-pilot's 0.31.3 has no flag for it. Not a lever for this tier yet.
- **Batching.** 0.31.3 has `--decode-concurrency` (default 32) and `--prompt-concurrency` (default 8), and neither is in nav-pilot's whitelist. On 64 GB, two concurrent worker dispatches become possible memory-wise. That is a later experiment, not part of this plan.
- **Speculative decoding.** mlx-lm's draft-model path needs a trimmable prompt cache (`generate.py:533-536`), so **no draft pair works on any `qwen3_5`/`qwen3_5_moe` target**, Occamy included; a draft also disables batching. Trimmable-ArraysCache PR [#1821](https://github.com/ml-explore/mlx-lm/pull/1821) is an open draft. Native MTP in mlx-lm is PR [#990](https://github.com/ml-explore/mlx-lm/pull/990), still open (1.57× on a Qwen3.5-27B 4-bit, 1.11× on the 35B-A3B, by the PR's author). The MTP routes today are oMLX (`Jundot/Qwen3.8-27B-oQ8e-mtp`, ~30 GB, already on the backlog at 48–52 wired) and MTPLX (+24–28 % on a Qwen3.6-27B on an M3 Max 64 GB, [third-party test](https://www.rotecodefraktion.de/en/blog/mlx-mtp-mtplx-test-m3-max/)). Poolside ships DFlash drafters for Laguna (`poolside/Laguna-XS-2.1-DFlash`) for vLLM; oMLX has DFlash. None of these is in scope for the first nights.
- **Tool calls.** All Qwen-based candidates use the `qwen3_coder` parser, which has two September issues: oneOf/anyOf parameters returned as a raw string ([#1907](https://github.com/ml-explore/mlx-lm/issues/1907), open) and an `int("10.0")` crash that makes an agent loop ([#1919](https://github.com/ml-explore/mlx-lm/issues/1919), closed on main; *inference*: still in 0.31.3). Count parser errors per run.

## 5. Benchmark plan

### 5.1 Suites, in the order they decide

1. **Smoke and fit** (`bench-np-e2e -- <profile> --latency-only`, `bench-cheap-ops` ×2). Peak footprint at 30k and at the largest target, cold and warm TTFT, decode, `Insufficient Memory` in the log, loop-guard trips. A profile that peaks over wired − 2 GB at 48 is retried at 52; one that OOMs at 52 is dropped. cheap-ops ×2 is a floor: a candidate below optiq's 29/50 by more than noise does not go on.
2. **Directed-worker frontier** (`bench-frontier`, the worker proxy). `decompose` on edit-multi-mechanical and edit-single (the oracle split into one subtask per file, design §3, the closest proxy for "directed by a stronger model"), `retry2` on create-file (test-writing from a named spec) and edit-single. Base ladders for the same classes run once per model as the autonomy baseline only; they do not rank models.
3. **Hybrid arm** (`bench-hybrid`, through `night-run-2`'s `hybrid` kind): a Sonnet 5 orchestrator dispatching to the local worker, against a dispatch-disabled control. This is the suite that answers the question. Its first run on 25 September produced no valid samples (Copilot API outage, pending-tasks §8.3), so optiq needs a fresh baseline under Sonnet 5 before any 64 GB worker is compared with it.
4. **np-e2e full** (the Copilot path through nav-pilot and its loop guard) for the survivors that run on nav-pilot's runtime.
5. **decide sets** (`bench-decide-limits`, `bench-decide-sets` with `--models`) for the survivors. Kev and Laya are planned separately in [pending-tasks §8.6](../2026-09-23-local-model-evaluation/pending-tasks.md#86-kev-4b-and-laya-mlx-plan) and not repeated here; on 64 GB the question worth adding there is whether a decision model can sit beside the worker without evicting its prompt cache (backlog, 64 GB table).

### 5.2 Metrics

Per (model, orchestrator, policy hash), from the hybrid files (`local_calls`, `cloud_steps`,
`cloud_tokens`, `cloud_cost_usd`, `verified`, `seconds` are already recorded per sample) and the
frontier files:

| Metric | How | Exists today |
|---|---|---|
| Dispatched-subtask pass rate | frontier `decompose`/`retry2` k/n per rung; hybrid samples with `dispatched` true | yes |
| End-to-end success | hybrid `verified`, both arms | yes |
| Cloud credits and tokens saved | hybrid arm against control: median `cloud_cost_usd` and `cloud_tokens.total` ratio | yes (list-price estimate, not Copilot credits) |
| Wall time | `seconds`, median and p90 | yes |
| Orchestrator rework | cloud edit/write tool calls on a file the worker changed, after its dispatch returned, from the sample's JSONL log | **no**: needs a small analysis in `bench-hybrid` (not written here) |
| Honest reporting | worker says "done" while its own change fails the verifier | partly: frontier verifier plus the worker's last message; needs a tag |
| Staying in scope | files changed outside the task's allowed set (frontier verifiers reject this), identical-call runs, loop-guard trips | yes |

**The decision rule, fixed before the runs:** among candidates whose hybrid `verified` rate is not
worse than the control's (one-sided Fisher p ≥ 0.1 for "worse", n ≥ 16 per arm on the trusted
cell), rank by the median cloud-cost ratio (hybrid ÷ control), then by wall time. A candidate
with more rework than optiq at the same ratio ranks below it.

### 5.3 Night order

Nights start at 18:00 from the main checkout. The frontier nights already planned (night 2,
the `retry2` replication in `night-2.queue`, and design §6.2's nights 3–5 for optiq and
Qwen3.8 at 36 GB) keep their place; these nights slot in after the `retry2` replication, because
the frontier variants below reuse whatever it concludes.

| Night | Wired | What | Est. GPU / cloud |
|---|---|---|---|
| D (daytime) | – | Downloads, per §6. Profiles for the tier, in a PR reviewed before the night (see §8) | none |
| 64-1 | 48 (52 on retry) | Fit and smoke: `--latency-only` for all five profiles (the four plus optiq at 48 wired as the control), then cheap-ops ×2 each. Stop a profile on OOM at 52 | ≈ 7.5 h / $0 |
| 64-2 | 48 | Directed-worker frontier for the survivors plus optiq: `decompose` on edit-multi r3–r6 and edit-single r3–r5, `retry2` on create-file r1–r3 and edit-single r1–r2, 2 runs × 2 tasks a rung; base only where no night-1 base exists | ≈ 7–8 h / $0 |
| 64-3 | 48 | Hybrid arm, Sonnet 5 orchestrator: optiq re-baseline with control on the trusted cell (4 targets × 2 arms × 8), then the best one or two 64 GB workers on the same rungs, hybrid arm only against the same control | ≈ 6–8 h / ≈ $20–30 at Sonnet 4.6 prices; Sonnet 5 unmeasured |
| 64-4 | 48 | np-e2e full for survivors on nav-pilot's runtime; decide-limits and decide sets for survivors; the backlog's 64 GB fit rows (8-bit cold/warm at 64k, OptiQ-4bit at 131k) | ≈ 5 h / $0 |
| 64-5 | 48 | Replication of whatever moved a frontier or won 64-3, at n ≥ 8 per arm (design §7 rule 2); one balloon run per survivor (§7) | ≈ 6 h / ≈ $10 |

**Occamy through nav-pilot needs the new binary.** nav-pilot refuses `Accio-Lab` weights, so on
day 64-0 its np-e2e step fell back to optiq and stopped on the model mismatch. navikt/copilot
#989 added a bench-only override: `NAV_PILOT_BENCH_MANIFEST` makes nav-pilot read one manifest
file and nothing else, and `NAV_PILOT_BENCH_ALLOW_ORGS` allows a named publisher from that file
only. `bench-np-e2e`, `np-serve` (under `decide` and `hybrid`) and `bench-navpilot-e2e` set both
when the selected binary has #989, and keep the old cache rewrite for older builds.
`.bench-logs/bin/nav-pilot-main-dd859ac6` (navikt/copilot main, 2026-09-26) has it;
`nav-pilot-main-2e1e8ee1`, which nights 4 and 64-1 pin, does not. The steps that need the new
binary are the ones that start nav-pilot's own server for Occamy: an `e2e` step for Occamy (a
64-1 retry), the hybrid arm with Occamy as worker (64-3), and np-e2e full and the decide sets
for Occamy (64-4). Cheap-ops and the local frontier arm (64-2) run on the workspace server and
do not depend on it. From 64-2 on, the launchers set
`BENCH_NAV_PILOT=/Users/hans/mlx-workspace/.bench-logs/bin/nav-pilot-main-dd859ac6`.

Laguna is left out of 64-3 and 64-4 unless nav-pilot's runtime has moved to an mlx-lm with
`laguna` by then. If a candidate is dropped on 64-1, the reserve (Qwen3-Coder-Next mxfp4) may take
its slot on 64-2, if its download fits the remaining budget.

## 6. Downloads

The user pre-approved up to **100 GB** for this shortlist, on AC power and an untethered network.

| Order | Repo | Size | Running total |
|---|---|---|---|
| – | `mlx-community/Qwen3.8-27B-8bit`, `mlx-community/Qwen3.6-35B-A3B-OptiQ-4bit` | already cached | 0 |
| 1 | `Accio-Lab/occamy-1.0-MLX-4bit` | 19.5 GB | 19.5 |
| 2 | `mlx-community/Qwen3.6-35B-A3B-8bit` | 37.7 GB | 57.2 |
| 3 | `mlx-community/Laguna-XS-2.1-8bit` | 35.5 GB | **92.7 GB** |
| reserve | `mlx-community/Qwen3-Coder-Next-mxfp4` | 42.4 GB | over budget; only in place of 2 or 3 |

If the budget must shrink, `mlx-community/Laguna-XS-2.1-4bit` (18.8 GB) replaces the 8-bit and
brings the total to 76.0 GB; it then measures a different trade-off (optiq-like size) and the
report must say so. Free disk on 26 September was 1.1 TiB (pending-tasks §8.6), so disk is not
the limit; the budget is.

**GO / NO-GO for the download step.** NO-GO if any of 1–5 fails.

1. Approval covers these repos and the total stays ≤ 100 GB (above). Anything else needs a new approval.
2. On AC power (`pmset -g ps` says "AC Power").
3. Not tethered: `route get default` names Wi-Fi or Ethernet, not an iPhone USB or Bluetooth interface, and `ipconfig getsummary en0` shows the usual SSID. The repo has no automatic tether check.
4. No GPU run holds the queue: no `.bench-logs/.queue.lock`, nothing matching `night-run|bench-` running. A download next to a run invalidated six of eleven tasks once (`bench-hybrid` docstring, preflight 3). Never start one after 17:30 on a night-run day.
5. xethub: `mise run bench-netcheck -- --for download`. python/hf_xet → `cas-server.xethub.hf.co` is blocked in Little Snitch today. Fetch one small file first (the repo's `README.md`); if xet fails, use `HF_HUB_DISABLE_XET=1` (files then come over `cas-bridge.xethub.hf.co` / `cdn-lfs.hf.co`), or ask the user for a time-limited allow rule.
6. Token only through fnox, never printed: `fnox exec -- env HF_HUB_DISABLE_XET=1 hf download <repo>`. `mise run model-download <key>` already wraps `fnox exec` once the profiles exist.

After each repo: check the file count and total against the HF listing, and `config.json`'s
`model_type` against the backend module (48gb-question, "How we evaluate the next model", step 1).

## 7. Testing the 64 GB tier on the 128 GB machine

| Lever | How | Emulates |
|---|---|---|
| Wired cap | `mise run vram-set 48` (52 on retry); back to 36 after the night, since the night-run and the 48 GB baselines assume 36 | The GPU's working-set ceiling: what decides OOM and the prefill guard. This is what the 48 GB work used |
| Memory pressure | A balloon process that allocates about 64 GB and writes **random** bytes to every page (zero or repeated pages are compressed by macOS to almost nothing), held for the run; or `memory_pressure -l` without `-S`, which really allocates. `memory_pressure -S` only simulates the notification and is not enough | The other 64 GB being absent: compression, swap and what an IDE, a browser and Copilot leave. One run per survivor, recording swap from the hybrid files' `memory` block |

**What this does not emulate.** This host is an M5 Max with a 40-core GPU and 614 GB/s. 64 GB Macs
sold now include the M5 Pro (16- or 20-core GPU, 307 GB/s, MacBook Pro and Mac mini) and the M5
Max 32-core (460 GB/s) ([Apple](https://support.apple.com/en-us/126318),
[Mac mini](https://www.apple.com/mac-mini/specs/)). Decode is bandwidth-bound, so expect about half
the decode speed on an M5 Pro; prefill tracks GPU cores, so also about half with 20 cores. SLC
size, thermals (a MacBook under sustained load) and SSD swap speed differ too. The 48 GB work
also found that the cap itself changes behaviour (a 220-call loop at 36 GB that never happened at
115 GB, [48gb-question.md](../48gb-question.md)), so always compare models at the same cap.
Report every speed as "this host, scale by bandwidth", and confirm on a real 64 GB M5 Pro before
shipping a latency claim.

## 8. What carries over from the 48 GB tier

| Result | Carries over as | Caveat |
|---|---|---|
| optiq cheap-ops 28/40 and 29/50 at temp 0.6, 36 wired | Baseline for the smoke test | Different cap; 64-1 runs optiq at 48 wired as the control |
| Frontier night 1, optiq base and levers, and Sonnet 5's cloud arm (p_cloud per rung) | p_cloud for the bar, and optiq's base frontiers | Same tasks sha and harness sha only; `harness_sha` changes when a lever becomes default |
| Qwen3.8-27B 8-bit: cheap-ops 31/40, e2e 12/12 at 48k, peaks 37.2 / 38.3 GB | Anchor for the fit formula and quality | Its 64k point is new |
| Qwen3.8-27B OptiQ-4bit: 18/30, 12/12 sessions, 37.2 GB at 54.6k | Reference for a dense 4-bit | |
| decide-limits and decide sets for optiq and OptiQ-4bit | Baselines for decide | |
| August hybrid 35/35 (Sonnet 4.6, old policy text) | **Does not carry over**: orchestrator and policy changed | Re-baseline on 64-3 |

**Prerequisites before night 64-1 (daytime, in a PR, never while a night run is live):**

- Profiles `profiles/<key>-64g.toml` for the four candidates and optiq at 48 wired, with `gpu_wired_limit_gb`, `machine_min_ram_gb = 64` and each model card's sampling (Occamy and Laguna ask for temp 1.0). Not offered in the manifest.
- A queue file for the frontier nights (`night-run-3 --queue`) with `FRONTIER_MODEL` per step, and a `night-run-2`-style hybrid block with `HYBRID_CLOUD_MODEL=claude-sonnet-5` (Copilot retired Sonnet 4.6).
- The rework count in `bench-hybrid` (§5.2).
- `min_ram_gb` enforcement in nav-pilot, still open per the backlog: without it a 64 GB entry reaches 48 GB machines.

## 9. What nav-pilot would need for this tier

- **Capabilities are already per entry and already split `delegate` from `local`.** `delegate` is "dispatched by a cloud orchestrator", which is the worker role. A 64 GB entry gets its own block, so no schema change is needed for the tier itself.
- **Scope `delegate` verdicts to the spec the orchestrator gives.** A verdict earned under `decompose` holds only if the dispatch policy tells the orchestrator to split per file and name the exact signature and the files. Proposal: record the variant in the condition (the frontier already keys rows by variant), and publish a verdict earned under a variant only together with the policy sentence that produces it. The integer `limits` from frontier design §7 (`call_sites`, `files`) is the other half.
- **Dispatch policy text** (#941 generates it from capabilities). For a worker it should require of each dispatch: the files to touch, the exact change or signature, the command that verifies it, and "report what you changed and whether the command passed". The honest-reporting metric in §5.2 tests the last clause.
- **Retries** (`retry2`) are the orchestrator's check-and-retake; a verdict earned with retries should say so in the policy ("verify the worker's result and send it back once with the error").
- **Runtime.** Laguna needs nav-pilot's mlx-lm past 0.31.3. KV quantisation and speculative decoding are not available on this runtime for the Qwen candidates (§4).

## Limits

- Every benchmark number in §2 is vendor-reported, except the Artificial Analysis indexes. None was measured by an independent source on IFEval, BFCL or Aider. Different benchmarks (SWE-V against SWE-Pro, TB 2.0 against 2.1) are not comparable across rows.
- All fit numbers are arithmetic from a formula calibrated on one model (Qwen3.8-27B 8-bit) and one MoE anchor (optiq). Laguna's sliding-window cache and Occamy's identical config are assumed, not checked on a load.
- The hybrid arm has no valid data under the current orchestrator and policy. Everything in §5.2 depends on 64-3 producing it.
- One codebase for the frontier (a Ktor service), and a few targets for the hybrid arm.
- Speed numbers from this host overstate a 64 GB Pro machine by about 2×.

## Reproduce

Nothing to reproduce yet. The sizes and dates in §2 come from
`https://huggingface.co/api/models/<repo>?blobs=true` (sum of `*.safetensors`, `createdAt`).

## Sources

- [hardware-tier-backlog.md](../2026-09-23-local-model-evaluation/hardware-tier-backlog.md), [decision.md](../2026-09-23-local-model-evaluation/decision.md), [qwen38-tuning.md](../2026-09-23-local-model-evaluation/qwen38-tuning.md), [48gb-question.md](../48gb-question.md)
- [Quality-frontier design](../2026-09-25-quality-frontier/design.md), [night 1](../2026-09-25-quality-frontier/night-1.md)
- [Copilot mixed mode research](../2026-09-24-copilot-mixed-mode/research.md) §3.2 (the hybrid arm), [pending-tasks.md](../2026-09-23-local-model-evaluation/pending-tasks.md) §8.3, §8.6
- `manifest/models.json`, `.mise/tasks/model-manifest`, `.mise/tasks/_profiles.py`, `.mise/tasks/bench-hybrid`
- mlx-lm: [releases](https://github.com/ml-explore/mlx-lm/releases), [SERVER.md](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/SERVER.md), PRs [#990](https://github.com/ml-explore/mlx-lm/pull/990), [#1821](https://github.com/ml-explore/mlx-lm/pull/1821), issues [#1907](https://github.com/ml-explore/mlx-lm/issues/1907), [#1919](https://github.com/ml-explore/mlx-lm/issues/1919)
- Model cards and configs linked in §2; [Artificial Analysis](https://artificialanalysis.ai/); [Aider leaderboard](https://aider.chat/docs/leaderboards/) (no 2026 entries)
- Apple: [MacBook Pro M5 Pro/Max](https://support.apple.com/en-us/126318), [Mac mini](https://www.apple.com/mac-mini/specs/), [Mac Studio](https://support.apple.com/en-ca/128107)
