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
| [Local models for nav-pilot: decision and action list](2026-09-23-local-model-evaluation/decision.md) | 2026-09-23 | optiq stays the only default; both Qwen3.8-27B builds stay on 48 GB as tuned opt-ins (updated 2026-09-24, sweep partial); the System One classifier is replaced by a result-aware loop guard. Entry point for the folder, which also holds the [evaluation log](2026-09-23-local-model-evaluation/evaluation-log.md), the [nav-pilot e2e test](2026-09-23-local-model-evaluation/nav-pilot-e2e.md), the [Qwen3.8 tuning plan](2026-09-23-local-model-evaluation/qwen38-tuning.md), the [hardware-tier backlog](2026-09-23-local-model-evaluation/hardware-tier-backlog.md) and the [profile audit](2026-09-23-local-model-evaluation/profile-audit.md) |
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
