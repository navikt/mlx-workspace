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

## 8. Follow-ups from the night of 24 September

Steps 1–4 of `night-run` are locked in ([qwen38-tuning.md](qwen38-tuning.md#night-24-sept-locked-in-so-far)).
The 8-bit entry moved to 48k / 4k / 3.25 GiB with a 512-token prefill step, and the 4-bit lost
"provisional". Still open:

- **Full e2e at 48k for the 8-bit.** Step 4 was `--latency-only`: no Copilot sessions ran at 48k.
  Put `bench-np-e2e` (full) with `qwen3.8-27b-8bit-nopin-c48k-ps512` at the front of the next night
  run. If it fails, the 8-bit goes back to 32k, which step 1 confirmed (37.28 GB, 10 of 10 launched
  sessions verified).
- **Old nav-pilot clients and 48k.** The local manifest has no minimum-version field
  (`minNavPilotVersion` exists only for agentpakker), and every client fetches the same file.
  Releases without navikt/copilot#936 (`2026.09.24-105710-a078525` and older) accept
  `MLX_PREFILL_STEP_SIZE`, since it is in the `MLX_` namespace, but only as an inert environment
  variable, so they prefill 48k in 2048-token chunks (estimated 43.6–44.3 GB, qwen38-tuning.md §4).
  The expect text tells users to update. A real gate needs a nav-pilot change, and it would only
  protect releases built after it.
- **Network blips.** Three Copilot launches failed because nav-pilot could not clone `nais/pilot`
  (two R2 in step 1, one M1 in step 2: "Could not resolve host: github.com" and a connect
  timeout). navikt/copilot is getting a PR that falls back to the cached source (in progress).
  Until then a blip costs a session, and the e2e verdicts count it as a path error.
- **The #939 loop hook inside cplt: unverified.** The hook keeps its state in
  `~/.nav-pilot/hook-state/`. Inside the cplt sandbox that directory may not be writable, and the
  hook fails open, so it would pass silently and do nothing. Also unverified: whether local sessions
  skip it, since that depends on what environment the hook process inherits. Tonight's M1 stop in
  step 2 came from nav-pilot's own local loop guard (8 identical `gradlew compileKotlin` calls with
  changing results), not from the hook.
- **rtk in Copilot's instructions.** The proposal to change `~/.copilot/copilot-instructions.md`
  (the `rtk` prefix hides output in local cplt sessions, §7) is still the user's call.
- **`~/.copilot/session-state` worktrees.** 27 GB in total, 6 `*-worktree` directories. The user
  deletes them.
- **Temperature and OptiQ-4bit.** Still pending: `night-run` steps 5–15 (OptiQ-4bit e2e, temp-0
  cheap-ops, cheap-ops for the 4-bit and OptiQ-4bit). Tasks 2 and 3 above stay open until then.
- **Refresh capabilities after tonight.** `mise run bench-capabilities && mise run model-manifest`
  once the night's JSON is on `main`, and a PR if the verdicts move.
- **opencode regression arm through nav-pilot.** Nothing re-measures delegate mode today: the
  one trusted cell (mechanical multi-file, 35/35) is from August, with Sonnet 4.6 and the old
  dispatch text, and #941 now generates a narrower text from the manifest. Before the next night
  run, one harness PR: a `BENCH_HYBRID_TAG` in `bench-hybrid`'s output stem (it would otherwise top
  up the August files), the policy file's sha256 and `opencode --version` in its preflight, and
  `_by_class.py` reading orchestrator, worker and policy hash from the file. Then a `hybrid` step
  kind in `night-run` and eight queue lines: rungs 3 and 6 on Ktor, rung 3 on frontend, rung 6 on
  Spring, both arms ×8, plus rungs 1, 2, 4 and 5 hybrid ×6. Pin `claude-sonnet-4.6` first, then
  repeat the four trusted-cell lines with the default GPT-6 Sol. Needs a nav-pilot binary at
  `7362715c` or later (the current `nav-pilot-main-f1507caa` predates #941). About 4 h and $13 per
  run. The exact steps are in [copilot mixed mode §3.2](../2026-09-24-copilot-mixed-mode/research.md#32-the-proposed-arm-hybrid-steps-in-the-night-run-driver).
- **What tonight cannot answer.** Real 48 GB hardware and Pro chips (task 5), a cloud reference
  arm for the same tasks, and a rerun of the delegation benchmark.
