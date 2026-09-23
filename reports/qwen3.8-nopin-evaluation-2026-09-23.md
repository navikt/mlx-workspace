# Qwen3.8-27B 8-bit (nopin) as an optional nav-pilot model: evaluation log

Started 2026-09-23. This is a running log, updated as each benchmark completes.

**Hypothesis under test:** `qwen3.8-27b-8bit-nopin` (`mlx-community/Qwen3.8-27B-8bit` on mlx-lm,
without the `reasoning_effort` pin) is good enough to ship as an *optional*, non-default local
model in nav-pilot. The refutation criteria were set before any results came in (PLAN.md §12,
commit 3c10544).

## Corrections to the previous session's handoff

The session that ended on the morning of 2026-09-23 reported several things that did not hold:

| Claim | Reality |
|---|---|
| nopin scored "7/7" on 09-18 | 7/11: 7 passed, 1 timed out, 3 unscored ("needs a human") |
| A 6-run validation queue was running | It never started, and when started it failed every run in seconds: `assert_serving_profile` was a no-op stub defined after its caller (fixed in 9cc6ba3) |
| System One was "merged into navikt/copilot" | It was bundled into open PR #928 under an unrelated title. It was removed from there, fixed, and now lives on the unpushed branch `feat/local-system-one-loop-guard` (e72319e0) |
| `bench-results` validity key fix | The patch broke the script's schema handling (fixed in 41f4f95) |
| oMLX MTPLX speed comparison | Both oMLX profiles pointed at `mvid/Huihui-Qwen3.8-27B-abliterated-MTPLX-Q8`, a finetune with safety training removed. Repointed to `Jundot/Qwen3.8-27B-oQ8e-mtp`, published by the oMLX author (9c660c3) |

A baseline run of the current default, `results-qwen3.6-35b-a3b-optiq-20260902-081512-01.json`,
was served by 7 different models over the run and has to be excluded.

## Harness changes today

- `bench-models` can wait for a running queue with `BENCH_WAIT=1` instead of refusing (39658a1).
- `bench-np-e2e` runs a profile through nav-pilot's own guard, on nav-pilot's own runtime
  (mlx-lm 0.31.3), and measures memory footprint and latency (01d8070).

## Cheap-ops quality (bench-cheap-ops, 10 scored tasks; D2 is retired)

| Run | Passed | Failed | Median s/task |
|---|---|---|---|
| nopin 09-18 (old harness) | 7/11 | D2 timeout, 3 unscored | 149 |
| nopin 09-23 run 1 | 8/10 | R1 (1 of 4 terms), G2 (420 s timeout) | 145 |
| nopin 09-23 run 2 | 9/10 | R1 | 136 |
| nopin 09-23 run 3 | 6/10 | R1; M2, G2, D3 timed out at 420 s | 96 |
| nopin 09-23 run 4 | 8/10 | R1, D3 (timeout) | 115 |
| **nopin 09-23, n=4** | **mean 7.75/10 (31/40)** | R1 4/4; timeouts G2 ×2, D3 ×2, M2 ×1 | |
| optiq, re-measured on the same harness ×3 | pending | | |

The only clean optiq baseline so far (2026-09-03, older harness) scored 2, 3, 2 and 4 of 11.
It is not directly comparable, which is why optiq is being re-measured.

R1 has failed in every nopin run, so either the task or the model has a consistent problem.
Check it against the optiq re-runs.

## Risks known before measuring

- **Memory.** Weights are 29.5 GB. By arithmetic the peak at 60k context is 37–41 GB. The
  live server used 33.5 GB, which is already above the manifest's 36 GB wired limit.
- **Decode speed on smaller machines.** Decode speed is bound by memory bandwidth, and the
  model reads about 29.5 GB per token. A Pro-class chip (273 GB/s) caps at about 9 tok/s;
  a 48 GB Max-class chip (546 GB/s, like the M4 Max in the August study) at about 18 tok/s.
  Which machines Nav developers actually have decides this.
- **Manifest collision.** nav-pilot selects manifest entries by model id, and nopin shares its
  id with `qwen3.8-27b-8bit-mlx`. Shipping it means dropping that entry's
  `reasoning_effort` pin. mlx-lm reads `reasoning_effort` only through
  `chat_template_kwargs`, so the pin may already be a no-op.
- **All measurements are from one M5 Max with 128 GB.** No run happens on 48 GB hardware.

## Decision frame (user, 11:35)

Ship nopin as an optional model unless a major blocker turns up, backed by a head-to-head
comparison with the models already in the manifest. The manifest already offers
`qwen3.8-27b-8bit-mlx` (same weights, with the `reasoning_effort` pin, described as "the
quality build, weakest here"). So "shipping nopin" means updating that entry: dropping the
pin, rewriting its role, and possibly raising `min_ram_gb`. It does not mean adding a new model.

Blocker vs caveat: a failure through the nav-pilot path, an OOM, or classifier false
positives are blockers. Slow decode and high memory are caveats, to be documented in the
entry's role/requirements, since the model is opt-in.

Head-to-head set, same harness: optiq (default), qwen3.8-27b-4bit, qwen3.8-27b-8bit-mlx (pinned),
nopin. Cheap-ops ×3 each (nopin ×4), latency/memory probes for optiq, 4bit and nopin.

## Blocker found: Metal OOM at about 51k context (11:30)

Through nav-pilot's own server (mlx-lm 0.31.3, wired limit 36 GB set by nav-pilot), the 60k
latency probe died during prefill at about 51k tokens:

    RuntimeError: [METAL] Command buffer execution failed: Insufficient Memory
    (kIOGPUCommandBufferCallbackErrorOutOfMemory)   mlx_lm/generate.py:1161

- Peak process footprint was 43.8 GB, on an M5 Max with 128 GB. The limit comes from the
  wired/Metal budget, not physical RAM.
- The generation thread died, but HTTP stayed up. Every later request hung until the client's
  900 s timeout. nav-pilot did not notice. The end-to-end sessions would have hung for about
  3 hours, so the job was stopped at 11:45.
- **The already-shipped entry `qwen3.8-27b-8bit-mlx` serves the same weights with the same
  params**, and opencode declares a 65,536-token context. Users who select it today can hit
  this. It is a fleet bug regardless of the nopin decision. (Investigation running.)
- The classifier and reasoning_effort probes did not run (the probe script crashed on the
  timeout), and the end-to-end sessions did not run either. Both must be re-run after a fix.

Measured before the crash (nopin, M5 Max, nav-pilot runtime):

| Prompt | Cold TTFT | Decode | Criterion |
|---|---|---|---|
| 2k | 4.3 s | 14.8 tok/s | |
| 30k | 59.6 s | 13.8 tok/s | TTFT > 30 s: caveat |
| 60k | OOM | | blocker |

## Head-to-head: latency and memory (nav-pilot runtime, M5 Max, wired limit 36 GB)

| Model | Cold TTFT 2k / 30k / 60k | Warm TTFT 30k | Decode 30k | Peak footprint |
|---|---|---|---|---|
| optiq (default) | 1.0 / 11.1 / 33.8 s | 0.5 s | 58.6 tok/s | 34.3 GB |
| nopin | 4.3 / 59.6 s / **OOM** | not measured | 13.8 tok/s | 43.8 GB (crashed) |
| 4bit | queued | | | |

optiq passes all of its latency and memory criteria, even at 60k. nopin decodes 4.2× slower
and needs 5.4× longer to the first token at 30k.

## Queue

1. nopin cheap-ops runs 3–4
2. oMLX with MTP on the official build (`qwen3.8-27b-8bit`, `-nocache`): speed comparison
3. optiq cheap-ops ×3: re-measured baseline
4. `bench-np-e2e` nopin: end-to-end through nav-pilot, memory, latency, classifier probe
5. `bench-np-e2e` optiq, latency and memory only
6. cheap-ops ×3 for qwen3.8-27b-4bit and for qwen3.8-27b-8bit-mlx (pinned), interleaved
7. `bench-np-e2e` qwen3.8-27b-4bit, latency and memory only

Once the queue is done: System One integration and testing in real nav-pilot sessions.

## Results log

- 08:39 queue relaunched after the harness fix.
- 09:15 nopin run 1: 8/10.
- 09:58 nopin run 2: 9/10.
- 11:27 first probe: 2k cold TTFT 4.3 s, decode 14.8 tok/s, peak footprint 37.3 GB (at risk).
- 11:48 oMLX runs refused by oMLX's own prefill memory guard: 30 GB of weights already exceed 90% of the 36 GB Metal cap. Both oMLX profiles ask for `gpu_wired_limit_gb = 96`, and the machine is at 36 (model-use only recommends the change, and `vram-set` needs sudo). The oMLX numbers need a separate batch at 96 GB and are not relevant to a 48 GB fleet anyway.
- 11:47 optiq latency/memory done: every criterion passes (34.3 GB peak at 60k).
- 11:45 nopin e2e stopped: the server's generation thread died on a Metal OOM at about 51k tokens (see the blocker section).
- 11:35 head-to-head queued (4bit and pinned 8bit cheap-ops ×3, 4bit latency).
- 11:25 nopin run 4: 8/10. Across n=4 on the current harness: 31/40, range 6–9. Medians recomputed over the 10 scored tasks, excluding D2.
- 11:25 `bench-np-e2e` for nopin took the lock ahead of the oMLX and optiq queues (the waiters don't queue in order).
- 10:45 nopin run 3: 6/10. Three timeouts at the 420 s cap and no loops (longest identical run 1). Variance so far is 6–9/10, so timeouts are the main failure mode, not wrong answers.
