# create-file re-run with the sandbox fixed, 2026-10-01

## Question
Is create-file `trusted` at any rung on optiq or on the 64 GB 8-bit profile, now that the agent's Gradle calls reach the daemon inside the sandbox (#165)? This re-decides the stop rule in [BENCHMARKING.md](../../BENCHMARKING.md) («Queued runs») for create-file. A trusted rung would earn the profile more ladder time and a delegate cost-ratio run. No trusted rung stops create-file ladder work on that profile.

## What shipped
Nothing. `manifest/models.json` is unchanged.

## Method
- Models: `qwen3.6-35b-a3b-optiq` and `qwen3.6-35b-a3b-8bit-64g`, base variant, harness_sha `9db581bed642`. This is the #165 sandbox fix, so it is a new generation that does not pool with `f7507f42e5f4`.
- create-file r1–r4, 10 samples per rung per model, 30 Sep 20:34 to 1 Oct 01:35, $0 cloud.
- The bar is 0.90 × p_cloud on the one-sided 90 % Wilson lower bound, from `_frontier.py` via `mise run bench-frontier -- summary`.
- Check before scoring: none of the 80 samples contains "Could not connect to the Gradle daemon". In the invalid 30 Sep rows, 28/40 and 29/40 did.

## Results
k/n with a 95 % Wilson interval, and the frontier verdict (source: [cf-rerun.md](../2026-09-29-v2-ladders/cf-rerun.md)).

| Model | r1 | r2 | r3 | r4 | Frontier trusted / open | First break |
|---|---|---|---|---|---|---|
| optiq | 8/10 [.49, .94] not-yet | 3/10 [.11, .60] cloud | 7/10 [.40, .89] cloud | 1/10 [.02, .40] cloud | 0 / 1 | r2 |
| 8-bit | 7/10 [.40, .89] not-yet | 5/10 [.24, .76] cloud | 8/10 [.49, .94] cloud | 4/10 [.17, .69] cloud | 0 / 1 | r2 |

Totals: optiq 19/40, 8-bit 24/40. Failures by kind:

| Model | Timeout | No files written | Tests failed | Compilation error | Other |
|---|---|---|---|---|---|
| optiq | 9 | 6 | 4 | 2 | 0 |
| 8-bit | 7 | 0 | 4 | 5 | 0 |

No samples were discarded. The cloud arm (Sonnet 5) on this class has n = 4 per rung (2/4, 4/4, 4/4, 3/4), so p_cloud is itself loose.

## Verdict
create-file is trusted at no rung on either profile. Both models clear the bar's point estimate only at r1 (not-yet at n = 10), and both are ruled out from r2 on. With Gradle working, the 8-bit does better than in the invalid rows (24/40 against 12/40), but not enough to trust. The gap is model quality, not the harness: the tests now run, and the failures are timeouts, failing tests, code that does not compile and, on optiq, sessions that write no file.

## Limits
- n = 10 a rung. A trusted r1 needs about 20/20, and 7–8/10 points away from that.
- The cloud arm has n = 4, and v2 has no cloud re-run on this harness.
- Base variant only. `retry2` (shipped for local create-file in navikt/copilot#1156) was not re-run on harness `9db581bed642`.

## Decision
Stop rule applied (owner's 30 Sep decision, item 2): create-file is not trusted on either profile, so its ladder work stops on optiq and on the 8-bit. Gap analysis: model quality. The harness and task design check out: Gradle reaches its daemon, the tests run, and Sonnet 5 passes the same tasks. More create-file GPU time needs a new candidate model or a variant that changes the failure kinds above. Another base sample on these two profiles would not do that.

## Reproduce
`mise run bench-frontier -- summary` on this branch.

## Sources
- [cf-rerun.md](../2026-09-29-v2-ladders/cf-rerun.md) (night-run-3 results)
- [bench/frontier-qwen3.6-35b-a3b-optiq-base-20260930-203401.json](../../bench/frontier-qwen3.6-35b-a3b-optiq-base-20260930-203401.json)
- [bench/frontier-qwen3.6-35b-a3b-8bit-64g-base-20260930-230232.json](../../bench/frontier-qwen3.6-35b-a3b-8bit-64g-base-20260930-230232.json)
- [v2 ladders report](../2026-09-29-v2-ladders/report.md), #165, #166
