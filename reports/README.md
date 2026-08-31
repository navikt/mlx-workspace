# Reports

**Finished documents.** The numbers in these are reproducible with `python3 bench/analyse.py`,
they will not change except to correct an error, and they are safe to link from outside this
repo.

If you are looking for something being actively written, it is in [`../working/`](../working/).
If you want the raw record of every run rather than a summary, that is `MODELS.md` at the
repo root.

| Report | Covers |
|---|---|
| [`local-inference-findings.md`](local-inference-findings.md) | **The study.** 200 valid samples across two clients, three codebases, six task shapes and three refactor strategies: what the local model saves, what it cannot do, why the saving tracks the cloud arm's step count rather than the codebase, and the things we got wrong along the way |
| [`alpha-model-decision.md`](alpha-model-decision.md) | Which model the nav-pilot alpha ships, why Qwen3.8-27B is held back, what was rejected, and how far the numbers can be trusted |
| [`48gb-question.md`](48gb-question.md) | Seven models on the weather-cli benchmark, what fits a 48 GB machine, and what moved the numbers |
| [`night-plan-2026-08-31.md`](night-plan-2026-08-31.md) | The plan for the 31 August run, including the prediction, statistic and test fixed in writing **before** the run that tested them |
| [`night-results-2026-08-31.md`](night-results-2026-08-31.md) | What that run produced: the step-count predictor holding on a codebase it had not seen, and the model failing every debugging task |

## Elsewhere

| Where | What |
|---|---|
| [`../working/`](../working/) | Plans and trackers being edited. Expect them to change under you, and do not link to them from outside. |
| [`../runbooks/`](../runbooks/) | Operational. [`alpha-runbook.md`](../runbooks/alpha-runbook.md) is for whoever picks up an alpha report. |
| [`../archive/`](../archive/) | Superseded. Kept because deleting the record of a wrong conclusion is how a team repeats it. |
| [`../bench/specs/`](../bench/specs/) | What each benchmark measures and how. |
