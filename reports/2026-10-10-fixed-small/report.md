---
models: ["qwen3.6-35b-a3b-optiq", "qwen3.6-35b-a3b-8bit"]
headline: "26/28"
verdict: "pass"
---

# Small PR types on the fixed harness, 2026-10-10

## Question
After the O1 prompt fix and task-classes (#189), can both 64g profiles do config-deploy (O1) locally, and do the other small-task figures from [small-delegate](../2026-10-10-small-delegate/report.md) still hold?

## Method
Two queues of 14 `bench-cheap-ops` passes each, run by `night-run-3`: `optiq-refill` (10 Oct, 12:43–16:04) on `qwen3.6-35b-a3b-optiq-64g`, then `8bit-refill` (16:09–19:26) on `qwen3.6-35b-a3b-8bit-64g`. All 28 launcher passes exited 0. Only results with harness `5cdeda213eba` are counted (182 samples per profile); the earlier `1cb0ea736a5a` generation is not pooled. Classes from `bench/task-classes.json`. R1 is excluded (suspected checker problem) and D2 is excluded (retired). $0 cloud.

## Results
Local, k/n [95 % Wilson].

| Task (class) | optiq-64g | 8-bit-64g |
|---|---|---|
| **O1 (config-deploy, edit-single)** | **12/14 [0.60, 0.96]** | **14/14 [0.78, 1.00]** |
| E1 (edit-single) | 14/14 | 14/14 |
| E3b (edit-single) | 11/14 | 14/14 |
| T1 (create-file) | 12/14 | 12/14 |
| G2 (create-file) | 8/14 | 9/14 |
| D3 (create-file) | 9/14 | 10/14 |
| M1 (edit-multi-mechanical) | 14/14 | 6/14 |
| M2 (edit-multi-mechanical) | 11/14 | 13/14 |
| R2, R3 (read-qa) | 14/14, 14/14 | 14/14, 14/14 |
| D1 (read-qa) | 11/14 | 14/14 |
| R1 (excluded) | 0/14 | 1/14 |
| D2 (excluded) | – | – |

Per class: edit-single optiq 37/42 [0.75, 0.95], 8-bit 42/42 [0.92, 1.00]; create-file 29/42 [0.54, 0.81] vs 31/42 [0.59, 0.85]; edit-multi-mechanical 25/28 [0.73, 0.96] vs 19/28 [0.49, 0.82]; read-qa 39/42 [0.81, 0.98] vs 42/42 [0.92, 1.00].

Before #189 ([small-delegate](../2026-10-10-small-delegate/report.md)): O1 was 0/15 optiq and 0/30 8-bit, every sample "no changes made". E1 15/15 and 30/30, E3b 12/15 and 29/30, T1 14/15 and 28/30. The figures for the other tasks are in line with those.

## Verdict
The O1 fix worked. Both profiles now do config-deploy locally; the 8-bit passed all 14. The two optiq misses were "no changes made" (14:58 and 15:13). The 8-bit is again the steadier profile on edit-single and read-qa. Its weak spot is M1: of the 8 misses, 7 left the old symbol in place and 1 made no change.

## Caveats
n = 14 per task. The pre-#189 numbers come from another harness generation and are not pooled. D2 is still in the queue even though it is retired: 19 of its 28 samples timed out at 420 s and the rest were marked retired, with no verdict. These are not counted as failures. R1 is excluded, and it failed on the same note ("1 of 4 expected terms") 27 of 28 times, which supports the checker-problem theory. No `bench-capabilities` verdict was run for this draft.

## Sources
Launcher logs `.bench-logs/optiq-refill.log`, `.bench-logs/8bit-refill.log`; step logs `.bench-logs/night3-20261010-*`. Result files (harness `5cdeda213eba`):
- optiq: `bench/results-qwen3.6-35b-a3b-optiq-64g-20261010-{124333,125402,131100,132657,134030,135617,141252,142808,144419,145803,151348,152717,154257,155024}-01.json`
- 8-bit: `bench/results-qwen3.6-35b-a3b-8bit-64g-20261010-{160929,162434,163847,165149,170833,172052,173446,174826,180225,181732,183419,184456,185957,191027}-01.json`

Committed on the local `bench/night3-results-20261010-*` branches (not pushed). Per-pass reports in `reports/2026-10-10-optiq-refill/` and `reports/2026-10-10-8bit-refill/`.
