# v2 base ladders: plan

UNMEASURED's "v2 base ladders for optiq and the 64 GB 8-bit" row, mlx #144. Background:
[night-v2-validate.md](../2026-09-28-frontier-harness-v2/night-v2-validate.md) Review. Queue:
[v2-ladders.queue](v2-ladders.queue). Launcher: [v2-ladders-launcher](v2-ladders-launcher).

## Question

The v2 validation night ran optiq's create-file, edit-single, edit-multi-mechanical and read-qa
at n = 4 per rung under the new harness (`harness_sha` no longer `df7deb1af416`), because the v1
sessions never got a working JDK 21 in-session. create-file moved from 3/12 to 12/12 on rungs
1-3 (p < 0.001); debug and the edit classes moved within their intervals; read-qa (builds
nothing) did not move, as expected. The verdict: every create-file frontier verdict for a local
model from before v2 understates it, and the class needs its v2 base ladders re-run. This queue
does that for the classes v2 can move (create-file, edit-single, edit-multi-mechanical; debug
and read-qa are left for a later night, see Scope) on the model or profile set that feeds
shipped decisions.

## Scope

**Models:** `qwen3.6-35b-a3b-optiq` (the default, shipped) and `qwen3.6-35b-a3b-8bit-64g` (the
64 GB tier's shipped 8-bit, night-64-4/64-5) — the profiles that feed shipped routing decisions.
optiq has v1 history on all three classes. The 8-bit's v1 history
(`bench/frontier-qwen3.6-35b-a3b-8bit-64g-base-*.json`) covers edit-single (44 samples) and
edit-multi-mechanical (16), but no create-file — so this queue gives the 8-bit its first
create-file frontier run, not a correction of one. It stays in scope because the task calls for
full three-class coverage on optiq and the 8-bit specifically; the model that has no v1 ladder to
correct on *any* of the three, and no request to give it first coverage, is Qwen3.8 (below).

**Qwen3.8 left out.** `qwen3.8-27b-optiq-4bit` was tuned and passed `bench-cheap-ops`
(pending-tasks.md #2), but no `bench/frontier-qwen3.8-27b-optiq-4bit-*.json` exists at any
`harness_sha` — it has never had a base-ladder frontier run on any of the three classes.
UNMEASURED's row is about a correction (v1 understated what it did measure); giving Qwen3.8 its
first frontier run on every class is new coverage, not a correction, so it is a separate task and
stays out of this queue.

**Classes:** create-file (4 rungs), edit-single (5 rungs), edit-multi-mechanical (6 rungs) — the
three the validation night showed v2 can move, because they build
([design.md](../2026-09-25-quality-frontier/design.md) §1). debug and read-qa are left for a
later night: debug builds too (12 min/sample, 4 rungs) but the validation night's one rung
already moved within its interval at n = 4, so it is lower priority than a class still sitting on
v1 numbers across its whole ladder; read-qa does not move under v2 by construction (it builds
nothing) and has its own open item (the ANSWER-line variant, UNMEASURED).

## Method

- **`runs = 5`** on every rung: `bench-frontier`'s own `--runs` default, and exactly `MIN_RUNS`
  (`_frontier.py`) — the floor `rung_verdict` needs before a rung can read `trusted` or `not-yet`
  instead of stalling for lack of runs, given `k/n` already clears the bar. `USE_PER_RUNG = 2`
  tasks a rung is fixed by the task pool, so `runs = 5` gives n = 10 samples a rung in this one
  pass, enough for a real verdict without waiting to pool with a later night.
- **Full rung ranges**, not just the validation night's partial ones (create-file was 1-3 there;
  this queue runs 1-4), so every rung gets its own v2 numbers, not a mix of v2 and pre-v2.
- **A leading `validate` step**, matching `night-run-3`'s own default queue: it SKIPs in about a
  second when `bench/frontier/validated-17d0cf33d776.json` is already on disk (it is, generated
  2026-09-25, and valid for any `harness_sha` since it checks the reference solutions compile and
  their tests pass, not the harness), and rebuilds it otherwise so the queue is not tied to one
  checkout.
- **Order:** create-file for both models first (the class the validation night showed furthest
  off), then edit-single, then edit-multi-mechanical, both models before moving to the next
  class.

## n

| Class | Rungs | Tasks/rung | Runs | Samples/rung | Total (per model) |
|---|---|---|---|---|---|
| create-file | 1-4 | 2 | 5 | 10 | 40 |
| edit-single | 1-5 | 2 | 5 | 10 | 50 |
| edit-multi-mechanical | 1-6 | 2 | 5 | 10 | 60 |

150 samples a model, 300 total across optiq and the 8-bit, plus the validate step (no samples).

## Time and cost

`EST_MIN` and `MODEL_FACTOR` are both in `bench-frontier` (not `_frontier.py`): create-file 3.5
min/sample, edit-single 1.9, edit-multi-mechanical 2.3, scaled by `plan_minutes`
(`rungs × 2 tasks × EST_MIN × factor × runs`). `MODEL_FACTOR` has an entry for
`qwen3.6-35b-a3b-optiq` (1.0) but none for `qwen3.6-35b-a3b-8bit-64g`, so its lines fall back to
the default factor, 2.0 — a generic ceiling, not a measurement: the 8-bit's edit-single and
edit-multi-mechanical medians in earlier nights ran faster than optiq's own `EST_MIN`, so the
real run should finish well inside these numbers. Timeout is about 2× expected, this queue's
usual margin.

| Step | Rungs | Expected | Timeout |
|---|---|---|---|
| validate | – | 40 min (SKIP in ~1 s if already valid) | 60 min |
| create-file, optiq | 1-4 | 140 min | 280 min |
| create-file, 8-bit (factor 2.0) | 1-4 | 280 min | 560 min |
| edit-single, optiq | 1-5 | 95 min | 190 min |
| edit-single, 8-bit (factor 2.0) | 1-5 | 190 min | 380 min |
| edit-multi-mechanical, optiq | 1-6 | 138 min | 276 min |
| edit-multi-mechanical, 8-bit (factor 2.0) | 1-6 | 276 min | 552 min |
| **Total expected** | | **≈ 1,159 min (19.3 h)**, ≈ 18.6 h if validate SKIPs | |

Cost: $0. Everything is local, cached weights, no cloud arm in this queue.

## When it runs

`v2-ladders-launcher`, copied to `~/tmp/`, waits until both hold for 5 min straight:

1. `.bench-logs/kev-laya.done` exists, or the kev-laya launcher process (its report name is
   `kev-laya-launcher`; the running copy is `~/tmp/kl-launcher`) is gone for 30 min (it gave up
   on the uv cooldown, or was never started) — the last link before this one in the
   chain: 64-6 → after-64-6 → balctl → Kev/Laya → this queue. All four share the queue lock, so
   they cannot truly overlap even though this launcher only names Kev/Laya explicitly.
2. no queue lock, no benchmark, night, server, probe or Linux smoke process, on AC power, and
   `iogpu.wired_limit_mb = 49152` (48 GB) — the same GPU-free check `after-64-6-launcher` and
   `balctl-launcher` use.

It then pulls main, copies `night-run-3` to `.bench-logs/bin/night-run-3-v2lad`, runs
`v2-ladders.queue` with `NIGHT_REPORT=reports/2026-09-29-v2-ladders/v2-ladders.md`, and touches
`.bench-logs/v2-ladders.done`. Logs to `.bench-logs/v2-ladders.log`. Gives up 2026-10-13 06:00.
No command line in the script carries "bench-", "night", "np-serve" or "dispatch-probe"; those
strings are built from pieces, the same rule every launcher in this chain follows.

Start: `nohup bash ~/tmp/v2-ladders-launcher >> ~/mlx-workspace/.bench-logs/v2-ladders.log 2>&1 &`
Stop: `kill <pid on the first log line>`.

## Done means

`v2-ladders.md` here (the night report `night-run-3` writes), with every rung of create-file,
edit-single and edit-multi-mechanical on optiq and the 64 GB 8-bit carrying a v2 `harness_sha`
verdict, and a short review comparing each moved cell against its v1 number the way
night-v2-validate.md's Review did. UNMEASURED's row moves from "not built" to done, or to a
narrower follow-up if a class still needs more runs to clear its bar.
