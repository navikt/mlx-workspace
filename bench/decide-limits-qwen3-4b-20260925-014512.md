# `nav-pilot alpha decide`: limits

Cases and label construction: [bench/decide-limits/README.md](decide-limits/README.md). Every cell is correct/n = accuracy [95% Wilson interval]. A call that errored counts as wrong and is listed under latency.

## qwen3-4b (`mlx-community/Qwen3-4B-Instruct-2507-4bit`)

nav-pilot `nav-pilot-main-d24a65e5` (commit d24a65e5fd81c3347e7325722354c998d7499f08), started 2026-09-25T02:24:14+0200, 974 cases in 480 s, cold decide 220 ms.

### Language (same evidence and labels; only the question and option labels change)

| Question | English | Norwegian | Pairs answered differently |
|---|---|---|---|
| commit-conventional | 9/20 = 0.45 [0.26–0.66] | 9/20 = 0.45 [0.26–0.66] | 2/20 |
| loop-vs-progress | 8/12 = 0.67 [0.39–0.86] | 11/12 = 0.92 [0.65–0.99] | 3/12 |
| describes | 26/40 = 0.65 [0.50–0.78] | 27/40 = 0.68 [0.52–0.80] | 5/40 |
| goapi | 22/40 = 0.55 [0.40–0.69] | 21/40 = 0.53 [0.37–0.67] | 5/40 |
| loop-near | 22/40 = 0.55 [0.40–0.69] | 23/40 = 0.57 [0.42–0.71] | 15/40 |

### Number of options (type question; the correct type among k)

| k | All | Correct inside the top-11 cap (A–K) | Correct past it (L–N) | Errors |
|---|---|---|---|---|
| 2 | 30/30 = 1.00 [0.89–1.00] | 30/30 = 1.00 [0.89–1.00] | – | 0 |
| 4 | 30/30 = 1.00 [0.89–1.00] | 30/30 = 1.00 [0.89–1.00] | – | 0 |
| 8 | 29/30 = 0.97 [0.83–0.99] | 29/30 = 0.97 [0.83–0.99] | – | 0 |
| 11 | 28/30 = 0.93 [0.79–0.98] | 28/30 = 0.93 [0.79–0.98] | – | 0 |
| 12 | 28/30 = 0.93 [0.79–0.98] | 15/15 = 1.00 [0.80–1.00] | 13/15 = 0.87 [0.62–0.96] | 0 |
| 14 | 29/30 = 0.97 [0.83–0.99] | 15/15 = 1.00 [0.80–1.00] | 14/15 = 0.93 [0.70–0.99] | 0 |

### Evidence length and where the deciding line sits

| Length | Early | Middle | Late | p50 ms | p95 ms |
|---|---|---|---|---|---|
| 1k | 20/30 = 0.67 [0.49–0.81] | 15/30 = 0.50 [0.33–0.67] | 15/30 = 0.50 [0.33–0.67] | 237 | 255 |
| 8k | 5/10 = 0.50 [0.24–0.76] | 5/10 = 0.50 [0.24–0.76] | 6/10 = 0.60 [0.31–0.83] | 426 | 610 |
| 30k | 5/10 = 0.50 [0.24–0.76] | 6/10 = 0.60 [0.31–0.83] | 5/10 = 0.50 [0.24–0.76] | 1374 | 2395 |

### Option order (position bias)

| Correct option at | Type question, 4 options | Share of all answers at this position |
|---|---|---|
| A | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| B | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| C | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| D | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| yes/no, `yes` listed first | 14/30 = 0.47 [0.30–0.64] | chose A: 25/30 |
| yes/no, `no` listed first | 16/30 = 0.53 [0.36–0.70] | chose A: 5/30 |

### Calibration (p of the chosen option, all answered cases)

| p(choice) | n | Accuracy | Mean p |
|---|---|---|---|
| 0.00–0.50 | 2 | 1/2 = 0.50 [0.09–0.91] | 0.444 |
| 0.50–0.70 | 32 | 20/32 = 0.62 [0.45–0.77] | 0.602 |
| 0.70–0.90 | 45 | 22/45 = 0.49 [0.35–0.63] | 0.808 |
| 0.90–0.99 | 147 | 63/147 = 0.43 [0.35–0.51] | 0.958 |
| 0.99–1.00 | 748 | 555/748 = 0.74 [0.71–0.77] | 0.999 |

### Injection (evidence tells the model to give the wrong answer)

Flip rate: of the pairs whose clean case was right, how often the injected twin chose the injected answer.

| Injection | Pairs | Clean accuracy | Injected accuracy | Flip rate |
|---|---|---|---|---|
| authority | 30 | 19/30 = 0.63 [0.46–0.78] | 10/30 = 0.33 [0.19–0.51] | 9/19 = 0.47 [0.27–0.68] |
| claim | 30 | 19/30 = 0.63 [0.46–0.78] | 3/30 = 0.10 [0.03–0.26] | 16/19 = 0.84 [0.62–0.94] |
| diff-claim | 20 | 14/20 = 0.70 [0.48–0.85] | 9/20 = 0.45 [0.26–0.66] | 5/14 = 0.36 [0.16–0.61] |
| letter | 30 | 19/30 = 0.63 [0.46–0.78] | 22/30 = 0.73 [0.56–0.86] | 1/19 = 0.05 [0.01–0.25] |

### Latency and errors per set

| Set | n | p50 ms | p95 ms | Errors |
|---|---|---|---|---|
| lang-en | 32 | 226 | 368 | 0 |
| lang-no | 152 | 386 | 724 | 0 |
| describes | 40 | 373 | 527 | 0 |
| goapi | 40 | 469 | 766 | 0 |
| loop-near | 40 | 394 | 658 | 0 |
| options | 180 | 214 | 229 | 0 |
| position | 180 | 211 | 228 | 0 |
| injection | 160 | 225 | 369 | 0 |
| length | 150 | 253 | 2162 | 0 |

### `--eval` cross-check (nav-pilot's own totals, same cases)

| Set | `--eval` | Per-case calls |
|---|---|---|
| lang-en | 17/32 = 0.53, p50 228 ms | 17/32 |
| options | 174/180 = 0.97, p50 207 ms | 174/180 |

