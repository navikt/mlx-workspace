# Pending tasks

Written 2026-09-24. These are what's left of the 2026-09-23 evaluation that can't be done right now.
Each one needs the machine on mains power (GPU) and/or a normal network. The order below is the
suggested order.

## How to start tonight

Tasks 1–3 below are now one unattended run, `mise run night-run` (task 1, the download, is done
already). The queue, timeouts and failure handling are in [qwen38-tuning.md §6](qwen38-tuning.md#6-resume).

```sh
cd /Users/hans/mlx-workspace
# 1. plug in the charger
mise run night-preflight                 # every line PASS (a WARN is fine); fix any FAIL
nohup mise run night-run > .bench-logs/night.log 2>&1 &
```

In the morning, read `reports/2026-09-23-local-model-evaluation/night-2026-09-24.md`. It is
committed on a local branch `bench/night-results-<stamp>` (not pushed), together with tonight's
`bench/*.json`. `.bench-logs/night-<stamp>/steps.jsonl` has one line per step, with status
(OK / FAIL / TIMEOUT / SKIP), exit code, times and result file. To resume, run
`mise run night-run -- --from N`.

Before any GPU work (night-preflight checks all of this):

- Use a nav-pilot binary built from current `main` of navikt/copilot, which contains #931 to #937:
  `.bench-logs/bin/nav-pilot-main-f1507caa` (built at f1507caa, so it includes #934). night-run sets
  `BENCH_NAV_PILOT` to it. The rebuild command is in [qwen38-tuning.md §6](qwen38-tuning.md#6-resume).
  The older `nav-pilot-combined-915e27c6` ignores `MLX_PREFILL_STEP_SIZE`.
- Queue any manual jobs with `BENCH_WAIT=1`, and never edit a `.mise/tasks/*` bash script in place while an
  instance is running or waiting (bash reads scripts by byte offset).
- Keep the 36 GB wired limit (`iogpu.wired_limit_mb` = 36864) that fits 48 GB machines.

## 1. Finish the OptiQ-4bit download (network): done

Done 2026-09-24: `mlx-community/Qwen3.8-27B-OptiQ-4bit`, 5 shards, 20.3 GB, no `.incomplete` blobs
(`mise run night-preflight` checks it). A resume leaves the old partial `.incomplete` files behind
and starts new ones, so move the orphans out before retrying. Don't use `taskpolicy -b`: it throttles
the network as well, down to about 2 MB/s.

## 2. Qwen3.8 tuning sweep (GPU): night-run steps 1–5 and 11–15

Goal: confirm or replace the provisional parameters in PR navikt/mlx-workspace#20 (8-bit
32,768/4,096/2.25 GiB cache; 4-bit 65,536/8,192/8 GiB). Details and pass criteria are in
[qwen38-tuning.md](qwen38-tuning.md).

1. `bench-np-e2e` through nav-pilot, one run per profile:
   - `qwen3.8-27b-8bit-nopin-c32k` (full; 2.25 GiB cache)
   - `qwen3.8-27b-8bit-nopin-c40k-3g` (`--latency-only`)
   - `qwen3.8-27b-8bit-nopin-c48k` (`--latency-only`; its 30k point is already measured)
   - `qwen3.8-27b-4bit-c64k-8g` (full)
   - `qwen3.8-27b-optiq-4bit` (full; needs task 1)
2. **New since #936:** `MLX_PREFILL_STEP_SIZE` variants for the 8-bit (512 or 1024 at 40k/48k). A
   smaller prefill chunk shrinks the attention score transient, the part that caused the Metal OOM,
   and may make a larger context fit. The arithmetic and the two variant profiles (c40k-3g at 1024,
   c48k at 512 with a 3.25 GiB cache) are in [qwen38-tuning.md §4](qwen38-tuning.md#4-the-pruned-grid).
3. `bench-cheap-ops` for the winners: ×2 for the 8-bit and the 4-bit, ×3 for OptiQ-4bit.
4. Pass: no `Insufficient Memory`, peak footprint ≤ 41 GB with a warm cache at max context, and
   Copilot sessions verify ≥ 5/6.

## 3. Sampling (temperature) comparison (GPU): temp 0 is night-run steps 6–10

Local models run greedy today (temp 0): opencode sends no temperature, and Copilot CLI sends 0.
navikt/copilot#934 (merged 2026-09-24) lets the manifest set `MLX_NAV_PILOT_TEMPERATURE` /
`MLX_NAV_PILOT_TOP_P`, which the guard enforces. No manifest entry sets them yet, so behaviour is unchanged.

- Compare temp 0 against 0.7 with top_p 0.8, on optiq and the tuned Qwen3.8 profiles:
  `bench-cheap-ops` ×3 per cell, comparing verified tasks and loop-guard trips.
- First cell, tonight: temp 0 (`-t0` profiles) against the existing 0.6 runs. Every cheap-ops score
  so far was measured at 0.6, the workspace server's `MLX_TEMP` default, not at the greedy 0 users get.
  The report gives Fisher p-values against optiq 28/40 and 8-bit nopin 31/40.
- `nav-pilot-main-f1507caa` includes #934.
- Afterwards, set the values in the manifest in a new PR.

## 4. Update the manifest with measured values (network, after 2–3)

#20 (provisional tuned params) and #21 (this evaluation) were merged on 2026-09-24. Open a new PR
that replaces the provisional Qwen3.8 params with the measured ones (and sets a temperature if
task 3 gives one). Merging publishes to every nav-pilot user.

## 5. Verify on real hardware (needs other machines)

Everything so far was measured on an M5 Max with 128 GB at a 36 GB wired limit. The tier list is in
[hardware-tier-backlog.md](hardware-tier-backlog.md). The most important checks:

- a real 48 GB machine, preferably a Pro chip: decode speed and memory pressure with an IDE and
  browser open
- 64 GB: whether the 8-bit can run at full context with a higher wired limit

## 6. Parked (decided not now)

- The oMLX MTP profiles (`Jundot/Qwen3.8-27B-oQ8e-mtp`) need a 96 GB wired limit. They're parked by
  decision (stay at 36 GB).
- Qwen3.8-Flash-Next 125B MoE (mlx-vlm, about 118 GB wired): 128 GB tier only.

## 7. Cleanup when finished

- The worktree `copilot-e2e` and its local branch `test/e2e-combined`: a test build, which can go
  once the sweep uses a binary from main.
- The local tag `archive/system-one-classifier` in the copilot repo: delete it once nobody needs
  the classifier code anymore.
- `~/.copilot/session-state/*/files/*-worktree`: git worktrees left by other agent sessions. #932
  stops them from inflating Copilot's context, but they still take up disk. It's the user's call.
- `~/.copilot/copilot-instructions.md` tells Copilot to prefix shell commands with `rtk`, which
  hides output in local cplt sessions ([decision.md](decision.md)). It's the user's call.
