# Jev-like "System One" features for nav-pilot: research, 2026-09-24

For the Nav platform team. Desk research only: no GPU was used, and nothing here is a new
measurement. Numbers marked "vendor" come from the vendor and have not been reproduced. Numbers
marked "ours" come from this repo and name their source file.

## Executive summary

1. Jev is a real product. TypeSafe AI released it into limited early access on 15 Sep 2026: a proprietary, US-hosted "System One" API that returns typed decisions (choice, score, yes/no) with probabilities instead of text[^ts-blog][^wiki].
2. Vendor claims: 70–500 ms per call, $0.042 per million input tokens, output free, 64k context, text only, English strongest, no EU region, zero data retention only for enterprise customers[^ts-blog][^ts-models][^opper].
3. Independent numbers are more modest. On Banking77 Jev scored 81.0% against Claude Opus 5's 84.4%, at 13× lower latency[^openrouter]. LiteLLM measured 127 ms against Haiku's 688 ms for tier routing[^litellm-jev].
4. The mechanism is one forward pass and a read of the scores for the option letters. That is the same `max_tokens=1` + logprobs trick as our "OpenJev" probe. Open reproductions exist, including one on MLX at ~90 ms on an M5 Pro[^openjev-hf][^open-jev-mlx][^simple-jev].
5. What we measured: the pattern is fast enough (p50 ≈ 0.5 s on Qwen3.8-27B). It failed as a loop detector because it saw calls without results. The signal was missing; the model was not the problem.
6. Most useful for nav-pilot: (a) near-duplicate, result-aware loop detection; (b) a risk gate on tool calls; (c) redaction of secrets and fødselsnummer in tool results, plus a prompt-injection flag.
7. (a) and (c) are deterministic first. A model only earns its place on the residue that rules cannot decide, and it has to be shown the evidence.
8. nav-pilot already sees cloud-session tool calls. Its Copilot CLI hooks (`preToolUse`, `postToolUse`) run for every model, and `postToolUse` gets the tool result and can rewrite it[^gh-hooks-ref]. The local guard is not the only place to act.
9. A Nav-hosted gateway for cloud traffic would make Nav a processor of all prompts and code, and it would mean leaving the Copilot subscription path. Not recommended as a first step.
10. Do not depend on Jev itself yet: US-only hosting, early access, proprietary. Use the idea (typed questions over explicit evidence) with local models.

## 1. What Jev is

**Provider and product.** TypeSafe AI (San Francisco, founded 2024 by Diogo Almeida, Erik Gafni and
Sasha Sheng) announced Jev on 15 Sep 2026 with a US$40M seed round led by DCVC[^wiki][^ts-blog]. It
calls Jev the first "System One model", after Kahneman's fast, intuitive System 1. The name comes
from Jevons' paradox[^wiki]. The launch post is dated 15 Sep 2026[^ts-blog].

**What it does.** Jev is not a chat model. A request carries a `state` (text or JSON) and one or
more questions of three kinds[^ts-docs][^wiki]:

| Primitive | Returns |
|---|---|
| Choice | selected option, probability per option, confidence (up to 255 options[^ts-blog]) |
| Score | level on an ordered rubric, probability per level, confidence |
| Noul (yes/no) | probability of yes |

The state is processed once and all questions are evaluated against it in parallel. TypeSafe says
batching questions this way is 12.2× cheaper and 10× faster than one call per question[^ts-llms].

**Vendor claims.** 70–500 ms end to end. "40–200× faster" and "40–400× cheaper" than frontier LLMs,
with a best case of 193.6× and 444.6× on workflows TypeSafe wrote itself; it concedes these are at
"the high end of real-world gains". "0% hallucination" is guaranteed by schema, not measured[^ts-blog].
Training is described as synthetic data plus "RL for Calibrated Decisions"; size and architecture
are not disclosed[^wiki].

**Limits and terms.** Model `Jev 1.13.0`: 64k tokens per request (32k for state plus the longest
question), text only, best in English, 1,200 requests/min, $0.042/MTok input, output free[^ts-models].
Hosted in the US; the DPA carries the EU SCCs; zero data retention (ZDR) only for enterprise
customers, and no EU region is documented[^opper][^ts-models]. HN commenters say the terms forbid
publishing benchmarks; we have not verified this against the terms[^hn].

**Independent measurements.**

| Who | Task | Result |
|---|---|---|
| OpenRouter, 22 Sep 2026[^openrouter] | Banking77, 3,080 utterances, 77 intents | Jev 81.0% vs Opus 5 84.4% (gap 2.3–4.4 pp, significant). Median 175 ms vs 2,266 ms. $0.11 vs $2.42 per 1k requests |
| LiteLLM, 18 Sep 2026[^litellm-jev] | Auto-router tier choice | 127 ms vs Haiku 688 ms median. Tier match 95% vs 73.75%. Classifier cost only, not downstream answer quality |

**What people use it for.** The community list[^awesome-jev] is dominated by coding-agent guardrails:
`PreToolUse` risk gates for Claude Code (jev-engineering, jev-use), "no claiming done without
evidence" checks (jev-belay), and cross-agent tool-call risk scoring (jev-guard). Model and tier
routing is next (Switchboard, the LiteLLM `classifier_type: jev`, Jevonian as an OpenAI-compatible
proxy), followed by semantic filters in pipelines.

**"OpenJev".** Within days, several open reproductions appeared under that name[^classmethod]:

- `openjev/openjev`: 27B, CC BY-NC 4.0 (non-commercial), MLX 4/8-bit builds. 84.0% vs Jev's 85.4% on the authors' 10k-question text set; ~80 ms on one H100[^openjev-hf].
- `daseinlabs/open-jev`: Gemma 3 4B on mlx-lm, MIT, ~90 ms per request on an M5 Pro, with the same `/v1/systemone` contract. Its accuracy figures come from a synthetic set only[^open-jev-mlx].
- `featherless-ai/simple-jev`: Apache-2.0; turns any HF model into a `/v1/classifier` endpoint by reading next-token logits[^simple-jev].
- openjev.com runs Qwen3 0.6B–4B in the browser[^openjev-site]. There is also an unrelated crypto token called OpenJEV.

All of these read the scores for the option tokens at the first output position. That is the same
technique as `.mise/tasks/bench-decision` (commit f75fb88). HN's main objections are that the
probabilities are not calibrated unless someone calibrates them, and that BERT-class encoders have
done this for years[^hn].

## 2. Use cases for nav-pilot, ranked

"Sees it today" is for nav-pilot. **Guard** means the local proxy, which sees local traffic only.
**Hooks** means the Copilot CLI `preToolUse`/`postToolUse` hooks nav-pilot already installs
(`ask-first-aria`, `gh-poll-gate`, `nais-cluster-gate`, `klarsprak-gate` in `~/.copilot/hooks/`).
They run for cloud and local sessions alike. They are not exported to opencode yet (navikt/copilot#709).

| # | Use case | Needs | Sees it today | Value |
|---|---|---|---|---|
| 1 | Loop/stuck detection **with results** | Call + result history; < 1 s; high precision (a false stop costs a turn) | Guard: local. Hooks: `postToolUse` gets `toolResult`[^gh-hooks-ref] (state across calls needed) | **High.** Measured failure mode: runs of 203 and 220 identical calls (`guard.go` header) |
| 2 | Tool-call risk gate before execution | Tool name + args + cwd; < 1–2 s (hook timeout 5 s); high recall, "ask" rather than "deny" | Hooks: yes, all models | **High.** Regex gates exist; a model covers the long tail of shell commands |
| 3 | Secret / fødselsnummer / PII in tool results before they reach the model | Tool result text; ms; high recall | Hooks: `postToolUse` can return `modifiedResult`[^gh-hooks-ref] | **High for cloud sessions**, mostly deterministic |
| 4 | Prompt-injection flag on tool outputs (web fetch, issues, MCP) | Tool result; < 1 s; low false-positive rate on code and logs | Hooks: yes | Medium. Flag via `additionalContext`, do not block |
| 5 | Nav-agent intent choice | First prompt; < 0.5 s | Only if the prompt passes through nav-pilot at launch | Medium. Low risk, easy to evaluate |
| 6 | Model tier per task (local 35B-A3B / 27B / cloud) | Task text at launch; accuracy vs task outcome is hard to measure | At launch only | Medium, but switching mid-session loses context and cache |
| 7 | Local vs cloud routing per request | Every request | **No.** Cloud traffic bypasses nav-pilot | Low now. Needs option (b) |
| 8 | Commit/PR text checks | Commit message; seconds | Hooks on `git commit` | Low. Deterministic rules (trailers, length, klarspråk gate) already cover it |
| 9 | Context compression | Generative | n/a | Not a System One task |
| 10 | Command autocomplete | Generative, < 100 ms | n/a | Not a System One task |

Secret and PII detection *in prompts* is weaker than it looks: `userPromptSubmitted` config-file
hooks have their output dropped, so they cannot block or rewrite[^gh-hooks-ref].

## 3. Self-hosted building blocks

Latency on Apple Silicon is given only where published. "Ours" rows are from this repo.

| Candidate | What it does | Licence | Size | Latency | Maturity | Fit for nav-pilot |
|---|---|---|---|---|---|---|
| Small instruct model + logprobs (Qwen3 0.6B–4B, Gemma 3 4B) | Choice/noul over any prompt | Apache-2.0 (Qwen3), Gemma terms | 0.6–4B | open-jev: ~90 ms, Gemma 3 4B on M5 Pro[^open-jev-mlx]. Ours: p50 ≈ 0.5 s on Qwen3.8-27B 8-bit (`evaluation-log.md`) | The technique is old; the calibration is up to us | **Best general fit.** mlx-lm already in nav-pilot's runtime |
| Main local model as classifier | Same, no extra memory | as model | 35B-A3B | Ours: optiq TTFT 0.99 s at 2k (`decision.md` §3.1) | Works | Competes with generation on one GPU; fine for low-rate checks |
| Llama Prompt Guard 2[^pg2] | Injection/jailbreak, binary | Llama 4 Community (gated) | 22M (EN) / 86M (multilingual) | not published for MLX; DeBERTa-size, CPU-friendly | Stable, Meta, part of LlamaFirewall[^llamafirewall] | Good for use case 4; test FP rate on code first |
| LlamaFirewall[^llamafirewall] | PromptGuard + AlignmentCheck (LLM audits agent reasoning) + CodeShield (Semgrep/regex) | see repo (PurpleLlama) | framework | n/a | Research-grade, AlignmentCheck "experimental" | Borrow CodeShield rules; AlignmentCheck too heavy locally |
| Qwen3Guard Gen / Stream[^qwen3guard] | Safety classification; Stream variant scores per token | Apache-2.0 | 0.6B / 4B / 8B | not published for MLX | Tech report Oct 2025 | Content safety is not our problem; the 0.6B is a cheap base to fine-tune |
| Granite Guardian 3.x[^granite] | Harm, RAG groundedness, **function-call hallucination** | Apache-2.0 | 38M–8B (3.2 3B-A800M MoE) | Ollama builds exist | IBM, stable | Interesting for use case 2 (bad tool args) |
| ShieldGemma[^shieldgemma] | 4 harm categories | Gemma terms (gated) | 2B / 9B / 27B | n/a | Stable | Poor fit: categories are content harms |
| Arch-Router-1.5B / archgw (Plano)[^arch] | Preference routing to a model per domain/action | Apache-2.0 (gateway); check model card | 1.5B | 51 ms (paper, GPU) | Active, 7k stars | Fit for use case 6 if routing ever lands |
| RouteLLM[^routellm] | Strong/weak router trained on Arena preferences | Apache-2.0 | MF / BERT routers | n/a | **Stale** since Aug 2024 | Idea only; the weak/strong pair does not match ours |
| semantic-router (Aurelio)[^semrouter] | Embedding nearest-route | MIT | encoder of choice | ms on CPU | Active | Good for use case 5 (agent intent) |
| vLLM Semantic Router[^vllmsr] | K8s router with intent, jailbreak, PII classifiers (mmBERT), semantic cache | Apache-2.0 | several small encoders | n/a | v0.3, Helm chart, Envoy integration | Candidate *only* for option (b) on NAIS |
| NeMo Guardrails[^nemo] | Programmable input/output/execution rails | Apache-2.0 | framework | adds an LLM call per rail | Mature | Heavy for a CLI; option (b) only |
| LiteLLM proxy[^litellm-auto] | Gateway, guardrails, Auto Router (incl. Jev classifier) | MIT core; auto-router features license-gated | gateway | n/a | Very active | Option (b) only; mind the gated features |
| Portkey gateway[^portkey] | Gateway with 40+ guardrails | MIT | gateway | "<1 ms" overhead (vendor) | Active | Option (b) only |
| Envoy AI Gateway / Agent Router[^envoy] | K8s-native AI gateway, token rate limits, MCP routes | Apache-2.0 | gateway | n/a | v1.0 Jun 2026 | Option (b) on NAIS, if at all |
| gitleaks[^gitleaks] | Secret patterns | MIT | regex | ms | Mature | Use case 3, together with a fødselsnummer mod-11 check |

**Reward-model and judge approaches** (an LLM scores a transcript) are System Two in cost. Only
AlignmentCheck is agent-specific[^llamafirewall]. They do not fit a per-call budget on a 48 GB Mac.
Keep them for offline evaluation.

**Embedding routers** (semantic-router, vLLM-SR's embedding signal) are the cheapest option for
fixed-label intent tasks. They cannot answer questions about evidence ("did this result change?").

## 4. Architecture options

**(a) Inside the local guard (local traffic only).** Sees the whole request, so calls and results
are there without extra state. It is stateless, which fits the guard's design. Costs: covers only
local-model sessions, and any model check shares the GPU with generation. Right home for loop
detection on local sessions; `repeatedToolCall` already pairs calls with results.

**(b) Nav-hosted gateway that also sees cloud traffic.** Copilot CLI reaches cloud models through
GitHub. To see that traffic, a Nav gateway would have to be the provider: BYOK/custom provider
pointed at Nav's own model contracts, instead of the Copilot subscription. Implications:

- Nav becomes a processor of all prompts, source code and tool output, including anything personal a tool reads. That needs a ROS/DPIA, a logging policy and access control. A log of prompts is a sensitive dataset in its own right.
- It moves billing and model availability away from the Copilot seat. It is a new single point of failure and adds latency to every request.
- Gains: per-request routing (use case 7), central policy, one place to run vLLM-SR / Prompt Guard on GPU in NAIS.
- It is an organisational decision, not a nav-pilot feature. Not recommended until (a) and (c) show the checks are worth having.

**(c) Client-side hooks.** Copilot CLI reads `~/.copilot/hooks/*.json` and `.github/hooks/*.json`.
`preToolUse` can allow, deny, ask or modify, and fails closed on a non-zero exit. `postToolUse`
receives `toolResult.textResultForLlm` and can return `modifiedResult` or `additionalContext`[^gh-hooks-ref].
opencode plugins have `tool.execute.before` (block or modify) and `tool.execute.after` (sees the
output)[^opencode]. nav-pilot already installs Copilot hooks and marks them with `navPilot`
(`internal/source/hooks.go`). Costs: a process per call (5 s timeout in nav-pilot's configs), no
state between calls unless the hook keeps it on disk, and a model call from a hook needs a
reachable model. During a cloud session the local GPU is idle, so a small local model is cheap
there. Gains: works for **cloud and local** sessions, and the data never leaves the Mac.

**Trade-off in one line:** (c) reaches the most traffic for the least trust change; (a) is where
state is free; (b) is the only way to route requests between cloud models, and the most expensive
one to justify.

## 5. Recommendation and experiment plan

Lesson from the failed classifier: it gave real loops P = 0.88 and legitimate polls 0.42–0.78,
too close to separate, because it was never shown whether the result changed.
Give a classifier the evidence the decision depends on, and do not use one where a rule already
settles the case. The result-aware rule (navikt/copilot#933) settled most of it for free.

**Jev itself:** do not integrate it now. It is US-hosted, in early access and proprietary, and its
ZDR is enterprise-only; for code and tool output that needs a ROS first. Its latency advantage
matters less on a developer Mac, where a 4B model on MLX answers in ~0.1 s[^open-jev-mlx].

### E1. Near-duplicate loop detection (use case 1)

- **Prototype:** in `repeatedToolCall`, compare a normalised result instead of the exact bytes. Replace ISO timestamps, durations, hex/UUIDs and digit runs with a placeholder before comparing. This is the `ponytail:` note already in `guard.go`. Then port the same rule to a `postToolUse` hook for cloud sessions, with state in a per-session file (check which session id the payload carries).
- **Only if rules leave a residue:** re-run the 7-scenario probe with the **last two results and their diff** in the prompt, as one noul question.
- **Measure:** add the 7 probe scenarios, plus variants with timestamped output, to `guard_test.go` (CPU). Replay recorded Copilot sessions (`~/.copilot/session-state/*/events.jsonl`) offline and count would-have-stopped turns, in the spirit of `mise run bench-loop-analysis` (CPU). Then check that no legitimate session stops early with `BENCH_WAIT=1 mise run bench-np-e2e` (queued behind the night run). Pass criterion: 0 false stops on the legitimate polls; both loop scenarios stopped.

### E2. Tool-call risk gate (use case 2)

- **Prototype:** one `preToolUse` hook for shell tools. Deterministic allow- and deny-lists decide first (reuse the `nais-cluster-gate` and `gh-poll-gate` patterns). Only unknown commands go to a Choice question {safe, risky-local, touches-shared-infra} on a small local model via mlx-lm logprobs, with the command, cwd and git branch as state. The hook answers **ask**, never deny, and falls back to the deterministic result on timeout.
- **Measure:** label ~200 shell commands pulled from real session logs (CPU). Report precision/recall per class and p50/p95 latency for Qwen3-1.7B, Qwen3-4B and the loaded optiq model, queued with `BENCH_WAIT=1`. Pass: recall ≥ 0.95 on "touches-shared-infra", p95 < 1 s, and fewer than one "ask" per 20 commands on a normal session.

### E3. Redaction and injection flag on tool results (use cases 3 and 4)

- **Prototype:** a `postToolUse` hook with gitleaks-style patterns and a fødselsnummer check (11 digits with valid mod-11 control digits). Hits are masked via `modifiedResult`, deterministic, no model. Second step, behind a flag: Llama Prompt Guard 2 86M on web/MCP results only, reporting via `additionalContext` ("this output contains instruction-like text").
- **Measure:** false-positive rate of both on a corpus of normal tool outputs from recorded sessions (code, test logs, `gh` output), and recall on a small set of planted secrets, test fødselsnummer and published injection samples. The regex part is CPU-only and can run now. Prompt Guard latency is to be measured later, after the night run.

**Not now:** per-request cloud/local routing (needs option b), context compression and
autocomplete (not classification), and a Nav gateway (organisational decision).

## Searches run

"Jev System One model provider", "OpenJev", "Jev AI inference API fast classification latency",
"TypeSafe Jev data retention privacy region EU", plus product-specific searches for every row in §3.
The primary sources were the TypeSafe blog and docs, Wikipedia, and the OpenRouter, LiteLLM and HN
pages cited below, fetched 2026-09-24.

[^ts-blog]: TypeSafe AI, "Introducing System One Models & Jev", 15 Sep 2026. https://typesafe.ai/blog/introducing-system-one-models-and-jev
[^wiki]: "Jev (AI model)", Wikipedia, citing Forbes, TechCrunch, The Register, SiliconANGLE (15–23 Sep 2026). https://en.wikipedia.org/wiki/Jev_(AI_model)
[^ts-docs]: TypeSafe docs. https://docs.typesafe.ai
[^ts-llms]: TypeSafe docs index. https://docs.typesafe.ai/llms.txt
[^ts-models]: TypeSafe, Models (Jev 1.13.0). https://docs.typesafe.ai/models
[^opper]: Opper, "TypeSafe AI: ZDR, training posture, GDPR DPA". https://opper.ai/provider/typesafe
[^openrouter]: OpenRouter, "Is Jev as accurate as frontier models at classification?", 22 Sep 2026. https://openrouter.ai/blog/insights/jev-vs-claude-opus-5-classification/
[^litellm-jev]: LiteLLM, "JEV Classifier: 5.43x as fast as Haiku", 18 Sep 2026. https://docs.litellm.ai/blog/jev-auto-router-benchmark
[^awesome-jev]: cobanov/awesome-jev. https://github.com/cobanov/awesome-jev
[^classmethod]: DevelopersIO, "I read OpenJev and thought of an alternative…". https://dev.classmethod.jp/en/articles/openjev-non-generative-ai-alternatives/
[^openjev-hf]: openjev/openjev model card. https://huggingface.co/openjev/openjev
[^open-jev-mlx]: daseinlabs/open-jev (MLX, Gemma 3 4B), Sep 2026. https://github.com/daseinlabs/open-jev
[^simple-jev]: featherless-ai/simple-jev. https://github.com/featherless-ai/simple-jev
[^openjev-site]: OpenJev / SemIf. https://openjev.com/
[^hn]: Hacker News, "OpenJev", Sep 2026. https://news.ycombinator.com/item?id=49752041
[^gh-hooks-ref]: GitHub Docs, hooks configuration reference. https://docs.github.com/en/copilot/reference/hooks-configuration
[^opencode]: opencode, Plugins. https://opencode.ai/docs/plugins/
[^pg2]: Meta, Llama Prompt Guard 2 model card. https://github.com/meta-llama/PurpleLlama/blob/main/Llama-Prompt-Guard-2/86M/MODEL_CARD.md
[^llamafirewall]: Chennabasappa et al., "LlamaFirewall", arXiv:2505.03574, May 2025. https://arxiv.org/abs/2505.03574
[^qwen3guard]: Qwen, "Qwen3Guard Technical Report", arXiv:2510.14276, Oct 2025. https://github.com/QwenLM/Qwen3Guard
[^granite]: IBM, Granite Guardian. https://github.com/ibm-granite/granite-guardian
[^shieldgemma]: Google, ShieldGemma. https://ai.google.dev/gemma/docs/shieldgemma
[^arch]: Katanemo, "Arch-Router", arXiv:2506.16655, Jun 2025. https://huggingface.co/katanemo/Arch-Router-1.5B
[^routellm]: LMSYS, "RouteLLM", 1 Jul 2024. https://www.lmsys.org/blog/2024-07-01-routellm/
[^semrouter]: aurelio-labs/semantic-router. https://github.com/aurelio-labs/semantic-router
[^vllmsr]: vLLM Semantic Router v0.3 "Themis", 5 Jun 2026. https://vllm.ai/blog/2026-06-05-v0.3-vllm-sr-themis-release
[^nemo]: NVIDIA NeMo Guardrails. https://github.com/NVIDIA-NeMo/Guardrails
[^litellm-auto]: LiteLLM, Auto Router. https://docs.litellm.ai/docs/auto_router/
[^portkey]: Portkey-AI/gateway. https://github.com/portkey-ai/gateway
[^envoy]: Envoy AI Gateway v1.0, 23 Jun 2026. https://www.prnewswire.com/news-releases/envoy-ai-gateway-reaches-v1-0--establishing-the-open-source-standard-for-enterprise-ai-traffic-302808088.html
[^gitleaks]: gitleaks. https://github.com/gitleaks/gitleaks
