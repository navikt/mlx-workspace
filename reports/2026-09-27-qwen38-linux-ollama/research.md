# Qwen3.8's gap, Qwen news, and local inference on Linux, 2026-09-27

Desk research and a re-reading of our own result files. No new GPU runs and no downloads.
Figures from outside this repo carry their source URL; web sources were read on 2026-09-27.

Labels: **[fact]** = our result files or a cited primary source say it. **[inference]** = our own
reading or estimate. In §3–4, **[V]** = checked in source code, official docs or the GitHub API,
**[C]** = a community claim we didn't reproduce, **[U]** = unverified or estimated.

## Question

Four questions from the user:

1. Why does Qwen3.8 perform so much worse? If it's the model, drop it; if it's the setup, fix it.
2. Any Qwen model news in the last three months that changes what we run or how?
3. What is the MLX equivalent for NAV developers on Linux?
4. Could nav-pilot support Ollama for people who insist on their own local inference?

## What shipped

Nothing. This report recommends one measurement (§2.3, the norm-shift check) and one
nav-pilot change (§4.5, a bring-your-own-endpoint mode).

## Summary

1. **Qwen3.8 isn't worse on quality, it's 5× slower.** The 8-bit is the most accurate local model
   we have measured (cheap-ops 31/40 and 18/20; decide 95/96 on commit-why), and every one of its
   failures outside the suspect R1 task is a 420 s timeout at the 48 GB tier. Decode is 15–17
   against 79–91 tok/s and prefill 589 against 3,022 tok/s, because a dense 27B reads all its
   weights per token. The 4-bit builds lose the accuracy (they fail the same multi-file edits as
   optiq) and keep most of the slowness. No loops since the reasoning pin went. Fixable around
   the edges: MTP and a trimmable cache in mlx-lm, more memory; inherent in the middle.
   Qwen3.8 has never been run in the frontier or hybrid suites.
2. **News:** Qwen3.8-27B itself (2026-08-13/14) and Qwen3.8-Flash-Next (08-24, too big) are the
   only relevant releases; no new Qwen3.5/3.6/Coder weights. The card recommends non-thinking
   at temp 0.7 / top_p 0.8 / top_k 20 / presence_penalty 1.5; we run 0.6 / 0.95 / 20 / none.
   mlx-lm has had no release since 0.31.3 (04-22), and `main` has fixes we lack: a norm-shift bug
   in Qwen3.5/3.6 conversions with MTP tensors (#1623, 08-18, which may affect the mlx-community
   Qwen3.8 builds made on 08-14: **not checked, check first**) and `qwen3_coder` parser fixes
   (#1811, #1881). llama.cpp fixed Gated DeltaNet normalisation on 09-06 (#28068).
3. **Linux: llama.cpp's `llama-server`.** Every GPU API and CPU, a native Qwen tool-call parser,
   `top_logprobs`, and `--n-cpu-moe` to run a 35B-A3B on an 8 GB GPU at about 25–40 tok/s.
   CPU-only laptops decode acceptably but prefill at 50–200 tok/s, too slow for Copilot's
   21.7k-token start; fine for decide.
4. **Ollama: yes, as a bring-your-own OpenAI endpoint, not as a managed backend.** It has tool
   calls and `top_logprobs` (cap 20, we need 11), but no way to set context over `/v1` (a small
   default silently truncates), no MoE offload, and an open Qwen tool-call 500 (#16383).
   A `local_endpoint` mode that skips provisioning, labelled "unsupported, unmeasured", with a
   doctor check for tool calls, logprobs and context: about 3–5 developer-days.

## 1. Why does Qwen3.8 do worse?

### 1.1 The premise, checked against our files

**[fact]** It doesn't do worse on quality where it has been measured. It is slower, and at the
48 GB tier the slowness turns into timeouts. There is no Qwen3.8 run in the hybrid or frontier
suites: no `bench/hybrid-*` or `bench/frontier-*` file names it (`grep -l qwen3.8`), so
"worse in the frontier" rests on nothing. It was measured in cheap-ops, np-e2e, decide and
weather-cli.

cheap-ops, every valid run since the current harness (2026-09-23), classified per task by the
fields each result file records (`verified`, `timed_out`, `files_changed`, `looped_on`,
`longest_identical_run`). D2 is left out (retired, it times out on every model). The three runs
decision.md §3.1 excludes as invalid (two queues at once) are left out.

| Profile | Wired | Runs | Pass | Timeout (420 s) | No change | Edit fails check | Read answer wrong | Loop | Median s/task |
|---|---|---|---|---|---|---|---|---|---|
| qwen3.6-35b-a3b-optiq (default) | 36 GB | 9 | 57/90 = 0.63 [0.53–0.73] | 0 | 9 | 15 | 9 | 0 | 11 |
| qwen3.6-35b-a3b-optiq-t0 | 36 GB | 3 | 17/30 | 0 | 2 | 7 | 4 | 0 | 15 |
| qwen3.6-35b-a3b-optiq-64g | 48 GB | 2 | 15/20 | 0 | 1 | 2 | 2 | 0 | 10 |
| qwen3.6-35b-a3b-8bit-64g | 48 GB | 2 | 17/20 | 0 | 0 | 1 | 2 | 0 | 13 |
| qwen3.8-27b-8bit-nopin | 36 GB | 4 | 31/40 = 0.78 [0.62–0.88] | **5** | 0 | 0 | 4 | 0 | 115 |
| qwen3.8-27b-8bit-nopin-c32k-t0 | 36 GB | 2 | 12/20 | 1 | 0 | 5 | 2 | 0 | 98 |
| qwen3.8-27b-8bit-64g | 48 GB | 2 | **18/20** [0.70–0.97] | 0 | 0 | 0 | 2 | 0 | 50 |
| qwen3.8-27b-4bit | 36 GB | 3 | 17/30 | 1 | 0 | 9 | 3 | 0 | 80 |
| qwen3.8-27b-4bit-c64k-8g | 36 GB | 2 | 11/20 | **4** | 0 | 3 | 2 | 0 | 63 |
| qwen3.8-27b-optiq-4bit | 36 GB | 3 | 18/30 | 0 | 0 | 9 | 3 | 0 | 49 |

Source: `bench/results-<profile>-2026092*-*.json`; the classifier is `failtypes.py` next to this report.
"Read answer wrong" is almost all R1, which fails on every model and is excluded from the
capability bar as a suspected checker fault (`manifest/capabilities.json`, `excluded_tasks`).

What the table says:

- **[fact]** Take R1 out and every failure of the 8-bit is a timeout: 5 of 5 at 36 GB (G2 ×2,
  M2, D3 ×2), 0 at 48 GB, where it passed 18 of 18 non-R1 tasks. Its edits never failed a check.
- **[fact]** The 4-bit builds (plain and OptiQ) fail M2, G2 and D3 with an edit that doesn't pass
  the check, the same three tasks and the same failure type as optiq. The 8-bit doesn't.
- **[fact]** Qwen3.8 never made a no-change run on an edit task (0 of 160 tasks). optiq did 9
  times in 90.
- **[fact]** No loop in any run since 23 September: `longest_identical_run` ≤ 2 everywhere.
- **[fact]** It is 4.5–10× slower per task (median 49–115 s against 10–15 s).
- **[fact]** np-e2e Copilot sessions pass as often as optiq's: 12/12 for OptiQ-4bit
  (`np-e2e-qwen3.8-27b-optiq-4bit-20260924-181038.json`) and for the 8-bit at 48k
  (`…-c48k-ps512-20260924-234628.json`), at 48–97 s a session.
- **[fact]** decide: more accurate on 7 of 9 decide-limits sets and on commit-why (95/96 against
  89/96), less robust to injection (103/160 against 132/160), and 2.7× slower per call (p50
  1158 ms against 432 ms) ([System One report](../2026-09-25-system-one/report.md) §3.3–3.4).

So the accurate summary is: **the 8-bit is the most accurate local model we have measured, and
the slowest; the 4-bit builds lose the accuracy and keep most of the slowness.** At n = 20–40
none of the pass-rate differences is significant (decision.md §3.2, Fisher p 0.07–0.79); the
speed difference is.

### 1.2 Throughput: dense 27B against 3B active

**[fact]** Measured on the same machine and runtime (M5 Max, mlx-lm 0.31.3, 48 GB wired), cold,
256 output tokens (`bench/np-e2e-qwen3.8-27b-8bit-64g-20260926-234818.json`,
`bench/np-e2e-qwen3.6-35b-a3b-optiq-64g-20260926-234608.json`):

| | Qwen3.8-27B 8-bit | optiq (35B-A3B, 4-bit mixed) | Ratio |
|---|---|---|---|
| Decode at 2k / 30k | 16.8 / 15.5 tok/s | 90.7 / 78.9 tok/s | 5.4× / 5.1× |
| TTFT at 2k | 2.97 s | 0.73 s | 4.1× |
| TTFT at 30.9k (prefill rate) | 52.5 s (589 tok/s) | 10.2 s (3,022 tok/s) | 5.1× |
| TTFT at 56.6k / 48.6k | 119 s | 21 s | |
| Peak footprint | 46.5 GB | 31.5 GB | |

At 36 GB wired, Qwen3.8 OptiQ-4bit decodes at 21–25 tok/s and the plain 4-bit at 25–30
(qwen38-tuning.md §5, §10).

**[inference]** Decode on Apple Silicon is bound by memory bandwidth: every token reads every
active weight once. The 8-bit reads about 29.5 GB per token, so 16.8 tok/s is about 495 GB/s of
effective bandwidth; optiq reads about 1.5–2 GB of active expert and shared weights per token,
so the same bandwidth would allow well over 200 tok/s, and the 91 we see is bound by other
overhead. The 5× ratio is roughly 27B against 3B active, discounted by optiq's overheads. Prefill
is compute-bound and scales with active parameters too (27B against 3B active FLOPs per token),
which is the 5× TTFT ratio. None of this is fixable by configuration. A 4-bit build halves the
bytes and only gets decode to about 25–30 tok/s, still 3× slower than optiq.

**[fact]** How speed becomes failure: cheap-ops kills a task at 420 s. An agent task re-sends a
growing context each turn; 8-bit M2 took 203 s over 14 turns with 80k input tokens in total on
the 48 GB run (`results-qwen3.8-27b-8bit-64g-20260927-002153-01.json`). At 36 GB wired the same
work crosses 420 s, since prefill slows about 6× past 40k under memory pressure (decision.md §3.3).
The Copilot 80 % gate, 900 s session caps and the 30 s cold-TTFT criterion are all hit by the
same thing.

**[fact]** The prompt cache hides most of it when it hits: 30k warm TTFT is 0.6–0.7 s
(qwen38-tuning.md §5). **[fact]** It cannot hit partially: the `qwen3_5` family's cache is not
trimmable (`can_trim_prompt_cache`, mlx_lm `models/cache.py:88`), so any change to the prefix
(Copilot rewriting the system prompt, a compaction, a new branch of the conversation) re-prefills
from zero, and an entry bigger than `--prompt-cache-bytes` evicts itself (qwen38-tuning.md §2).
**[inference]** This affects optiq equally, since both are `qwen3_5`/`qwen3_5_moe` hybrids, but a
full re-prefill costs optiq 10 s at 30k and Qwen3.8 52 s, so it is felt only on Qwen3.8.

### 1.3 Tool calls, chat template, thinking, sampling

- **Parser.** **[fact]** Both models use mlx-lm's `qwen3_coder` parser. mlx-lm #1919 (an
  `int("10.0")` crash that makes an agent retry) is closed on main, and #1907 (oneOf/anyOf
  parameters returned as a string) is open (64 GB plan §4). **[fact]** A search of the 3,712
  files in `.bench-logs/` for `invalid literal for int` and parser error strings found nothing.
  **[inference]** The parser bugs are real but don't explain any failure we have recorded, and
  they would hit optiq the same way.
- **Chat template.** **[fact]** The template fault recorded in MODELS.md (our hand-written
  `chat_templates/qwen3.8-27b.jinja` re-encoding arguments) only touched the abliterated oMLX
  build; every shipped profile uses the model's own template. mlx-lm normalises arguments
  before rendering, which is what keeps the stock templates from raising (PLAN.md §9, 6c).
- **Thinking.** **[fact]** Every profile sets `enable_thinking: false`. With thinking on, the
  4-bit took 2.3× longer per task and made about 3× the output tokens (MODELS.md, "Thinking
  costs about 2.3x"). Artificial Analysis calls the model "very verbose" (64 GB plan §2.1).
- **Reasoning pin.** **[fact]** The early-September loops were caused by a `reasoning_effort`
  pin plus greedy decoding; the nopin 8-bit ran without a loop (MODELS.md, rows 159–160).
- **Sampling.** **[fact]** Temp 0 was not better than 0.6 on either model (8-bit 12/20 against
  31/40, p = 0.22), so both ship at 0.6 / top_p 0.95 / top_k 20 (qwen38-tuning.md §9).
  `repetition_penalty` 1.05 made the old loops worse (MODELS.md).

### 1.4 Quantization

**[fact]** Same model, weights the only variable (48 GB tier excepted): 8-bit 31/40 and 18/20;
OptiQ-4bit 18/30; plain 4-bit 17/30 and 11/20. The 8-bit's non-R1 failures are all timeouts; the
4-bit builds fail M2/G2/D3 on the check (§1.1). **[inference]** 4-bit costs this dense model
accuracy on multi-file edits and doesn't buy enough speed to make up for it; OptiQ's mixed 4/8-bit
removed the timeouts but not the edit failures (qwen38-tuning.md §10). For optiq the same
question (8-bit against OptiQ-4bit of Qwen3.6) is being answered on the 64 GB tier (17/20 against
15/20 on night 64-1, within noise).

### 1.5 Context caps

**[fact]** The 8-bit is capped at 48k on the 48 GB tier (36 GB wired) and the 4-bit builds at
64k, because the 8-bit hit a Metal OOM at about 51k (43.8 GB) and prefill slows about 6× past 40k
(decision.md §3.3). The cause is mlx 0.32.0 having no fused attention for head_dim 256, which
materialises about 5 GB of scores per 2048-token prefill chunk at 51k; `--prefill-step-size 512`
cuts that 4× (qwen38-tuning.md §3–4). **[fact]** At 48 GB wired the 8-bit ran at 64k and peaked
at 46.5 GB, 0.5 GB over the 46 GB fit line (night-64-1.md). **[inference]** 48k is enough for
Copilot's 21.7k static context plus a normal session; the cap is not what fails tasks. Memory
pressure near the cap is, through the prefill slowdown.

### 1.6 Looping

**[fact]** The "Qwen3.8 loops" verdict of late August (MODELS.md, alpha-model-decision.md) came
from the reasoning pin, greedy sampling and thinking left on, and partly from a harness that
mis-served templates. Since nopin, thinking off and temp 0.6, no run has a run of more than two
identical calls, and the result-aware loop guard (#933) blocks at 4 in any case. One np-e2e
session (4-bit c64k-8g, M1) was stopped by the loop guard's 8-call backstop (qwen38-tuning.md,
night of 24 Sept). Not a current cause.

### 1.7 mlx-lm support for the architecture

**[fact]** Qwen3.8-27B is `qwen3_5`: dense, 64 layers, 16 of them full attention and the rest
linear attention (Gated DeltaNet), head_dim 256 (64 GB plan §2.1, `config.json`). It loads and
runs in mlx-lm 0.31.3. What is missing:

- the prompt cache can't be trimmed (above), so no partial cache hits;
- **speculative decoding doesn't work**: mlx-lm's draft path needs a trimmable cache
  (`generate.py:533-536`), and trimmable `ArraysCache` is an open draft PR, ml-explore/mlx-lm#1821;
- **native MTP** is PR ml-explore/mlx-lm#990, still open; its author reports 1.57× on a
  Qwen3.5-27B 4-bit and 1.11× on the 35B-A3B. The 27B's MTP head (`qwen3_5_mtp`) can't be loaded
  by mlx-lm today (`profiles/qwen3.8-27b-4bit-reppen.toml`). oMLX runs it;
- no fused SDPA for head_dim 256 in mlx 0.32.0 (above).

**[inference]** Of these, MTP is the one that would change the picture: the dense model gains
most from it (1.57× against 1.11× for the MoE), which would take the 8-bit from about 16 to about
25 tok/s. Still 3× slower than optiq.

### 1.8 Fixable or inherent

| Cause | Kind | What would fix it | Expected gain |
|---|---|---|---|
| 5× slower decode and prefill | **inherent** (27B dense against 3B active on the same bandwidth) | nothing short of a different model | |
| Timeouts at 36 GB wired | partly fixable | more wired memory (48 GB wired removed them), a 900 s task cap for a dense model, shorter prompts | the 8-bit went from 5 timeouts in 40 to 0 in 20 |
| Full re-prefill on any prefix change | fixable in mlx-lm | trimmable `ArraysCache` (#1821) | fewer 50–120 s cold turns |
| No MTP / speculative decoding | fixable in mlx-lm | #990, or serve through oMLX | about 1.5× decode (author's figure) |
| head_dim-256 score spike | fixable in mlx, worked around | fused SDPA; today `--prefill-step-size 512` | a higher context cap on 48 GB |
| 4-bit edit failures | configuration | ship the 8-bit where it fits (64 GB) | 18/20 against 18/30 |
| Thinking, reasoning pin, greedy, repetition penalty | fixed already | shipped profile | loops gone |
| Parser bugs #1907/#1919 | fixable in mlx-lm, not observed | bump mlx-lm | none measured |
| Injection sensitivity in decide | inherent to the model, as far as we know | filter untrusted evidence | |

**Verdict for question 1.** Qwen3.8-27B isn't a worse model for our tasks; it's a 5× slower one.
On our two agent-quality measurements the 8-bit is the most accurate local model we have (31/40,
18/20; decide 95/96), and every failure it has that isn't R1 is a timeout. The speed is set by
reading 27B weights per token, and no parameter changes that. The things that would make it
usable are MTP and a trimmable cache in mlx-lm, and more memory. Until then it belongs where
latency doesn't matter: `alpha decide` in hooks where 1 s is acceptable, or unattended batch
work on a 64 GB machine.

## 2. Qwen news, 2026-06-20 to 2026-09-27

Checked against the Hugging Face API (repo `createdAt` and commit logs), raw model cards,
`config.json` and `chat_template.jinja`, the GitHub API (releases, PR merge dates) and PyPI, on
2026-09-27. The qwen.ai blog renders with JavaScript and couldn't be read, so no date below comes
from it. **Relevance** is to us: nav-pilot on mlx-lm 0.31.3, and a possible Linux path.

### 2.1 Models

| Date | Item | Fact | Relevance |
|---|---|---|---|
| 2026-08-13/14 | [Qwen/Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B) (+FP8) | Repo created 08-05, weights and template 08-13, card and LICENSE 08-14. Dense 27B, `qwen3_5`, 64 layers as 16 × (3 Gated DeltaNet + 1 gated attention), 4 KV heads, one MTP layer, 262k context, vision-language | **High**: the model in §1 |
| 2026-08-14 | mlx-community `Qwen3.8-27B-4bit` / `-8bit` / `-bf16` | Load with mlx-lm's existing `qwen3_5` code ([mlx-lm#1871](https://github.com/ml-explore/mlx-lm/issues/1871)) | **High**: what we ship |
| 2026-08-24 | [Qwen/Qwen3.8-Flash-Next](https://huggingface.co/Qwen/Qwen3.8-Flash-Next) | `qwen4_exp`, 125B total / 6B active + 51B n-gram embedding + 4B MTP, 512 experts, "preview of the Qwen4 architecture" | Low for now: too big for 48 GB; mlx-lm support is an open PR (#1788); Ollama's MLX engine runs it (v0.33.1) |
| 2026-08-08 | [Qwen/Qwen3.8-2.4T-A95B](https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B) | Open weights of the Max-class model | None locally |
| 2026-06-22 | [Qwen/Qwen-AgentWorld-35B-A3B](https://huggingface.co/Qwen/Qwen-AgentWorld-35B-A3B) | A model that simulates agent environments (MCP, terminal, SWE), `qwen3_5_moe` | Low: not a coding agent |
| none | Qwen3.5 / Qwen3.6 / Coder | No new Qwen3.5 or 3.6 weights or official quants in the window (Qwen3.6-35B-A3B's last commit is 2026-04-24); no Qwen3.8 MoE below Flash-Next; no Coder release since Qwen3-Coder-Next (2026-01) | optiq's base model hasn't changed |

### 2.2 Official sampling and thinking guidance (Qwen3.8-27B card)

| Mode | temperature | top_p | top_k | min_p | presence_penalty | repetition_penalty |
|---|---|---|---|---|---|---|
| Thinking | 1.0 | 0.95 | 20 | 0 | 0.0 | 1.0 |
| Non-thinking | 0.7 | 0.80 | 20 | 0 | 1.5 | 1.0 |

- **[fact]** Thinking is on by default; `chat_template_kwargs: {enable_thinking: false}` turns it
  off. `reasoning_effort` takes `xhigh` (default), `medium` or `low`, and only adds a sentence to
  the system prompt; any other value raises in the template. `preserve_thinking` is on by
  default, so past reasoning is re-rendered and the prompt stays append-only. The card warns that
  lower effort in multi-turn agentic work can cost more time through retries. Qwen's own SWE
  numbers ran at temp 1.0, thinking on, in a Claude Code harness.
- **[fact]** There is no coding-specific preset on the 3.8 card. The Qwen3.6-35B-A3B card had
  one (thinking, coding: temp 0.6, presence_penalty 0).
- **[fact]** vLLM/SGLang recipes use `--tool-call-parser qwen3_coder --reasoning-parser qwen3`
  and MTP via `--speculative-config '{"method":"qwen3_next_mtp","num_speculative_tokens":2}'`.
- **Relevant to us, [inference]:** we run non-thinking at 0.6 / 0.95 / 20 with no presence
  penalty; the card says 0.7 / 0.8 / 20 with presence_penalty 1.5. nav-pilot can't send
  `presence_penalty` today (the guard writes only `temperature` and `top_p`), and the
  0.7 / top_p 0.8 cell from qwen38-tuning.md §9 has never run
  (`profiles/qwen3.6-35b-a3b-optiq-t07p08.toml` exists). Worth one cheap-ops cell per model.

### 2.3 Runtimes

**mlx-lm** ([releases](https://github.com/ml-explore/mlx-lm/releases), [PyPI](https://pypi.org/project/mlx-lm/)):

- **[fact]** No release in the window: 0.31.3 (2026-04-22) is the latest on PyPI, and it is what
  nav-pilot pins. Every fix below is on `main` only.
- **[fact]** Merged to `main`: #1501 (07-08, a state machine for tool and reasoning parsing);
  **#1623 (08-18, fixes a double RMSNorm +1 shift when converting Qwen3.5/3.6 checkpoints that
  still contain MTP tensors, which silently corrupted output)**; #1632 (08-22, unbounded
  `ArraysCache` metadata during decode); `qwen3_coder` parser fixes #1239/#1417 (08-22, invalid
  JSON and float-formatted ints, the #1919 class), **#1811 (09-01, tool name lost when the model
  drops `>`; its author hit it "constantly" with Qwen3.6-35B-A3B)**, #1881 (09-14, the same for
  parameter names); #1832 (09-09, KV-cache quantization in the server); #1559 (08-27, packed
  gated-delta kernel).
- **[fact]** Still open: #1821 (trimmable recurrent cache), #990 (MTP; #1730, #1740 and #1543
  closed unmerged), #1807 (server memory grows past the prompt-cache cap on Qwen3.8-27B 4-bit),
  #1480 (OOM on long prefill for hybrid MoE).
- **Relevant to us, [inference]:** (a) The mlx-community Qwen3.8 builds were converted on
  08-14, before #1623. Whether they carry the norm shift is **not checked**; #1623 names
  Qwen3.5/3.6 checkpoints with MTP tensors, and Qwen3.8-27B has an MTP layer. That could depress
  every Qwen3.8 number in §1, so it's the first thing to check (compare logits of the
  mlx-community 8-bit against a fresh conversion from `main`; no GPU night needed, a few minutes
  on any Mac). (b) #1811 is a plausible cause of some of optiq's "no change" runs (9 in 90,
  §1.1): a lost tool name looks like a model that did nothing. Count it in the logs. (c) Moving
  nav-pilot's pin to a `main` commit or the next release picks up both.

**llama.cpp** (PR merge dates, [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp)): #24176
(06-23, context checkpoints at every user message, which is what makes the prompt cache usable for
hybrid models); #26252 (08-02, Qwen3 parser for `<tool_call>` straight after `<think>`); #26793
(08-11, tighter `<function=` grammar trigger); #26941 (08-14, `reasoning_effort` to Jinja);
#27679 (08-25, Qwen3-Coder grammar workarounds limited to Qwen3-Coder, they slowed Qwen3.5+ with
many tools); **#28068 (09-06, Gated DeltaNet q/k normalisation fixed to match the reference,
affects every Qwen3.5/3.6/3.8 GGUF run)**; #28208 (09-07, converter writes explicit
`recurrent_layers`). MTP (#22673, 05-16; Qwen3.5 #24025, 06-03) and EAGLE3 for Qwen3.5/3.6
(#24593, 06-19) predate the window. Qwen3.8-Flash-Next added in #27742 (08-26). **Relevant:** any
Linux path must use a llama.cpp build after 2026-09-06, and GGUFs converted after 09-07.

**vLLM** ([releases](https://github.com/vllm-project/vllm/releases)): v0.27.0 (08-10) text-only
Qwen3.5; v0.28.0 (08-26) Qwen3.8 on ROCm, fused MTP decode for Qwen3.5 GDN, prefix caching on by
default for hybrid models; v0.29.0 (09-09) Mamba/hybrid prefix-cache checkpoints (9–25 % faster
TTFT); v0.30.0 (09-22). No `qwen3_coder` parser change found in the window.

**Ollama** ([releases](https://github.com/ollama/ollama/releases)): v0.32.12 (08-14)
`qwen3.8:27b` and `qwen3.8:27b-mlx`; v0.32.13–15 (08-14 to 08-19) Qwen3.8 template fixes
(developer instructions, non-leading system messages); v0.33.1 (08-26) Qwen3.8-Flash-Next on MLX;
v0.34.4 (09-23) faster Qwen3.8 prompt processing on Apple Silicon; v0.40.0-rc0 (09-25) MLX as the
default engine on Apple Silicon.

**QwenLM repos:** Qwen-Agent has no commits since 06-20 (last PyPI 0.0.34, 2026-02-16), so no
tool-calling change there; Qwen3-Coder has no release; `qwen-code` is active (v0.24.6, 09-26).

### 2.4 Not verified

- qwen.ai blog dates for Qwen3.8, Qwen3.8-Flash-Next and AgentWorld (JavaScript-rendered).
- Qwen3.8-Max's date (08-03) and a "Max-0902" snapshot come only from secondary sources.
- "Qwen3.7" appears only in secondary sources; there are no weights.
- Issue #1807's claim that 0.31.3 is "the last release with the classic `mlx_lm.server`":
  `server.py` is still on `main`. If true, it matters for nav-pilot's next pin.

## 3. What is the MLX equivalent on Linux?

**Short answer, [inference]:** llama.cpp's `llama-server`. It is the only engine that covers
every Linux machine a NAV developer has (CPU only, NVIDIA 8–24 GB, AMD), and can keep a
35B-A3B MoE's experts in system RAM while the rest runs on a small GPU. It has a native parser
for Qwen's XML tool calls and returns `top_logprobs`. Ollama is the same engine family behind an
easier installer, with less control (§4). vLLM and SGLang only make sense on a 24 GB-plus GPU or
a shared server.

### 3.1 Comparison

Legend: **[V]** checked in source, official docs or the GitHub API on 2026-09-27; **[C]**
community claim not reproduced; **[U]** unverified or our estimate.

| | llama.cpp `llama-server` | Ollama | vLLM | SGLang | LM Studio (Linux) |
|---|---|---|---|---|---|
| Latest | b11207, 2026-09-27 [V] | v0.34.4, 2026-09-23 [V] | v0.30.0, 2026-09-22 [V] | v0.5.20, 2026-09-18 [V] | AppImage/.deb |
| Licence | MIT | MIT | Apache-2.0 | Apache-2.0 | proprietary, free |
| Hardware | CPU, CUDA, Vulkan, ROCm/HIP, SYCL | CPU, CUDA, ROCm, (MLX on Mac) | NVIDIA first; ROCm; CPU slow | NVIDIA first; ROCm | CPU, CUDA, Vulkan (llama.cpp inside) |
| OpenAI server | `/v1/chat/completions`, `/v1/completions`, `/v1/responses`, Anthropic `/v1/messages` [V] | `/v1/chat/completions`, `/v1/completions`, `/v1/responses`, `/v1/models` [V] | full [V] | full [V] | `/v1/*` on :1234, Anthropic-compatible [V] |
| Qwen tool calls | native Qwen3-Coder XML handler in `common/chat.cpp`, Jinja on by default [V] | built-in `qwen3.5` PARSER/RENDERER for library models; **not** for `hf.co` pulls (#17636) [V] | `--tool-call-parser qwen3_coder` [V] | `--tool-call-parser qwen3_coder` [V] | via llama.cpp [U] |
| `top_logprobs` on chat | yes; no hard cap; not with tools + stream [V] | yes since v0.12.11; **cap 20** (HTTP 400 above) [V] | yes; `--max-logprobs` default 20 [V] | yes; cap [U] | only via `/v1/responses` [V] |
| Prompt cache | per-slot prefix reuse on by default, checkpoints for hybrid models (#24176), `--cache-reuse`, slot save/restore [V] | inherits the runner's [U] | automatic prefix caching, on for hybrid models since v0.28.0 [V] | RadixAttention [V] | automatic [V] |
| Formats | GGUF (K-, IQ-quants, MXFP4) | GGUF, own library | safetensors BF16/FP8/AWQ/GPTQ/NVFP4; GGUF experimental | as vLLM | GGUF (MLX on Mac) |
| MoE experts in RAM | `--cpu-moe`, `--n-cpu-moe N`, `-ot` [V] | **no** (PRs #16146, #15988 open) [V] | no expert-level offload | via KTransformers [V] | GUI option [U] |
| Install | release binaries or cmake; low–medium | one script or package; low | pip/uv with a matching CUDA; medium | as vLLM; medium–high | GUI; low, but not scriptable |

Also relevant: **ik_llama.cpp** (MIT fork: faster CPU and hybrid MoE kernels, IQ*_K quants; the
maintainer reports IQ4_KS at UD-Q4_K_XL accuracy in about 3 GiB less,
[discussion #1663](https://github.com/ikawrakow/ik_llama.cpp/discussions/1663); API parity for Qwen
tools unverified). **Lemonade** (AMD, Apache-2.0, v2026.39.1, 2026-09-23) wraps llama.cpp
Vulkan/ROCm and vLLM-ROCm and is the easiest start on AMD GPUs
([docs](https://lemonade-server.ai/docs/guide/configuration/llamacpp/)). **KTransformers** (v0.7.1)
targets far bigger MoEs than ours. **TabbyAPI/exllamav3** is CUDA-only, fully in VRAM, AGPL, and
lists logprobs as work in progress. **LocalAI** and **llamafile** wrap the same engines and lag
on new architectures.

Sources: [llama-server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md),
[Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility),
[vLLM tool calling](https://docs.vllm.ai/en/latest/features/tool_calling.html),
[SGLang tool parser](https://docs.sglang.io/advanced_features/tool_parser.html),
[LM Studio Open Responses](https://lmstudio.ai/blog/openresponses), release pages of each project.

### 3.2 Weights

**[V]** There's no official Qwen GGUF for either model (`Qwen/…-GGUF` is a 404) and no GGUF of
optiq (OptiQ is an MLX mixed-precision format). Equivalents on Hugging Face:

- Qwen3.6-35B-A3B: `unsloth/Qwen3.6-35B-A3B-GGUF` (2026-04-16; UD-Q4_K_XL about 23 GB, Q8 about
  38 GB), `bartowski/Qwen_Qwen3.6-35B-A3B-GGUF`, `ggml-org/Qwen3.6-35B-A3B-GGUF`,
  `lmstudio-community`. Ollama library: `qwen3.6:35b` (q4_K_M, q8_0, bf16, `-mtp`, `-coding`).
- Qwen3.8-27B: `unsloth/Qwen3.8-27B-GGUF` (2026-08-13), `lmstudio-community`, `ggml-org`
  (2026-08-14); no bartowski repo. Ollama library: `qwen3.8:27b` (q4_K_M 18 GB, q8_0 30 GB).

**[inference]** A dynamic 4-bit GGUF (UD-Q4_K_XL) is the closest thing to OptiQ: both keep
sensitive tensors at higher precision. Neither is the same bits, so our optiq measurements don't
carry over; the models do. Per §2.3, use GGUFs converted after 2026-09-07 on a llama.cpp built
after 2026-09-06 (the Gated DeltaNet normalisation fix, #28068).

### 3.3 Realistic speed for a 35B-A3B at Q4 on Linux

| Hardware | Decode | Prefill | Source |
|---|---|---|---|
| RTX 4090 24 GB, Q4 fully on GPU | about 120–160 tok/s | fast | [C] RTX 3090 157.7 tok/s UD-Q4_K_M at 8k, 80.9 at 65k with q8 KV ([aminrj.com, updated 2026-09-19](https://aminrj.com/posts/llamacpp-qwen36-35b/); [insiderllm](https://insiderllm.com/guides/best-way-run-qwen-3-6-35b-moe-locally/)) |
| RTX 4090, Q8 (about 37 GB) | about 40–70 tok/s with `--n-cpu-moe` | | [U] estimate |
| RTX 4060-class 8 GB + 32 GB DDR5, Q4, experts in RAM | about 25–40 tok/s | a few hundred tok/s [U] | [C] RTX 5070 Laptop 8 GB, i9-14900HX, `--n-cpu-moe 999`: about 38 tok/s at 3.8 GB VRAM ([little-coder benchmark, 2026-04-21](https://github.com/itayinbarr/little-coder/blob/main/docs/benchmark-qwen3.6-35b-a3b.md)); ik_llama.cpp IQ4_KS on a simulated 8 GB card: 70–90 tok/s, desktop Zen 4 host ([#1663](https://github.com/ikawrakow/ik_llama.cpp/discussions/1663)) |
| CPU only, 32–64 GB dual-channel DDR5 | about 15–25 tok/s at Q4, 8–14 at Q8 | **about 50–200 tok/s** | [U] estimate: about 2 GB of active weights per token against 60–70 GB/s |
| Strix Halo (AMD APU, 128 GB unified) | 44 tok/s at Q8 | 600–800 tok/s | [C] [akehir.com](https://akehir.com/blog/strix-halo-kubernetes-llm-qwen-3.6) |
| For comparison: optiq on our M5 Max | 91 → 73 tok/s | about 3,000 tok/s at 30k | [V] §1.2 |

**[inference]** Decode is usable everywhere. **Prefill is the problem on laptops.** Copilot's
static context is 21.7k tokens (decision.md §3.4); at 100–200 tok/s a cold start is 2–4 minutes,
before the first tool call. The prompt cache makes later turns cheap, but only if it hits. A
CPU-only laptop is therefore fine for `alpha decide` (a few hundred tokens of evidence) and not
for Copilot sessions. An 8 GB NVIDIA laptop is borderline for Copilot and fine for opencode's
`local-worker` dispatch. A 24 GB card is comparable to our Macs. Qwen3.8-27B dense is
impractical on anything but a 24 GB card (§1.2: dense decode is bound by reading all 27B weights).

### 3.4 What `alpha local` needs for Linux

From §4.2. Either path needs the same first steps:

1. `SupportedPlatform()` stops refusing Linux for a non-MLX backend.
2. `CheckWiredLimit` and `RaiseWiredLimit` are macOS-only; on Linux, skip them and check free
   RAM and VRAM instead (`/proc/meminfo`, `nvidia-smi --query-gpu=memory.total`), or skip the
   check for an endpoint nav-pilot doesn't manage.
3. `/usr/sbin/lsof` → look it up on `PATH` (Linux has `/usr/bin/lsof`), or prove ownership
   another way (`/proc/<pid>/`).
4. The HF cache path works as is; `WeightsPresent` must learn GGUF (one file, not
   `*.safetensors` + `config.json`).
5. decide sends `chat_template_kwargs`, which llama-server honours and Ollama ignores
   (Ollama wants `think: false`); the `top_logprobs: 11` it sends is within every engine's cap.
6. The manifest needs a GGUF id per entry (repo + quant file), and `allowedPublishers` (today
   `mlx-community`, `lmstudio-community`) needs `unsloth` or `ggml-org`.

A managed `backend: "llama-server"` (nav-pilot downloads a pinned release binary for the
detected GPU, downloads a pinned GGUF and starts it with measured flags) is the Linux equivalent
of what nav-pilot does with mlx-lm today. It is also the most work: release binaries differ per
GPU API, and every profile needs measuring on hardware we don't have. §4.5 recommends the
cheaper step first.

## 4. Ollama as a backend

### 4.1 What Ollama offers, 2026-09

- **[V] OpenAI-compatible** `/v1/chat/completions` with streaming tool calls (since 2025-05) and
  parallel tool calls. `tool_choice`, `logit_bias` and `n` are documented as unsupported
  ([docs](https://docs.ollama.com/api/openai-compatibility)).
- **[V] logprobs**: `logprobs` and `top_logprobs` on `/v1/chat/completions` and `/api/chat` since
  v0.12.11 (about November 2025); `openai/openai.go` maps them and returns
  `choices[].logprobs.content[]` in OpenAI shape. `top_logprobs` is capped at **20**
  (`server/routes.go`; issue [#18590](https://github.com/ollama/ollama/issues/18590) asks for 100).
  The docs page still lists logprobs as unsupported and issue
  [#16117](https://github.com/ollama/ollama/issues/16117) (closed 2026-05-12) says `/v1` drops
  them; the code says otherwise. **A one-line curl test settles it and belongs in the doctor
  check.** When streaming with thinking, logprobs are dropped on the split content chunk; decide
  doesn't stream, so this doesn't matter to it.
- **[V] Thinking**: native `think` (true/false/level); on `/v1`, `reasoning_effort: "none"`
  maps to `think: false`. `chat_template_kwargs` is not read.
- **[V] Context**: the default `num_ctx` depends on VRAM (4k under 24 GiB, 32k to 48 GiB, 256k
  above; [docs](https://docs.ollama.com/context-length)); the FAQ still says 4096. **`/v1` has no
  way to set it.** Only `OLLAMA_CONTEXT_LENGTH` on the server, a Modelfile `PARAMETER num_ctx`,
  or `/api/chat` `options.num_ctx`. A CPU-only machine likely gets 4k [U], which silently
  truncates Copilot's 21.7k static context. opencode's docs say to raise it if tool calls fail,
  and Ollama's Copilot guide recommends at least 64k.
- **[V] keep_alive**: default 5 minutes (`OLLAMA_KEEP_ALIVE`, or per request, also on `/v1`).
- **[V] Concurrency**: `OLLAMA_NUM_PARALLEL` defaults to 1; RAM scales with
  `NUM_PARALLEL × CONTEXT_LENGTH`. `OLLAMA_KV_CACHE_TYPE` q8_0/q4_0.
- **[V] No MoE expert offload** (PRs #16146, #15988 open): on an 8 GB GPU it can't do what
  `--n-cpu-moe` does, which is the one configuration that makes a 35B-A3B fast on a laptop GPU.
- **[V] Models**: the library has `qwen3.6:35b` and `qwen3.8:27b` with Ollama's own `qwen3.5`
  PARSER and RENDERER. `ollama pull hf.co/<user>/<repo>:<quant>` works, but those pulls don't get
  the built-in parser and renderer, and tool calling is unreliable until the Modelfile adds them
  ([#17636](https://github.com/ollama/ollama/issues/17636), closed 2026-09-05 with that answer).
- **[V] Known Qwen bugs**: [#16383](https://github.com/ollama/ollama/issues/16383) (open since
  2026-06-01): qwen3.6 sometimes emits a `<function_invocation>` wrapper and the parser answers
  HTTP 500, worst in long agent sessions. [#15771](https://github.com/ollama/ollama/issues/15771):
  Qwen3.6 MoE at about 24.5 tok/s on a 7900 XTX with ROCm, well below llama.cpp on the same card.
- **[C]** On the same bytes, decode is within 2–7 % of llama.cpp on a Mac, and about 1.4× slower
  than llama.cpp on Qwen3.5 on an RTX 3090 (136 against 99 tok/s,
  [aminrj.com](https://aminrj.com/posts/llamacpp-qwen36-35b/)).
- **[V] Clients**: opencode takes it as an `@ai-sdk/openai-compatible` provider with
  `baseURL: http://localhost:11434/v1`, the same block nav-pilot already writes. Copilot CLI BYOK
  takes `COPILOT_PROVIDER_BASE_URL=http://localhost:11434/v1` and `COPILOT_MODEL`
  ([GitHub docs](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-byok-models));
  Ollama ships `ollama launch copilot` ([docs](https://docs.ollama.com/integrations/copilot-cli)).
  Both are what nav-pilot already does for mlx-lm.
- **[V] Template risk, from our own work**: mlx-lm parses tool arguments before rendering, and
  that is what keeps the stock templates from raising (PLAN.md §9, 6c; `mise run
  bench-template-check`). Ollama uses its own Go renderers, not the model's Jinja, so the risk is
  different, not absent; #16383 is an example.

PLAN.md §9 (6b) and navikt/copilot#521 already propose this; §4.2 says how big it is in code.

### 4.2 What nav-pilot has today

**[fact]** Read at navikt/copilot `dd859ac6` (`cli/nav-pilot/internal/`):

- **There is no backend abstraction.** `Model.Backend` is checked against
  `allowedBackends = []string{"mlx-lm"}` (`local/local.go:117-133`, check at `:355-360`) and
  nothing switches on it. The comment there says adding a backend "means shipping the code that
  knows how to launch it, which is a nav-pilot release, not a manifest edit". PLAN.md §9 (6b)
  reached the same conclusion on 1 September.
- **The lifecycle assumes a process nav-pilot spawned.** `serverCommand` starts
  `~/.nav-pilot/local/venv/bin/python -c <bootstrap> … mlx_lm.server` on a free 127.0.0.1 port
  (`local/runtime.go:1065-1088`); ownership is proven by pid, `ps -o lstart=` and
  `/usr/sbin/lsof` (`local/attach.go:231-320`); every server URL is built as
  `http://127.0.0.1:%d` (`local/ask.go:164`, `local/guard.go:119-121, 513`,
  `local/runtime.go:975, 1120`).
- **macOS gates.** `SupportedPlatform()` refuses anything but darwin/arm64
  (`local/runtime.go:425-432`, called by `init`); `CheckWiredLimit` reads `hw.memsize` and
  `iogpu.wired_limit_mb` via `/usr/sbin/sysctl` and is a hard gate in `init`, `start` and
  autostart (`local/runtime.go:1434-1488, 1544-1552`); `/usr/sbin/lsof` is a macOS path. No build
  tags; uv already has pinned Linux assets (`local/runtime.go:468-497`).
- **HF cache.** `hfHome()` honours `HF_HOME` (`local/runtime.go:141-150`); `WeightsPresent`
  checks the snapshot's safetensors and `config.json` (`:657-692`); `DownloadWeights` runs
  `hf download` (`:711-722`). All safetensors and MLX-specific.
- **Endpoint-agnostic already:** the loop guard is a reverse proxy that parses OpenAI
  `messages[].tool_calls` and `role: "tool"` (`local/guard.go:275-347, 661-786`); the opencode
  provider block is `@ai-sdk/openai-compatible` with `baseURL: <guard>/v1`
  (`provider/opencode_launch.go:390-419`); Copilot CLI gets BYOK environment variables
  (`COPILOT_PROVIDER_BASE_URL`, `_TYPE=openai`, `_WIRE_API=completions`, `COPILOT_MODEL`,
  `provider/copilot_launch.go:380-395`). All three take a base URL.
- **decide** sends `max_tokens: 1, temperature: 0, logprobs: true, top_logprobs: 11,
  chat_template_kwargs: {enable_thinking: false}` straight to the server, not through the guard
  (`cli/alpha_decide.go:446-455`), and errors out if `logprobs` is missing (`:492-494`). 11 is
  mlx-lm's cap (`:67-70`).
- **Sampling** reaches the server two ways: mlx-lm flags from `MLX_*` params (`serverFlags`,
  `local/runtime.go:1010-1037`), and `temperature`/`top_p` written into each request by the guard
  from `MLX_NAV_PILOT_TEMPERATURE`/`_TOP_P` (`local/guard.go:170-219`). The request-body path
  works on any server; the flag path doesn't.
- **Concurrency.** The guard serialises completions machine-wide with a flock, because of
  mlx-lm's batching bugs (`local/guard.go:466-501`).
- **Telemetry** records the raw model id (`telemetry/telemetry.go:430-460`) on the argument that
  ids come from the manifest, so cardinality is bounded.
- **Config keys:** `local_enabled`, `local_autostart`, `local_model`, `local_loop_guard`
  (`cli/config.go:79-95`). No endpoint override of any kind. `doctor` has no local checks.

### 4.3 Two designs

**A. Manifest `backend: "ollama"`, managed.** Each entry gets an Ollama tag (`qwen3.6:35b-q8_0`)
next to its HF id. nav-pilot checks that `ollama` is installed, runs `ollama pull`, writes a
Modelfile with the entry's `num_ctx` and sampling, and starts or reuses `ollama serve`.

- Gains: nav-pilot still picks the model and its parameters.
- Costs: a second lifecycle (install, pull, serve, ownership) next to mlx-lm's; `allowedBackends`
  is a trust boundary (it decides which binary nav-pilot starts, `local/local.go:117-133`); the
  profiles would have to be measured on Ollama on Linux hardware we don't have; Ollama's context
  default and the missing expert offload have to be managed around. On a Mac it would duplicate
  what mlx-lm already does.

**B. Bring your own endpoint (`local_endpoint`), unmanaged.** A config key (plus environment
variable) with a base URL and a model name. nav-pilot starts nothing and downloads nothing:
it points the guard, opencode, Copilot and decide at that URL. It is PLAN.md's 6b.

Code changes (navikt/copilot at `dd859ac6`, `cli/nav-pilot/internal/`):

1. `cli/config.go:79-95, 512-522`: `local_endpoint` and `local_endpoint_model` keys, and an
   environment override. `cli/alpha_local.go:1006-1036` (`applyLocalConfig`): don't require
   `local.Installed()` when an endpoint is set.
2. `local/guard.go:113-122` (`ServerURL`) and `local/ask.go:131-165` (`Acquire`): return the
   endpoint instead of `127.0.0.1:<state port>`; `local/guard.go:511-518` compares against it.
3. `local/attach.go:231-264` (`EnsureOwnServer`, used by the guard and
   `provider/opencode_launch.go:904`): for an endpoint, a `/v1/models` reachability check instead
   of the pid/lstart/lsof proof.
4. `provider/opencode_launch.go:925-963` and `provider/copilot_launch.go:320-358`: take the model
   from the endpoint config, not the state file.
5. `cli/alpha_decide.go:446-455`: send `reasoning_effort: "none"` alongside
   `chat_template_kwargs` (each server ignores the one it doesn't know, [U] per server: test it);
   keep `top_logprobs: 11`; keep the hard error at `:492-494` and make it name the endpoint.
6. `local/guard.go:466-501`: the machine-wide one-completion flock exists for mlx-lm's batching
   bugs; keep it on for a first version (harmless), revisit later.
7. `cli/doctor.go`: an endpoint check (below). Today `doctor` has no local checks at all.
8. Telemetry (`telemetry/telemetry.go:430-460`): add a `backend` attribute (`mlx-lm` or
   `endpoint`) and record BYO model ids as `custom`. The code's own argument for recording raw ids
   is that they come from the manifest; a user-typed id breaks that, and PLAN.md 6b already warns
   that `nav_pilot_local_ready_seconds` would otherwise mix two populations.
9. `local/runtime.go:425-432`: `SupportedPlatform()` doesn't apply in endpoint mode, so Linux
   works without touching the MLX path; `CheckWiredLimit` is skipped.

**The doctor check** (`nav-pilot doctor` and `alpha local status`), each line PASS/WARN/FAIL:

- `GET /v1/models` answers and lists the configured model;
- one chat completion with a dummy tool returns a parsed `tool_calls` entry (not text that looks
  like one);
- `max_tokens: 1, logprobs: true, top_logprobs: 11` returns 11 entries; otherwise decide is
  marked unavailable;
- a 25k-token prompt comes back with `usage.prompt_tokens` ≥ 25k, which catches Ollama's small
  `num_ctx` default truncating Copilot's 21.7k static context;
- time to first token at that size, printed with a warning above 60 s.

### 4.4 What BYO loses and gains

| Lost | Why |
|---|---|
| Measured profiles | context, cache, prefill step and sampling come from our benchmarks; a BYO endpoint runs whatever the user configured. Every number in this repo stops applying |
| Sampling | the guard can still overwrite `temperature` and `top_p` per request (`local/guard.go:170-219`); `top_k`, `min_p` and the thinking switch are server-side and out of reach |
| Loop guard | still works: it parses OpenAI messages and doesn't care what's behind it. What goes is the assumption that one server serves one session at a time for one user |
| Telemetry comparability | sessions on unknown models and engines; hence the `backend` attribute and `custom` id |
| decide | fine on Ollama (cap 20 ≥ 11), llama-server, vLLM, SGLang; unavailable on LM Studio's chat endpoint and on anything without logprobs. Its thresholds (0.7 for `commit-msg`) were calibrated on optiq; another model's probabilities differ (System One report §3.3) |
| Capability routing | `manifest/capabilities.json` is per HF id; a BYO model gets the unmeasured block, so everything routes to cloud unless the user overrides it |

| Gained |
|---|
| Linux and Windows users, and Macs on Ollama or LM Studio, get the guard, the Copilot/opencode wiring and decide without nav-pilot learning a second engine |
| A shared team server (vLLM on a workstation, or the central service in the decide-as-a-service report) works with the same key |
| Much less code: no downloads, no process ownership, no platform gates |

### 4.5 Recommendation

1. **Build B, labelled.** `local_endpoint` with the doctor check, reported everywhere as
   "unsupported, unmeasured": `alpha local status` says so, and routing treats the model as
   unmeasured. Document llama-server as the suggested Linux engine and Ollama as the easy one,
   with the `num_ctx` warning and a tested Modelfile snippet
   (`PARAMETER num_ctx 65536`, the Qwen non-thinking sampling).
2. **Don't build A now.** Revisit a managed `llama-server` backend (not Ollama: it can't offload
   experts, and its context default is a trap) once someone runs our cheap-ops suite on Linux
   hardware through B and the numbers justify shipping profiles.
3. **Measure before promising speed.** cheap-ops and np-e2e on one Linux laptop with an 8 GB
   NVIDIA GPU and one CPU-only laptop, via B, with llama-server. §3.3's figures are community
   numbers and our estimates.

**Effort, [inference]:** B is about 3–5 developer-days in navikt/copilot: 1–2 for config,
URL plumbing and the ownership bypass (points 1–4, 9), 1 for decide and the doctor check
(5, 7), 1 for telemetry and docs (8), plus tests. The seams exist: the guard, the opencode block
and the Copilot environment already take a base URL. A would be 2–3 weeks plus a measurement
campaign per engine and GPU class.

**Risks:**

- **Blamed for someone else's model.** A 4k context or a template that mangles tool calls looks
  exactly like a weak model (PLAN.md 6c). The doctor check and the label are the mitigation; the
  support answer is "run doctor".
- **Remote endpoints.** A base URL can point off the machine. Code, diffs and tool results then
  leave the laptop, past the guard's redaction only for what the guard sees (decide and `ask`
  bypass the guard). First version: accept only loopback and private addresses, or warn loudly
  for anything else. cplt gets `--allow-localhost <guard port>`, and the
  guard runs outside the sandbox) means a remote upstream isn't blocked by cplt.
- **Telemetry cardinality and privacy** from free-text model ids: record `custom`.
- **Support load**: users will report Ollama bugs (#16383) as nav-pilot bugs.
- **Scope creep toward A**: hold the line at "we don't start or download anything" until there
  is Linux data.

## Limits

- §1 re-reads existing runs; n is 20–40 per profile, so pass-rate differences between models
  aren't significant (decision.md §3.2). The speed differences are.
- All our numbers come from one M5 Max with the wired limit set to emulate 48 GB and 64 GB tiers.
- The #1623 norm-shift question is open and could change §1: if the mlx-community Qwen3.8 builds
  are affected, every Qwen3.8 quality number here is a lower bound.
- §3.3 has no measurement of ours: Linux speeds are community figures and bandwidth arithmetic.
- Ollama's logprobs are verified in source, not by a request; the docs page still says
  unsupported.
- The effort estimate in §4.5 is a reading of the code, not a spike.

## Reproduce

- §1.1 table: `python3 reports/2026-09-27-qwen38-linux-ollama/failtypes.py` from the repo root.
- §1.2 latency: the `latency` blocks of the two `bench/np-e2e-*-64g-2026092*.json` files named there.
- nav-pilot facts: navikt/copilot at `dd859ac60fb086b66d504471bdef1e186121f9a4`,
  `cli/nav-pilot/internal/`.

## Sources

Our files: [decision.md](../2026-09-23-local-model-evaluation/decision.md),
[qwen38-tuning.md](../2026-09-23-local-model-evaluation/qwen38-tuning.md),
[evaluation-log.md](../2026-09-23-local-model-evaluation/evaluation-log.md),
[nav-pilot-e2e.md](../2026-09-23-local-model-evaluation/nav-pilot-e2e.md),
[night-64-1.md](../2026-09-26-64gb-tier/night-64-1.md), [64 GB plan](../2026-09-26-64gb-tier/plan.md),
[System One report](../2026-09-25-system-one/report.md), [MODELS.md](../../MODELS.md),
[PLAN.md §9](../../PLAN.md), [capabilities.json](../../manifest/capabilities.json),
`bench/results-*-2026092*.json`, `bench/np-e2e-*.json`.

External (read 2026-09-27): [Qwen/Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B),
[Qwen/Qwen3.6-35B-A3B](https://huggingface.co/Qwen/Qwen3.6-35B-A3B),
[Qwen/Qwen3.8-Flash-Next](https://huggingface.co/Qwen/Qwen3.8-Flash-Next),
[mlx-lm](https://github.com/ml-explore/mlx-lm) (PRs #990, #1501, #1559, #1623, #1632, #1811,
#1821, #1832, #1881; issues #1480, #1807, #1871, #1907, #1919),
[llama.cpp](https://github.com/ggml-org/llama.cpp) (PRs #24176, #26252, #26793, #26941, #27679,
#28068, #28208), [vLLM releases](https://github.com/vllm-project/vllm/releases),
[Ollama releases](https://github.com/ollama/ollama/releases) and issues #15771, #16117, #16383,
#17636, #18590, PRs #15988, #16146, [Ollama docs](https://docs.ollama.com/),
[Copilot CLI BYOK](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-byok-models),
[opencode providers](https://opencode.ai/docs/providers/), and the benchmark pages linked in §3.3.
