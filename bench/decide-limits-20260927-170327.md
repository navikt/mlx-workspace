# `nav-pilot alpha decide`: limits

Cases and label construction: [bench/decide-limits/README.md](decide-limits/README.md). Every cell is correct/n = accuracy [95% Wilson interval]. A call that errored counts as wrong and is listed under latency.

## occamy-1.0-4bit-64g (`Accio-Lab/occamy-1.0-MLX-4bit`)

nav-pilot `nav-pilot-main-7236795f` (commit 7236795f04e9984fc080a89ea6b92e7407a5d03f), started 2026-09-27T17:03:31+0200, 974 cases in 800 s, cold decide 316 ms.

### Language (same evidence and labels; only the question and option labels change)

| Question | English | Norwegian | Pairs answered differently |
|---|---|---|---|
| commit-conventional | 13/20 = 0.65 [0.43–0.82] | 12/20 = 0.60 [0.39–0.78] | 1/20 |
| loop-vs-progress | 10/12 = 0.83 [0.55–0.95] | 10/12 = 0.83 [0.55–0.95] | 0/12 |
| describes | 37/40 = 0.93 [0.80–0.97] | 36/40 = 0.90 [0.77–0.96] | 1/40 |
| goapi | 32/40 = 0.80 [0.65–0.90] | 30/40 = 0.75 [0.60–0.86] | 6/40 |
| loop-near | 24/40 = 0.60 [0.45–0.74] | 24/40 = 0.60 [0.45–0.74] | 4/40 |

### Number of options (type question; the correct type among k)

| k | All | Correct inside the top-11 cap (A–K) | Correct past it (L–N) | Errors |
|---|---|---|---|---|
| 2 | 30/30 = 1.00 [0.89–1.00] | 30/30 = 1.00 [0.89–1.00] | – | 0 |
| 4 | 30/30 = 1.00 [0.89–1.00] | 30/30 = 1.00 [0.89–1.00] | – | 0 |
| 8 | 29/30 = 0.97 [0.83–0.99] | 29/30 = 0.97 [0.83–0.99] | – | 0 |
| 11 | 29/30 = 0.97 [0.83–0.99] | 29/30 = 0.97 [0.83–0.99] | – | 0 |
| 12 | 29/30 = 0.97 [0.83–0.99] | 15/15 = 1.00 [0.80–1.00] | 14/15 = 0.93 [0.70–0.99] | 0 |
| 14 | 30/30 = 1.00 [0.89–1.00] | 15/15 = 1.00 [0.80–1.00] | 15/15 = 1.00 [0.80–1.00] | 0 |

### Evidence length and where the deciding line sits

| Length | Early | Middle | Late | p50 ms | p95 ms |
|---|---|---|---|---|---|
| 1k | 18/30 = 0.60 [0.42–0.75] | 23/30 = 0.77 [0.59–0.88] | 19/30 = 0.63 [0.46–0.78] | 443 | 683 |
| 8k | 8/10 = 0.80 [0.49–0.94] | 6/10 = 0.60 [0.31–0.83] | 8/10 = 0.80 [0.49–0.94] | 958 | 1134 |
| 30k | 5/10 = 0.50 [0.24–0.76] | 5/10 = 0.50 [0.24–0.76] | 5/10 = 0.50 [0.24–0.76] | 2870 | 3113 |

### Option order (position bias)

| Correct option at | Type question, 4 options | Share of all answers at this position |
|---|---|---|
| A | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| B | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| C | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| D | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| yes/no, `yes` listed first | 25/30 = 0.83 [0.66–0.93] | chose A: 14/30 |
| yes/no, `no` listed first | 22/30 = 0.73 [0.56–0.86] | chose A: 9/30 |

### Calibration (p of the chosen option, all answered cases)

| p(choice) | n | Accuracy | Mean p |
|---|---|---|---|
| 0.00–0.50 | 0 | – | – |
| 0.50–0.70 | 147 | 70/147 = 0.48 [0.40–0.56] | 0.598 |
| 0.70–0.90 | 181 | 97/181 = 0.54 [0.46–0.61] | 0.798 |
| 0.90–0.99 | 192 | 150/192 = 0.78 [0.72–0.83] | 0.953 |
| 0.99–1.00 | 454 | 446/454 = 0.98 [0.97–0.99] | 0.999 |

### Injection (evidence tells the model to give the wrong answer)

Flip rate: of the pairs whose clean case was right, how often the injected twin chose the injected answer.

| Injection | Pairs | Clean accuracy | Injected accuracy | Flip rate |
|---|---|---|---|---|
| authority | 30 | 20/30 = 0.67 [0.49–0.81] | 13/30 = 0.43 [0.27–0.61] | 7/20 = 0.35 [0.18–0.57] |
| claim | 30 | 20/30 = 0.67 [0.49–0.81] | 10/30 = 0.33 [0.19–0.51] | 10/20 = 0.50 [0.30–0.70] |
| diff-claim | 20 | 18/20 = 0.90 [0.70–0.97] | 14/20 = 0.70 [0.48–0.85] | 4/18 = 0.22 [0.09–0.45] |
| letter | 30 | 20/30 = 0.67 [0.49–0.81] | 19/30 = 0.63 [0.46–0.78] | 2/20 = 0.10 [0.03–0.30] |

### Latency and errors per set

| Set | n | p50 ms | p95 ms | Errors |
|---|---|---|---|---|
| lang-en | 32 | 328 | 516 | 0 |
| lang-no | 152 | 548 | 1048 | 0 |
| describes | 40 | 550 | 721 | 0 |
| goapi | 40 | 655 | 1107 | 0 |
| loop-near | 40 | 565 | 976 | 0 |
| options | 180 | 344 | 359 | 0 |
| position | 180 | 322 | 334 | 0 |
| injection | 160 | 341 | 698 | 0 |
| length | 150 | 481 | 3025 | 0 |

### `--eval` cross-check (nav-pilot's own totals, same cases)

| Set | `--eval` | Per-case calls |
|---|---|---|
| lang-en | 23/32 = 0.72, p50 325 ms | 23/32 |
| options | 177/180 = 0.98, p50 340 ms | 177/180 |

