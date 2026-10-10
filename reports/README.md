# Reports

**Finished documents.** The numbers in these are reproducible with `python3 bench/analyse.py`,
they will not change except to correct an error, and they are safe to link from outside this
repo.

If you are looking for something being actively written, it is in [`../working/`](../working/).
If you want the raw record of every run rather than a summary, that is `MODELS.md` at the
repo root.

A dated folder holds one piece of work; start with the file named as its entry point. Reports are
grouped by the kind of test below, newest first within each group. A new report starts from
[TEMPLATE.md](TEMPLATE.md).

**Not measured yet:** [UNMEASURED.md](UNMEASURED.md) lists every open measurement, what it decides, and when it
runs or what it waits for.

## In nav-pilot

What shipped to nav-pilot users (navikt/copilot PRs, or the manifest in this repo), and the test
that justifies it. The manifest itself is the authority for current values: `manifest/models.json`
and `manifest/capabilities.json`.

| Feature or setting | Shipped | Justified by | Verdict |
|---|---|---|---|
| `qwen3.6-35b-a3b-8bit`, a 64 GB opt-in at 48 GB wired, 64k context (manifest, navikt/mlx-workspace#109) | 2026-09-28 | [night 64-4](2026-09-26-64gb-tier/night-64-4.md) and [64-5](2026-09-26-64gb-tier/night-64-5.md), Reviews | Copilot e2e 12/12, create-file with one retry 19/24 against Occamy's 13/24 (p = 0.062); peak 46.18 GB at 49k, longer prompts unmeasured. Capabilities all `cloud`: a selectable model, not yet a worker |
| `local_dispatch` levels with a dispatch gate, `balanced` the default and `aggressive` opt-in (#999); the gate counts call sites and checks the worker's result (#1114) | 2026-09-27, 2026-09-28 | [pending-tasks §8.8](2026-09-23-local-model-evaluation/pending-tasks.md#88-the-64-gb-tier-a-worker-directed-by-a-cloud-orchestrator-downloaded-profiles-in-place), dispatch probe 6 | The gate made Sonnet 5 dispatch (8 of 16 against 1 of 29 on text alone), but `aggressive` failed 1 of 6 dispatched samples at 1.2–1.6× the cost. #1114 is not yet re-probed (#121) |
| Own local endpoint: `local_endpoint`, `alpha local setup` and `doctor` (#998, #1000), two setup fixes (#1100) | 2026-09-27, 2026-09-28 | [Endpoint validation](2026-09-28-local-endpoint-validation/report.md) | Works on mlx_lm.server, Ollama and llama-server; macOS measured; on Linux the plumbing works on CPU ([Linux smoke](2026-09-27-linux-smoke/report.md)) |
| `alpha decide`, typed local decisions (#949), and its telemetry (#961) | 2026-09-24, 2026-09-25 | [System One report](2026-09-25-system-one/report.md) §3.2–3.3 | Works where the evidence holds the answer; use it to warn, block only at p ≥ 0.9 after your own `--eval`; filter untrusted evidence first |
| `commit-msg` warning "says what, not why" at p(no) ≥ 0.7 (docs recipe, #958) | 2026-09-25 | [System One report](2026-09-25-system-one/report.md) §3.4 | optiq caught 40/48, wrongly flagged 0/48 (up to 14 % not ruled out): a warning, not a block |
| Short-cycle loops count as loops (#955) | 2026-09-25 | [System One report](2026-09-25-system-one/report.md) §3.1, `bench/loop-hook-20260925-002708.json` | A cloud session dodged the hook by cycling three calls |
| Loop-guard hook for every Copilot session (#939, #953) | 2026-09-24 | [System One report](2026-09-25-system-one/report.md) §3.1 | PASS inside cplt on one provoked-loop session |
| Result-aware loop guard (#933), replacing the System One classifier | 2026-09-24 | [decision.md](2026-09-23-local-model-evaluation/decision.md) §3.5–3.6, [System One report](2026-09-25-system-one/report.md) §3.1 | Classifier caught 0/2 loops at 0.9; the rule blocked the loop at 4 and let a 7-call poll finish |
| Redaction of secrets and fødselsnummer in tool results, injection note (#940) | 2026-09-24 | [Jev-like features research](2026-09-24-jev-like-features/research.md) (desk) | Not measured by a benchmark here ([coverage audit](2026-09-25-benchmark-coverage/audit.md), summary item 7) |
| Dispatch policy generated from manifest `capabilities` (#941, `manifest/capabilities.json`) | 2026-09-24 | [Routing design](2026-09-24-local-vs-cloud-routing/design.md) §2–3 | Only mechanical multi-file edits delegated by a cloud orchestrator go local (35/35); every other class stays cloud |
| Qwen3.8-27B-OptiQ-4bit replaces the plain 4-bit in the manifest | 2026-09-24 | [qwen38-tuning.md](2026-09-23-local-model-evaluation/qwen38-tuning.md) §10 | cheap-ops 18/30 against 11/20, 0 timeouts against 4, 12/12 Copilot sessions |
| Qwen3.8-27B 8-bit as a 48 GB opt-in at 48k / 4k / 3.25 GiB, prefill step 512 (#936, #943 `min_nav_pilot`) | 2026-09-24 | [qwen38-tuning.md](2026-09-23-local-model-evaluation/qwen38-tuning.md), [night 2](2026-09-23-local-model-evaluation/night-2026-09-25.md) | 48k e2e: 8/9 criteria hold, 12/12 sessions, peak 38.47 GB; cold TTFT at 30k fails (54 s) |
| Sampling temp 0.6 / top_p 0.95 for every entry (#934) | 2026-09-24 | [qwen38-tuning.md](2026-09-23-local-model-evaluation/qwen38-tuning.md) §9 | Temp 0 not better: optiq 17/30 against 28/40 (p = 0.32), 8-bit 12/20 against 31/40 (p = 0.22) |
| Static context 45.1k → 21.7k (#932); dead generation thread exits (#931); failed launch exits non-zero (#935, #937) | 2026-09-24 | [decision.md](2026-09-23-local-model-evaluation/decision.md) §3.3–3.6, [nav-pilot e2e](2026-09-23-local-model-evaluation/nav-pilot-e2e.md) | All e2e scenarios pass after the re-run |
| optiq (Qwen3.6-35B-A3B-OptiQ-4bit) as the only default | 2026-08-28, confirmed 2026-09-23 | [alpha-model-decision.md](alpha-model-decision.md), [decision.md](2026-09-23-local-model-evaluation/decision.md) §3.1–3.2 | Level with the best alternative (28/40 against 31/40, p = 0.61) at about 9× the speed |
| Local model as a sub-agent worker, opt-in alpha (#483) | 2026-08-31 | [the measurement study](local-inference-findings.md), [pre-ship review](pre-ship-review-2026-08-31.md) | Saves cloud cost when the cloud arm needs many steps; cannot debug |

## Agentic task benchmarks

Coding tasks run by an agent against a real codebase, verified by a compiler, a test suite or an
answer check: cheap-ops, np-e2e, the Copilot and hybrid ladders, weather-cli and the quality
frontier. What each one measures is in [`../bench/specs/`](../bench/specs/).

| Report | Date | Summary |
|---|---|---|
| [Small tasks locally and by delegation on optiq-64g and the 8-bit](2026-10-10-small-delegate/report.md) | 2026-10-10 | Both profiles do single edits, doc comments and test-only work locally (E1, E3b and T1 at 80 % or higher); the 8-bit is more consistent (edit-single 59/60). Config-deploy (O1) 0/45 cannot be judged until O1 is fixed. Delegation passes as often as the control at 1.3–1.5× the cloud cost; the orchestrator never hands over one-line edits (0/32) |
| [create-file base vs retry2 on the same harness](2026-10-10-gap-fill/report.md) | 2026-10-10 | Base optiq create-file 26/40 (trusted only at r1) against retry2's 37/40 on a harness that matches for create-file: retry2 does the work, so #1156 stays and the manifest is unchanged |
| [K2-Horizon with the ifm tool parser](2026-10-10-k2-ifm/report.md) | 2026-10-10 | Rejected again: 0/80 (create-file 0/40, edit-multi-mechanical 0/40). The ifm parser still mangles tool names (74 % of calls invalid). Revisit only after a parser unit test passes |
| [Small PR types on the fixed harness](2026-10-10-fixed-small/report.md) | 2026-10-10 | After the O1 fix (#189), config-deploy passes locally: O1 12/14 on optiq and 14/14 on 8-bit (0/15 and 0/30 before). Edit-single is 37/42 on optiq and 42/42 on 8-bit; D2 retired and R1 excluded |
| [What code changes at Nav look like: a navikt PR audit](2026-10-09-navikt-pr-audit/report.md) | 2026-10-09 | 356 human PRs from 30 public navikt repos, classed by a path-and-line heuristic. create-file is de-prioritised; cheap-ops gains a one-file config task (O1) and a test-only unit test task (T1) |
| [create-file with retry2](2026-10-08-cf-retry2/report.md) | 2026-10-09 | retry2 makes create-file trusted locally at r1–r2 on both profiles (optiq 37/40, 8-bit 35/40 over r1–r4). r3 is not ruled out; r4 is open on optiq and breaks on timeouts on the 8-bit. No base run on this harness, so retry2's own effect is unknown; the manifest is unchanged |
| [8-bit emm as a delegate, and r4 at n = 20](2026-09-30-emm8-delegate/report.md) | 2026-10-01 | Local emm is trusted through r4 (20/20). As a delegate, emm is `not-yet`: 13/13 dispatched, LB 0.888 against 0.90. This run's cells cost 1.93–2.20× their controls; the only cell below 1 is phase C's 0.89. Nothing ships |
| [Phase C re-run: the 8-bit as a delegate worker](2026-10-01-phase-c-rerun/report.md) | 2026-10-01 | Under the bench-only overlay, 19/24 dispatched, 17/19 against 12/12 same-day controls (difference −0.11, lower bound −0.23) at 1.28× the control cost. Fails both rules; the 8-bit stays a selectable model with all-`cloud` capabilities |
| [create-file re-run with the sandbox fixed](2026-10-01-create-file-rerun/report.md) | 2026-10-01 | Gradle works in the sandbox now. optiq 19/40, 8-bit 24/40, not trusted at any rung, first break r2 on both. Stop rule applied: create-file ladder work stops on both profiles; the gap is model quality |
| [Quality frontier, v2 base ladders](2026-09-29-v2-ladders/report.md) | 2026-09-30 | Edit-single is trusted on neither model; emm is trusted on the 8-bit at r1–r3 and on optiq at r1 only. The create-file rows are invalid (the sandbox blocked Gradle) and were re-run in the create-file re-run |
| [Night 64-6: the 8-bit past 49k, and its capabilities](2026-09-26-64gb-tier/night-64-6b.md) | 2026-09-29 | The shipped 8-bit answers a 64k prompt at 48 GB wired (TTFT 38 s, peak 49.2 GB, 3.2 GB over the fit line). 52 GB buys little. Six cheap-ops passes: read-qa and edit-single not-yet, the rest cloud, nothing trusted, so nothing ships. Delegate mode could not be measured under an all-cloud block (#147) |
| [Frontier harness v2 validation](2026-09-28-frontier-harness-v2/night-v2-validate.md) | 2026-09-29 | JDK 21 now works in the session and the sandbox leaves no daemons (#89, #107 fixed). optiq's create-file r1–r3 goes from 3/12 under v1 to 12/12, and debug is 4–5× faster, so v1's create-file cells understate local models and their ladders need re-running |
| [presence_penalty 1.5 on the Qwen3.6 8-bit](2026-09-28-orchestrator-and-penalty/presence-penalty-night.md) | 2026-09-28 | The card's non-thinking value against none, ABBA twice on create-file retry2 and once on edit-single: 41/56 against 45/56 (p = 0.50), loops or timeouts 6/56 against 5/56. There was no tool-call loop in either arm. The penalty stays off |
| [GPT-6 Sol as the cloud orchestrator](2026-09-28-orchestrator-and-penalty/gpt6-sol.md) | 2026-09-28 | On probe 6's cells, GPT-6 Sol dispatches on its own under `aggressive` (7/7, no gate refusal, all passing) where Sonnet 5 mostly needed the gate, but it costs 0.71–2.33× its control. `conservative` 0/3, `balanced` not run. Frontier slice 19/20. 9 of 25 sessions ended on a rejected read of nav-pilot's instructions (navikt/copilot#1120) |
| [Quality frontier, follow-ups 1](2026-09-25-quality-frontier/night-followups-1.md) | 2026-09-28 | decide's yes/no inconsistency is a pull to the last-listed option, stronger in optiq under negation, not a "text is fine" prior. read-qa's `example` prefix replicates (57/80 against 32/80) but every rung stays cloud. create-file `retry2` pooled with night 2: 15/20 against 5/20 at 2.02× the time per sample and half the time per verified result |
| [Quality frontier, night 2: `retry2` replication](2026-09-25-quality-frontier/night-2.md) | 2026-09-26 | `retry2` replicates on edit-single rung 2 (10/16 → 16/16, p = 0.009, 1.1× the time). create-file rung 1 improves (5/16 → 12/16, p = 0.016) but costs 2.03× the time, over the 2× limit. No effect on mechanical multi-file edits: night 1's move was noise |
| [Quality frontier, night 1: results](2026-09-25-quality-frontier/night-1.md) | 2026-09-26 | optiq against Sonnet 5 on five ladders. Mechanical multi-file edits stay local up to 2 call sites (10/10), are not yet proven at 4–6 and fall to cloud at 12–13 (7/10); the cloud is trusted up to 22–29. read-qa, create-file and edit-single stay cloud ([why read-qa is so far below cheap-ops](2026-09-25-quality-frontier/read-qa-analysis.md)). Verifier retries (`retry2`) moved three frontiers on n = 4 and need a replication night |
| [Quality frontier: design](2026-09-25-quality-frontier/design.md) | 2026-09-25 | Graded ladders per task class (thread an argument, callers of F, a new test file, debug with less and less help), run per model and harness lever, to find whether the model or the harness is the limit. Night 1 is `mise run night-run-3` |
| [`balanced` dispatch against same-day controls](2026-09-28-balanced-controls/results.md) | 2026-09-29 | Pass rate matched control (15/15), but cloud cost was 1.57× on r4 and 1.49× on r6, so `balanced` fails the decision rule and the gate stays at `aggressive` |
| [After night 64-6: the action check and #122](2026-09-28-after-64-6/results.md) | 2026-09-30 | The action check stays log-only (optiq at 0.9 flags 24/24 risky and 3/14 clean commands). #122 showed no effect (57/72 against 53/72, p = 0.56); both runs ran while the sandbox blocked Gradle |
| [Benchmark coverage audit: gaps and duplicates](2026-09-25-benchmark-coverage/audit.md) | 2026-09-25 | Desk audit of every suite against one capability taxonomy, with a coverage matrix. The bar never reads np-e2e Copilot sessions or any non-Ktor run; a `_profiles.py` edit resets `harness_sha` and would drop 16 runs when the night results merge; the Copilot and delegate ladders cannot meet `min_tasks = 2` for three classes; no cloud arm for GPT-6 Sol. Ranked retire, merge and add list |
| [Night results](night-results-2026-08-31.md) | 2026-08-31 | The step-count predictor holding on a codebase it had not seen, and the model failing every debugging task |
| [Night plan](night-plan-2026-08-31.md) | 2026-08-31 | The plan for that run, with the prediction, statistic and test fixed in writing **before** the run that tested them |
| [Delegating coding work to a local model: a measurement study](local-inference-findings.md) | 2026-08-30 | **The study.** 216 valid samples across two clients, three codebases, six task shapes and three refactor strategies: what the local model saves, what it cannot do, and why the saving tracks the cloud arm's step count rather than the codebase |

## Model and profile evaluations

Which model and which parameters nav-pilot offers: quality head-to-heads, memory, latency, context
and sampling on the 48 GB tier.

| Report | Date | Summary |
|---|---|---|
| [K2-Horizon MoVA as a local candidate](2026-10-09-new-candidates/report.md) | 2026-10-09 | Rejected: 0/40, no parseable tool calls. Revisit only with a parser fix |
| [nav-pilot's own-endpoint path on real servers](2026-09-28-local-endpoint-validation/report.md) | 2026-09-28 | #998/#1000 against mlx_lm.server, Ollama 0.34.4 and llama-server 0.5.0. Doctor passes 5/5 checks on all three. Decide through an endpoint matches managed mlx exactly on OptiQ (89/96, 95/105, 323/364). The unsloth UD-Q4_K_XL GGUF is level within the intervals (87/96, 94/105, 321/364), with the same decode and half the prefill (TTFT 17–19 s against 9–10 s at 30k). Two setup bugs are fixed in navikt/copilot#1100. A later rerun pulled Ollama's library `qwen3.6:35b` through `setup --pull` (21.1 GiB, 711 s), and setup and doctor passed |
| [Linux smoke test of the local endpoint path](2026-09-27-linux-smoke/report.md) | 2026-09-27, 2026-09-28 | arm64 on CPU in a 5 GiB Colima container. With a saved config on Ollama, the install, doctor and `alpha decide` work, and an opencode session launches through nav-pilot and cplt. No coding session succeeds at 6 GB: Ollama cuts the prompt to 4k, and llama-server at 32k is OOM-killed after a long prompt. On CPU the 30k probe takes over 10 minutes (navikt/copilot#1222). Earlier passes found #1099 and #1126–#1129 |
| [Qwen3.8's gap, Qwen news, and local inference on Linux](2026-09-27-qwen38-linux-ollama/research.md) | 2026-09-27 | Desk research and a re-read of our result files. Qwen3.8-27B isn't worse on quality but 5× slower: the 8-bit is the most accurate local model measured and its only non-R1 failures are timeouts. Qwen news June–September, with an unchecked mlx-lm norm-shift fix (#1623) that may affect our Qwen3.8 builds. On Linux the MLX equivalent is llama.cpp's `llama-server`; Ollama fits as a bring-your-own OpenAI endpoint with a doctor check, not a managed backend |
| [The 64 GB tier: which local worker to benchmark, and how](2026-09-26-64gb-tier/plan.md) | 2026-09-26 | Plan, desk research, no measurements. A worker directed by a cloud orchestrator, not an autonomous agent. Shortlist: Qwen3.8-27B 8-bit at 64k (cached), Qwen3.6-35B-A3B 8-bit, Occamy-1.0 4-bit, Laguna XS 2.1 8-bit, 92.7 GB to download. Profiles at the default 48 GB wired limit. Five nights, from fit to the hybrid arm, which decides the 64 GB entry on credits saved at an equal pass rate. Outcome: the hybrid arm stayed NO-GO (Sonnet 5 did not dispatch), and the Qwen3.6-35B-A3B 8-bit won on the frontier, e2e and decide suites and shipped as an opt-in (#109). Night reports: [64-0](2026-09-26-64gb-tier/day-64-0.md), [64-0b](2026-09-26-64gb-tier/day-64-0b.md), [64-1](2026-09-26-64gb-tier/night-64-1.md), [64-2](2026-09-26-64gb-tier/night-64-2.md), [64-2c](2026-09-26-64gb-tier/night-64-2c.md), [64-4](2026-09-26-64gb-tier/night-64-4.md), [64-5](2026-09-26-64gb-tier/night-64-5.md); next, [night 64-6](2026-09-26-64gb-tier/plan-64-6.md) |
| [Local models for nav-pilot: decision and action list](2026-09-23-local-model-evaluation/decision.md) | 2026-09-23 | optiq stays the only default; both Qwen3.8-27B builds stay on 48 GB as tuned opt-ins (updated 2026-09-24); the System One classifier is replaced by a result-aware loop guard. Updated 2026-09-28 with the 64 GB opt-in, the `local_dispatch` levels, GPT-6 Sol, the endpoint and Linux checks, follow-ups 1 and the hosted-decide PRD. Entry point for the folder, which also holds the [evaluation log](2026-09-23-local-model-evaluation/evaluation-log.md), the [nav-pilot e2e test](2026-09-23-local-model-evaluation/nav-pilot-e2e.md), the [Qwen3.8 tuning plan and results](2026-09-23-local-model-evaluation/qwen38-tuning.md), the night reports of [24](2026-09-23-local-model-evaluation/night-2026-09-24.md) and [25 September](2026-09-23-local-model-evaluation/night-2026-09-25.md), the [pending tasks](2026-09-23-local-model-evaluation/pending-tasks.md), the [hardware-tier backlog](2026-09-23-local-model-evaluation/hardware-tier-backlog.md) and the [profile audit](2026-09-23-local-model-evaluation/profile-audit.md) |
| [Which model the nav-pilot alpha ships](alpha-model-decision.md) | 2026-08-28 | Ship one model, Qwen3.6-35B-A3B-OptiQ-4bit; why Qwen3.8-27B is held back, what was rejected, and how far the numbers can be trusted |
| [The 48 GB question](48gb-question.md) | 2026-08-27 | Seven models on the weather-cli benchmark: everything worth running fits in 48 GB, and speed and tool-call looping, not memory, decide |

## Routing: local or cloud

When a task should go to the local model, and how a client can mix the two.

| Report | Date | Summary |
|---|---|---|
| [Dispatch probes 1–6: does a cloud orchestrator hand work to the local worker?](2026-09-23-local-model-evaluation/pending-tasks.md#88-the-64-gb-tier-a-worker-directed-by-a-cloud-orchestrator-downloaded-profiles-in-place) | 2026-09-28 | In pending-tasks §8.8, no report of their own. On advisory policy text Sonnet 5 dispatched 1 of 29 samples in probes 1–5, whatever the job size or wording. Probe 6's enforcing gate made it dispatch 8 of 16, but under `aggressive` 1 of 6 dispatched samples failed and cost was 1.2–1.6× the control: `balanced` stays the default. GPT-6 Sol is in the agentic table |
| [Cloud + local orchestration: has anyone solved it?](2026-09-27-hybrid-orchestration-research/research.md) | 2026-09-27 | Desk research. No shipping tool lets a cloud orchestrator decide on its own to hand edits to a local model; delegation happens through a user mode (Aider, Cline, Codex), a router in front of the model (Copilot Auto, Cursor), or a cheap executor escalating to a strong advisor (Anthropic advisor, MinionS). Routers barely beat the best single model (LLMRouterBench). At Sonnet 5 cached prices the saving on our probe cells is cents per job. Recommends `local_dispatch` as modes enforced per agent: off (no policy text), conservative (user-invoked), balanced (`alpha decide` pre-router + per-turn edit deny), aggressive (architect/editor), with a denial cap and cloud fallback |
| [Copilot CLI mixed mode: cloud main agent, local worker](2026-09-24-copilot-mixed-mode/research.md) | 2026-09-24 | Desk research. Documented Copilot CLI (1.0.89) still has one provider per session and github/copilot-cli#4703 is unanswered, but the runtime has an experimental multi-provider registry (`session.provider.add`) an extension may reach. Ranks an extension PoC, an MCP `local_worker` tool and opencode-only, and proposes a `hybrid` night-run arm for the untested current dispatch policy |
| [When nav-pilot should use a local model](2026-09-24-local-vs-cloud-routing/design.md) | 2026-09-24 | Design. Per-class pass rates, local against cloud; a statistical bar for routing a task class to a local model; manifest `capabilities` that move the bar without a nav-pilot release; runtime feedback; the measurement loop. Today only mechanical multi-file edits delegated by a cloud orchestrator clear it |

## System One and `alpha decide`

Fast typed decisions from a local model (one token, probabilities over the options), and the loop
guard that replaced the first attempt. Case sets and their labels are documented next to the data:
[`../bench/decide-cases/`](../bench/decide-cases/README.md) and
[`../bench/decide-limits/`](../bench/decide-limits/README.md).

| Report | Date | Summary |
|---|---|---|
| [Kev 4B as an optional English System 1 model](2026-09-30-kev-english/report.md) | 2026-09-30 | Fail. Kev matches optiq on English accuracy (125/152 against 127/152) and answers in a third of the time, but fails the memory criterion and the p ≥ 0.9 precision row, which optiq also fails. optiq stays the only System 1 model |
| [Kev 4B and Laya on the decide sets](2026-09-29-kev-laya/report.md) | 2026-09-29 | Neither replaces optiq in `alpha decide`. Kev 4B matches it on English triage (issue-type 91/105 against 95/105, no wrong answer at t = 0.9) but fails Norwegian (why-no 24/48 against 44/48) and leans to `yes`; Laya 421M/322M is 0.34–0.69 on the recipe sets even on untruncated cases. PRD gate 2 not met; no model separates the loop scenarios at 0.9 |
| [Selective rule loading, per prompt and per file](2026-09-28-selective-rules/research.md) | 2026-09-28 | Desk research and a re-read of session logs. A Copilot session starts at ≈ 23k Qwen tokens; nav-pilot controls ≈ 8k, of which only 1.3–2.0k are filterable always-on rules (0.4–0.7 s cold prefill on optiq, 2–3.5 s on Qwen3.8-27B, nothing warm). The gap worth fixing is recall: no local model opened a file-scoped rule in four bench tasks (67 runs), and `nav-pilot` cloud sessions opened the security rules in 37/117. Fix the install (descriptions, security rules always on) and, if that is not enough, inject by glob on first touch; `alpha decide` only for glob-less rules after a recall check |
| [PRD: hosted `alpha decide`](2026-09-27-hosted-decide-prd/prd.md) | 2026-09-27 | Plan only, no GCP infrastructure; no-go today: none of the four §8.10 gates is met. Recommends, if they pass and the user says go, a G4 in `europe-north1` behind the nav-pilot CLI gateway (#339) with a decide-only API: about $1.0k a month for an office-hours pilot, $3.2–7.2k for 1+1 serving developer hooks for NAV (CI only if its route and sign-in are solved). Adds a privacy gate (ROS, DPIA, redaction). Volumes are unknown, so costs are given for three assumed scenarios. Open for later: volumes, owner, budget range |
| [`alpha decide` as a service at NAV scale](2026-09-26-decide-as-a-service/research.md) | 2026-09-26 | Desk research, no measurements. Developer hooks and CI for all of NAV fit on 1+1 G4 (RTX PRO 6000) in `europe-north1` with vLLM and the 35B-A3B model, about $3.2–7.2k a month; the 27B needs about 9× the GPUs. CPU works for encoder models, not for a 30B-class decoder at 8k tokens. NAIS has no GPU node pools. Five measurements to take first |
| [Option order and yes/no consistency in `alpha decide`](../bench/decide-layout-results.md) | 2026-09-26 | Options before evidence: no pooled gain (optiq 392 against 391 of 464, Qwen3.8-27B 414 against 412), per-question swings both ways, worse on the 27B's long evidence (55 against 45 of 60); nav-pilot keeps evidence first. Swapping yes/no agrees 77–81 %, negating the question 58–66 %: ask in the positive form and measure the exact wording |
| [System One: from the loop classifier to `alpha decide`](2026-09-25-system-one/report.md) | 2026-09-25 | The 23 Sep classifier caught 0/2 loops and was replaced by the result-aware guard. decide-limits (974 cases × 3 models): language, up to 14 options, position bias, injection, evidence length, calibration. "Does the commit message explain why?" 89/96 on optiq; the `commit-msg` warning at 0.7. What shipped, and what is still open |
| [Jev-like "System One" features for nav-pilot](2026-09-24-jev-like-features/research.md) | 2026-09-24 | Desk research: Jev is a real TypeSafe AI product (US-hosted, early access); the same pattern runs locally. Top three: near-duplicate result-aware loop detection, a tool-call risk gate, redaction of secrets and fødselsnummer in tool results; Copilot hooks reach cloud sessions too |

## Infrastructure and preflight

No report of its own. Before a night run, `mise run night-preflight` checks everything a night run
needs without touching the GPU, and `mise run bench-netcheck -- --for <kinds>` makes each program reach
its own hosts, since the firewall rules are per program. What they check and what they found on
25 September: [pending-tasks.md §8.3](2026-09-23-local-model-evaluation/pending-tasks.md#83-follow-ups-from-the-night-of-2425-september).

## Communication

| Report | Date | Summary |
|---|---|---|
| [Posting about `alpha decide` internationally](2026-09-25-social-research/research.md) | 2026-09-25 | Desk research and draft posts for NAV employees writing in their own name. The Jev launch backlash is about unverified claims, so lead with measured limits; the civil-service ethics guidelines allow the post. Angles, words to avoid, skills for editing, and drafts for LinkedIn, X/Bluesky and Show HN |

## Reviews

| Report | Date | Summary |
|---|---|---|
| [Adversarial pass before shipping](pre-ship-review-2026-08-31.md) | 2026-08-31 | The last gate before navikt/copilot#483 merged: attacks on nav-pilot's trust boundary and first-user path, nothing found that should hold the merge |

## Elsewhere

| Where | What |
|---|---|
| [`../working/`](../working/) | Plans and trackers being edited. Expect them to change under you, and do not link to them from outside. |
| [`../runbooks/`](../runbooks/) | Operational. [`alpha-runbook.md`](../runbooks/alpha-runbook.md) is for whoever picks up an alpha report. |
| [`../archive/`](../archive/) | Superseded. Kept because deleting the record of a wrong conclusion is how a team repeats it. |
| [`../bench/specs/`](../bench/specs/) | What each benchmark measures and how. |
| [`../bench/decide-cases/commit-explains-why-results.md`](../bench/decide-cases/commit-explains-why-results.md), [`../bench/decide-limits-20260925-014512.md`](../bench/decide-limits-20260925-014512.md) | Result pages linked from outside this repo. They stay where they are. |
