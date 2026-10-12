# Gemma 4 26B A4B QAT optiq 4-bit: follow-up, 2026-10-12

## Question
Does the missing data (the fm rerun and cf run 5) move Gemma off not-yet in the [new-models report](report.md)?

## Data
All four Gemma result files are on harness `855cba4e0fd0`, so they pool.

| Pass | File | Samples | Pass |
|---|---|---|---|
| cf runs 1–4 | `bench/frontier-gemma-4-26b-a4b-qat-optiq-4bit-base-20261011-145520.json` | 32 | 22 |
| cf run 5 | `bench/frontier-gemma-4-26b-a4b-qat-optiq-4bit-base-20261012-070411.json` | 8 | 2 |
| fm run 1 (server crash) | `bench/frontier-gemma-4-26b-a4b-qat-optiq-4bit-base-20261011-203328.json` | 8 | 5 |
| fm rerun after the venv fix | `bench/frontier-gemma-4-26b-a4b-qat-optiq-4bit-base-20261011-223741.json` | 35 | 17 |

The fm rerun stopped at 35 of 40 samples. 14 of its 18 failures are 420 s timeouts. The other 4 are 3 missed file-name literals and 1 compile failure.

## Cells
LB is the one-sided 90 % Wilson lower bound (z = 1.2816). The bar is 0.90 × the Sonnet 5 point estimate on the same harness.

| Class | Rung | k/n | LB | Bar | Verdict |
|---|---|---|---|---|---|
| cf | r1 | 6/10 | 0.40 | 0.45 (2/4) | cloud |
| cf | r2 | 10/10 | 0.86 | 0.90 (4/4) | not-yet |
| cf | r3 | 8/10 | 0.60 | 0.90 (4/4) | cloud |
| cf | r4 | 0/10 | 0.00 | 0.68 (3/4) | cloud |
| fm | r1 | 10/12 | 0.66 | 0.63 (7/10) | trusted |
| fm | r2 | 6/11 | 0.36 | 0.81 (9/10) | cloud |
| fm | r3 | 4/10 | 0.23 | 0.90 (10/10) | cloud |
| fm | r4 | 2/10 | 0.09 | 0.90 (10/10) | cloud |

Totals: cf 24/40 (LB 0.50), fm 22/43 (LB 0.42), together 46/83 (LB 0.48). The Sonnet 5 cf cells are only 4 samples each, so the cf bars are rough. No cell flips at any bar between 0.40 and 0.90. The `bench-frontier summary` table in [results 1](gemma-4-26b-a4b-qat-optiq-4bit-results-1.md) uses the monotone LB and reaches the same verdicts.

## Verdict
**Not-yet.** Frontier: cf 0 rungs, fm 1 rung (r1). cf r4 is 0/10, and fm falls apart from r2 on, mostly to timeouts. Optiq on its own harnesses did better on both classes at r2–r4 (see [report](report.md#optiq-comparison)); that comparison is descriptive, not pooled.

## Limits
Two tasks per rung. The fm rerun is 5 samples short. Timeouts drive fm; a longer cap could change r2–r4, but that would be a new variant, not this one.

## Decision
Routing is unchanged. Gemma stays off the routing table.

## Sources
The four JSON files above, [Gemma results 1](gemma-4-26b-a4b-qat-optiq-4bit-results-1.md), [Gemma 3](gemma-4-26b-a4b-qat-optiq-4bit-results-3.md), [Gemma 4](gemma-4-26b-a4b-qat-optiq-4bit-results-4.md), [report](report.md).
