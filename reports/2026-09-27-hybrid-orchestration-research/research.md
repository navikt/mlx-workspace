# Cloud + local orchestration: has anyone solved it?, 2026-09-27

Desk research. No GPU runs, no downloads, no sessions. Web sources were read on 2026-09-27; each
carries its URL and publication date. Our own figures come from
[pending-tasks.md §8.8](../2026-09-23-local-model-evaluation/pending-tasks.md) (dispatch probes 1–5).

Labels: **[fact]** = a cited primary source or our result files say it. **[inference]** = our
reading or estimate. For outside numbers, **(vendor)** = measured by the seller of the product,
**(authors)** = measured by the paper's own authors on their own method, **(indep.)** = measured by
someone with no stake in the method.

## Question

Should we do another round of research to find out whether others have already solved
cloud + local (or strong + weak) orchestration in coding agents? And what does that change for the
`local_dispatch = off|conservative|balanced|aggressive` setting and its preToolUse hook, now being
built?

If someone has a reliable way to make a strong cloud orchestrator hand work to a weak worker, we
copy it. If nobody does, the hook is the design and the question becomes what it should enforce.

## What shipped

Nothing. This report recommends a shape for the `local_dispatch` levels and the hook (§6) and
one measurement per level (§6.4).

## Summary

1. **Nobody ships "the cloud model decides when to hand work to a local model" as a reliable
   feature.** [fact] Every shipping product we found decides delegation in one of three other
   ways: the **user picks a mode or role** (Aider architect/editor, Cline Plan/Act, Roo Code modes,
   Continue roles, Claude Code `opusplan`, Codex custom agents, which Codex spawns "only when you
   explicitly ask"), a **router in front of the model** picks per request (Copilot Auto, Cursor
   Router, Windsurf/Devin Adaptive, OpenRouter Auto), or the **cheap model runs and escalates** to
   the strong one (Anthropic's advisor tool, Goose lead/worker). The one product where an
   orchestrator delegates on its own judgement, Claude Code's built-in Haiku `Explore` subagent,
   delegates read-only search, and Anthropic's own guidance says its newer Opus models
   *over*-delegate. [fact]
2. **Strong models' delegation is model-specific and not steerable by prose.** [fact]
   DecisionBench (May 2026, indep.) measured 11 orchestrators at 0.02–0.41 delegation calls per
   task, with an agent's domain policy overriding delegation cues. A preloaded list of peers
   *lowered* routing precision (7.5–20.8 %) against giving the agent an on-demand tool (29.5 %).
   Anthropic says Opus 4.6 and Opus 5 delegate *more* readily than earlier models. Our five probes
   show Sonnet 5 delegating 1 of 29 against Sonnet 4.6's 23 of 24 in August. [inference] The
   direction flips between model versions, so a design that depends on the orchestrator's
   willingness breaks on the next model update. That is what happened to us between August and
   September.
3. **The pattern with the best published evidence is inverted: the cheap model executes, the
   strong one advises.** [fact] Anthropic's advisor tool (9 Apr 2026, vendor): Sonnet executor +
   Opus advisor gained 2.7 points on SWE-bench Multilingual at 11.9 % lower cost. Qualcomm's hybrid
   study (May 2026, authors) found "executing on-device with cloud supervision" the best
   configuration, and that too much cloud intervention hurts. MinionS (Feb 2025, authors) kept
   97.9 % of the cloud model's accuracy at 5.7× lower cloud cost, but on long-document QA, not code
   edits. [inference] This needs a local model that can run the agent loop and debug. Ours cannot
   yet ([local-inference-findings.md](../local-inference-findings.md)), so it is a later
   experiment, not a `local_dispatch` level.
4. **Routers beat the best single model by a few points at best, and often don't.** [fact]
   LLMRouterBench (ACL 2026, indep.; 10 methods, 33 models, 400k queries): the best router scored
   71.9 % against 68.0 % for the best single model, and commercial routers including OpenRouter
   did not beat it. RouterBench (2024): cascades collapse once the judge's error rate passes
   about 0.2. Router-LLMs route by task *category* rather than difficulty, sending all coding
   queries to the strongest model (EACL 2026, indep.). The large vendor numbers (RouteLLM 85 %,
   FrugalGPT up to 98 %, Cursor 41–68 %) are chat or QA traffic, measured by their authors or the
   vendor.
5. **The mechanisms that actually move work are enforced by the harness, not by prompts.**
   [fact] Aider's editor model, Cline's Act model, `opusplan` and Goose's lead/worker all switch
   models because the *harness* switches, not because a model chose to. A community hooks project for
   Claude Code proposes an "orchestrator-only" mode built on PreToolUse hooks that deny Edit and
   Write in the main thread.
   opencode has this natively: per-agent `permission` with `edit: deny` on the primary agent and
   `allow` on the worker.
6. **Cost: at Sonnet 5 prices with caching, the saving ceiling on the jobs we probed is cents.**
   [fact] Sonnet 5 costs $2/M input, $0.20/M on a cache hit and $10/M output (Anthropic pricing
   page, 2026-09-27). Our probe jobs cost $0.06–0.44 and took 20–230 s. The one dispatched sample
   cost the same as its non-dispatched siblings and took 90 s against 33–49 s. [inference] Each
   extra cloud step with a ~20k cached context costs about $0.005–0.01, so a dispatch that saves
   3–9 edit steps saves about $0.02–0.08 and adds 40–60 s. In August, savings (0.39× and 0.53×)
   appeared only on cells where the cloud needed about 5 steps or more.
7. **Recommendation** (§6): make the levels *modes*, the way products do, and enforce them in
   the tool layer:
   - `off`: no worker and no policy text in the prompt. Probes 4–5 show the unused policy costs
     0.8–1.45× the control.
   - `conservative`: user-invoked only (`@local-worker`, as Codex and Cline do).
   - `balanced`: a deterministic pre-router (`alpha decide` on the user's prompt, trusted classes
     only), with an edit-deny that applies to that turn and a reason naming the task call.
   - `aggressive`: architect/editor: the primary agent cannot edit, the worker edits, the cloud
     verifies, with a failure fallback.

   Key the enforcement on the agent, not the tool: Copilot CLI hooks fire inside subagents
   and carry no agent name. Measure each level with the existing probe and GO rule before
   claiming savings.

**Answer to the user's question:** yes, this round was worth doing, and one is enough. The
answer is "nobody has solved autonomous cloud→local delegation; the working patterns are user
modes, pre-model routers, and executor-initiated escalation". A further round would find more of
the same. The next evidence has to come from our own probe run against the enforced levels.

## Method

- Web search and reading of vendor docs, changelogs, GitHub issues and arXiv abstracts/HTML,
  2026-09-27. Papers were read at abstract or HTML-summary depth, not in full. Figures quoted from
  them are the headline numbers. Where a figure matters to a decision, its source type is marked.
- opencode's plugin hook signature and permission docs were read from source (`anomalyco/opencode`,
  branch `dev`, via the GitHub API).
- Our own figures are from pending-tasks §8.8 (probes 1–5, 2026-09-27) and the August hybrid runs
  cited there. No new sessions were run.
- Earlier desk research already covered part of this ground: the "Prior art worth knowing"
  note in `working/alpha-status.md`, RouteLLM in the
  [Jev-like features research](../2026-09-24-jev-like-features/research.md), and Copilot CLI's
  provider limits in [Copilot mixed mode](../2026-09-24-copilot-mixed-mode/research.md). This
  report does not repeat those. It checks their claims where they matter here.

## 1. Products and tools

### 1.1 Comparison

"Who decides" is the thing that decides whether work actually moves.

| Tool (date checked) | Pattern | Who decides delegation | Enforced? | Local model as worker? | Published result |
|---|---|---|---|---|---|
| **Aider** architect/editor[^aider] | Strong architect describes the change; editor model writes the edit | User turns the mode on; the harness then always sends the architect's output to the editor | Yes, by the harness | Yes (any model; DeepSeek was the editor in several pairs) | o1-preview + DeepSeek 85.0 % (whole) on Aider's edit benchmark; R1 + Sonnet 64.0 % polyglot at 14× less than o1 (authors = Aider, vendor-ish) |
| **Cline** Plan/Act[^cline] | Plan mode reads, cannot edit or run; Act mode executes | User switches the mode; the model follows the mode | Yes, Plan mode has no write tools | Yes, documented for local models (one loaded at a time) | None |
| **Roo Code** Orchestrator ("Boomerang")[^roo] | Orchestrator spawns child tasks in modes (Architect, Code, Debug), each with its own model | The orchestrator model chooses mode and task | The orchestrator has no edit tools, so it *must* delegate | Yes, via per-mode model | None |
| **Continue**[^devto] | Roles: autocomplete local (Ollama), chat cloud | User config per role | Yes, static | Yes | None |
| **Claude Code** subagents, `opusplan`[^ccsub][^opusplan] | Built-in `Explore` on Haiku; `model:` per subagent; `opusplan` = Opus in plan mode, Sonnet when executing | Orchestrator's choice for subagents; the mode switch for `opusplan` | Subagents: no. `opusplan`: yes | No local provider natively | None published. Anthropic: Opus 4.6/5 *over*-delegate[^ccbp] |
| **Anthropic advisor tool**[^advisor] | Cheap executor runs the task; calls a strong advisor when stuck | The executor | `max_uses` caps calls | Executor is Claude only | Sonnet+Opus: +2.7 pts SWE-bench Multilingual, −11.9 % cost; Haiku+Opus BrowseComp 41.2 % vs 19.7 % (vendor) |
| **OpenAI Codex CLI**[^codexsub][^codexoss] | Custom agents in `.codex/agents/*.toml` with their own model; `--oss` local mode via Ollama | User: "Codex only spawns subagents when you explicitly ask" | n/a | Whole-session `--oss`; per-subagent provider is an open request (openai/codex#14039) | None |
| **opencode**[^ocagents] | Primary agents and subagents, per-agent `model` and `permission`; `permission.task` limits which subagents may be called | Primary agent's choice (by description) or user `@mention` | Per-agent `permission` can deny `edit`/`bash` patterns | Yes, a subagent can use a different provider (what nav-pilot uses) | None |
| **Goose** lead/worker[^goose] | Lead model for the first N turns (default 3), then worker; back to lead after repeated failures (threshold 2) | Deterministic turn count + failure counter | Yes, by the harness | Yes, any provider | None. Since folded into general multi-model config (block/goose#4036, Aug 2025)[^goose4036] |
| **GitHub Copilot Auto**[^copilotauto] | Router picks a model per task from a pool (Sonnet 4.6, GPT-5.x, Haiku 4.5 …), respects cache boundaries | Server-side classifier + health signals | Yes | No; a BYOK provider disables Copilot routing | A 10 % discount when Auto picks (changelog, pre-credits wording); no quality numbers |
| **Cursor Router** (Auto)[^cursor] | Stage 1 predicts complexity; stage 2 taxonomy router over frontier models; per turn | Server-side classifier | Yes | No; custom endpoints go through Cursor's servers | Auto Balance "outperforms Opus 4.8 at 41 % lower cost", Intelligence −68 % (vendor, own traffic) |
| **Windsurf/Devin Adaptive**[^windsurf] | Router by prompt complexity | Server-side | Yes | No | None |
| **OpenRouter Auto**[^openrouter] | Classifies prompt into ~30 task types; picks by last 7 days' community spend; sticky per conversation | Server-side | Yes | No | None; LLMRouterBench found OpenRouter did not beat the best single model[^llmrb] |
| **Martian, NotDiamond, RouteLLM, LiteLLM**[^routellm][^martian] | Per-request routers (trained on preference or benchmark data) | Router | Yes | RouteLLM/LiteLLM can target any endpoint | RouteLLM: 85 % cost cut at 95 % GPT-4 quality on MT-Bench (authors, 2024); Martian "20–97 %" (vendor) |

[inference] Only Roo Code's Orchestrator and Claude Code's subagents rely on the strong model's
own judgement. Roo removes the choice by giving the orchestrator no edit tools. Claude Code uses
it for read-only work, where Anthropic's problem is too much delegation. Every tool that moves
*edits* to a cheaper model does it by a harness rule or a user mode.

### 1.2 Hooks and enforcement surfaces we would build on

- **Copilot CLI** [fact]: `preToolUse` gets `sessionId`, `toolName` and `toolArgs`, and returns
  `permissionDecision` (`allow`/`deny`/`ask`) with a `permissionDecisionReason` that the agent
  sees, or `modifiedArgs`. The payload has **no agent name**[^ghhooks]. Hooks did not fire for
  subagent tool calls in early 2026 (github/copilot-cli#2392, #3013, both closed); 1.0.49's
  changelog says they now fire "for sub-agent tool calls"
  ([Copilot mixed mode §1.1](../2026-09-24-copilot-mixed-mode/research.md)). `subagentStart` and
  `subagentStop` carry the agent name. [inference] A plain "deny `edit`" hook would therefore
  also deny the worker's edits. It needs to track which session or agent is active, for example by
  setting state on `subagentStart` and clearing it on `subagentStop`. Copilot CLI still has one
  provider per session, so the local worker lives in opencode today anyway.
- **opencode** [fact]: `tool.execute.before(input: {tool, sessionID, callID}, output: {args})`,
  and throwing blocks the call (`packages/plugin/src/index.ts`, `session/tools.ts` on `dev`). There
  is no agent name. Subagents run as child sessions, so the hook fires for the worker too
  [inference, from the call site]. Per-agent `permission` is native and simpler:
  `edit: deny` on the primary agent, `edit: allow` on `local-worker`, and bash patterns per agent
  (`"sed -i*": "deny"`)[^ocagents].
- **Claude Code** [fact]: PreToolUse exit 2 blocks and shows stderr to the model. Hooks did not
  fire in subagents as of anthropics/claude-code#34692 (closed not planned, Mar 2026). Community
  "orchestrator-only mode" builds on exactly this[^hooksdaemon].

## 2. Research

| Work (date) | Setting | Result | Type | What it means for us |
|---|---|---|---|---|
| **Minion / MinionS**[^minions] (Feb 2025; retrospective May 2026[^hazyretro]) | Local small LM + cloud LM over long financial, medical and scientific documents | Minion: 30.4× lower cloud cost, 87 % of quality. MinionS: remote model decomposes into single-step jobs over chunks, run locally in parallel: 5.7× lower cost, 97.9 % of quality | authors | Works when the cloud writes small, self-contained jobs and the local model runs many of them. That is our per-file split rule (#997). The cost metric is cloud tokens on QA, not code edits |
| **Qualcomm hybrid MAS**[^qualcomm] (May 2026) | Qwen3 4–32B on device, GPT-4o in cloud; plan-based (PEVR) and advisory (EVA) | Hybrid beats device-only and costs less than cloud-only; "executing on-device with cloud supervision" is the best configuration; too much cloud intervention hurts | authors | Supports local-first with cloud supervision, not cloud-first with optional dispatch |
| **Advisor strategy**[^advisor] (Apr 2026) | Claude executor, Opus advisor | See §1.1 | vendor | Same direction: executor calls up, not orchestrator calls down |
| **HERA / AIMS**[^hera] (Apr 2025; EuroSys 2026) | Scheduler partitions an agent's iterations between local SLM and cloud LLM | Per-iteration selection beats per-request routing for agents | authors | A learned or rule-based scheduler, not the LLM's choice |
| **DecisionBench**[^decisionbench] (May 2026) | 11 orchestrators, 7 vendors, GAIA/τ-bench/BFCL, can call peer models | 0.02–0.41 delegation calls per task; routing precision@1 7.5–29.5 %; a perfect delegator would score 15–31 points higher; domain policy overrides delegation cues; an on-demand tool beats a preloaded list (29.5 % against 7.5–20.8 %); vendor self-preference up to 3.65× chance (GPT-5.5), Anthropic neutral | indep. | Prose in the prompt is a weak lever. The closest analogue to our "policy text + persona tier" finding |
| **RouteLLM**[^routellm] (2024) | Strong/weak router trained on Arena preferences | 85 % cost cut at 95 % GPT-4 quality on MT-Bench | authors | Chat, single turn |
| **FrugalGPT**[^frugal] (2023) | Cascade of APIs with a scorer | Up to 98 % cost cut at GPT-4 accuracy on some datasets | authors | QA; the scorer is the hard part |
| **RouterBench**[^routerbench] (2024) | Precomputed outputs, routing and cascades | Oracle routing saves 2–5×; cascades degrade fast once judge error > 0.2 | authors (Martian) | A cascade needs a reliable pass/fail check, which our verified edits have (compile, tests) |
| **LLMRouterBench**[^llmrb] (ACL 2026 Findings) | 10 routers, 33 models, 400k queries | Best router 71.9 % against best single model 68.0 %; many routers, commercial ones included, do not beat it | indep. | Don't expect a trained router to earn much over "always cloud" on quality |
| **Router-LLM fragility**[^fragile] (EACL 2026) | Robustness of routers | Route by category, not difficulty; all coding goes to the strongest model | indep. | A category router would never send code to local. Route on *task class + size*, which `decide` can read from the prompt |
| **LLM Shepherding**[^shepherd] (Jan 2026) | Strong model gives a short hint prefix; small model finishes | 42–94 % cost cut on GSM8K, HumanEval, MBPP; up to 2.8× over routing/cascade baselines | authors | Pay for the plan, not the edit: the architect/editor idea at token level |
| **Bayesian self-escalation**[^escalate] (Aug 2026) | Weak model decides mid-generation to hand over to a strong one | Beats post-hoc routing at equal cost on MBPP (Qwen2.5-Coder 1.5B→7B); needs learned signals, not raw entropy | authors | Escalation works with a calibrated signal; self-reported confidence is not enough |
| **Uno-Orchestra**[^uno] (May 2026) | A trained 7B router emits decomposition + (model, primitive) | 77.0 % macro pass@1 over 13 benchmarks at $0.10/query | authors | A *trained* orchestrator delegates selectively; an untrained frontier one does not |
| **Anthropic multi-agent research**[^anthmulti] (Jun 2025) | Orchestrator-worker research agent | Multi-agent uses ~15× the tokens of chat; "coding is less parallelizable" | vendor | Delegation has a token overhead that eats small savings |
| **In-context vs orchestration**[^incontext] (Apr 2026) | Procedures in the system prompt against a LangGraph orchestrator | In-context failed 0.5–11.5 %, orchestrator 9–24 % | authors | Frontier models do well on their own; external orchestration has to earn its keep |

Studies on under-delegation specifically: [fact] we found none that names it for coding
agents. DecisionBench measures low delegation and its causes; Anthropic's guidance documents the
opposite failure for Opus. [inference] Our probes are, as far as we can tell, the only published
measurement of a frontier orchestrator declining a local worker it was told to use.

## 3. Mechanisms that make delegation reliable

| Mechanism | Who uses it | Evidence on cost | Evidence on quality | Fits nav-pilot? |
|---|---|---|---|---|
| **Advisory prompt text** (policy, agent description) | Claude Code subagents, our policy | None published | DecisionBench: weak lever; our probes: 1/29 on Sonnet 5 | Already tried five times. Stop tuning |
| **Deterministic pre-router** (classifier before the model) | Copilot Auto, Cursor Router, Windsurf, OpenRouter, RouteLLM | Vendor: 41–68 % (Cursor, cloud→cloud) | Indep.: routers ≈ best single model (LLMRouterBench) | Yes: `alpha decide` on the user's prompt, trusted classes only |
| **Hard mode: plan cloud, execute local** (architect/editor) | Aider, Cline, `opusplan`, Roo Orchestrator, Qualcomm PEVR | Aider R1+Sonnet 14× cheaper than o1 (cloud pairs) | Aider: a strong architect lifts a weaker editor; quality is capped by the editor on hard edits | Yes, as `aggressive`. Quality is capped by our worker's trusted classes |
| **Tool-level enforcement** (deny edits in the main agent) | Community orchestrator-only hooks, opencode permissions, Roo Orchestrator (no edit tools) | None published | Not measured anywhere | Yes, and it is the only lever we have not measured |
| **Budget steering** (caps) | Advisor `max_uses`, Goose turn counts, Copilot premium-request multipliers | Advisor −11.9 % (vendor) | Advisor +2.7 pts (vendor) | Partly: a cap on *denials* stops a deadlock (§6.2) |
| **Local-first with cloud escalation** | Advisor tool, Goose lead/worker, Qualcomm EVA, self-escalation, FrugalGPT | 5.7× (MinionS), 85 % (advisor, Haiku vs Sonnet on BrowseComp), vendor/authors | Close to the strong model when the escalation signal is reliable | Not yet: the local model cannot debug, and our escalation signal (compile/test) exists only after the edit |
| **Cascade with a verifier** | FrugalGPT, RouterBench | 50–98 % on QA (authors) | Collapses when the judge errs > 20 % | Our verified edits give a reliable judge; fits the fallback in §6.2 |

## 4. Cost reality

[fact] Sonnet 5 (Anthropic pricing, 2026-09-27): $2/M input, $2.50/M 5-minute cache write,
**$0.20/M cache hit**, $10/M output. The planned increase to $3/$15 on 1 September was cancelled.
Since 1 June 2026 Copilot bills AI Credits ($0.01 each) on input, output and cached tokens at
each model's API rates, replacing premium requests[^copilotbill]. So the same token arithmetic
applies to Copilot users as to API users.

[fact] Our probes: Sonnet 5 did each job for **$0.06–0.44** in **20–230 s** (renames $0.06–0.13,
thread-arg rungs $0.12–0.19, five test files $0.23–0.44). The one dispatched sample cost $0.107
against $0.090–0.132 for its non-dispatched siblings and took 90 s against 33–49 s. In August
(Sonnet 4.6, $3/$15), dispatch saved money only where the cloud needed about 5 or more steps
(hybrid-6 at 0.39×, frontend-3 at 0.53×), and those cells are now retired or scriptable.

[inference] Why caching makes the saving small. With a ~20k-token cached context, one extra
cloud step costs about 20k × $0.20/M = $0.004 of input plus a few hundred output tokens at
$10/M, so roughly **$0.005–0.01 per step**. A dispatch replaces the edit steps with one `task`
call (the instructions are output tokens) and one or two verification steps. On a 3–9-step job
that saves about $0.02–0.08, on jobs that cost $0.06–0.44 in total. Most of the cloud cost is
fixed: the system prompt, the first uncached read, and the final build. Delegation does not
remove those. Anthropic's 15× token figure for multi-agent research shows how an orchestration
overhead can swallow that margin.

[inference] When local does save: (a) long, output-heavy jobs where the cloud would write many
thousand tokens of code (output is 50× the cache-hit price per token); (b) jobs where the cloud
would loop through many read-edit-build cycles. Electricity for local inference is quoted at about
$0.10 per million tokens (third-party blogs, not checked), so the local side is effectively free.
The real local costs are latency (40–60 s extra per dispatch in our probe) and the quality risk
outside the trusted classes.

[fact] Published savings for comparison: RouteLLM 85 % and FrugalGPT up to 98 % (chat and QA,
authors), MinionS 5.7× cloud cost (document QA, authors), advisor −11.9 % (coding, vendor), Cursor
−41 % to −68 % (production coding, vendor, cloud→cloud). None of them is a cloud orchestrator
delegating code edits to a local model, and none was measured against a prompt-cached baseline at
2026 prices.

## 5. What is directly reusable for nav-pilot

1. **A deterministic pre-router with `alpha decide`** (Copilot Auto, Cursor Router, RouteLLM
   pattern). `decide` already answers typed questions locally with calibrated p. Ask it, once per
   user prompt, whether the task is in a trusted class (today only `edit-multi-mechanical`) and
   over the size rule (≥ 5 files or ≥ 10 sites). Only then enforce. The fragility paper's warning
   applies: route on class *and* size, not on "is this code". The routing design's §7 said a
   classifier was unnecessary because Sonnet 4.6 routed correctly; that premise no longer holds
   for Sonnet 5.
2. **Aider-style architect/editor as a hard mode.** The cloud agent plans and verifies; the harness
   removes its edit tools, so all edits go to `local-worker`. opencode supports this with
   per-agent `permission`, with no hook needed for the `edit` tool.
3. **The MinionS job shape.** The cloud writes single-step, per-file jobs with the exact sites and
   a grep check; the local model runs them. #997's split rule already says this. Keep it as the
   worker brief under enforcement.
4. **Goose/advisor-style caps and fallback.** A fixed number of denials, then let the cloud do
   it; after two failed worker attempts on a job, hand it back to the cloud. This is a cascade with
   a reliable judge (compile, tests, grep), which is the case where RouterBench says cascades work.
5. **Local-first escalation** (advisor, Qualcomm, MinionS). Later, as a separate experiment: a
   local primary agent with a cloud `advisor` subagent. Our local models cannot debug and are not
   trained to call for help, so this is not a `local_dispatch` level now.

## 6. Recommendation for `local_dispatch` and the hook

### 6.1 Levels

| Level | Prompt | Enforcement | Analogue | Expected dispatch |
|---|---|---|---|---|
| `off` | No `local-worker`, no policy text | None | Default everywhere | 0 |
| `conservative` | `local-worker` listed, one neutral line ("the user may ask you to use it") | None; dispatch when the user asks (`@local-worker` or "use the local worker") | Codex, Cline, Continue | Only on request |
| `balanced` | As conservative, plus a per-turn note injected *only* when the pre-router fires | Pre-router: `alpha decide` on the prompt → trusted class and over size. For that turn, deny the primary agent's `edit`/`write`/`apply_patch` and in-place bash edits, with a reason naming the worker and the per-file split | Copilot Auto / Cursor Router + Roo Orchestrator | ≈ the router's hit rate on trusted classes |
| `aggressive` | Architect/editor brief | The primary agent never edits (all turns); worker edits; cloud reads, builds, tests, verifies | Aider architect/editor, Cline Plan/Act, `opusplan` | Every edit |

[inference] At `off`, the policy text and worker description should also go, because probes 4–5
measured the unused policy at 0.8–1.45× the control's cost. That makes `off` cheaper than today's
default.

### 6.2 Hook design

1. **Key on the agent, not only the tool.** In opencode, prefer per-agent `permission`
   (`edit: deny` on the primary agent, `allow` on `local-worker`) over a global
   `tool.execute.before` hook, which also fires in the worker's child session and only carries a
   `sessionID`. In Copilot CLI, `preToolUse` has no agent name and (since 1.0.49) fires inside
   subagents. Track the active subagent through `subagentStart`/`subagentStop`, or exempt by
   session.
2. **Close the bash route.** Sonnet 5 kept work with `sed -i`, `perl -pi`, `grep | xargs sed` and
   `for` loops (probes 1–4). Deny those patterns for the primary agent at `balanced` (that turn)
   and `aggressive`. [inference] The pattern list will leak; count bypasses in the probe (§6.4)
   rather than trying to make it airtight.
3. **Use the deny reason as the steering channel.** DecisionBench's on-demand-tool result and our
   probes both say the model acts on what the tool tells it at the moment, not on the preloaded
   policy. The reason should say what to do: "Edits go to `local-worker` in this session. Send
   one task per file with the exact sites and a grep check."
4. **Cap and fall back.** After k denials in a turn (k = 3), or two failed worker attempts on
   the same job (compile/test/grep red), allow the cloud to edit and record it. This follows the
   pattern of Goose's failure threshold and the advisor's `max_uses`. Without it, a worker
   refusal deadlocks the session.
5. **Record it.** Per session: level, router verdict and p, denials, bypasses (edits by bash
   after a deny), dispatches, worker pass/fail, fallbacks. That is the data the GO rule needs, and
   it matches the runtime-feedback telemetry already proposed in the
   [routing design](../2026-09-24-local-vs-cloud-routing/design.md) §3c.

### 6.3 What not to do

- Don't tune the policy prose again (five probes, 1/29).
- Don't put a trained or commercial router in front: LLMRouterBench says it would not beat
  "always cloud" on quality, and category routers send all code to the strongest model.
- Don't claim credit savings for any level until it passes the GO rule. The ceiling on today's
  cells is cents per job (§4).

### 6.4 Measurement

Run the existing `dispatch-probe` once per level on the probe 4 and probe 5 cells, with the same
worker and a $3 cap. Use `PROBE_CONTROL_N=0` to reuse the controls. Keep the GO rule: dispatch ≥
50 %, dispatched samples pass, cost ≤ control. Add two columns: **bypasses** (edits by bash after
a deny) and **fallbacks** (cloud edits after the cap). Expect `aggressive` to pass on dispatch
rate by construction. The open questions are whether it passes on quality (the worker's
create-file record is 11 of 12 at r1–r3 for the 8-bit, and it cannot debug) and on cost against
controls that already pass 10 of 10 at $0.30–0.33.

## Verdict

Nobody has made a strong cloud orchestrator reliably delegate edits to a local model by asking
it to. What works in shipping tools is taking the choice away: a user mode, a router in front of
the model, or a harness that removes edit tools from the planner. The one direction with strong
published results, cheap executor with strong advisor, needs a local model that can run the loop,
and ours cannot yet. So the `local_dispatch` levels with a tool-layer hook are the right design,
and prior art only refines it: deny per agent rather than per tool, close the bash route, steer
through the deny reason, and cap with a cloud fallback. Whether any level saves money is not
settled by anything published. At Sonnet 5's cached prices the ceiling on our probe cells is
cents per job, so the saving has to be measured and not assumed.

## Limits

- Papers were read at abstract or HTML-summary level. Headline numbers only; setups may differ
  from what the summaries imply.
- Vendor numbers (Cursor, Anthropic advisor, Martian, Copilot) are unaudited, and Cursor's are
  from its own traffic.
- "Nobody ships it" means we found no such product, not that it cannot exist. Private or
  enterprise systems would not show up in this search.
- The opencode claim that `tool.execute.before` fires in child sessions is read from the call
  site, not run. The Copilot CLI claim that hooks fire in subagents rests on the 1.0.49 changelog
  line, and two closed issues without visible fix notes.
- The per-step cost estimate in §4 assumes a ~20k cached context and a few hundred output tokens
  per step. It was not computed from our session logs.
- Local electricity costs are from third-party blogs and were not checked.

## Reproduce

Desk research; nothing to rerun. The opencode source reads:

```sh
gh api 'repos/anomalyco/opencode/contents/packages/plugin/src/index.ts?ref=dev' --jq .content | base64 -d | grep -n -A4 'tool.execute.before'
gh api 'repos/anomalyco/opencode/contents/packages/web/src/content/docs/agents.mdx?ref=dev' --jq .content | base64 -d | sed -n '/### Permissions/,/glob pattern/p'
```

## Sources

Ours: [pending-tasks.md §8.8](../2026-09-23-local-model-evaluation/pending-tasks.md) (probes 1–5,
`.bench-logs/dispatch-probe*`), [routing design](../2026-09-24-local-vs-cloud-routing/design.md),
[Copilot mixed mode](../2026-09-24-copilot-mixed-mode/research.md),
[local-inference-findings.md](../local-inference-findings.md).

[^aider]: Aider, "Separating code reasoning and editing", 2024-09-26, https://aider.chat/2024/09/26/architect.html ; "R1+Sonnet set SOTA on aider's polyglot benchmark", 2025-01-24, https://aider.chat/2025/01/24/r1-sonnet.html
[^cline]: Cline docs, "Plan & Act", https://docs.cline.bot/core-workflows/plan-and-act (read 2026-09-27)
[^roo]: Roo Code docs, "Boomerang Tasks", https://docs.roocode.com/features/boomerang-tasks (read 2026-09-27)
[^devto]: "Running local and cloud models in the same coding agent: what actually ships in 2026", DEV, 2026-08-07, https://dev.to/jacksonxly/running-local-and-cloud-models-in-the-same-coding-agent-what-actually-ships-in-2026-18eo
[^ccsub]: Claude Code docs, "Create custom subagents", https://code.claude.com/docs/en/sub-agents (read 2026-09-27)
[^opusplan]: Claude Code docs, "Model configuration", https://code.claude.com/docs/en/model-config (read 2026-09-27)
[^ccbp]: Claude docs, "Prompting best practices", https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices (read 2026-09-27): "Claude Opus 4.6 has a strong predilection for subagents … Claude Opus 5 also delegates to subagents more readily than prior models."
[^advisor]: Anthropic, "The advisor strategy", 2026-04-09, https://claude.com/blog/the-advisor-strategy ; docs https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool
[^codexsub]: OpenAI, "Subagents", https://developers.openai.com/codex/subagents (read 2026-09-27); openai/codex#14039, "Allow per-subagent model/provider/profile selection"
[^codexoss]: Don't Panic Labs, "Running OpenAI's Codex CLI locally with Ollama", 2026-08-18, https://dontpaniclabs.com/blog/post/2026/08/18/running-openais-codex-cli-locally-with-ollama/
[^ocagents]: opencode docs, "Agents", https://opencode.ai/docs/agents/ and `packages/web/src/content/docs/agents.mdx` on `anomalyco/opencode@dev` (read 2026-09-27); plugin hook `packages/plugin/src/index.ts`, `packages/opencode/src/session/tools.ts`
[^goose]: Goose multi-model docs, https://goose-docs.ai/docs/guides/multi-model/ ; lead/worker defaults (lead_turns 3, failure_threshold 2) from search snippets of the Goose FAQ, not the current docs page
[^goose4036]: block/goose#4036, "multi model and multi provider config and auto switching (lead/worker consolidation/simplification)", 2025-08-12, closed
[^copilotauto]: GitHub Changelog, "Copilot CLI auto model selection routes based on task", 2026-07-01, https://github.blog/changelog/2026-07-01-copilot-cli-auto-model-selection-routes-based-on-task/ ; docs https://docs.github.com/copilot/concepts/auto-model-selection
[^copilotbill]: GitHub Blog, "GitHub Copilot is moving to usage-based billing", https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/ ; gHacks, 2026-05-02, https://www.ghacks.net/2026/05/02/github-copilot-switches-to-token-based-billing-from-june-1-replacing-premium-request-model/
[^cursor]: Cursor, "How Cursor Router chooses the right model for the task", 2026-08-06, https://cursor.com/blog/how-cursor-router-works
[^windsurf]: Devin/Windsurf, "Introducing Adaptive", April 2026, https://devin.ai/blog/windsurf-adaptive
[^openrouter]: OpenRouter, "Model routing powered by wisdom of the market", https://openrouter.ai/blog/announcements/introducing-the-new-auto-router/ (replacement of the NotDiamond router reported as 2026-08-10)
[^routellm]: Ong et al., "RouteLLM: Learning to Route LLMs with Preference Data", 2024, https://arxiv.org/abs/2406.18665
[^martian]: Martian, https://withmartian.com/ (vendor claims); "Introducing RouterBench", https://withmartian.com/post/introducing-routerbench
[^ghhooks]: GitHub Docs, "GitHub Copilot hooks reference", https://docs.github.com/en/copilot/reference/hooks-reference (read 2026-09-27); github/copilot-cli#2392 (2026-03-30, closed), #3013 (2026-04-28, closed)
[^hooksdaemon]: Edmonds-Commerce-Limited/claude-code-hooks-daemon#14, "Optional orchestrator-only mode – enforce subagent usage for all work"; anthropics/claude-code#34692 (2026-03-15, closed not planned)
[^minions]: Narayan, Biderman, Eyuboglu et al., "Minions: Cost-efficient Collaboration Between On-device and Cloud Language Models", 2025-02, https://arxiv.org/abs/2502.15964
[^hazyretro]: Hazy Research, "From Minions to OpenJarvis: A Retrospective on Two Years in Local AI", 2026-05-15, https://hazyresearch.stanford.edu/blog/2026-05-15-minions-to-openjarvis-retrospective
[^qualcomm]: Rainone, Belli, Major, Behboodi, "When Cloud Agents Meet Device Agents: Lessons from Hybrid Multi-Agent Systems", 2026-05, https://arxiv.org/abs/2605.30102
[^hera]: "HERA: Hybrid Edge-cloud Resource Allocation for Cost-Efficient AI Agents", 2025-04, https://arxiv.org/abs/2504.00434 ; AIMS, EuroSys 2026, https://dl.acm.org/doi/10.1145/3767295.3803622
[^decisionbench]: Gao et al., "DecisionBench: A Benchmark for Emergent Delegation in Long-Horizon Agentic Workflows", 2026-05-18, https://arxiv.org/abs/2605.19099
[^frugal]: Chen, Zaharia, Zou, "FrugalGPT", 2023, https://arxiv.org/abs/2305.05176
[^routerbench]: Hu et al., "RouterBench: A Benchmark for Multi-LLM Routing System", 2024, https://arxiv.org/abs/2403.12031
[^llmrb]: "LLMRouterBench: A Massive Benchmark and Unified Framework for LLM Routing", Findings of ACL 2026, https://arxiv.org/abs/2601.07206 ; https://aclanthology.org/2026.findings-acl.1881/
[^fragile]: "How Robust Are Router-LLMs? Analysis of the Fragility of LLM Routing Capabilities", EACL 2026, https://aclanthology.org/2026.eacl-long.351/
[^shepherd]: Dong et al., "Pay for Hints, Not Answers: LLM Shepherding for Cost-Efficient Inference", 2026-01, https://arxiv.org/abs/2601.22132
[^escalate]: Shaikh, "Knowing When to Ask for Help: Bayesian Self-Escalation in Hierarchical LLM Agents", 2026-08-25, https://arxiv.org/abs/2608.24087
[^uno]: Cui et al., "Uno-Orchestra: Parsimonious Agent Routing via Selective Delegation", 2026-05-06, https://arxiv.org/abs/2605.05007
[^anthmulti]: Anthropic, "How we built our multi-agent research system", 2025-06, https://www.anthropic.com/engineering/built-multi-agent-research-system
[^incontext]: Dennis et al., "In-Context Prompting Obsoletes Agent Orchestration for Procedural Tasks", 2026-04-30, https://arxiv.org/abs/2604.27891
