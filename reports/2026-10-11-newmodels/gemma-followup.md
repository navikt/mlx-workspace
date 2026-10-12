# Gemma 4 26B A4B QAT optiq 4-bit: follow-up, 2026-10-12

## Question
Does the missing data (the fm rerun and cf run 5) move Gemma off not-yet in the [new-models report](report.md)?

## Data
All four Gemma result files are on harness `855cba4e0fd0`, so they pool.

| Run | File | Samples | Passed |
|---|---|---|---|
| cf runs 1–4 | `bench/frontier-gemma-4-26b-a4b-qat-optiq-4bit-base-20261011-145520.json` | 32 | 22 |
| cf run 5 | `bench/frontier-gemma-4-26b-a4b-qat-optiq-4bit-base-20261012-070411.json` | 8 | 2 |
| fm run 1 (server crash) | `bench/frontier-gemma-4-26b-a4b-qat-optiq-4bit-base-20261011-203328.json` | 8 | 5 |
| fm rerun | `bench/frontier-gemma-4-26b-a4b-qat-optiq-4bit-base-20261011-223741.json` | 35 | 17 |

The rerun followed the venv fix: a Python 3.13 rebuild had left a stale oMLX stamp and no `mlx_lm`, so the server could not start; #211 pinned Python 3.12. The fm rerun stopped at 35 of 40 samples. 14 of its 18 failures are 420 s timeouts. The other 4 are 3 missed file-name literals and 1 compile failure.

## Cells
LB is the one-sided 90 % Wilson lower bound (z = 1.2816). The bar is 0.90 × the cloud pass rate, as `bench-frontier summary` computes it: all cloud rows (Sonnet 5 and GPT-6-sol) pooled per class and rung. The cloud runs are on harness `df7deb1af416`, not Gemma's. Rule: k/n below the bar → cloud; otherwise LB below the bar, fewer than 5 runs or fewer than 2 tasks → not-yet; else trusted.

| Class | Rung | k/n | LB | Bar | Verdict |
|---|---|---|---|---|---|
| cf | r1 | 6/10 | 0.40 | 0.675 (6/8) | cloud |
| cf | r2 | 10/10 | 0.86 | 0.90 (8/8) | not-yet |
| cf | r3 | 8/10 | 0.60 | 0.90 (8/8) | cloud |
| cf | r4 | 0/10 | 0.00 | 0.675 (3/4) | cloud |
| fm | r1 | 10/12 | 0.66 | 0.63 (7/10) | trusted |
| fm | r2 | 6/11 | 0.36 | 0.81 (9/10) | cloud |
| fm | r3 | 4/10 | 0.23 | 0.90 (10/10) | cloud |
| fm | r4 | 2/10 | 0.09 | 0.90 (14/14) | cloud |

Totals: cf 24/40 (LB 0.50), fm 22/43 (LB 0.42), together 46/83 (LB 0.48). The cloud cf cells are only 4–8 samples each, so the cf bars are rough. The verdicts depend on them: cf r2 would be trusted at a bar of 0.86 or less, cf r3 at 0.60 or less, and fm r1 stops being trusted above 0.66. The `bench-frontier summary` table in [results 1](gemma-4-26b-a4b-qat-optiq-4bit-results-1.md) uses the monotone LB and reaches the same verdicts.

## Verdict
**Not-yet.** Frontier: cf 0 rungs, fm 1 rung (r1). cf r4 is 0/10, and fm falls apart from r2 on, mostly from timeouts. Against optiq on its own harnesses (see [report](report.md#optiq-comparison)), Gemma is ahead at cf r2–r3 (10/10 and 8/10 against 6/10 and 7/10) and fm r2 (6/11 against 5/10); optiq is ahead at cf r4 and fm r3–r4. That comparison is descriptive, not pooled.

## Limits
Two tasks per rung. The fm rerun is 5 samples short. Timeouts drive fm; a longer cap could change r2–r4, but that would be a new variant, not this one.

## Decision
Routing is unchanged. Gemma stays off the routing table.

## Sources
The four JSON files above, [Gemma results 1](gemma-4-26b-a4b-qat-optiq-4bit-results-1.md), [Gemma 3](gemma-4-26b-a4b-qat-optiq-4bit-results-3.md), [Gemma 4](gemma-4-26b-a4b-qat-optiq-4bit-results-4.md), [report](report.md).
