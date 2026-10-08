---
models: ["qwen3.6-35b-a3b-8bit-64g"]
headline: "17/19"
verdict: "fail"
---

# Phase C re-run: the 8-bit as a delegate worker, 2026-10-01

## Question
Sonnet 5 orchestrates at `aggressive`, and the bench-only overlay (#147, #149) trusts the 8-bit's classes. Under that setup, does delegating to `qwen3.6-35b-a3b-8bit-64g` keep the pass rate and cost less than same-day cloud-only controls? The rule: a Newcombe lower bound on the pass-rate difference ≥ −10 points, and a median cost ratio below 1. A pass would make the 8-bit a worker candidate for the 64 GB tier. A fail keeps it a selectable model with all-`cloud` capabilities.

## What shipped
Nothing. The overlay is bench-only and never reaches the manifest.

## Method
- nav-pilot `main-2bcca023`, tag `np-2bcca023-sonnet5-aggressive-c2`, policy sha256 `f814d19d`, overlay [capabilities-bench-only-64-6c.json](../2026-09-26-64gb-tier/capabilities-bench-only-64-6c.json).
- Six cells, 2 controls and 4 hybrid samples each, with controls from the same night as their hybrid arm: isoppfolgingstilfelle-large r4–r5 (emm), isoppfolgingstilfelle-tests r1–r2 (create-file), tasks r2, frontend-familie-tilbake r2. 1 Oct 01:40–03:20, $7.80 of an $8 cap.
- Run after the #165 Gradle fix. Figures from `_by_class.py` via `mise run bench-capabilities`.

## Results
Pooled over the six cells (source: [phase-c-rerun-results.md](../2026-09-26-64gb-tier/phase-c-rerun-results.md)):

| Dispatched | Pass, dispatched | Pass, control | Difference [90 % lower, upper] | Median $ dispatched / control |
|---|---|---|---|---|
| 19/24 | 17/19 [.69, .97] | 12/12 [.76, 1] | −0.11 [−0.23, +0.03] | 0.242 / 0.190 = 1.28× |

By class (`bench-capabilities`, NOT SHIPPED overlay rows):

| Class | k/n dispatched | Cost ratio per cell | Verdict |
|---|---|---|---|
| create-file (tests r1, r2) | 6/8, LB 0.52 | 1.12, 0.96 | cloud |
| edit-multi-mechanical (large r4, r5) | 8/8 | 0.89, 1.92 | pooled with emm8, see [its report](../2026-09-30-emm8-delegate/report.md) |
| edit-single | 3/3 | – | cloud |

Both failed dispatched samples are create-file on isoppfolgingstilfelle-tests r2 (2/4 verified). No samples were discarded.

## Verdict
The re-run fails both rules. The pass-rate lower bound of −0.23 is below −0.10, and delegation costs 1.28× the control median. Delegation works mechanically (19/24 dispatched), but it does not save credits at this level. Two cells come in below 1 (emm large r4 at 0.89, create-file tests r2 at 0.96), and the create-file cell fails half its samples.

## Limits
Two controls a cell, so each cell's median rests on two numbers. One orchestrator, one level. GPT-6 Sol, which dispatches on its own, is not in this run.

## Decision
The 8-bit stays a selectable 64 GB model with all-`cloud` capabilities. No manifest change. emm continues only through the emm8 follow-up, which pools the r4–r5 cells above.

## Reproduce
`mise run bench-capabilities` (writes `manifest/capabilities.json`; discard the diff) and the hybrid-arm table in the results file.

## Sources
- [phase-c-rerun-results.md](../2026-09-26-64gb-tier/phase-c-rerun-results.md) and the `bench/hybrid-*-c2-*.json` files it lists
- [plan-64-6.md](../2026-09-26-64gb-tier/plan-64-6.md), #147, #149, #165, #166
