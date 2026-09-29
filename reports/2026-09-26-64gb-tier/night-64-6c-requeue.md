# Night 64-6 phase C requeue, under bench-only trust (#147)

**Status: written, not armed.** Nothing starts it. The GPU queue stays frozen until the user arms it.

On 29 September, phase C ([night-64-6c.md](night-64-6c.md)) lost ten of its twelve steps:

- Steps 2 and 4 failed with "gate was not armed". The shipped 8-bit block trusts no class, so `local_dispatch = aggressive` never arms the gate.
- Steps 1 and 6–12 failed with load average 8.2–17.6, above the ceiling of 8.

Steps 3 and 5 are valid controls and are reused.

## What changed (#147, option 1)

- **Overlay:** [capabilities-bench-only-64-6c.json](capabilities-bench-only-64-6c.json) trusts `edit-multi-mechanical`, `create-file` and `edit-single` for delegation. `BENCH_CAPABILITIES_OVERRIDE` loads it into the run's own manifest only. `_np_checks.manifest` refuses to write it into nav-pilot's cache, and `manifest/models.json` does not change.
- **Separate tally:** `bench-capabilities` counts samples that ran under an overlay in `delegate_probe`, marked `shipped: false`, with the verdict the delegate bar would give them. They never reach `models`, `manifest_blocks` or `unmeasured_block`, which are the only keys `model-manifest` copies. Controls that ran under an overlay stay out of `p_cloud`. The frontier reads `frontier-*.json` only, never hybrid files. The night report's hybrid table labels such a worker "bench-only overlay, not shipped".
- **Promotion stays manual:** when a class's `bar_verdict` reads `trusted` (≥ 5 dispatched runs over ≥ 2 tasks, LB ≥ 0.90 × p_cloud, cost ratio < 1 on one cell), the user decides whether to ship it.

Steps 2 and 4 are now valid, because the gate arms for the overlay's classes, and they resume their files. The one invalid sample in each file stays invalid and does not anchor the policy.

## The queue

[night-64-6c-requeue.queue](night-64-6c-requeue.queue) runs with the same tag (`np-2bcca023-sonnet5-aggressive`), binary, level and orchestrator (Sonnet 5), at 48 GB wired.

| Original step | Cell | Arm | Samples | $ a sample | $ expected | Min expected / timeout |
|---|---|---|---|---|---|---|
| 1 | isoppfolgingstilfelle-large:4 | control | 2 | 0.14 | 0.28 | 5 / 30 |
| 2 | isoppfolgingstilfelle-large:4 | hybrid | 4 | 0.16 | 0.64 | 10 / 60 |
| 4 | isoppfolgingstilfelle-large:5 | hybrid | 4 | 0.19 | 0.76 | 12 / 60 |
| 6 | isoppfolgingstilfelle-tests:1 | hybrid | 4 | 0.35 | 1.40 | 25 / 100 |
| 7 | isoppfolgingstilfelle-tests:2 | control | 2 | 0.25 | 0.50 | 5 / 30 |
| 8 | isoppfolgingstilfelle-tests:2 | hybrid | 4 | 0.35 | 1.40 | 25 / 100 |
| 9 | tasks:2 | control | 2 | 0.06 | 0.12 | 3 / 20 |
| 10 | tasks:2 | hybrid | 4 | 0.06 | 0.24 | 6 / 40 |
| 11 | frontend-familie-tilbake:2 | control | 2 | 0.06 | 0.12 | 3 / 20 |
| 12 | frontend-familie-tilbake:2 | hybrid | 4 | 0.06 | 0.24 | 6 / 40 |
| | **Total** | | **32** | | **~$5.70** | **~100 min / 500 min** |

The per-sample costs come from 29 September (controls $0.135 and $0.225, and the failed hybrid attempts $0.12 and $0.17) and from probe 6 (create-file $0.30–0.40, E1 $0.06).

- **Cloud:** about $5.70 expected. The hard cap is $8 on a new ledger, which leaves room for retries: bench-hybrid allows up to 2n + 2 attempts a cell.
- **Hours:** about 1.7 h expected, plus model load and the 5 min free-GPU wait. The worst case is the sum of the timeouts, 8.3 h, and the cap stops the run before that.

## Arming it (the user)

1. Merge #148 first: it holds the reused controls (steps 3 and 5) and the two step 2 and 4 files. The launcher refuses to start without the controls.
2. `cp reports/2026-09-26-64gb-tier/requeue-646c-launcher ~/tmp/ && nohup bash ~/tmp/requeue-646c-launcher >> .bench-logs/requeue-64-6c.log 2>&1 &`

The launcher then waits for a free GPU for 5 min: no queue lock, no GPU job and nothing on :8080. It also needs AC power, 48 GB wired and a 1-minute load below 6. It pulls main and runs night-run-3 `--part hybrid`. It writes `night-64-6c-requeue-results.md` and touches `.bench-logs/requeue-64-6c.done`.

Afterwards, `mise run bench-capabilities` prints the overlay rows under "NOT SHIPPED overlay". The shipped blocks come out the same as without them.
