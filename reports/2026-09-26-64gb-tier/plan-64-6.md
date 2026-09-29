# Night 64-6: the shipped 8-bit past 49k, and its capabilities

The shipped opt-in entry `qwen3.6-35b-a3b-8bit` (48 GB wired, 64k context, 16k reply, 6 GiB prompt cache) has two gaps:

- **Prompts past 49k are unmeasured.** Night 64-4 peaked at 46.18 GB at 49k, and 64k extrapolates to about 50 GB.
- **Its capabilities block is all `cloud`**, so the orchestrator is told to send it nothing.

This night closes the first gap and collects the evidence that `bench-capabilities` reads for the second.

## Start and finish (the user, with sudo)

Before phase A:

```sh
sudo sysctl iogpu.wired_limit_mb=53248
```

After phase A, when `.bench-logs/tier64-6a.done` appears (about 30 min in):

```sh
sudo sysctl iogpu.wired_limit_mb=49152
```

The launcher never changes the limit. It waits until it reads 53248 for phase A and 49152 for phases B and C. Check with `/usr/sbin/sysctl -n iogpu.wired_limit_mb`.

## Launcher

`tier64-6-launcher` goes to `~/tmp/` and runs from there. Each phase starts only after 5 minutes with no queue lock and no GPU job, on AC, with a healthy `.venv`. `V2_DONE=<marker>` also makes it wait for the v2 validation night's done file.

```sh
cp reports/2026-09-26-64gb-tier/tier64-6-launcher ~/tmp/ && \
  V2_DONE=<v2 night's done file> nohup ~/tmp/tier64-6-launcher >> .bench-logs/tier64-6.log 2>&1 &
```

The phases run as follows:
- **Phase A** pulls main, copies `night-run-3` and the queues to `.bench-logs/bin/`, and runs `night-64-6a.queue`.
- **Phase B** runs `night-64-6b.queue`. It starts at step 2 when phase A's 64k probe failed.
- **Phase C** runs `night-64-6c.queue`, but only if `~/tmp/tier64-6-hybrid.env` sets `HYB_NAV_PILOT` and `LEVEL`, and optionally `CLOUD`.

The launcher touches `.bench-logs/tier64-6.done` at the end.

## 1. Fit and TTFT at 52 GB wired (phase A, ~30 min)

`bench-np-e2e --latency-only` with `NP_LATENCY_TARGETS=2000,60000,64000`, a new override in `_np_checks.py`. On 64k/16k the profile-derived targets stop at 49k. Each target reports cold TTFT, warm TTFT (60k and 64k), decode speed and peak footprint.

| Step | Profile | Why |
|---|---|---|
| A1 | `qwen3.6-35b-a3b-8bit` (shipped, 6 GiB cache) | the configuration users get |
| A2 | `qwen3.6-35b-a3b-8bit-64g-w52` (12 GiB cache, bench-only) | labelled extra: the plan's original 52 GB profile, ~15 min |

- **Pass:** peak ≤ 50 GB (wired − 2).
- **What else is reported:** the 48 GB line (46 GB), and whether the entry needs `gpu_wired_limit_gb = 52` or a shorter context.

## 2. The 48 GB control (phase B step 1, ~15 min)

A1 runs again at 48 GB wired. It runs only if A1's 64k probe finished. This shows whether 52 GB is needed at all, or whether 48 GB holds a 64k prompt, possibly over the 46 GB line with no OOM.

## 3. Local-mode capabilities (phase B steps 2–6, ~2 h)

`bench-capabilities` reads two kinds of run: cheap-ops (local mode) and hybrid (delegate mode). It does not read frontier ladders. Optiq's local verdicts come from 9 cheap-ops passes.

- **Steps 2–5:** four `ops` passes on `qwen3.6-35b-a3b-8bit-64g`. Night 64-1 ran two passes on the same harness generation (d1229ad0e89f ≡ 492141135fe6), which makes six. That is past the five-run floor.
  - **The two passes so far:** read-qa 6/6, edit-single 4/4 and create-file 4/4 are all not-yet, and edit-multi-mechanical is 3/4, so cloud.
  - **Note:** the committed `manifest/capabilities.json` is stale and does not list the 8-bit yet.
- **Step 6:** create-file under `retry2` at rung 4, 4 runs. 64-2 and 64-5 stopped at rung 3. This is supporting evidence for the frontier, not a capabilities input.

## 4. Delegate-mode capabilities (phase C, ~1.5 h, cloud cap $12)

This phase takes the shape of optiq's `edit-multi-mechanical` delegate entry: 35/35 over two tasks, with a cost ratio below 1 on one codebase.
- **Cells:** per class, two tasks, with two controls and four hybrid samples per cell.
- **Worker:** the 8-bit at 48 GB wired, served by nav-pilot.
- **Orchestrator:** Sonnet 5, unless the env file sets `CLOUD`.

| Class | Cells (target:rung → task) | Why these |
|---|---|---|
| edit-multi-mechanical | isoppfolgingstilfelle-large:4 → fm-r4-a, :5 → fm-r5-a | r4 dispatched 2/2 at the enforcing levels in probe 6. r6 is skipped (the gate's blind spot) unless re-probe 7's call-site rule fixes it |
| create-file | isoppfolgingstilfelle-tests:1 → cf5-a, :2 → cf5-b | both dispatched at `aggressive` in probe 6 |
| edit-single | tasks:2, frontend-familie-tilbake:2 → E1 | E1 is the only edit-single task in the hybrid ladders, so this class can reach not-yet at most. It is here for its dispatch rate |

- **Dispatch:** Sonnet 5 dispatched 1 of 29 samples on advisory text alone, so this phase needs an enforcing `local_dispatch` level. Its binary and level come from dispatch re-probe 7. If re-probe 7 recommends no enforcing level, phase C stays skipped.
- **What counts:** these samples count toward `bench-capabilities` because they run without `BENCH_CAPABILITIES_OVERRIDE`. The worker's own all-`cloud` block is in the policy the orchestrator sees.
  - **Superseded (#147):** with nothing trusted, the gate never arms (steps 2 and 4). The requeue runs under a bench-only trust overlay, and its samples are tallied apart and never shipped: [night-64-6c-requeue.md](night-64-6c-requeue.md).
- **Cost:** about $7 at probe 6's per-sample costs, with a hard cap of $12 on one ledger.
- **Trusted needs** ≥ 5 dispatched samples over 2 tasks and a lower bound of ≥ 0.90 × p_cloud. It also needs a cost ratio below 1 on one cell, which probe 6 never saw (1.03–1.56×). So the likely outcome is not-yet or cloud, with measured counts instead of "no data".

## Afterwards

- `mise run bench-capabilities && mise run model-manifest`, then propose the 8-bit's block in a PR. The user decides whether it ships.
- The shipped entry's `notes` and `gpu_wired_limit_gb` follow from §1–2.
- Reports: `night-64-6a.md`, `night-64-6b.md` and `night-64-6c.md`, written by night-run-3, plus a Review section.
