# New candidate: K2-Horizon MoVA 36B A4B, 2026-10-09

Trigger: a new candidate model (BENCHMARKING.md, «When we benchmark»).

## What was considered (last 4 weeks)

| Item | Verdict |
|---|---|
| **K2-Horizon-MoVA-36B-A4B-4bit** (mlx-community, 28 Sep) | **Run.** MoE, 4B active, 26.4 GB, same tier as optiq. Card: Terminal-Bench 2.1 58.6 against 44.9 for Qwen3.6-35B-A3B. Loads on our mlx-lm 0.31.3 through the repo's `k2_horizon.py`. |
| Xing4.0-29B-A4B-OptiQ-4bit (23 Sep, 20.6 GB) | Not now. Card: SWE-bench Verified 75. Needs the `mlx-optiq` package to register `xing4_0`; that is a new dependency in the live `.venv`. Separate PR once this run is done. |
| Qwen3.6-35B-A3B-DFlash2-4bit (speculative draft for optiq's base) | Not now. Needs a DFlash runtime that mlx-lm does not have; speed only, no quality decision. |
| GLM-5.3-Flash (204 GB), MiMo-V2.6-Flash (167 GB) | Too big for 48 GB wired. |
| Qwopus / TWIN-TURBO / uncensored merges | Community fine-tunes of models already measured; no coding claim to test. |

## Decision this run gates

Replace optiq, add K2-Horizon next to it, or reject it. Compared with optiq base on the same
harness (create-file from [create-file re-run](../2026-10-01-create-file-rerun/report.md):
19/40; emm r1–r4 from [v2 ladders](../2026-09-29-v2-ladders/report.md): 30/40).

- **Replace optiq** if K2-Horizon is at least 4/40 higher on both classes and no emm rung below
  optiq's. Follow-up before shipping: decide-set and Norwegian checks.
- **Add next to optiq** (selectable, bench verdict in the manifest) if it is at least 4/40 higher on
  one class and not 4/40 lower on the other.
- **Reject** otherwise, or if the validate step fails (tool calls do not parse).

## Standard set (defines the «about 4 hours» set for a new candidate)

`new-candidates.queue`: validate, then create-file r1–r4 and edit-multi-mechanical r1–r4,
variant `base`, 5 runs (10 samples a rung), timeouts as the v2 ladders on optiq. Expected about
4 h, local only, $0 cloud. Check before scoring: no sample contains "Could not connect to the
Gradle daemon".

## Run

`new-candidates-launcher` follows BENCHMARKING.md «Waiting launchers», waits for
`.bench-logs/cf-retry2.done`, pulls `main` once the GPU is free, and stops if the weights are
incomplete. Weights downloaded on 9 Oct. Results go to `new-candidates.md`.

## Arm
    cp reports/2026-10-09-new-candidates/new-candidates-launcher ~/tmp/ && nohup bash ~/tmp/new-candidates-launcher >/dev/null 2>&1 &
