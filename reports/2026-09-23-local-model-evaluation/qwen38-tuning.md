# Qwen3.8-27B on the 48 GB tier: tuning plan and partial results, 2026-09-24

Status: **partial.** The sweep stopped at 08:50 on 24 Sep (battery and network). Rows marked
PENDING have not been measured; the commands to finish them are in §6.

Same machine and runtime as [decision.md](decision.md): M5 Max 128 GB, `iogpu.wired_limit_mb` =
36864, nav-pilot's own server (mlx-lm 0.31.3, mlx 0.32.0). The runs in §5 used
`.bench-logs/bin/nav-pilot-combined-915e27c6`; the rest of the sweep must use
`.bench-logs/bin/nav-pilot-main-d328ee68`, built from navikt/copilot `main` at d328ee68 (#931,
#932, #933, #935, #936, #937). The old binary ignores `MLX_PREFILL_STEP_SIZE`: its `serverFlags`
whitelist has no entry for it, so a profile that sets it would run at the 2048 default without
saying so. `.bench-logs/` is git-ignored and exists only on that machine.

## 1. Goal and decision

The user's decision of 2026-09-24 replaces decision.md's items 2–5:

- `qwen3.6-35b-a3b-optiq` stays the only default.
- nav-pilot's manifest keeps offering **both** Qwen3.8-27B builds, the 8-bit and the 4-bit, on
  the 48 GB tier (36 GB wired), as opt-ins with parameters tuned for that tier.
- navikt/mlx-workspace#20 is re-scoped from "remove the 8-bit, cap the 4-bit" to "ship the tuned
  parameters" once this sweep settles them.

The goal of the sweep: for each build, the largest context window that (a) starts a Copilot CLI
session, (b) keeps the whole session in the prompt cache, and (c) stays under the memory limit
with margin. OptiQ-4bit (`mlx-community/Qwen3.8-27B-OptiQ-4bit`) is measured as a possible
replacement for the plain 4-bit.

## 2. Constraints

**Memory.** 36 GB wired; the pass criterion is a peak footprint under 41 GB
([hardware-tier-backlog.md](hardware-tier-backlog.md), 48 GB table). The 8-bit has already hit a
Metal OOM at about 51k tokens (43.8 GB) and survived 59k once at 46.31 GB, with prefill about 6×
slower past 40k ([decision.md §3.3](decision.md#33-the-oom), [nav-pilot-e2e.md](nav-pilot-e2e.md#8-bit-past-40k-on-this-tier)).

**Copilot's 80% gate.** Copilot CLI refuses to start when static context exceeds about 80% of
`COPILOT_PROVIDER_MAX_PROMPT_TOKENS` ([evaluation-log.md](evaluation-log.md), "Where the gate
is"). With navikt/copilot#932 static context is 21,709 tokens
(`bench/navpilot-e2e-20260923-140805.json`, scenario `a`). So the context must be at least
21,709 / 0.8 ≈ 27.1k. 24,576 was blocked at 87% and 28,672 started at 74% (evaluation-log.md,
gate table, measured with 21.4k static context).

**The cache-size rule.** `LRUPromptCache.insert_cache` adds the new entry, then evicts from the
LRU end while the total exceeds `max_bytes`
(`~/.nav-pilot/local/venv/lib/python3.12/site-packages/mlx_lm/models/cache.py:1696-1737`). An entry
larger than `--prompt-cache-bytes` therefore evicts itself as soon as it is stored. This hybrid
model's cache can't be trimmed to a shorter prefix (`can_trim_prompt_cache`, same file, `:88`,
used at `:1683` and `:1721`), so there is no partial hit either. The consequence: **the cache
must hold at least 64 KiB × the session's token count**, or every Copilot turn re-prefills from
zero. 64 KiB/token is the figure in `profiles/qwen3.8-27b-8bit-nopin-c40k-3g.toml` (notes).
Copilot's static context alone is 21.7k × 64 KiB ≈ 1.33 GiB, so a 1 GiB cache is out.

**Probe coverage.** The latency probe's largest target is `context − output`, rounded down to 1k
(`.mise/tasks/_np_checks.py:158-165`). A Copilot session can reach `context + output` (prompt up to
`COPILOT_PROVIDER_MAX_PROMPT_TOKENS`, then the reply), so the probe does not reach the worst case.
§4 lists both.

## 3. Knobs

Available through the manifest, `serverFlags` in navikt/copilot
`cli/nav-pilot/internal/local/runtime.go:1002-1013` on `main`: `MLX_TEMP` (`--temp`), `MLX_TOP_P`,
`MLX_TOP_K`, `MLX_MIN_P`, `MLX_MAX_TOKENS`, `MLX_CACHE_SIZE` (`--prompt-cache-size`),
`MLX_CACHE_BYTES` (`--prompt-cache-bytes`), `MLX_CHAT_TEMPLATE_ARGS`, and since #936 (baf72f2c)
`MLX_PREFILL_STEP_SIZE` (`--prefill-step-size`, a whole number from 1 to 16,384, checked when the
manifest is parsed). Context and output (`MLX_OPENCODE_CONTEXT`, `MLX_OPENCODE_OUTPUT`) are
enforced by the client, not the server.

`--prefill-step-size` is the main fix for the score-matrix transient: mlx 0.32.0 has no fused
attention for head_dim 256, so each 2048-token chunk materialises about 5 GB of scores at 51k
([evaluation-log.md](evaluation-log.md), "Root cause"). The transient scales with the step, so 512
cuts it by 4× and 1024 by 2× (§4, prefill-step variants).

Not available (not in the whitelist): `--decode-concurrency`, `--prompt-concurrency`.

**Temperature.** `MLX_TEMP` is whitelisted but no profile sets it (all five in §4 lack it), and
mlx-lm's `--temp` defaults to 0.0 (`mlx_lm/server.py:1818-1821` in nav-pilot's venv). Unless the
client sends a temperature, every request is greedy. That applies to the default optiq model as
well.

## 4. The pruned grid

Peak estimate = weights + KV (64 KiB/token) + prompt cache + score transient (5 GB × tokens / 51k)
+ 1 GB overhead + 1.6 GB calibration. The 1.6 GB brings the formula up to the 46.31 GB measured
at 59,210 tokens (`bench/navpilot-e2e-20260923-140805.json`, `e-crash`). Weights 29.5 GB for the
8-bit (evaluation-log.md, "Risks"). These are arithmetic, not measurements.

| Profile | Context / output / cache | Window in cache (GiB), ctx / ctx+out | Gate (static / ctx) | Peak at ctx | Peak at ctx+out | Verdict |
|---|---|---|---|---|---|---|
| `qwen3.8-27b-8bit-nopin-c32k` | 32,768 / 4,096 / 2.25 GiB (was 2) | 2.0 / 2.25 | 66% | 39.6 GB | 40.3 GB | fits |
| `qwen3.8-27b-8bit-nopin-c40k` | 40,960 / 4,096 / 2 GiB | 2.5 / 2.75 | 53% | 40.9 GB | 41.6 GB | borderline; cache too small for a full window |
| `qwen3.8-27b-8bit-nopin-c40k-3g` | 40,960 / 4,096 / 3 GiB | 2.5 / 2.75 | 53% | 42.0 GB | 42.7 GB | borderline |
| `qwen3.8-27b-8bit-nopin-c48k` | 49,152 / 4,096 / 2 GiB | 3.0 / 3.25 | 44% | 42.3 GB | 43.0 GB | likely over; cache too small |
| `qwen3.8-27b-4bit-c64k-8g` | 65,536 / 8,192 / 8 GiB | 4.0 / 4.5 | 33% | ≈ 35 GB | | fits |
| `qwen3.8-27b-optiq-4bit` | 65,536 / 8,192 / 8 GiB | 4.0 / 4.5 | 33% | ≈ 37.5 GB | | fits |

The 4-bit estimate is not from the formula: it is the measured 39.0 GB at 60k with a 12 GiB cache
(`bench/np-e2e-qwen3.8-27b-4bit-20260923-155027.json`, `memory.peak_gb_by_phase.latency-60000`) minus the 4 GiB (4.3 GB) of cache
the new profile gives up. OptiQ adds its 2.5 GB of extra weights (18.5 GB vs 16 GB,
`profiles/qwen3.8-27b-optiq-4bit.toml` and `profiles/qwen3.8-27b-4bit-c64k-8g.toml`,
`model_vram_gb`).

Pruned: 1 GiB caches (below Copilot's static context, §2); 8-bit above 48k (OOM at 51k, 6×
prefill slowdown past 40k); the 4-bit at 131k and 12 GiB (≈ 51 GB with a warm cache,
evaluation-log.md exposure table).

**Prefill-step variants (new since #936).** The transient term is 5 GB × tokens / 51k at a
2048 step, and linear in the step, so a smaller step subtracts from the peak and changes nothing
else in the formula (weights, KV and cache stay as they are). A c48k variant also needs its cache
raised to 3.25 GiB (3489660928 bytes), since 53,248 tokens × 64 KiB is 3.25 GiB and the 2 GiB
cache evicts a full window (§2).

| Variant | Tokens | Transient at 2048 / 1024 / 512 | Peak at 2048 / 1024 / 512 |
|---|---|---|---|
| c40k-3g, at ctx | 40,960 | 4.02 / 2.01 / 1.00 GB | 42.0 / 40.0 / 39.0 GB |
| c40k-3g, at ctx+out | 45,056 | 4.42 / 2.21 / 1.10 GB | 42.7 / 40.5 / 39.4 GB |
| c48k with a 3.25 GiB cache, at ctx | 49,152 | 4.82 / 2.41 / 1.20 GB | 43.6 / 41.2 / 40.0 GB |
| c48k with a 3.25 GiB cache, at ctx+out | 53,248 | 5.22 / 2.61 / 1.31 GB | 44.3 / 41.7 / 40.4 GB |

By this arithmetic, 1024 brings 40k under 41 GB and 512 is needed for 48k. Two variants to add:
`c40k-3g` with a 1024 step, and `c48k` with a 512 step and a 3.25 GiB cache. The cost is not in the
formula: a smaller step means 4× as many prefill chunks at 512, and how much that slows prefill
on this model is unmeasured. The latency probe measures it, and it matters because the 30k cold
TTFT (66 s) is already over the 30 s criterion.

Profiles: `profiles/qwen3.8-27b-8bit-nopin-{c32k,c40k,c48k,c40k-3g}.toml`,
`profiles/qwen3.8-27b-4bit-c64k-8g.toml`, `profiles/qwen3.8-27b-optiq-4bit.toml`.

## 5. Measured so far

Cold probes, 256 output tokens. Warm = the same prompt plus a follow-up.

| Profile | 2k cold TTFT / decode | 30k cold TTFT / decode | 30k warm TTFT (cached) / decode | Largest target | Peak | Source |
|---|---|---|---|---|---|---|
| 8-bit c48k, 2 GiB | 4.68 s / 15.2 tok/s | 66.03 s / 13.6 tok/s | 0.70 s (29,069 cached) / 14.9 tok/s | 45k: **not reached** | 37.60 GB through the 30k probe only | `bench/np-e2e-qwen3.8-27b-8bit-nopin-c48k-20260924-084632.json`; peak from `.bench-logs/np-e2e-qwen3.8-27b-8bit-nopin-c48k-20260924-084632.footprint` (max of 96 samples) |
| 8-bit c40k-3g | PENDING | PENDING | PENDING | 36k: PENDING | PENDING | the run was stopped during its first probe; its header-only JSON was discarded |
| 4-bit c64k-8g | PENDING | PENDING | PENDING | 57k: PENDING | PENDING | |
| OptiQ-4bit | PENDING | PENDING | PENDING | 57k: PENDING | PENDING | weights not downloaded (`.bench-logs/download-optiq-qwen38.log`, exit 143) |
| 8-bit c32k | PENDING | PENDING | PENDING | 28k: PENDING | PENDING | |

Earlier, for reference:

| Profile | 2k | 30k | 60k | Peak | Source |
|---|---|---|---|---|---|
| 4-bit at 65,536, 12 GiB cache | 2.5 s / 30.1 tok/s | 47.0 s / 25.1 tok/s | 109 s / 22.2 tok/s | 39.0 GB at 60k | `bench/np-e2e-qwen3.8-27b-4bit-20260923-155027.json` (`memory.peak_gb`) |
| 8-bit nopin, 4 GiB cache | 4.3 s / 14.8 tok/s | 59.6 s / 13.8 tok/s | OOM | 43.8 GB | `bench/np-e2e-qwen3.8-27b-8bit-nopin-20260923-112533.json`, decision.md §3.1 |
| 8-bit at 32k | | | | 37.23 GB | `bench/np-e2e-qwen3.8-27b-8bit-nopin-20260923-123952.json` (decision.md §3.3) |

What the c48k point says so far:

- The warm hit works: 29,069 tokens came from the cache, TTFT 66 s → 0.7 s. The 30k session is
  1.8 GiB of KV and fits the 2 GiB cache, as the cache-size rule predicts.
- 30k cold TTFT was 66 s against 59.6 s for the base nopin (4 GiB cache) the day before. Both are
  over the 30 s criterion (decision.md §5).
- The formula predicts 39.0 GB at 29k tokens; the sampler saw 37.6 GB. The estimates in §4 are
  about 1.4 GB conservative at that size.

## 6. Resume

In order. `BENCH_WAIT=1` queues each run behind the bench lock. This is
`.bench-logs/qwen38-tuning-queue.sh` with the c48k rerun and the prefill-step variants added, and
with the binary built from `main` (see the top of this file). To rebuild it after `main` moves:
`cd ~/go/src/github.com/navikt/copilot && git switch main && git pull && cd cli/nav-pilot && go build -o /Users/hans/mlx-workspace/.bench-logs/bin/nav-pilot-main-$(git rev-parse --short=8 HEAD) .`

```sh
cd /Users/hans/mlx-workspace
mise run model-download qwen3.8-27b-optiq-4bit      # 4.5 of 19.45 GB done; needs network
export BENCH_WAIT=1 BENCH_NAV_PILOT=$PWD/.bench-logs/bin/nav-pilot-main-d328ee68
# Prefill-step variants (§4): copy the profile and add one line (and, for c48k, the larger cache).
# Fix [meta] name/notes in both before committing them.
mise run bench-np-e2e -- qwen3.8-27b-8bit-nopin-c48k --latency-only
mise run bench-np-e2e -- qwen3.8-27b-8bit-nopin-c40k-3g --latency-only
# variant profiles are committed (profiles/*-ps1024.toml, *-ps512.toml)
mise run bench-np-e2e -- qwen3.8-27b-8bit-nopin-c40k-3g-ps1024 --latency-only
mise run bench-np-e2e -- qwen3.8-27b-8bit-nopin-c48k-ps512 --latency-only
mise run bench-np-e2e -- qwen3.8-27b-4bit-c64k-8g
mise run bench-np-e2e -- qwen3.8-27b-optiq-4bit
mise run bench-np-e2e -- qwen3.8-27b-8bit-nopin-c32k
```

Check the server log of the first variant run for `--prefill-step-size` in the launch command
before trusting its numbers.

Then cheap-ops quality for the winners: two runs each, three for OptiQ, which has no quality
data at all. Repeating a profile on the command line repeats the run:

```sh
BENCH_WAIT=1 mise run bench-models -- <8-bit winner> <8-bit winner> \
  qwen3.8-27b-4bit-c64k-8g qwen3.8-27b-4bit-c64k-8g \
  qwen3.8-27b-optiq-4bit qwen3.8-27b-optiq-4bit qwen3.8-27b-optiq-4bit
```

Then update #20's manifest entries with the chosen parameters.

**Queue-script bug:** `run()` in `.bench-logs/qwen38-tuning-queue.sh` logs `exit $?` after a
`$(date +%T)` substitution, so it always logs `exit 0`. The interrupted c48k run logged `exit 0`
directly under `[bench-np-e2e] ERROR task failed` (`.bench-logs/qwen38-tuning-queue.log`). Save
the status first (`rc=$?`) before relying on the log.

## 7. Provisional parameters

| Build | Context | Output | Prompt cache | Status |
|---|---|---|---|---|
| 8-bit (`mlx-community/Qwen3.8-27B-8bit`) | 32,768 | 4,096 | 2.25 GiB (2415919104 bytes, 2 entries) | provisional: the only 8-bit point estimated under 41 GB at ctx+out; cache raised from 2 GiB (user decision 2026-09-24) so a full 32k+4k session stays cached |
| 4-bit (`mlx-community/Qwen3.8-27B-4bit`) | 65,536 | 8,192 | 8 GiB (3 entries) | provisional |
| OptiQ-4bit (`mlx-community/Qwen3.8-27B-OptiQ-4bit`) | 65,536 | 8,192 | 8 GiB (3 entries) | PENDING; not downloaded |

All three keep `enable_thinking: false`, top-p 0.95, top-k 20, min-p 0.0, and no `reasoning_effort`
pin (the profiles in §4).

Known limit of the 8-bit choice: a 32k session at its full 36,864 tokens (context + output) is
2.25 GiB, over the 2 GiB cache, so its entry evicts itself and the next turn prefills cold (about
66 s at 30k, §5). A cache of 2.25 GiB (2415919104) would cover it at an estimated +0.27 GB peak.

## 8. What would change these

- **8-bit c40k-3g peaks under 41 GB at 36k** with room for the 4k reply → 40k/3 GiB replaces 32k.
  c48k is only worth finishing if its 45k point comes in under 41 GB, which §4 does not expect.
- **8-bit c32k peaks over 41 GB, or OOMs** → the 8-bit is withdrawn from this tier again, as in
  decision.md item 2.
- **The OptiQ build matches or beats the plain 4-bit on cheap-ops** at a peak under 41 GB → it
  replaces the plain 4-bit entry (same parameters).
- **A prefill-step variant peaks under 41 GB at ctx+out** (nav-pilot whitelists
  `--prefill-step-size` since #936) → that context replaces 32k for the 8-bit, if its prefill
  slowdown is acceptable. The arithmetic in §4 says 1024 is enough at 40k and 512 at 48k.
- **Real 48 GB hardware** leaves less than the 12 GB this emulation assumes for everything else →
  every margin above shrinks (decision.md §5).
- **A default temperature** set in the manifest changes the quality numbers for every model,
  including the default; the cheap-ops runs should use whatever ships.

## 9. Sampling (temperature)

**Finding.** Every local session runs greedy. mlx-lm defaults `--temp` to 0.0 (§3). opencode
1.18.32 sends no temperature for a custom model, because nav-pilot's provider block leaves
`capabilities.temperature` false. The Copilot CLI (BYOK, 1.0.81) sends `"temperature": 0` and
`"top_p": 0.95` explicitly. `MLX_TEMP` only sets the server default, which a request's own value
overrides, so it would reach opencode and never Copilot. Greedy decoding makes repetition loops
more likely, and Qwen recommends about temp 0.7 / top_p 0.8 / top_k 20 for non-thinking mode.

**Mechanism.** navikt/copilot#934 (draft) adds `MLX_NAV_PILOT_TEMPERATURE` and
`MLX_NAV_PILOT_TOP_P`. When a profile sets them, nav-pilot's loop guard overwrites `temperature`
and `top_p` in each chat-completion request, so the value is the same for both clients. It ships
with no values set, so behaviour stays the same until this sweep picks some. The names are in the
`MLX_` namespace, so `.mise/tasks/model-manifest` (the `startswith("MLX_")` filter and
`PARAM_KEY`) publishes them without any change.

**Sweep plan.** Temp 0 against temp 0.7 with top_p 0.8, on the optiq default and the tuned
Qwen3.8 profiles from §7. Run `bench-cheap-ops` three times per cell and compare verified tasks
and loop-guard trips (runs of identical tool calls). The winner goes into the profiles and the
manifest; the "default temperature" point in §8 applies to every model, the default included.
