# Model status

Last updated 2026-10-09. Sources: the linked reports. Routine benchmarking has stopped, see
[BENCHMARKING.md](BENCHMARKING.md#when-we-benchmark).

## What runs locally today

- **optiq (`qwen3.6-35b-a3b-optiq`) is the default.** It is the only shipped System 1 (decide) model.
  Delegation is `trusted` for edit-multi-mechanical (35/35 verified). Everything else stays on cloud.
- **The 64 GB 8-bit (`qwen3.6-35b-a3b-8bit`) is a selectable model with no trusted delegate class.**
  Everything stays on cloud.

## Rejected

- **Kev 4B:** fails the memory criterion (how it is loaded) and the p >= 0.9 precision row (optiq fails that row too), and is
  weak on Norwegian. optiq stays the only System 1 model; the track is closed.
  [kev-english](reports/2026-09-30-kev-english/report.md)
- **Laya (421M, multilingual 322M):** 0.34-0.69 on the decide sets where optiq is 0.75-0.94.
  [kev-laya](reports/2026-09-29-kev-laya/report.md)
- **Qwen3.8 for the action check:** too slow, 0.5 s per call at p50 against 500 ms for three calls.
  The check stays log-only; optiq at 0.9 is the best setting measured, if the hook ever acts.
  [after-64-6](reports/2026-09-28-after-64-6/results.md)
- **create-file on both profiles:** trusted at no rung. The gap is model quality, not the harness.
  [create-file re-run](reports/2026-10-01-create-file-rerun/report.md)
- **Phase C (hybrid delegation on the 8-bit):** fails both rules; delegation costs 1.28x the control
  median. emm on the 8-bit is `not-yet` (13/13 passes on 13 of 20 dispatched, lower bound 0.888 against 0.90, cost about 2x cloud).
  [phase C](reports/2026-10-01-phase-c-rerun/report.md),
  [emm8 delegate](reports/2026-09-30-emm8-delegate/report.md)

- **K2-Horizon MoVA (36B-A4B 4-bit):** 0/40, no parseable tool calls. Revisit only with a parser fix.
  [new candidates](reports/2026-10-09-new-candidates/report.md)

The [navikt PR audit](reports/2026-10-09-navikt-pr-audit/report.md) de-prioritises create-file and
extends cheap-ops with O1 (one-file config change) and T1 (test-only unit test).

## What triggers the next run

- A new candidate model: the standard set of about 4 hours, "better than optiq?".
- A nav-pilot release that touches local mode: a short regression check.

The create-file retry2 run ([#169](https://github.com/navikt/mlx-workspace/pull/169)) is queued, its
report pending. It is the last routine run. Parked items: [reports/UNMEASURED.md](reports/UNMEASURED.md).
