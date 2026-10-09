# Small tasks: cheap-ops with O1 and T1, and delegation on the small classes

The PR audit ([report](../2026-10-09-navikt-pr-audit/report.md)) found that about 42 % of human Nav
PRs are small and touch one module: single edits, config and deploy changes, version bumps by
hand, docs and test-only changes. #178 added cheap-ops tasks O1 (nais limits) and T1 (a JUnit
test). This queue measures how well the local models handle that work. GPU window: until Saturday 2026-10-10 14:00.

| Item | Steps | Runs | Decision it gates |
|---|---|---|---|
| 1 | 1-8 | cheap-ops, all 13 tasks, 4 passes each on `qwen3.6-35b-a3b-optiq` and `qwen3.6-35b-a3b-8bit-64g` at 48 GB wired | Which small task types each profile can do locally. Per task class: 4/4 or 3/4 counts as "can", 0-1/4 as "cannot", 2/4 waits for item 3. |
| 2 | 9-16 | bench-hybrid on target `tasks`, worker optiq, rungs 1-4 (R2 read-qa, E1 edit-single, M1 rename, G2 test file); each rung gets 2 control samples, then 4 hybrid samples, all on the same day | Whether `manifest/models.json` should trust these classes for delegation. A class qualifies when the hybrid arm passes as often as its control and dispatches at least once. This step only measures; any manifest change is a separate release. |
| 3 | 17-28 | 6 more cheap-ops passes per profile | Tightens item 1's intervals (up to 10 passes per task). Mostly decides the 2/4 cases. |

The cheap-ops sizing follows the 64 GB tier: two passes is the floor and gives a smoke result
only. Four passes give a per-task verdict, and up to ten give intervals tight enough to compare
the two profiles.

Item 2 uses the bench-only overlay `capabilities-bench-only-small.json`. It marks the four
classes as trusted inside the run's own manifest, under nav-pilot-main-2bcca023 with
`local_dispatch = "aggressive"`, cloud claude-sonnet-5, and a new tag, so every control is fresh.
The hard cloud cap is $10 (`FRONTIER_COST_CAP=10`), one ledger. Expected spend is about $5.
Item 2 has no rung for O1, T1, config-deploy or bumps: bench-hybrid's `tasks` rungs end at G2, so
these classes can only be measured locally (item 1). Adding rungs changes the harness and needs
its own PR.

**Time.** Item 1 takes about 3.7 h, item 2 about 1 h and item 3 about 5.5 h. Starting at about
20:30, the ETA is about 07:30 Saturday. The launcher starts no step at or after 13:00 and kills
its night-run-3 by PID at 14:00.

Run by `small-tasks-launcher` (BENCHMARKING.md «Waiting launchers»). Results go to
`small-tasks-results.md`, and a report with the decisions follows.
