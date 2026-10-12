---
models: ["mellum2.1-12b-a2.5b-thinking-mxfp4", "muse-glimmer-30b-optiq-4bit", "nemotron-3.5-lightning-30b-a3b-optiq-4bit", "gemma-4-26b-a4b-qat-optiq-4bit"]
headline: "92/155"
verdict: "not-yet"
---

# Four new models on the quality frontier, 2026-10-11

## Question
Can any of four new local models match or beat optiq on the standard quality frontier: create-file (cf) and edit-multi-mechanical (fm), variant base, rungs r1–r4?

## What shipped
Nothing. The manifest and models.json are unchanged.

## Method
Each model first had to pass a tool-call probe. Then: two tasks per rung, 5 runs planned (10 samples per rung cell). Harness `855cba4e0fd0`, tasks `cd8780d1d644`. Success means `verified && valid`. LB is the one-sided 90 % Wilson lower bound (z = 1.2816), computed from the JSON samples.

Headline: 92/155 verified samples across the five JSONs (Nemotron 62/80, Gemma 27/40, Mellum 3/35). Muse-Glimmer has no samples.

## Results
k/n (raw Wilson LB).

| Model | cf r1 | cf r2 | cf r3 | cf r4 | fm r1 | fm r2 | fm r3 | fm r4 | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Mellum2.1 12B thinking | 2/10 (0.09) | 1/9 (0.03) | 0/8 | 0/8 | – | – | – | – | fail |
| Muse-Glimmer 30B | – | – | – | – | – | – | – | – | none |
| Nemotron 3.5 Lightning 30B | 8/10 (0.60) | 7/10 (0.50) | 10/10 (0.86) | 2/10 (0.09) | 8/10 (0.60) | 10/10 (0.86) | 10/10 (0.86) | 7/10 (0.50) | mixed |
| Gemma 4 26B QAT | 6/8 (0.52) | 8/8 (0.83) | 8/8 (0.83) | 0/8 | 2/2 | 2/2 | 0/2 | 1/2 | not-yet |

**Mellum: fail.** The owner stopped the run during cf at 35 of 40 samples, so there is no fm pass. Total 3/35 (LB 0.04). Of the 32 failures, 15 left a new test failing or not running, 15 made no changes, and 2 timed out.

**Muse-Glimmer: none.** It failed the tool-call probe. The probe got gpt-oss harmony text wrapping a function-call block as plain content, with `finish_reason: stop` and no `tool_calls`. It was not benched. This is a probe failure, not a quality result.

**Nemotron: mixed.** Both passes completed, 40/40 samples each. fm is strong: the summary's monotone verdicts are trusted at r1 (0.85) and r2 (0.92), not-yet at r3. cf collapses at r4, and 8 of its 13 failures are timeouts. fm failures are 3 compile errors and 2 missed file-name literals, with no timeouts.

**Gemma: not-yet.** cf hit the 280 min step timeout after run 4, so run 5 is missing (32/40, total 22/32, LB 0.58). The fm pass stopped after run 1, when the server crashed: three 420 s timeouts, then the server never came back on its port. That is infra, not a below-bar exit. The 8 fm samples are valid, but the r3/r4 fm cells are unreliable. An owner-approved Gemma fm rerun is running on 2026-10-11. Its results are in the [follow-up](gemma-followup.md).

## Optiq comparison
Descriptive only. No optiq JSON exists on harness `855cba4e0fd0`, so nothing is pooled. Optiq base cf was 9/10, 6/10, 7/10, 4/10 at r1–r4 (harness `521cdea78914`); fm was 7/10, 5/10, 10/10, 8/10 (`bench/frontier-qwen3.6-35b-a3b-optiq-base-20260930-102508.json`, harness `f7507f42e5f4`). Nemotron fm matches or beats that at r2–r4. Nemotron and Gemma cf match or beat it at r2–r3 but fall below at r4.

## Verdict
No new model replaces optiq yet. Nemotron is the only candidate with a full data set, and its cf r4 is too weak. The [Gemma follow-up](gemma-followup.md) keeps Gemma at not-yet.

## Limits
Two tasks per rung. Different harness from the optiq reference. Timeouts drive much of the cf result for Nemotron.

## Decision
Routing is unchanged. Drop Mellum and Muse-Glimmer. Keep Gemma at not-yet; the fm rerun has landed and the [Gemma follow-up](gemma-followup.md) gives the numbers.

## Sources
`bench/frontier-mellum2.1-12b-a2.5b-thinking-mxfp4-base-20261011-092657.json`, `bench/frontier-nemotron-3.5-lightning-30b-a3b-optiq-4bit-base-20261011-105741.json`, `bench/frontier-nemotron-3.5-lightning-30b-a3b-optiq-4bit-base-20261011-134827.json`, `bench/frontier-gemma-4-26b-a4b-qat-optiq-4bit-base-20261011-145520.json`, `bench/frontier-gemma-4-26b-a4b-qat-optiq-4bit-base-20261011-203328.json`, [Nemotron 1](nemotron-3.5-lightning-30b-a3b-optiq-4bit-results-1.md), [Nemotron 2](nemotron-3.5-lightning-30b-a3b-optiq-4bit-results-2.md), [Gemma 3](gemma-4-26b-a4b-qat-optiq-4bit-results-3.md), [Gemma 4](gemma-4-26b-a4b-qat-optiq-4bit-results-4.md), [Gemma follow-up](gemma-followup.md), [plan](plan.md).
