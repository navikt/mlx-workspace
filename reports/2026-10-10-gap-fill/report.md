---
models: ["qwen3.6-35b-a3b-optiq"]
headline: "26/40"
verdict: "fail"
---

# create-file base vs retry2 on the same harness, 2026-10-10

## Question
Does base create-file on optiq reach retry2's 37/40 when the harness is the same? If it does, the harness fixes did the work and retry2 is optional complexity in navikt/copilot#1156. If base is clearly lower, retry2 stays.

## What shipped
Nothing. retry2 (navikt/copilot#1156) stays as it is. The manifest is unchanged (create-file `delegate: cloud`).

## Method
Profile `qwen3.6-35b-a3b-optiq`, variant base, create-file r1–r4, n = 10 per rung, run by `night-run-3` (`.bench-logs/night3-20261010-090040`) on 10 Oct, 09:01–10:54, $0 cloud. Harness `521cdea78914` (checkout ec8a627), tasks `cd8780d1d644`. retry2 ran on harness `98da309f03c1` (ca37518). Three commits change hashed files between the two: 1deb96c and 1af77c2 add the O1/T1 checks to `bench-cheap-ops`, and 48f20f9 adds an `MLX_TOOL_PARSER` default to `_profiles.py` that is empty by default. None of them touches create-file. Step 1 (the TS tasks) was skipped because the gh token lacks `read:packages`.

## Results
Pass rate with 95 % Wilson interval. The verdict comes from `bench-frontier -- summary`.

| Variant | r1 | r2 | r3 | r4 | Total |
|---|---|---|---|---|---|
| base | 9/10 (0.60–0.98) trusted | 6/10 (0.31–0.83) cloud | 7/10 (0.40–0.89) cloud | 4/10 (0.17–0.69) cloud | 26/40 (0.50–0.78) |
| retry2 (8 Oct) | 10/10 trusted | 10/10 trusted | 10/10 not-yet | 7/10 not-yet | 37/40 (0.80–0.97) |

Frontier (trusted / open): base 1 / 1 with first break at r2; retry2 2 / 4 with no break.

Base failures (14): the new test fails or does not run 7, no changes 3, file in the wrong path 2, timeout 2. All three retry2 failures were r4 timeouts. Mean time per sample was 159 s and output speed 32.9 tok/s. No samples were discarded.

## Verdict
On a harness that matches for create-file, retry2 adds 11/40, and the two intervals do not overlap. The gain is retry2's own: it retries the test and build failures that make up most of base's misses. The harness fixes lifted base from 19/40 (1 Oct) to 26/40, but that does not make base trusted beyond r1.

## Limits
n = 10 per rung, and the r1 difference (9/10 vs 10/10) is within noise. The two harness hashes differ, even though nothing that differs touches create-file. The cloud arm still has n = 4.

## Decision
Keep retry2 for local create-file (navikt/copilot#1156); the manifest is unchanged. Close the #183 Q2 item with "retry2 stays". Worth trying later: retry2 for other classes whose base failures are test failures, such as edit-single. Re-run the TS tasks once the gh token has `read:packages`.

## Reproduce
`mise run bench-frontier -- summary`; queue `reports/2026-10-10-gap-fill/gap-fill.queue`.

## Sources
`bench/frontier-qwen3.6-35b-a3b-optiq-base-20261010-090107.json`, [gap-fill-results.md](gap-fill-results.md), [plan](plan.md), [cf-retry2](../2026-10-08-cf-retry2/report.md).
