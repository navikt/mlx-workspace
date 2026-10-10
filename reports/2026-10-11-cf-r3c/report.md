---
models: ["qwen3.6-35b-a3b-optiq"]
headline: "36/40"
verdict: "not-yet"
---

# create-file retry2 r3, more optiq runs, 2026-10-11

## Question
Do 10 more optiq retry2 runs at create-file r3 on harness `6967c4bae943` lift the pooled lower bound over the 0.90 bar? The plan in [cf-r34](../2026-10-10-cf-r34/report.md) set the target: 39/40 clears the bar (LB 0.92), 38/40 does not.

## What shipped
Nothing. The manifest is unchanged (create-file `delegate: cloud`).

## Method
One `night-run-3` pass (cf-r3c), 10 Oct 23:48 to 11 Oct 01:15, 86 min: optiq retry2, rung r3 only, 10 runs on two tasks (`.bench-logs/night3-20261010-234830`). Harness `6967c4bae943`, tasks `cd8780d1d644`, $0 cloud, 420 s cap per attempt. All 20 samples are valid, with no stray processes and no harness errors. 3 samples timed out at the cap, and those count as failures.

This pass pools with the two earlier optiq r3 files on the same harness and task hash (19/20). The pooled verdict comes from `summarise()` in `bench-frontier`, run on copies of the three files.

## Results
k/n with the summary's 90 % one-sided Wilson bounds. Bar: 0.90 at r3 (p_cloud 1.0). Minimum 5 runs and 2 tasks.

| Profile | r3 this pass | r3 pooled | Frontier trusted / open |
|---|---|---|---|
| optiq retry2 | 17/20 | 36/40 (0.82–0.95) not-yet | 0 / 3 |

The three failures this pass were all timeouts: `cf-r3-b` runs 6 and 8, `cf-r3-a` run 7. The one earlier failure was also a timeout, so all 4 pooled failures are timeouts at the 420 s cap. Median time per sample at r3 is 191 s. The r4 cell is unchanged at 4/10 (cloud).

## Verdict
r3 is still not trusted on optiq. The pooled rate is exactly 0.90, so the rung is not ruled out, but the lower bound of 0.82 is well under the bar. The pass went backwards: 17/20 against 19/20 before. It did not reach the 39/40 target.

The cost ratio is still unchecked. These runs are local only, with no priced hybrid/control cells.

## Limits
n = 40 at r3, on two tasks. Every failure is a timeout, so the 420 s cap shapes the result as much as the model does. The cloud create-file arm still has n = 4 per rung.

## Decision
Keep create-file routing at r2. No manifest or models.json change follows. Do not price a hybrid/control cell yet: the quality bar is not met, so the cost rule cannot decide anything. More optiq r3 runs at the same cap are unlikely to help. Clearing 0.90 now needs 33 more samples in a row without a failure, against a 10 % failure rate so far. If r3 is revisited, the timeouts are the thing to test, not the sample count.

## Reproduce
`mise run bench-frontier -- summary` with the three result files below in `bench/`. Log: `.bench-logs/cf-r3c.log`.

## Sources
`bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20261010-193539.json`, `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20261010-225059.json`, `bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20261010-234858.json`, [cf-r3c-results-1.md](cf-r3c-results-1.md), [cf-r34](../2026-10-10-cf-r34/report.md).
