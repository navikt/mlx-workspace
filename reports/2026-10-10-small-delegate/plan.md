# Small delegate: delegation on the O1 and T1 task types

The small-tasks queue ([plan](../2026-10-09-small-tasks/plan.md)) measured delegation only on
rungs 1-4 (R2, E1, M1, G2), because bench-hybrid's `tasks` rungs had no config change and no
test-only task. This PR adds rung 8 (O1, raise a nais memory limit) and rung 9 (T1, a JUnit test
for a class without one) to bench-hybrid. The verifier now applies O1's `expect_diff` and both
tasks' `only` checks, the same as bench-cheap-ops, so a hybrid pass means what a cheap-ops pass
means. A doc edit gets no new rung: rung 2 (E1, a KDoc comment) already covers it.

| Item | Queue | Runs | Cap | Decision it gates |
|---|---|---|---|---|
| 1 | `optiq.queue` | rungs 8 and 9, 4 control then 8 hybrid samples each, worker `qwen3.6-35b-a3b-optiq-64g` | $8 | Can `manifest/models.json` trust edit-single (O1) and create-file (T1) for delegation on optiq? A class qualifies when the hybrid arm passes as often as its control and dispatches at least once. |
| 2 | `8bit.queue` | the same hybrid samples on `qwen3.6-35b-a3b-8bit-64g`; controls are shared with item 1 | $6 | The same question for the 8-bit profile. |
| 3 | dropped | | | The ceiling probe (migration plus model plus repository) needs a new verified task. The closest existing one, D2 (row class, mapper and every call site), was retired after passing 1 of 54 attempts, so the ceiling is already known to sit below it. Writing and validating a new task needs its own PR. |

Both items only measure. Any manifest change is a separate release.

Both runs use the bench-only overlay
[`capabilities-bench-only-small.json`](../2026-10-09-small-tasks/capabilities-bench-only-small.json),
nav-pilot-main-2bcca023 with `local_dispatch = "aggressive"`, cloud claude-sonnet-5, and the new
tag `np-2bcca023-sonnet5-aggressive-smallops`, so every control is fresh. Each queue runs as its
own night-run-3 with its own ledger, so each cap holds on its own.

**Time.** In the small-tasks run, a hybrid step of 4 samples took 2-8 min, at about $0.12 per
sample. Item 1 is about 1.5 h and $3, item 2 about 1.2 h and $2. The launcher waits for
`.bench-logs/small-tasks.done` (ETA 01:30) and a free GPU, so it should finish by about 05:00.
That leaves 8 h of buffer before 13:00. No step starts at or after 13:00, and the launcher kills
its night-run-3 by PID at 14:00.

Run by `small-delegate-launcher` (BENCHMARKING.md «Waiting launchers»). Results go to
`optiq-results.md` and `8bit-results.md`, and a report with the decisions follows.

## Item 4: fill until 13:00

`fill-launcher` waits for `.bench-logs/small-delegate.done`, then runs `fill.queue`: cheap-ops
passes (all 13 tasks, O1 and T1 included) alternating optiq-64g and the 8-bit, one pass per step,
local only, $0 cloud. The 13:00 gate cuts what does not fit, and every finished step counts.
Decision: tighter intervals for the local small-task verdicts from the small-tasks queue.
