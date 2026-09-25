# `nav-pilot alpha decide`: limits

Cases and label construction: [bench/decide-limits/README.md](decide-limits/README.md). Every cell is correct/n = accuracy [95% Wilson interval]. A call that errored counts as wrong and is listed under latency.

## qwen3.8-27b-optiq-4bit (`mlx-community/Qwen3.8-27B-OptiQ-4bit`)

nav-pilot `nav-pilot-main-d24a65e5` (commit d24a65e5fd81c3347e7325722354c998d7499f08), started 2026-09-25T01:56:27+0200, 974 cases in 1664 s, cold decide 481 ms.

### Language (same evidence and labels; only the question and option labels change)

| Question | English | Norwegian | Pairs answered differently |
|---|---|---|---|
| commit-conventional | 16/20 = 0.80 [0.58–0.92] | 15/20 = 0.75 [0.53–0.89] | 1/20 |
| loop-vs-progress | 12/12 = 1.00 [0.76–1.00] | 11/12 = 0.92 [0.65–0.99] | 1/12 |
| describes | 39/40 = 0.97 [0.87–1.00] | 36/40 = 0.90 [0.77–0.96] | 3/40 |
| goapi | 35/40 = 0.88 [0.74–0.95] | 32/40 = 0.80 [0.65–0.90] | 5/40 |
| loop-near | 33/40 = 0.82 [0.68–0.91] | 33/40 = 0.82 [0.68–0.91] | 0/40 |

### Number of options (type question; the correct type among k)

| k | All | Correct inside the top-11 cap (A–K) | Correct past it (L–N) | Errors |
|---|---|---|---|---|
| 2 | 30/30 = 1.00 [0.89–1.00] | 30/30 = 1.00 [0.89–1.00] | – | 0 |
| 4 | 30/30 = 1.00 [0.89–1.00] | 30/30 = 1.00 [0.89–1.00] | – | 0 |
| 8 | 29/30 = 0.97 [0.83–0.99] | 29/30 = 0.97 [0.83–0.99] | – | 0 |
| 11 | 29/30 = 0.97 [0.83–0.99] | 29/30 = 0.97 [0.83–0.99] | – | 0 |
| 12 | 29/30 = 0.97 [0.83–0.99] | 15/15 = 1.00 [0.80–1.00] | 14/15 = 0.93 [0.70–0.99] | 0 |
| 14 | 29/30 = 0.97 [0.83–0.99] | 15/15 = 1.00 [0.80–1.00] | 14/15 = 0.93 [0.70–0.99] | 0 |

### Evidence length and where the deciding line sits

| Length | Early | Middle | Late | p50 ms | p95 ms |
|---|---|---|---|---|---|
| 1k | 28/30 = 0.93 [0.79–0.98] | 27/30 = 0.90 [0.74–0.97] | 28/30 = 0.93 [0.79–0.98] | 779 | 794 |
| 8k | 9/10 = 0.90 [0.60–0.98] | 10/10 = 1.00 [0.72–1.00] | 10/10 = 1.00 [0.72–1.00] | 3339 | 3369 |
| 30k | 8/10 = 0.80 [0.49–0.94] | 10/10 = 1.00 [0.72–1.00] | 8/10 = 0.80 [0.49–0.94] | 11563 | 11745 |

### Option order (position bias)

| Correct option at | Type question, 4 options | Share of all answers at this position |
|---|---|---|
| A | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| B | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| C | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| D | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| yes/no, `yes` listed first | 27/30 = 0.90 [0.74–0.97] | chose A: 12/30 |
| yes/no, `no` listed first | 19/30 = 0.63 [0.46–0.78] | chose A: 6/30 |

### Calibration (p of the chosen option, all answered cases)

| p(choice) | n | Accuracy | Mean p |
|---|---|---|---|
| 0.00–0.50 | 0 | – | – |
| 0.50–0.70 | 202 | 129/202 = 0.64 [0.57–0.70] | 0.606 |
| 0.70–0.90 | 223 | 179/223 = 0.80 [0.75–0.85] | 0.796 |
| 0.90–0.99 | 230 | 218/230 = 0.95 [0.91–0.97] | 0.954 |
| 0.99–1.00 | 319 | 319/319 = 1.00 [0.99–1.00] | 0.998 |

### Injection (evidence tells the model to give the wrong answer)

Flip rate: of the pairs whose clean case was right, how often the injected twin chose the injected answer.

| Injection | Pairs | Clean accuracy | Injected accuracy | Flip rate |
|---|---|---|---|---|
| authority | 30 | 28/30 = 0.93 [0.79–0.98] | 15/30 = 0.50 [0.33–0.67] | 13/28 = 0.46 [0.30–0.64] |
| claim | 30 | 28/30 = 0.93 [0.79–0.98] | 13/30 = 0.43 [0.27–0.61] | 15/28 = 0.54 [0.36–0.70] |
| diff-claim | 20 | 19/20 = 0.95 [0.76–0.99] | 8/20 = 0.40 [0.22–0.61] | 11/19 = 0.58 [0.36–0.77] |
| letter | 30 | 28/30 = 0.93 [0.79–0.98] | 20/30 = 0.67 [0.49–0.81] | 8/28 = 0.29 [0.15–0.47] |

### Latency and errors per set

| Set | n | p50 ms | p95 ms | Errors |
|---|---|---|---|---|
| lang-en | 32 | 505 | 1523 | 0 |
| lang-no | 152 | 1831 | 4443 | 0 |
| describes | 40 | 1865 | 3128 | 0 |
| goapi | 40 | 2622 | 4691 | 0 |
| loop-near | 40 | 1986 | 3885 | 0 |
| options | 180 | 559 | 576 | 0 |
| position | 180 | 493 | 505 | 0 |
| injection | 160 | 503 | 2316 | 0 |
| length | 150 | 789 | 11592 | 0 |

### `--eval` cross-check (nav-pilot's own totals, same cases)

| Set | `--eval` | Per-case calls |
|---|---|---|
| lang-en | 28/32 = 0.88, p50 484 ms | 28/32 |
| options | 176/180 = 0.98, p50 557 ms | 176/180 |

