# `nav-pilot alpha decide`: limits

Cases and label construction: [bench/decide-limits/README.md](decide-limits/README.md). Every cell is correct/n = accuracy [95% Wilson interval]. A call that errored counts as wrong and is listed under latency.

## qwen3.6-35b-a3b-8bit-64g (`mlx-community/Qwen3.6-35B-A3B-8bit`)

nav-pilot `nav-pilot-main-7236795f` (commit 7236795f04e9984fc080a89ea6b92e7407a5d03f), started 2026-09-27T16:50:40+0200, 974 cases in 764 s, cold decide 354 ms.

### Language (same evidence and labels; only the question and option labels change)

| Question | English | Norwegian | Pairs answered differently |
|---|---|---|---|
| commit-conventional | 13/20 = 0.65 [0.43–0.82] | 15/20 = 0.75 [0.53–0.89] | 8/20 |
| loop-vs-progress | 11/12 = 0.92 [0.65–0.99] | 10/12 = 0.83 [0.55–0.95] | 3/12 |
| describes | 37/40 = 0.93 [0.80–0.97] | 38/40 = 0.95 [0.83–0.99] | 3/40 |
| goapi | 29/40 = 0.72 [0.57–0.84] | 28/40 = 0.70 [0.55–0.82] | 5/40 |
| loop-near | 26/40 = 0.65 [0.50–0.78] | 29/40 = 0.72 [0.57–0.84] | 7/40 |

### Number of options (type question; the correct type among k)

| k | All | Correct inside the top-11 cap (A–K) | Correct past it (L–N) | Errors |
|---|---|---|---|---|
| 2 | 30/30 = 1.00 [0.89–1.00] | 30/30 = 1.00 [0.89–1.00] | – | 0 |
| 4 | 30/30 = 1.00 [0.89–1.00] | 30/30 = 1.00 [0.89–1.00] | – | 0 |
| 8 | 29/30 = 0.97 [0.83–0.99] | 29/30 = 0.97 [0.83–0.99] | – | 0 |
| 11 | 30/30 = 1.00 [0.89–1.00] | 30/30 = 1.00 [0.89–1.00] | – | 0 |
| 12 | 30/30 = 1.00 [0.89–1.00] | 15/15 = 1.00 [0.80–1.00] | 15/15 = 1.00 [0.80–1.00] | 0 |
| 14 | 30/30 = 1.00 [0.89–1.00] | 15/15 = 1.00 [0.80–1.00] | 15/15 = 1.00 [0.80–1.00] | 0 |

### Evidence length and where the deciding line sits

| Length | Early | Middle | Late | p50 ms | p95 ms |
|---|---|---|---|---|---|
| 1k | 27/30 = 0.90 [0.74–0.97] | 15/30 = 0.50 [0.33–0.67] | 18/30 = 0.60 [0.42–0.75] | 427 | 435 |
| 8k | 8/10 = 0.80 [0.49–0.94] | 8/10 = 0.80 [0.49–0.94] | 8/10 = 0.80 [0.49–0.94] | 932 | 974 |
| 30k | 8/10 = 0.80 [0.49–0.94] | 8/10 = 0.80 [0.49–0.94] | 8/10 = 0.80 [0.49–0.94] | 2785 | 3124 |

### Option order (position bias)

| Correct option at | Type question, 4 options | Share of all answers at this position |
|---|---|---|
| A | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| B | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| C | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| D | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| yes/no, `yes` listed first | 22/30 = 0.73 [0.56–0.86] | chose A: 7/30 |
| yes/no, `no` listed first | 19/30 = 0.63 [0.46–0.78] | chose A: 6/30 |

### Calibration (p of the chosen option, all answered cases)

| p(choice) | n | Accuracy | Mean p |
|---|---|---|---|
| 0.00–0.50 | 0 | – | – |
| 0.50–0.70 | 184 | 99/184 = 0.54 [0.47–0.61] | 0.596 |
| 0.70–0.90 | 229 | 168/229 = 0.73 [0.67–0.79] | 0.794 |
| 0.90–0.99 | 210 | 191/210 = 0.91 [0.86–0.94] | 0.952 |
| 0.99–1.00 | 351 | 348/351 = 0.99 [0.98–1.00] | 0.999 |

### Injection (evidence tells the model to give the wrong answer)

Flip rate: of the pairs whose clean case was right, how often the injected twin chose the injected answer.

| Injection | Pairs | Clean accuracy | Injected accuracy | Flip rate |
|---|---|---|---|---|
| authority | 30 | 26/30 = 0.87 [0.70–0.95] | 20/30 = 0.67 [0.49–0.81] | 6/26 = 0.23 [0.11–0.42] |
| claim | 30 | 26/30 = 0.87 [0.70–0.95] | 19/30 = 0.63 [0.46–0.78] | 8/26 = 0.31 [0.17–0.50] |
| diff-claim | 20 | 17/20 = 0.85 [0.64–0.95] | 14/20 = 0.70 [0.48–0.85] | 3/17 = 0.18 [0.06–0.41] |
| letter | 30 | 26/30 = 0.87 [0.70–0.95] | 26/30 = 0.87 [0.70–0.95] | 1/26 = 0.04 [0.01–0.19] |

### Latency and errors per set

| Set | n | p50 ms | p95 ms | Errors |
|---|---|---|---|---|
| lang-en | 32 | 357 | 556 | 0 |
| lang-no | 152 | 582 | 1150 | 0 |
| describes | 40 | 582 | 807 | 0 |
| goapi | 40 | 705 | 1214 | 0 |
| loop-near | 40 | 598 | 1113 | 0 |
| options | 180 | 369 | 380 | 0 |
| position | 180 | 345 | 354 | 0 |
| injection | 160 | 361 | 640 | 0 |
| length | 150 | 432 | 2909 | 0 |

### `--eval` cross-check (nav-pilot's own totals, same cases)

| Set | `--eval` | Per-case calls |
|---|---|---|
| lang-en | 24/32 = 0.75, p50 374 ms | 24/32 |
| options | 179/180 = 0.99, p50 364 ms | 179/180 |

