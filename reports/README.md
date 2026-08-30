# Reports

Write-ups built from the benchmark data. `MODELS.md` at the repo root is the working record of every
run, every failure and every correction. These are the summaries.

| Report | Covers |
|---|---|
| [`local-inference-findings.md`](local-inference-findings.md) | **The findings report.** 146 verified samples across two clients, six task shapes and three refactor strategies: what the local model saves, what it cannot do, the four things we got wrong, and the bug that would have hurt users |
| [`alpha-model-decision.md`](alpha-model-decision.md) | Which model the nav-pilot alpha ships, why Qwen3.8-27B is held back, what was rejected, and how far the numbers can be trusted |
| [`alpha-status.md`](alpha-status.md) | The tracking file: what is verified on hardware, what is outstanding, what our own documents got wrong, and the known ceilings |
| [`alpha-runbook.md`](alpha-runbook.md) | **Triage.** For whoever picks up an alpha report: what the five health states mean, the symptom table, what to collect, and what is known-broken and not worth escalating |
| [`plan-forward.md`](plan-forward.md) | What is left after the model decision: the four gates, the phase sequence, and what would kill it |
| [`48gb-question.md`](48gb-question.md) | Seven models on the weather-cli benchmark, what fits a 48 GB Pro, and what moved the numbers |
| [`nav-pilot-path.md`](nav-pilot-path.md) | Seat economics, break-even, and where a local model layer fits alongside grillmester |
| [`status-2026-08-27.md`](status-2026-08-27.md) | Dated status update for a wider audience. Superseded by the decision report |
