# `alpha decide` as a service at NAV scale: research, 2026-09-26

Desk research, no new measurements. Figures from outside this repo carry their source URL.
Our own accuracy and latency figures are copied from the files named next to them.

Labels: **[fact]** = a cited source says it. **[inference]** = our own estimate or reading,
usually an extrapolation from a cited figure. **[assumption]** = a number we chose to size the
problem, not one we know.

## Question

What would it take to run `nav-pilot alpha decide` as a central service for all of NAV instead of
on each developer's Mac? Can it run on CPU, and what is available in `europe-north1`, where NAIS
runs? If the answer is "one or two GPUs", a shared service for hooks and CI is a small platform
decision. If it is "a pool of GPUs" or "only outside europe-north1", it becomes a budget and
data-residency decision.

## What shipped

Nothing. This is a sizing note for a decision that has not been taken.

## Summary

| Option | Hardware | Covers | Latency | Monthly |
|---|---|---|---|---|
| Local on Macs (today) | the developer's Apple Silicon | developer hooks | p50 0.38 s at ~1k characters, 0.84 s at ~8k (~2.5k tokens), 2.5 s at ~30k (~9k tokens), measured | $0 |
| (i) CPU + small model | 2× `c4d-standard-32` | hooks and CI, with an encoder model | encoder ~0.1–0.3 s; a 4B decoder ~7 s at 2k tokens, ~30 s at 8k | ~$1.4–2.9k (1-yr CUD to on-demand) |
| (ii) 1+1 G4 (RTX PRO 6000, 96 GB), vLLM, 35B-A3B FP8 | 2× `g4-standard-48` | hooks and CI for all of NAV | ~0.1 s at 2k tokens, ~0.2–0.4 s at 8k | ~$3.2k (3-yr CUD) to ~$7.2k (on-demand) |
| (iii) G4 pool | 4–10× G4 | runtime use inside applications | as (ii) | ~$6.4–36k |

The local row is optiq on the `length` set of
[`bench/decide-limits-20260925-014512.md`](../../bench/decide-limits-20260925-014512.md)
(p50 383, 843 and 2475 ms at about 1k, 8k and 30k characters). That set is sized in characters;
the token counts use the 3.2 characters per token in
[`bench/decide-limits/README.md`](../../bench/decide-limits/README.md). Every other latency and
price in the table is an inference or a third-party figure, explained below.

**Recommendation.** If central serving is wanted, take (ii) with the A3B MoE model. (i) is viable
only if a small model passes our case sets, and the one small decoder we have measured did not.
Measure the five items in [§9](#9-measure-first) before committing money.

## 1. Workload model [assumption]

Three kinds of use, sized to find the order of magnitude. None of these volumes is measured.

| Use | Volume | Peak | Evidence per call | Prefill at peak |
|---|---|---|---|---|
| (a) Developer hooks (commit-msg, pre-push, loop guard) | 2,000 developers × 30 calls a day | ~10 req/s | ~2k tokens | ~20–25k tokens/s |
| (b) CI and PR bots | 3,000 PR events a day × 5 questions | ~2 req/s | ~8k tokens | ~1.4k tokens/s averaged; latency-tolerant |
| (c) Runtime triage in applications | 100k–500k items a day × 3 questions | 15–75 req/s | ~2k tokens | 30k–150k tokens/s |

A decide call generates one token, so decode cost is negligible and the cost is prefill.

## 2. Serving stacks [fact unless marked]

`alpha decide` needs the log-probabilities of up to 11 option tokens from a single generated
token.

- **vLLM.** `max_logprobs` defaults to 20, and -1 means unlimited. Automatic prefix caching and
  continuous batching.
- **SGLang.** `return_logprob` and `top_logprobs_num`; RadixAttention for prefix reuse.
- **TGI.** In maintenance mode, and top-n logprobs defaults to 5. Ruled out.
- **llama.cpp server.** Works on CPU; batching is weak under concurrent load.
- **TensorRT-LLM.** Top-k logprobs not verified.
- **Open [inference].** Whether vLLM's prefix caching works with the hybrid DeltaNet layers of
  Qwen3.5/3.6. If it does not, repeated evidence (the same diff asked several questions) is
  prefilled once per question.

## 3. GPU throughput

- **[fact]** Millstone AI, independent: Qwen3-Coder-30B-A3B FP8 on one RTX PRO 6000 with vLLM,
  TTFT 37 ms at 1k tokens and 0.2 s at 8k, about 33–37k tokens/s prefill.
  <https://www.millstoneai.com/inference-benchmark/qwen3-coder-30b-a3b-instruct-fp8-1x-rtx-pro-6000-blackwell>
- **[inference]** Qwen3.6-35B-A3B has the same active-parameter class (3B), so we assume similar
  prefill. A 27B dense model needs about 9× the FLOPs per token: about 4k tokens/s and ~2 s at 8k
  on one G4.
- **[inference] GPUs needed.**

  | Model | (a)+(b) | (c) runtime triage |
  |---|---|---|
  | 35B-A3B | 1, plus 1 for availability | 2–3 at 100k items/day, 8–10 at 500k |
  | 27B dense | 4–10 | ~25+ |

- **[inference] Latency, A3B on G4 under load:** p50 ~0.1 s / p95 ~0.4 s at 2k tokens,
  ~0.25 s / ~0.6 s at 8k.

## 4. CPU

- **[fact]** AMD, EPYC 9755 (128 cores), BF16 prefill in llama.cpp, native → ZenDNN backend:
  Qwen3.5-4B 1,210 → 2,307 tokens/s; gpt-oss-20B 1,187 → 2,589; Llama-3.1-8B 694 → 1,234.
  <https://www.amd.com/en/developer/resources/technical-articles/2026/llama-cpp-on-amd-epyc.html>
- **[fact]** Phoronix on Granite Rapids with AMX:
  <https://www.phoronix.com/review/intel-xeon-6-granite-rapids-amx/4> (numbers not extracted
  here).
- **[inference]** A `c4d-standard-32` has 16 physical cores, an eighth of that socket: about
  290 tokens/s for a 4B model, so ~7 s at 2k tokens and ~30 s at 8k. A whole socket gives ~0.8 s at
  2k, one request at a time, for about $19/h: more expensive than a G4 and ~15× slower.
- **[inference]** An encoder such as Laya-322M should take ~0.1–0.3 s per 1k-token call on
  16 cores. INT8 through OpenVINO or ONNX Runtime is faster
  ([ML6](https://blog.ml6.eu/openvino-vs-onnx-for-transformers-in-production-3e10c01520c8)).
- **Verdict [inference].** CPU works for encoder models; for a 4B decoder only in asynchronous CI;
  not for 30B-class models at 8k tokens interactively.

## 5. What `europe-north1` (Hamina) offers

- **GPUs [fact]** (<https://docs.cloud.google.com/compute/docs/gpus/gpu-regions-zones>): G4 in
  zones a, b and c; A4 (8× B200) in c. No L4 (G2), T4, A100 or H100.
- **Nearby regions [fact].** `europe-west4`: G2/L4, G4, A2, A3 High/Mega/Ultra, A4, A4X, T4, V100.
  `europe-west1`: G2, G4, A3, A4, T4. `europe-west3`: G2, T4, A3 High. `europe-north2` is not
  listed.
- **TPUs [fact].** In Europe only `europe-west4`
  (<https://docs.cloud.google.com/tpu/docs/regions-zones>).
- **Cloud Run GPU [fact].** L4 in `europe-west1` and `europe-west4`, RTX PRO 6000 in
  `europe-west4`; `europe-north1` is not listed
  (<https://docs.cloud.google.com/run/docs/configuring/services/gpu>).
- **CPU.** C4, C4D and N4 according to third-party catalogues (Northflank, CloudPrice). Not
  verified against Google's own documentation.
- **Prices (third-party, gcloud-compute.com, not verified with Google):**

  | Machine in `europe-north1` | On-demand | 1-yr CUD | 3-yr CUD | Spot |
  |---|---|---|---|---|
  | `g4-standard-48` | $4.95/h (~$3.6k/month) | $2,493/month | $1,590/month | $2.11/h |
  | `c4d-standard-32` | $1.51–1.97/h | $695–904/month | $497–646/month | – |

## 6. NAV context

- **[fact]** NAIS runs in `europe-north1`
  ([naiserator `const.go`](https://github.com/nais/naiserator/blob/main/pkg/resourcecreator/google/const.go)).
- **[fact]** navikt/ao-ki-transkribering
  [ADR-0002](https://github.com/navikt/ao-ki-transkribering/blob/main/adr/0002-gcp-mvp-etableringsplan.md)
  records that NAIS clusters have no GPU node pools and no GPU API. That team ran its own GKE
  cluster with vLLM on L4 in `europe-west4-b`, because L4 is not in `europe-north1`, and reached it
  over VPC peering.
- **[fact]** KNADA's only GPU pool is T4, in dev, in `europe-west1`.
- **[inference]** A decide service would today need its own GKE cluster or GCE instances outside
  NAIS, as that team did. G4 in `europe-north1` at least keeps it in the same region as NAIS.

## 7. Data residency and privacy [inference]

- A central service moves the evidence (diffs, commit messages, tool output) off the developer's
  machine into NAV's GCP project. It stays in the EU/EEA.
- Runtime use on personal data, option (iii), needs a risk assessment (ROS) and a DPIA, no
  prompt logging, and a decision on region.
- G4 in `europe-north1` avoids the region question; L4 or TPUs would mean `europe-west1` or
  `europe-west4`.
- The KV/prefix cache holds evidence in GPU memory across requests. Keep caches per tenant, or
  accept the shared cache explicitly in the risk assessment.

## 8. Recommendation [inference]

**If central serving is wanted, take (ii) with the A3B MoE, not the 27B.** From
[`bench/decide-limits-20260925-014512.md`](../../bench/decide-limits-20260925-014512.md) and
[the System One report](../2026-09-25-system-one/report.md) §3.3, Qwen3.8-27B-OptiQ-4bit is more
accurate than optiq on the nuanced sets:

| Set | optiq (35B-A3B) | Qwen3.8-27B | Qwen3-4B |
|---|---|---|---|
| goapi (exported Go signature changed) | 28/40 = 0.70 [0.55–0.82] | 35/40 = 0.88 [0.74–0.95] | 22/40 = 0.55 [0.40–0.69] |
| loop-near (loop against progress) | 22/40 = 0.55 [0.40–0.69] | 33/40 = 0.82 [0.68–0.91] | 22/40 = 0.55 [0.40–0.69] |
| injection | 132/160 = 0.82 [0.76–0.88] | 103/160 = 0.64 [0.57–0.71] | 77/160 = 0.48 [0.41–0.56] |
| lang-en | 26/32 = 0.81 [0.65–0.91] | 28/32 = 0.88 [0.72–0.95] | 17/32 = 0.53 [0.36–0.69] |
| lang-no | 118/152 = 0.78 [0.70–0.84] | 127/152 = 0.84 [0.77–0.89] | 91/152 = 0.60 [0.52–0.67] |
| describes | 37/40 = 0.93 [0.80–0.97] | 39/40 = 0.97 [0.87–1.00] | 26/40 = 0.65 [0.50–0.78] |

But the 27B needs about 9× the GPUs (§3) and is the easier model to steer by injected text.
The same MLX 4-bit builds were measured, not the FP8 builds a G4 would serve (§9 item 4).

**(i) is only viable if a small model passes our sets.** Qwen3-4B did not: 0.53–0.65 on lang-en,
lang-no, describes and goapi, and 0.48 on injection, against optiq's 0.70–0.93 and 0.82. The
decision-trained small models, Kev 4B and Laya, have not been measured on our sets yet
([pending-tasks §8.6](../2026-09-23-local-model-evaluation/pending-tasks.md#86-kev-4b-and-laya-mlx-plan)),
and their context is short: 512–1,024 tokens for Laya, and Kev was trained on short states.

## 9. Measure first

Also tracked in [pending-tasks §8.9](../2026-09-23-local-model-evaluation/pending-tasks.md#89-decide-as-a-service-measure-first).

1. Kev 4B and Laya accuracy on our sets, Norwegian and injection included (the §8.6 plan).
2. Logprob parity between vLLM and mlx-lm on the same model: argmax agreement, calibration bands,
   and coverage of the top-11 options.
3. A G4 load test: p50/p95 at 2k and 8k tokens, 5–20 req/s, with prefix caching on the hybrid
   DeltaNet model.
4. Injection robustness under the quantization that would be served (FP8), not MLX 4-bit.
5. Real volumes: commits and PRs per day across navikt, and candidate runtime flows.

## Limits

- CPU, 27B-on-G4 and A3B-on-G4 throughput are extrapolated from third-party benchmarks, not
  measured by us.
- Prices are third-party list prices and exclude disks, networking, egress and operations.
- The workload volumes in §1 are assumptions.
- Our accuracy figures are from MLX 4-bit builds on a Mac. A served FP8 build may differ.

## Sources

- [`bench/decide-limits-20260925-014512.md`](../../bench/decide-limits-20260925-014512.md),
  [`bench/decide-limits/README.md`](../../bench/decide-limits/README.md)
- [`bench/decide-sets-20260925-225356.md`](../../bench/decide-sets-20260925-225356.md) (recipe
  questions: optiq p50 385–402 ms per call, Qwen3.8-27B 666–817 ms)
- [System One report](../2026-09-25-system-one/report.md)
- [Jev-like features research](../2026-09-24-jev-like-features/research.md)
- External URLs are inline above.
