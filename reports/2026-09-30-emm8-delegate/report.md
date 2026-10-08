# 8-bit emm as a delegate, and r4 at n = 20, 2026-10-01

## Question
Does edit-multi-mechanical (emm) on `qwen3.6-35b-a3b-8bit-64g` pass the delegate bar in `bench-capabilities`? The bar: at least 5 dispatched runs over at least 2 tasks, a Wilson lower bound ≥ 0.90 × p_cloud, and a median hybrid/control cost ratio below 1 on at least one cell. If `bar_verdict` reads `trusted`, the owner gives the 8-bit emm `delegate: trusted` in `manifest/models.json`. Otherwise nothing ships ([plan](plan.md)).

## What shipped
Nothing. `manifest/models.json` is unchanged.

## Method
- Hybrid: nav-pilot `main-2bcca023`, Sonnet 5 at `aggressive`, tag `np-2bcca023-sonnet5-aggressive-emm8`, policy `f814d19d`, the bench-only overlay. Cells: isoppfolgingstilfelle-large r5 and r6, and tasks r3 (M1), with 2 controls and 4 hybrid samples each. 1 Oct 03:25–04:16, $3.20.
- Steps 7–8 (tasks r6) failed in 0 s: bench-hybrid refuses rung 6 on `tasks` because D2 is retired. The plan named a retired task. No cost and no samples.
- Local: emm r4 base, 5 runs × 2 tasks, on 30 Sep (harness `f7507f42e5f4`) and again in step 9 (harness `9db581bed642`).
- Figures from `_by_class.py` and `_frontier.py` via `mise run bench-capabilities` and `mise run bench-frontier -- summary`. Cells with the same policy pool by dispatch policy, so the class row includes the phase C re-run's large r4–r5 cells.

## Results
This run's hybrid arm (source: [emm8-delegate-results.md](emm8-delegate-results.md)):

| Cell | Dispatched | Pass, dispatched | Pass, control | Cost ratio |
|---|---|---|---|---|
| large r5 | 4/4 | 4/4 | 2/2 | 2.20 |
| large r6 | 1/4 | 1/1 | 2/2 | 1.93 |
| tasks r3 (M1) | 0/4 | – | 2/2 | – |
| **Pooled** | 5/12 | 5/5 [.57, 1] | 6/6 [.61, 1] | 0.265 / 0.121 = 2.18× |

The class row the bar reads (emm, 8-bit, overlay, policy `f814d19d`):

| Dispatched runs | Tasks | k/n | Wilson LB (one-sided 90 %) | Bar | Cell ratios | Below 1 | bar_verdict |
|---|---|---|---|---|---|---|---|
| 13 of 20 | fm-r4-a, fm-r5-a, fm-r6-a | 13/13 | 0.888 | 0.90 | 0.89 (c2 large r4), 1.92, 2.20, 1.93 | 1 cell, from phase C | **not-yet** |

Local emm r4 (frontier, bar 0.90 × p_cloud):

| Harness | k/n | Monotone LB | Verdict |
|---|---|---|---|
| `f7507f42e5f4` (v2 ladders + 30 Sep extras) | 20/20 [.84, 1] | 0.92 | trusted; frontier trusted r1–r4, first break r5 (8/10) |
| `9db581bed642` (step 9) | 10/10 [.72, 1] | 0.86 | not-yet, new generation |

No samples were discarded.

## Verdict
The local ladder trusts the 8-bit on emm through r4. As a delegate it is `not-yet`: 13/13 dispatched passes put the lower bound at 0.888, just under 0.90. On cost, this run's own cells cost 1.93–2.20× their controls. The one cell below 1 is phase C's large r4 (0.89). The repo's rule needs only one such cell, so cost alone does not block, but quality does. Delegation costs more than cloud in three of four cells.

## Limits
- 15/15 would give LB ≈ 0.90. Two more dispatched passes on the same policy could flip the verdict to `trusted` on the strength of a single sub-1 cell, while the pooled ratio sits near 2×.
- Two controls a cell. M1 never dispatched (0/4), so tasks adds no evidence.
- The manifest is class-level: a `trusted` verdict would also cover r5–r6, where the local ladder has the 8-bit at 8/10 and 7/10.

## Decision
No manifest change. Under `_by_class.py` one phase C cell meets the cost condition, but the bar verdict is `not-yet`, and the plan ships only on `trusted`. No models.json PR is opened. Following the plan, delegate work for emm on the 8-bit stops here. Re-opening it is an owner call: two more dispatched passes would satisfy the rule as written, but the class costs about 2× cloud in three of four cells. The rule's "one cell below 1" should be reviewed before more GPU time goes in.

## Reproduce
`mise run bench-capabilities` (NOT SHIPPED overlay rows; discard the `manifest/capabilities.json` diff) and `mise run bench-frontier -- summary`.

## Sources
- [emm8-delegate-results.md](emm8-delegate-results.md), [emm8-r4.md](../2026-09-29-v2-ladders/emm8-r4.md)
- `bench/hybrid-*-emm8-*.json`, [bench/frontier-qwen3.6-35b-a3b-8bit-64g-base-20260930-150404.json](../../bench/frontier-qwen3.6-35b-a3b-8bit-64g-base-20260930-150404.json), [bench/frontier-qwen3.6-35b-a3b-8bit-64g-base-20261001-040605.json](../../bench/frontier-qwen3.6-35b-a3b-8bit-64g-base-20261001-040605.json)
- [phase C re-run report](../2026-10-01-phase-c-rerun/report.md), [plan](plan.md), #163, #166
