---
models: ["qwen3.6-35b-a3b-optiq", "qwen3.6-35b-a3b-8bit-64g"]
headline: "37/40"
verdict: "mixed"
---

# create-file with retry2, 2026-10-09

## Question
Does retry2 (shipped for local create-file in navikt/copilot#1156) lift create-file to `trusted` on optiq or the 8-bit? If it does not, #1156 should be reverted. If it does, does `manifest/models.json` change?

## What shipped
retry2 for local create-file, navikt/copilot#1156. The manifest is unchanged (create-file `delegate: cloud`).

## Method
Profiles `qwen3.6-35b-a3b-optiq` and `qwen3.6-35b-a3b-8bit-64g`, variant retry2, create-file r1–r4, 10 samples per rung. Run by `night-run-3` (`.bench-logs/night3-20261009-095038`) on 9 Oct, 09:51–14:35. Harness `98da309f03c1`, tasks `cd8780d1d644`, validated first (`bench/frontier/validated-cd8780d1d644.json`). Labels come from the Gradle tests in the task. Cloud reference: claude-sonnet-5, n = 4 per rung.

Two earlier attempts the same night were invalid and are not counted: JAVA_HOME pointed at a removed JDK (fixed in #173), and the offline Gradle cache was missing jars (fixed in #174 and #175).

## Results
Pass rate with 95 % Wilson interval. The verdict uses the summary's monotone lower bound against 0.90 × p_cloud.

| Profile | r1 | r2 | r3 | r4 | Total |
|---|---|---|---|---|---|
| optiq retry2 | 10/10 (0.72–1.00) trusted | 10/10 (0.72–1.00) trusted | 10/10 (0.72–1.00) not-yet | 7/10 (0.40–0.89) cloud | 37/40 (0.80–0.97) |
| 8-bit retry2 | 10/10 (0.72–1.00) trusted | 10/10 (0.72–1.00) trusted | 10/10 (0.72–1.00) not-yet | 5/10 (0.24–0.76) cloud | 35/40 (0.74–0.95) |

Frontier (trusted / open): 2 / 3 for both profiles. First break at r4. d at bar: 3.2 for optiq and 2.9 for the 8-bit.

Failures: all are timeouts at r4 (3 on optiq, 5 on the 8-bit). There are no build or test failures and no sessions without a file. Retries were used on passing samples 16 times on optiq and 6 times on the 8-bit. No samples were discarded.

Base on harness `9db581bed642` ([2026-10-01](../2026-10-01-create-file-rerun/report.md)): optiq 19/40 (0.33–0.63), 8-bit 24/40 (0.45–0.74). Trusted at no rung.

## Verdict
retry2 on the current harness makes create-file trusted locally at r1–r2 on both profiles. r3 is not ruled out, and r4 breaks on timeouts. The comparison with base mixes two causes, because the harness and tasks changed in between (JDK 21 via mise, java/21 task configs, bench-only cplt config, Gradle preflight). The run does not show how much of the gain comes from retry2 alone.

## Limits
- There is no base run on harness `98da309f03c1`, so the effect of retry2 alone is unknown.
- The cloud arm has n = 4, so p_cloud and the bar are imprecise.
- Only the local verdict was measured. Delegate on create-file is unmeasured.
- n = 10 per rung, so r3 needs more samples to reach trusted.

## Decision
Keep retry2 for local create-file (#1156): it is not worse on any reading, and it is trusted at r1–r2. `manifest/models.json` does not change. nav-pilot only routes on `delegate == trusted` (`DelegateTrusted()` in `capabilities.go`), and delegate is still `cloud`. No release. Next steps: a base create-file run on `98da309f03c1` to isolate retry2, and a delegate create-file run before any manifest promotion.

## Reproduce
`mise run bench-frontier -- summary --glob 'frontier-qwen3.6-35b-a3b-*-retry2-20261009-*.json'`

## Sources
- [bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20261009-095254.json](../../bench/frontier-qwen3.6-35b-a3b-optiq-retry2-20261009-095254.json)
- [bench/frontier-qwen3.6-35b-a3b-8bit-64g-retry2-20261009-123155.json](../../bench/frontier-qwen3.6-35b-a3b-8bit-64g-retry2-20261009-123155.json)
- [cf-retry2.md](cf-retry2.md), [2026-10-01 create-file rerun](../2026-10-01-create-file-rerun/report.md), navikt/copilot#1156
