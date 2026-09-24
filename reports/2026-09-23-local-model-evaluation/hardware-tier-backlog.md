# Test backlog by machine memory tier

Written 2026-09-23. Everything measured today ran at `iogpu.wired_limit_mb` = 36 GB on an
M5 Max with 128 GB, emulating the 48 GB fleet. By decision, the fleet target stays at 36 GB wired
(48 GB machines) for now. This file lists what can only be settled on bigger machines, or with a
higher wired limit, so it isn't lost.

Ground rules for every tier:

- Record the chip and its memory bandwidth, not just the RAM. Decode speed is bandwidth-bound
  (about weights ÷ bandwidth), so a Pro chip and a Max chip at the same RAM behave very differently.
- Set the wired limit per the tier (`mise run vram-set <GB>`, needs sudo), and put it back to 36
  afterwards on a shared machine.
- Use nav-pilot's runtime (`bench-np-e2e`), not only the workspace server, since the two run different
  mlx-lm versions (0.31.3 vs 0.32.0).
- Sample the peak with the `footprint` log and grep `server.log` for `Insufficient Memory` on every
  run.

## Prerequisites (any tier)

- **`min_ram_gb` is not enforced** (PLAN.md:193, 204). `model-manifest` derives it as
  `wired_limit_gb + 12`. Per-tier entries only make sense once nav-pilot actually refuses or
  steers on it.
- **Dead generation thread.** Land the nav-pilot fix (`fix/local-server-dead-generation-thread`)
  first, otherwise a failed run on a bigger machine also hangs for 900 s instead of failing.
- **`--prefill-step-size`** is not in nav-pilot's `serverFlags` whitelist (runtime.go:1003-1011).
  Several tests below need it.

## 48 GB (fleet target, 36 GB wired): still open

These can run on the 128 GB machine at 36 GB wired, but a real 48 GB machine should confirm them:

| Test | Why |
|---|---|
| `qwen3.8-27b-8bit-mlx` at the new 32k cap: no OOM through nav-pilot, peak < 41 GB footprint | Validates the manifest hotfix |
| `qwen3.8-27b-4bit` at the new 64k cap, with a warm prompt cache | Same |
| nopin end-to-end through nav-pilot (12 sessions), classifier probe, reasoning_effort probe | Didn't run because of the OOM |
| Decode tok/s for nopin/8-bit on a **Pro** chip | Estimate is about 7 tok/s; is it usable at all? |
| Whole-system memory pressure with the Copilot CLI, an IDE and a browser open, measured by swap | 48 − 36 = 12 GB for everything else is tight |

## 64 GB (candidate wired limit about 48–52 GB)

Goal: decide whether the Qwen3.8 builds get a "64 GB+" manifest entry with its full context.

| Test | Pass condition | Notes |
|---|---|---|
| `qwen3.8-27b-8bit` (nopin params) at the full 65,536 context, cold and with a warm 2-entry prompt cache | No OOM, peak footprint ≤ wired − 2 GB | Estimated peak at 64k is ~45.5 GB, so the ceiling at 48 wired is marginal and 52 is likely OK |
| Same with `--prefill-step-size 512` | Peak drops by about 5 GB; record the prefill tok/s cost | Could make 64k fit 48 wired comfortably |
| `qwen3.8-27b-4bit` at 131,072 with a warm cache | No OOM | Estimated at ~51 GB |
| Cheap-ops ×5 for nopin on a 64 GB machine | Matches today's 31/40 | Checks that the pass rate isn't bandwidth-sensitive (timeouts at 420 s) |
| TTFT at 30k/60k, decode at 30k | Within PLAN.md §12 thresholds, or documented | Today on the M5 Max: 59.6 s TTFT and 13.8 tok/s at 30k |
| oMLX MTP (`Jundot/Qwen3.8-27B-oQ8e-mtp`) at 48–52 GB wired | oMLX's prefill guard accepts the model, and MTP speedup is measured against mlx-lm nopin | oMLX refused at 36 GB: weights > 90% of the cap |
| System One classifier next to the agent model on the same server | Classifier call p95 < 1.5 s, no prompt cache eviction of the agent prefix | Cache eviction effect unmeasured so far |
| `min_ram_gb` enforcement on a real 64 GB machine | nav-pilot offers 64 GB entries and hides or warns on smaller machines | Needs the prerequisite fix |

## 128 GB (wired up to about 96 GB)

Goal: exploration, and the upper-tier options. Nothing here blocks the 48 GB fleet.

| Test | Notes |
|---|---|
| oMLX MTP profiles (`qwen3.8-27b-8bit`, `-nocache`) at 96 GB wired: speed vs mlx-lm nopin | Parked 2026-09-23. Queue with `.mise/tasks/queue-omlx-benchmarks` after `vram-set 96` |
| Full-context runs (131k) for every Qwen3.8 build, with and without a prompt cache | Establishes the real memory curve instead of arithmetic |
| Qwen3.8-Flash-Next 125B MoE 4-bit (PLAN.md:358, deferred) | 111.5 GB of weights, so it needs about 118 GB wired on the 128 GB machine, and the mlx-vlm backend (`qwen4_exp`); quality and loop behaviour vs 27B dense |
| System One classifier as a **separate** small model beside the agent model | Removes cache eviction and shared-slot serialisation; needs two servers |
| Concurrency: two nav-pilot sessions against one server (the guard serializes) vs two servers | Only feasible with the memory headroom |
| Upper bound on cheap-ops with a raised 900 s timeout cap (D2 was retired for exceeding the budget) | Separates "too slow" from "can't do it" |

## Where results go

Append to `evaluation-log.md` (or a successor), recording the chip, RAM,
bandwidth, wired limit, mlx-lm version and nav-pilot commit on every row.
