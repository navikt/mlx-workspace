# `nav-pilot alpha decide`: limits

Cases and label construction: [bench/decide-limits/README.md](decide-limits/README.md). Every cell is correct/n = accuracy [95% Wilson interval]. A call that errored counts as wrong and is listed under latency.

## optiq (`mlx-community/Qwen3.6-35B-A3B-OptiQ-4bit`)

nav-pilot `nav-pilot-main-d24a65e5` (commit d24a65e5fd81c3347e7325722354c998d7499f08), started 2026-09-25T01:45:14+0200, 974 cases in 669 s, cold decide 315 ms.

### Language (same evidence and labels; only the question and option labels change)

| Question | English | Norwegian | Pairs answered differently |
|---|---|---|---|
| commit-conventional | 15/20 = 0.75 [0.53–0.89] | 13/20 = 0.65 [0.43–0.82] | 6/20 |
| loop-vs-progress | 11/12 = 0.92 [0.65–0.99] | 9/12 = 0.75 [0.47–0.91] | 4/12 |
| describes | 37/40 = 0.93 [0.80–0.97] | 37/40 = 0.93 [0.80–0.97] | 0/40 |
| goapi | 28/40 = 0.70 [0.55–0.82] | 28/40 = 0.70 [0.55–0.82] | 6/40 |
| loop-near | 22/40 = 0.55 [0.40–0.69] | 31/40 = 0.78 [0.62–0.88] | 9/40 |

### Number of options (type question; the correct type among k)

| k | All | Correct inside the top-11 cap (A–K) | Correct past it (L–N) | Errors |
|---|---|---|---|---|
| 2 | 30/30 = 1.00 [0.89–1.00] | 30/30 = 1.00 [0.89–1.00] | – | 0 |
| 4 | 30/30 = 1.00 [0.89–1.00] | 30/30 = 1.00 [0.89–1.00] | – | 0 |
| 8 | 30/30 = 1.00 [0.89–1.00] | 30/30 = 1.00 [0.89–1.00] | – | 0 |
| 11 | 29/30 = 0.97 [0.83–0.99] | 29/30 = 0.97 [0.83–0.99] | – | 0 |
| 12 | 30/30 = 1.00 [0.89–1.00] | 15/15 = 1.00 [0.80–1.00] | 15/15 = 1.00 [0.80–1.00] | 0 |
| 14 | 30/30 = 1.00 [0.89–1.00] | 15/15 = 1.00 [0.80–1.00] | 15/15 = 1.00 [0.80–1.00] | 0 |

### Evidence length and where the deciding line sits

| Length | Early | Middle | Late | p50 ms | p95 ms |
|---|---|---|---|---|---|
| 1k | 28/30 = 0.93 [0.79–0.98] | 23/30 = 0.77 [0.59–0.88] | 21/30 = 0.70 [0.52–0.83] | 383 | 392 |
| 8k | 8/10 = 0.80 [0.49–0.94] | 9/10 = 0.90 [0.60–0.98] | 8/10 = 0.80 [0.49–0.94] | 843 | 898 |
| 30k | 7/10 = 0.70 [0.40–0.89] | 9/10 = 0.90 [0.60–0.98] | 8/10 = 0.80 [0.49–0.94] | 2475 | 2521 |

### Option order (position bias)

| Correct option at | Type question, 4 options | Share of all answers at this position |
|---|---|---|
| A | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| B | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| C | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| D | 30/30 = 1.00 [0.89–1.00] | 30/120 = 0.25 |
| yes/no, `yes` listed first | 24/30 = 0.80 [0.63–0.90] | chose A: 9/30 |
| yes/no, `no` listed first | 20/30 = 0.67 [0.49–0.81] | chose A: 5/30 |

### Calibration (p of the chosen option, all answered cases)

| p(choice) | n | Accuracy | Mean p |
|---|---|---|---|
| 0.00–0.50 | 1 | 1/1 = 1.00 [0.21–1.00] | 0.500 |
| 0.50–0.70 | 185 | 106/185 = 0.57 [0.50–0.64] | 0.603 |
| 0.70–0.90 | 245 | 192/245 = 0.78 [0.73–0.83] | 0.802 |
| 0.90–0.99 | 205 | 192/205 = 0.94 [0.89–0.96] | 0.953 |
| 0.99–1.00 | 338 | 336/338 = 0.99 [0.98–1.00] | 0.998 |

### Injection (evidence tells the model to give the wrong answer)

Flip rate: of the pairs whose clean case was right, how often the injected twin chose the injected answer.

| Injection | Pairs | Clean accuracy | Injected accuracy | Flip rate |
|---|---|---|---|---|
| authority | 30 | 27/30 = 0.90 [0.74–0.97] | 25/30 = 0.83 [0.66–0.93] | 2/27 = 0.07 [0.02–0.23] |
| claim | 30 | 27/30 = 0.90 [0.74–0.97] | 18/30 = 0.60 [0.42–0.75] | 9/27 = 0.33 [0.19–0.52] |
| diff-claim | 20 | 18/20 = 0.90 [0.70–0.97] | 16/20 = 0.80 [0.58–0.92] | 2/18 = 0.11 [0.03–0.33] |
| letter | 30 | 27/30 = 0.90 [0.74–0.97] | 28/30 = 0.93 [0.79–0.98] | 1/27 = 0.04 [0.01–0.18] |

### Latency and errors per set

| Set | n | p50 ms | p95 ms | Errors |
|---|---|---|---|---|
| lang-en | 32 | 328 | 506 | 0 |
| lang-no | 152 | 569 | 1121 | 0 |
| describes | 40 | 552 | 749 | 0 |
| goapi | 40 | 660 | 1091 | 0 |
| loop-near | 40 | 562 | 944 | 0 |
| options | 180 | 334 | 350 | 0 |
| position | 180 | 313 | 325 | 0 |
| injection | 160 | 329 | 594 | 0 |
| length | 150 | 387 | 2499 | 0 |

### `--eval` cross-check (nav-pilot's own totals, same cases)

| Set | `--eval` | Per-case calls |
|---|---|---|
| lang-en | 26/32 = 0.81, p50 314 ms | 26/32 |
| options | 179/180 = 0.99, p50 327 ms | 179/180 |

