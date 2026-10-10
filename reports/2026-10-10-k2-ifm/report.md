---
models: ["k2-horizon-mova-36b-a4b-4bit", "qwen3.6-35b-a3b-optiq"]
headline: "0/80"
verdict: "fail"
---

# K2-Horizon with the ifm tool parser, 2026-10-10

## Question
Does the ifm parser (#184) make K2-Horizon's tool calls parse? If it does, should K2 replace optiq, run next to it, or be rejected (rule in the [new-candidates plan](../2026-10-09-new-candidates/plan.md))?

## What shipped
Nothing.

## Method
Profile `k2-horizon-mova-36b-a4b-4bit` with `MLX_TOOL_PARSER=ifm`, a 48 GB wired limit, run by `night-run-3` (`.bench-logs/night3-20261010-105827`) on 10 Oct, 10:58–12:38, $0 cloud. Harness `6967c4bae943` (f07aed6), tasks `cd8780d1d644`. A one-request probe, then the standard set: create-file and edit-multi-mechanical, r1–r4, n = 10 each. Optiq figures come from the plan's references.

## Results
| Class | K2 | optiq base |
|---|---|---|
| create-file | 0/40 (0.00–0.09), cloud on all rungs | 19/40 (0.33–0.63); 26/40 on 10 Oct |
| edit-multi-mechanical | 0/40 (0.00–0.09), cloud on all rungs | 30/40 (0.60–0.86) |

Probe (`.bench-logs/k2-ifm-probe.json`): `finish_reason: tool_calls`, but the function name came back as `{"name":` and the real call ended up in `arguments.raw`. In the sessions, 981 of 1,319 tool calls (74 %) went to `invalid` (a tool that does not exist). Six edits were attempted. Failure kinds: create-file had no changes 36 and timeouts 4; edit-multi-mechanical had no changes 34, partial edits with call sites missed 5, and a timeout 1. Wall time per sample: create-file mean 96 s (median 34), edit-multi-mechanical mean 35 s (median 17), against 159 s for optiq create-file. Output speed was 15.7–16.9 tok/s, against 32.9 for optiq. Memory was not sampled on this run; the 9 Oct run measured about 27 GB. No samples were discarded.

## Verdict
The parser does not work: tool calls still do not parse reliably, and K2 changes nothing in 75 of 80 samples. The plan's rule says reject. The run says nothing about the model's ability apart from the parser.

## Limits
The optiq references come from older harnesses. The margin is so large that this cannot change the outcome. Memory was not measured.

## Decision
Reject K2-Horizon as a local candidate. Revisit only if `_ifm_parser.py` is fixed for the `{"name": ...}` JSON shape seen in the probe, with the probe as a unit test and as a gate in the launcher (no valid tool name, no standard set).

## Reproduce
`mise run bench-frontier -- summary`; `reports/2026-10-10-k2-ifm/k2-ifm-launcher`.

## Sources
`bench/frontier-k2-horizon-mova-36b-a4b-4bit-base-20261010-105856.json`, `bench/frontier-k2-horizon-mova-36b-a4b-4bit-base-20261010-120918.json`, [k2-ifm.md](k2-ifm.md), [new-candidates](../2026-10-09-new-candidates/report.md), #184.
