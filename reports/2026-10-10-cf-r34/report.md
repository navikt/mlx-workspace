---
models: ["qwen3.6-35b-a3b-optiq", "qwen3.6-35b-a3b-8bit-64g"]
headline: "19/20"
verdict: "not-yet"
---

# create-file retry2 r3–r4 extras, 2026-10-10

## Question
Do more retry2 samples on one harness make create-file r3 trusted locally on optiq and the 8-bit? If r3 is trusted on a profile, that profile's create-file routing moves to r3.

## What shipped
Nothing. The manifest is unchanged (create-file `delegate: cloud`).

## Method
Three `night-run-3` passes on 10 Oct, all on harness `6967c4bae943` and tasks `cd8780d1d644`, $0 cloud, 420 s cap per attempt:

1. cf-r34, 19:35–20:58: optiq retry2 r3–r4, 5 runs (`.bench-logs/night3-20261010-193512`). The 8-bit pass in the same queue failed its gradle preflight after 2 s, so it produced no samples.
2. cf-r34b pass 1, 21:09–22:49: 8-bit retry2 r3–r4, 5 runs (`.bench-logs/night3-20261010-210854`). It took 100 min instead of the planned ~4 h because the plan used the worst-case estimate. 20/20 samples are valid. 8 timed out at the 420 s cap, and those count as failures.
3. cf-r34b pass 2, 22:50–23:29: optiq retry2 r3 only, 5 more runs (`.bench-logs/night3-20261010-225023`). 10/10 samples are valid, and 1 timed out.

All three files share one harness and task hash, so this report pools them per profile. Earlier retry2 data ran on harness `98da309f03c1` and stays separate. The local `bench-frontier -- summary` on branch `bench/night3-results-20261010-225023` does not see pass 1's optiq file, which lives on `bench/night3-results-20261010-193512`. The pooled verdicts below come from the same `summarise()` code, run on all three files together.

## Results
k/n with the summary's 90 % one-sided Wilson bounds. Bar: 0.90 at r3 (p_cloud 1.0), 0.675 at r4 (p_cloud 3/4). Minimum 5 runs and 2 tasks.

| Profile | r3 | r4 | Frontier trusted / open |
|---|---|---|---|
| optiq (cf-r34 + cf-r34b, pooled) | 19/20 (0.85–0.99) not-yet | 4/10 (0.23–0.60) cloud | 0 / 3 |
| 8-bit (cf-r34b) | 9/10 (0.72–0.97) not-yet | 3/10 (0.15–0.50) cloud | 0 / 3 |

Optiq r3, per pass: 10/10, then 9/10. The single failure was `cf-r3-a` run 2, which timed out after 2 attempts (597 s). The 8-bit r3 failure was `cf-r3-b` run 1, a timeout. The 8-bit r4 failures were all timeouts (7/7: `cf-r4-a` 4, `cf-r4-b` 3). Optiq r4 (pass 1 only) failed `cf-r4-b` in all 5 runs: no changes 3, timeout 2, plus one `cf-r4-a` timeout.

## Verdict
r3 is not trusted on either profile. Optiq is close: 19/20 pass, but the lower bound of 0.85 is under the 0.90 bar. 20/20 would have cleared it. The 8-bit reaches 9/10 at r3 with a lower bound of 0.72, so it is further away. r4 breaks on both profiles, mostly on timeouts.

The cost ratio cannot be checked. These runs are local only, with no priced hybrid/control cells. BENCHMARKING.md requires a pooled hybrid/control median cost ratio ≤ 1.00 before a delegate verdict can be `trusted`, so even a frontier `trusted` at r3 would not by itself move the manifest `delegate` verdict.

## Limits
n = 20 (optiq) and 10 (8-bit) at r3, on two tasks. Timeouts at the 420 s cap explain most r4 failures and both r3 failures, so the cap affects the result as much as the model does. The cloud create-file arm still has n = 4 per rung.

## Decision
Keep create-file routing at r2 on both profiles. No manifest or models.json change follows. Next for optiq r3: 10 more runs (20 samples) on `6967c4bae943`. 39/40 clears the bar (LB 0.92); 38/40 does not (0.885). With only 5 more runs, 30/30 is needed, since 29/30 gives 0.895. Separately, price a hybrid/control cell so the cost rule can be checked. The 8-bit r3 needs about 15 more runs to reach 39/40.

## Reproduce
`mise run bench-frontier -- summary` with the three result files below in `bench/`. Queues: `reports/2026-10-10-cf-r34/cf-r34.queue`, `cf-r34-launcher`.

## Sources
`bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20261010-193539.json`, `bench/frontier-qwen3.6-35b-a3b-8bit-64g-retry2-20261010-210921.json`, `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20261010-225059.json`, [cf-r34-results-1.md](cf-r34-results-1.md), [cf-r34-results-2.md](cf-r34-results-2.md), [plan](plan.md), [cf-retry2](../2026-10-08-cf-retry2/report.md).
