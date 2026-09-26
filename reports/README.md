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

## In nav-pilot

What shipped to nav-pilot users (navikt/copilot PRs, or the manifest in this repo), and the test
that justifies it. The manifest itself is the authority for current values: `manifest/models.json`
and `manifest/capabilities.json`.

| Feature or setting | Shipped | Justified by | Verdict |
|---|---|---|---|
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
| [Quality frontier, night 1: results](2026-09-25-quality-frontier/night-1.md) | 2026-09-26 | optiq against Sonnet 5 on five ladders. Mechanical multi-file edits stay local up to 2 call sites (10/10), are not yet proven at 4–6 and fall to cloud at 12–13 (7/10); the cloud is trusted up to 22–29. read-qa, create-file and edit-single stay cloud. Verifier retries (`retry2`) moved three frontiers on n = 4 and need a replication night |
| [Quality frontier: design](2026-09-25-quality-frontier/design.md) | 2026-09-25 | Graded ladders per task class (thread an argument, callers of F, a new test file, debug with less and less help), run per model and harness lever, to find whether the model or the harness is the limit. Night 1 is `mise run night-run-3` |
| [Benchmark coverage audit: gaps and duplicates](2026-09-25-benchmark-coverage/audit.md) | 2026-09-25 | Desk audit of every suite against one capability taxonomy, with a coverage matrix. The bar never reads np-e2e Copilot sessions or any non-Ktor run; a `_profiles.py` edit resets `harness_sha` and would drop 16 runs when the night results merge; the Copilot and delegate ladders cannot meet `min_tasks = 2` for three classes; no cloud arm for GPT-6 Sol. Ranked retire, merge and add list |
| [Night results](night-results-2026-08-31.md) | 2026-08-31 | The step-count predictor holding on a codebase it had not seen, and the model failing every debugging task |
| [Night plan](night-plan-2026-08-31.md) | 2026-08-31 | The plan for that run, with the prediction, statistic and test fixed in writing **before** the run that tested them |
| [Delegating coding work to a local model: a measurement study](local-inference-findings.md) | 2026-08-30 | **The study.** 216 valid samples across two clients, three codebases, six task shapes and three refactor strategies: what the local model saves, what it cannot do, and why the saving tracks the cloud arm's step count rather than the codebase |

## Model and profile evaluations

Which model and which parameters nav-pilot offers: quality head-to-heads, memory, latency, context
and sampling on the 48 GB tier.

| Report | Date | Summary |
|---|---|---|
| [Local models for nav-pilot: decision and action list](2026-09-23-local-model-evaluation/decision.md) | 2026-09-23 | optiq stays the only default; both Qwen3.8-27B builds stay on 48 GB as tuned opt-ins (updated 2026-09-24); the System One classifier is replaced by a result-aware loop guard. Entry point for the folder, which also holds the [evaluation log](2026-09-23-local-model-evaluation/evaluation-log.md), the [nav-pilot e2e test](2026-09-23-local-model-evaluation/nav-pilot-e2e.md), the [Qwen3.8 tuning plan and results](2026-09-23-local-model-evaluation/qwen38-tuning.md), the night reports of [24](2026-09-23-local-model-evaluation/night-2026-09-24.md) and [25 September](2026-09-23-local-model-evaluation/night-2026-09-25.md), the [pending tasks](2026-09-23-local-model-evaluation/pending-tasks.md), the [hardware-tier backlog](2026-09-23-local-model-evaluation/hardware-tier-backlog.md) and the [profile audit](2026-09-23-local-model-evaluation/profile-audit.md) |
| [Which model the nav-pilot alpha ships](alpha-model-decision.md) | 2026-08-28 | Ship one model, Qwen3.6-35B-A3B-OptiQ-4bit; why Qwen3.8-27B is held back, what was rejected, and how far the numbers can be trusted |
| [The 48 GB question](48gb-question.md) | 2026-08-27 | Seven models on the weather-cli benchmark: everything worth running fits in 48 GB, and speed and tool-call looping, not memory, decide |

## Routing: local or cloud

When a task should go to the local model, and how a client can mix the two.

| Report | Date | Summary |
|---|---|---|
| [Copilot CLI mixed mode: cloud main agent, local worker](2026-09-24-copilot-mixed-mode/research.md) | 2026-09-24 | Desk research. Documented Copilot CLI (1.0.89) still has one provider per session and github/copilot-cli#4703 is unanswered, but the runtime has an experimental multi-provider registry (`session.provider.add`) an extension may reach. Ranks an extension PoC, an MCP `local_worker` tool and opencode-only, and proposes a `hybrid` night-run arm for the untested current dispatch policy |
| [When nav-pilot should use a local model](2026-09-24-local-vs-cloud-routing/design.md) | 2026-09-24 | Design. Per-class pass rates, local against cloud; a statistical bar for routing a task class to a local model; manifest `capabilities` that move the bar without a nav-pilot release; runtime feedback; the measurement loop. Today only mechanical multi-file edits delegated by a cloud orchestrator clear it |

## System One and `alpha decide`

Fast typed decisions from a local model (one token, probabilities over the options), and the loop
guard that replaced the first attempt. Case sets and their labels are documented next to the data:
[`../bench/decide-cases/`](../bench/decide-cases/README.md) and
[`../bench/decide-limits/`](../bench/decide-limits/README.md).

| Report | Date | Summary |
|---|---|---|
| [Option order and yes/no consistency in `alpha decide`](../bench/decide-layout-results.md) | 2026-09-26 | Options before evidence: no pooled gain (optiq 392 against 391 of 464, Qwen3.8-27B 414 against 412), per-question swings both ways, worse on the 27B's long evidence (55 against 45 of 60); nav-pilot keeps evidence first. Swapping yes/no agrees 77–81 %, negating the question 58–66 %: ask in the positive form and measure the exact wording |
| [System One: from the loop classifier to `alpha decide`](2026-09-25-system-one/report.md) | 2026-09-25 | The 23 Sep classifier caught 0/2 loops and was replaced by the result-aware guard. decide-limits (974 cases × 3 models): language, up to 14 options, position bias, injection, evidence length, calibration. "Does the commit message explain why?" 89/96 on optiq; the `commit-msg` warning at 0.7. What shipped, and what is still open |
| [Jev-like "System One" features for nav-pilot](2026-09-24-jev-like-features/research.md) | 2026-09-24 | Desk research: Jev is a real TypeSafe AI product (US-hosted, early access); the same pattern runs locally. Top three: near-duplicate result-aware loop detection, a tool-call risk gate, redaction of secrets and fødselsnummer in tool results; Copilot hooks reach cloud sessions too |

## Infrastructure and preflight

No report of its own. Before a night run, `mise run night-preflight` checks everything a night run
needs without touching the GPU, and `mise run bench-netcheck -- --for <kinds>` makes each program reach
its own hosts, since the firewall rules are per program. What they check and what they found on
25 September: [pending-tasks.md §8.3](2026-09-23-local-model-evaluation/pending-tasks.md#83-follow-ups-from-the-night-of-2425-september).

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
