# Reports

**Finished documents.** The numbers in these are reproducible with `python3 bench/analyse.py`,
they will not change except to correct an error, and they are safe to link from outside this
repo.

If you are looking for something being actively written, it is in [`../working/`](../working/).
If you want the raw record of every run rather than a summary, that is `MODELS.md` at the
repo root.

Newest first. A dated folder holds one piece of work; start with the file named as its entry point.

| Report | Date | Summary |
|---|---|---|
| [Benchmark coverage audit: gaps and duplicates](2026-09-25-benchmark-coverage/audit.md) | 2026-09-25 | Desk audit of every suite against one capability taxonomy, with a coverage matrix. The bar never reads np-e2e Copilot sessions or any non-Ktor run; a `_profiles.py` edit resets `harness_sha` and would drop 16 runs when the night results merge; the Copilot and delegate ladders cannot meet `min_tasks = 2` for three classes; no cloud arm for GPT-6 Sol. Ranked retire, merge and add list |
| [Copilot CLI mixed mode: cloud main agent, local worker](2026-09-24-copilot-mixed-mode/research.md) | 2026-09-24 | Desk research. Documented Copilot CLI (1.0.89) still has one provider per session and github/copilot-cli#4703 is unanswered, but the runtime has an experimental multi-provider registry (`session.provider.add`) an extension may reach. Ranks an extension PoC, an MCP `local_worker` tool and opencode-only, and proposes a `hybrid` night-run arm for the untested current dispatch policy |
| [When nav-pilot should use a local model](2026-09-24-local-vs-cloud-routing/design.md) | 2026-09-24 | Design. Per-class pass rates, local against cloud; a statistical bar for routing a task class to a local model; manifest `capabilities` that move the bar without a nav-pilot release; runtime feedback; the measurement loop. Today only mechanical multi-file edits delegated by a cloud orchestrator clear it |
| [Jev-like "System One" features for nav-pilot](2026-09-24-jev-like-features/research.md) | 2026-09-24 | Desk research: Jev is a real TypeSafe AI product (US-hosted, early access); the same pattern runs locally. Top three: near-duplicate result-aware loop detection, a tool-call risk gate, redaction of secrets and fødselsnummer in tool results; Copilot hooks reach cloud sessions too |
| [Local models for nav-pilot: decision and action list](2026-09-23-local-model-evaluation/decision.md) | 2026-09-23 | optiq stays the only default; both Qwen3.8-27B builds stay on 48 GB as tuned opt-ins (updated 2026-09-24, sweep partial); the System One classifier is replaced by a result-aware loop guard. Entry point for the folder, which also holds the [evaluation log](2026-09-23-local-model-evaluation/evaluation-log.md), the [nav-pilot e2e test](2026-09-23-local-model-evaluation/nav-pilot-e2e.md), the [Qwen3.8 tuning plan](2026-09-23-local-model-evaluation/qwen38-tuning.md), the [pending tasks](2026-09-23-local-model-evaluation/pending-tasks.md), the [hardware-tier backlog](2026-09-23-local-model-evaluation/hardware-tier-backlog.md) and the [profile audit](2026-09-23-local-model-evaluation/profile-audit.md) |
| [Adversarial pass before shipping](pre-ship-review-2026-08-31.md) | 2026-08-31 | The last gate before navikt/copilot#483 merged: attacks on nav-pilot's trust boundary and first-user path, nothing found that should hold the merge |
| [Night results](night-results-2026-08-31.md) | 2026-08-31 | The step-count predictor holding on a codebase it had not seen, and the model failing every debugging task |
| [Night plan](night-plan-2026-08-31.md) | 2026-08-31 | The plan for that run, with the prediction, statistic and test fixed in writing **before** the run that tested them |
| [Delegating coding work to a local model: a measurement study](local-inference-findings.md) | 2026-08-30 | **The study.** 216 valid samples across two clients, three codebases, six task shapes and three refactor strategies: what the local model saves, what it cannot do, and why the saving tracks the cloud arm's step count rather than the codebase |
| [Which model the nav-pilot alpha ships](alpha-model-decision.md) | 2026-08-28 | Ship one model, Qwen3.6-35B-A3B-OptiQ-4bit; why Qwen3.8-27B is held back, what was rejected, and how far the numbers can be trusted |
| [The 48 GB question](48gb-question.md) | 2026-08-27 | Seven models on the weather-cli benchmark: everything worth running fits in 48 GB, and speed and tool-call looping, not memory, decide |

## Elsewhere

| Where | What |
|---|---|
| [`../working/`](../working/) | Plans and trackers being edited. Expect them to change under you, and do not link to them from outside. |
| [`../runbooks/`](../runbooks/) | Operational. [`alpha-runbook.md`](../runbooks/alpha-runbook.md) is for whoever picks up an alpha report. |
| [`../archive/`](../archive/) | Superseded. Kept because deleting the record of a wrong conclusion is how a team repeats it. |
| [`../bench/specs/`](../bench/specs/) | What each benchmark measures and how. |
