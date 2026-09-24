# Pending tasks

Written 2026-09-24. These are what's left of the 2026-09-23 evaluation that can't be done right now.
Each one needs the machine on mains power (GPU) and/or a normal network. The order below is the
suggested order.

Before any GPU work:

- Use a nav-pilot binary built from current `main` of navikt/copilot, which now contains #931, #932,
  #933, #935, #936 and #937: `.bench-logs/bin/nav-pilot-main-d328ee68` (built at d328ee68), set as
  `BENCH_NAV_PILOT=$PWD/.bench-logs/bin/nav-pilot-main-d328ee68`. The resume commands and the rebuild
  command are in [qwen38-tuning.md §6](qwen38-tuning.md#6-resume). The older
  `nav-pilot-combined-915e27c6` ignores `MLX_PREFILL_STEP_SIZE`.
- Queue jobs with `BENCH_WAIT=1`, and never edit a `.mise/tasks/*` bash script in place while an
  instance is running or waiting (bash reads scripts by byte offset).
- Keep the 36 GB wired limit (`iogpu.wired_limit_mb` = 36864) that fits 48 GB machines.

## 1. Finish the OptiQ-4bit download (network)

`mlx-community/Qwen3.8-27B-OptiQ-4bit` stopped at 4.5 of 19.45 GB. It resumes where it stopped:

    HF_TOKEN=$(fnox get HF_TOKEN) nice -n 10 .venv/bin/hf download mlx-community/Qwen3.8-27B-OptiQ-4bit --max-workers 2

Don't use `taskpolicy -b`: it throttles the network as well, down to about 2 MB/s.

## 2. Qwen3.8 tuning sweep (GPU)

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

## 3. Sampling (temperature) comparison (GPU)

Local models run greedy today (temp 0): opencode sends no temperature, and Copilot CLI sends 0.
Draft PR navikt/copilot#934 lets the manifest set `MLX_NAV_PILOT_TEMPERATURE` / `MLX_NAV_PILOT_TOP_P`,
which the guard enforces.

- Compare temp 0 against 0.7 with top_p 0.8, on optiq and the tuned Qwen3.8 profiles:
  `bench-cheap-ops` ×3 per cell, comparing verified tasks and loop-guard trips.
- This needs a nav-pilot binary built from the #934 branch.
- Afterwards, set the values in the manifest (a PR to #20 or a new one), and mark #934 ready.

## 4. Update and merge the manifest (network, after 2–3)

- Update PR navikt/mlx-workspace#20 with the measured parameters (and a temperature, if task 3
  gives one), mark it ready and merge it. Merging publishes to every nav-pilot user.
- Merge PR navikt/mlx-workspace#21 (this evaluation: harness fixes, tasks, reports, PLAN.md
  corrections).

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

- The worktree `/Users/hans/mlx-workspace-hotfix` (PR #20), once #20 is merged.
- The worktree `copilot-e2e` and its local branch `test/e2e-combined`: a test build, which can go
  once the sweep uses a binary from main.
- The local tag `archive/system-one-classifier` in the copilot repo: delete it once nobody needs
  the classifier code anymore.
- `~/.copilot/session-state/*/files/*-worktree`: git worktrees left by other agent sessions. #932
  stops them from inflating Copilot's context, but they still take up disk. It's the user's call.
- `~/.copilot/copilot-instructions.md` tells Copilot to prefix shell commands with `rtk`, which
  hides output in local cplt sessions ([decision.md](decision.md)). It's the user's call.
