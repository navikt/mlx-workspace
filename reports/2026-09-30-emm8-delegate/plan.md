# 8-bit emm follow-up: delegate cost ratio and five more r4 runs

**Status: written, not armed by the repo.** [emm8-delegate-launcher](emm8-delegate-launcher) runs [emm8-delegate.queue](emm8-delegate.queue).

This is item 3 of the owner's decision in [the v2 ladders report](../2026-09-29-v2-ladders/report.md): go on only with edit-multi-mechanical (emm) on `qwen3.6-35b-a3b-8bit-64g`.

## The decision it gates

`bench-capabilities` applies the delegate bar to the overlay samples and reports them under `delegate_probe` (not shipped). The bar is:

- at least 5 dispatched runs over at least 2 tasks;
- a Wilson lower bound of at least 0.90 × p_cloud;
- a median hybrid/control cost ratio below 1 on at least one cell.

If `bar_verdict` reads `trusted` for emm on the 8-bit, the owner gives the 8-bit profile emm `delegate: trusted` in `manifest/models.json`.

- That is a release (BENCHMARKING.md, «models.json is a release»). The PR body must state the user impact, and a Fable review must check it before merge.
- The manifest is class-level, so the change covers r5–r6 too, where the local ladder has the 8-bit at 7–8/10.

If the tally is `cloud` or `not-yet`, nothing ships and emm on the 8-bit stops here too.

The five r4 runs answer a separate question. r4 has 10/10 and is `not-yet` only because the floor needs n = 15. With 10 more samples, r4 reaches trusted or drops.

## The queue

The run uses:

- the same binary (`nav-pilot-main-2bcca023`), level (`aggressive`), orchestrator (Sonnet 5) and overlay (`capabilities-bench-only-64-6c.json`) as the phase C requeue;
- a new tag, `np-2bcca023-sonnet5-aggressive-emm8`, so each control is fresh and from the same day as its hybrid arm. Pooling goes by dispatch policy, not by tag.

| Cell | Task | Arm | Samples | $ a sample | $ expected | Min expected / timeout |
|---|---|---|---|---|---|---|
| isoppfolgingstilfelle-large:5 | fm-r5-a | control | 2 | 0.14 | 0.28 | 5 / 30 |
| isoppfolgingstilfelle-large:5 | fm-r5-a | hybrid | 4 | 0.25 | 1.00 | 12 / 60 |
| isoppfolgingstilfelle-large:6 | fm-r6-a | control | 2 | 0.15 | 0.30 | 5 / 30 |
| isoppfolgingstilfelle-large:6 | fm-r6-a | hybrid | 4 | 0.27 | 1.08 | 14 / 60 |
| tasks:3 | M1 | control | 2 | 0.11 | 0.22 | 3 / 20 |
| tasks:3 | M1 | hybrid | 4 | 0.10 | 0.40 | 6 / 40 |
| tasks:6 | D2 | control | 2 | 0.34 | 0.68 | 5 / 30 |
| tasks:6 | D2 | hybrid | 4 | 0.20 | 0.80 | 12 / 60 |
| frontier emm r4, base | fm-r4-a, fm-r4-b | local | 5 runs × 2 | 0 | 0 | 46 / 92 |
| **Total** | | | **24 cloud + 10 local** | | **~$4.80** | **~110 min / 422 min** |

- **Costs:** the large-target figures come from 29–30 Sep, Sonnet 5 (controls $0.13–0.14, dispatched hybrid samples $0.21–0.26). M1 and D2 come from the August Sonnet 4.6 files.
- **Left out:** fm-r4-a already has a same-day pair from the requeue: 4 dispatched, ratio about 1.8. M2 dispatched 0 of 38 times, so it would add cost and no delegation.
- **Cloud:** about $4.80 expected. The hard cap is $8 on a new ledger (`FRONTIER_COST_CAP=8`), which leaves room for bench-hybrid's retries (up to 2n + 2 attempts a cell).
- **Hours:** about 2 h: 62 min of hybrid, 46 min of local and model loads. The worst case is the sum of the timeouts, 7 h, and the cap stops the cloud steps before that.

## Before it runs: gradle inside the sandbox

Since 29 Sep 15:11, `~/.config/cplt/config.toml` has not set `sandbox.allow_localhost_any`, and cplt's default is off. The harness grants only the model server's port (`_sandbox.py`). An agent's `./gradlew` therefore cannot reach its Gradle daemon, which listens on a random localhost port: "Could not connect to the Gradle daemon". `--no-daemon` fails the same way.

The transcripts show where the break falls:

| Window | Samples | Gradle calls that ran | Samples that hit the daemon error |
|---|---|---|---|
| 29 Sep 07:44–08:53 (validation) | 12 optiq create-file samples | 43 of 43 | none |
| From 29 Sep 18:00 | 40 optiq create-file samples | none | 28 |
| From 29 Sep 18:00 | 40 8-bit create-file samples | none | 29 |

It also skewed the requeue's large:4 hybrid samples. Each one tried gradle 2–3 times and failed, while the controls did not call it, so that 1.8 ratio is biased against delegation.

The launcher waits until `cplt config get sandbox.allow_localhost_any` prints `true`. The owner decides: `cplt config set sandbox.allow_localhost_any true`. A bench-only flag in `_sandbox.py` would also work, but it changes harness_sha.

## Arming it

The launcher is already armed from `~/tmp` (see the PR). By hand:

```
cp reports/2026-09-30-emm8-delegate/emm8-delegate-launcher ~/tmp/ && nohup bash ~/tmp/emm8-delegate-launcher >/dev/null 2>&1 &
```

The launcher logs to `.bench-logs/emm8-delegate.log`. Before it starts, it waits for all of these:

- `requeue-64-6c.done`;
- PRs #161 and #162 merged;
- cplt allowing localhost;
- 5 min of free GPU: no lock, no GPU job, nothing on :8080, AC, 48 GB wired and a 1-minute load below 6. The requeue lost 8 of its 10 steps to load 9–14.

Then it pulls main, checks the overlay and `bench/frontier/validated-*.json`, and runs night-run-3 `--part all`. When the queue has run, it touches `.bench-logs/emm8-delegate.done`.

Afterwards, `mise run bench-capabilities` prints the emm row for the 8-bit under "NOT SHIPPED overlay", and `emm8-delegate-results.md` holds the r4 cell.
