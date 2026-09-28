# Kev 4B and Laya: what they are and what we measure, 2026-09-28

Background for [plan.md](plan.md). The download, the sizes and the go/no-go list are in
[pending-tasks §8.6](../2026-09-23-local-model-evaluation/pending-tasks.md). Both models are in the HF cache
(5.8 GB, sha256 checked 2026-09-26). The two packages that run them are held by the 7-day uv cooldown
until 2026-09-29.

## What they are

Both are open "System One" decision models in the style of TypeSafe's Jev ([Jev research](../2026-09-24-jev-like-features/research.md)).
A caller sends a state (the evidence) and typed questions (`choice`, `score`, `noul` for yes/no). The
model returns one probability per option from a head on top of an encoder. It generates no tokens.

| | Kev 4B | Laya 421M | Laya multilingual 322M |
|---|---|---|---|
| Weights we run | `RoderickQiu/kev-4b-mlx-8bit`@e1c35947 (unofficial merge, 8-bit) | `aac6fef/laya-mlx`@20aed815 (FP16) | `aac6fef/laya-multilingual-mlx`@f2b4faf5 (FP16) |
| Backbone | Qwen3.5-4B-Base + rank-16 LoRA, causal, hybrid DeltaNet | ModernBERT-large, bidirectional | mmBERT-base, bidirectional |
| Head | Pointer head over option tokens, fitted temperature | Decision head, temperature per option-count bucket (clamped to 0.5–5.0) | same |
| Context | Trained on 384 state tokens; serving cuts silently at 8,192 | 512 tokens including the question and options | 1,024 |
| Language | English only | English | Multilingual (no published Norwegian numbers) |
| Licence | Apache-2.0 | Apache-2.0 | Apache-2.0 |
| Published Mac speed | 0.72 s new text, 0.14 s cached, 32 GB M5 (Kev README) | 13.4 ms p50, M3 Max (port README) | 7.4 ms p50 |

Their own claims, none of them ours: Opper measured hosted Kev at 95.0 / 98.3 / 93.9 % on three
classification sets and says gaps under 5 points are noise ([blog](https://opper.ai/blog/jev-vs-kev-open-decision-model)).
Laya's authors report 0.766 against Jev's 0.727 on typed-decisions, but 0.425 against 0.870 on Banking77
(77 labels). Laya is known to be weak on many options and on `score`.

The 8-bit Kev is not today's Kev. It was merged from `jaredpalmer/kev-4b`@485ace87 with Kev's code at
08ab0b87, and its `head.pt` differs from the current main's. We run it with its own head, temperature and
tokenizer, and record 485ace87 as the Kev revision. Its README reports the same answer as bf16 on 119/119
pages, with probabilities within 0.012–0.053.

## How they are served

- **Kev: `python -m kev.serve`** is a FastAPI sidecar with TypeSafe's `POST /v1/systemone`, `GET /v1/models`
  and an LRU cache of state prefixes. On Apple Silicon it picks `kev.mlx_model.MLXDecisionModel`: mlx-lm
  runs the backbone on Metal, and the pointer head stays in torch (fp32). So it needs torch < 2.9,
  transformers ≥ 5.17, pydantic and `mlx-lm>=0.31.3,<0.32`. That mlx pin conflicts with both the repo's
  `.venv` (mlx-lm 0.32.0) and laya-mlx (mlx 0.32.x), so Kev needs its own venv. The server's loader also
  wants the bf16 base (9.3 GB) to merge the adapter. We don't use the server. We load the pre-merged 8-bit
  weights in-process, as the 8-bit README shows, and call the same `to_record` → `encode` → `probs` →
  `to_answers` path the server's `answer()` calls, without HTTP and without the prefix cache. Every case
  has new evidence, so the numbers are uncached.
- **Laya: `laya_mlx`** (PyPI `laya-mlx` 0.2.0, published 2026-09-22) is a pure-MLX port with no torch. It has
  a Python API (`laya_mlx.load(path).predict(state, questions)`) and a CLI, but no HTTP server.
  `Router` picks the English or multilingual checkpoint by language. We call `predict` directly, with each
  checkpoint on every set, so the language routing does not hide which model answered.

## What they would be for in nav-pilot

Neither can be a worker. They generate no text, so they cannot edit, answer or plan. The only role they
could fill is **the backend for `nav-pilot alpha decide`**, the typed-question primitive that now runs as
one forward pass of a chat model through mlx-lm (optiq by default, Qwen3.8 as the nuanced slot). Its
callers in the repo and the plans:

- the commit-msg check ("does the message say why?", `commit-explains-why` EN and NO);
- the PR-description check (`pr-motivation`);
- issue triage (`issue-type`, `aksel-kind`);
- the log-only action check (#1163, measured by after-64-6 on the chat models);
- the loop classifier (`loop-vs-progress`, `loop-near`).

What a small decision model could change:

1. **Memory and startup.** Today `decide` needs a 20+ GB chat model resident, or a cold start. Laya needs
   under 1 GB, and Kev 8-bit about 5 GB. With either, `decide` could run on 16–32 GB Macs that cannot hold
   optiq, and next to a coding worker without evicting it.
2. **Latency.** optiq answers in 385–400 ms p50 on the recipe sets (bench/decide-sets-20260925-225356.md),
   and Qwen3.8 in 670–820 ms. Laya would be one to two orders of magnitude faster, which matters for hooks
   that run on every commit or tool call.
3. **A hosted service on CPU** ([PRD](../2026-09-27-hosted-decide-prd/prd.md) gate 2,
   [§8.9](../2026-09-26-decide-as-a-service/research.md)). A 322–421M encoder can be served on CPU, a 35B MoE
   cannot. If Laya holds up on our sets, a CPU service becomes an option. If it does not, the hosted path
   needs GPUs.

The obvious catch: our evidence is long (up to 30k characters: diffs, issue bodies) and partly Norwegian.
Laya sees 512 or 1,024 tokens, and Kev was trained on 384. The measurement is mostly about how much of
the chat models' accuracy survives that.

## What the benchmarks measure

The same 1,288 cases the chat models ran, through the adapter `.mise/tasks/_decide_s1.py`. Each case
becomes one `choice` question: state = evidence, instructions = question, criteria = options. The records
are the ones `_decide_limits`, `_decide_sets` and `_decide_why` write, so their summaries put Kev and Laya
next to optiq and Qwen3.8 unchanged.

| Group | Sets | n | What it tells us |
|---|---|---|---|
| why | `why-en`, `why-no` | 96 | The commit-msg hook: accuracy, block precision at p ≥ t, EN/NO twins |
| sets | `issue-type`, `aksel-kind`, `pr-motivation` | 218 | Triage and the PR check: confusion, calibration, abstain-at-t |
| limits | `lang-en`, `lang-no`, `describes`, `goapi`, `loop-near`, `options`, `position`, `injection`, `length` | 974 | Language, option count up to 14, evidence length and position, position bias, injection flip rate |

Per case the adapter also records `state_tokens`, `truncated` (the model cut the state) and, for Kev,
`over_train` (state longer than its 384 training tokens), so that a model that is wrong because it never
saw the deciding line can be told apart from one that saw it and answered wrong. The latency is the wall time of one
in-process call. It leaves out process start and HTTP, so it is a floor, not directly comparable with
nav-pilot's per-call `ms`, which goes through the local server.

Known limits of the comparison:

- **Question wording.** The chat models get nav-pilot's decide prompt with letters. Kev and Laya get the
  raw question as `instructions` and the option names as criteria, which is their native form. Neither
  side is tuned for the other.
- **Yes/no questions run as a two-option `choice`, not as `noul`.** That keeps the labels identical to
  the chat models' runs. `noul` might calibrate differently; it is left untested.
- **One pass, no repeats.** All three models are deterministic, so n is the case count.

## Sources

- Kev: [jaredpalmer/kev](https://github.com/jaredpalmer/kev) at 08ab0b87 (`kev/api.py`, `kev/serve.py`,
  `kev/mlx_model.py`, `kev/checkpoint.py`, README), [jaredpalmer/kev-4b](https://huggingface.co/jaredpalmer/kev-4b),
  [RoderickQiu/kev-4b-mlx-8bit](https://huggingface.co/RoderickQiu/kev-4b-mlx-8bit) README.
- Laya: [mizorewww/laya-mlx](https://github.com/mizorewww/laya-mlx) at 0a859518 (`laya_mlx/agent.py`,
  `laya_mlx/common.py`, `laya_mlx/prepared.py`, README), [convaiinnovations/laya](https://huggingface.co/convaiinnovations/laya).
- Opper, [Jev vs Kev](https://opper.ai/blog/jev-vs-kev-open-decision-model).
