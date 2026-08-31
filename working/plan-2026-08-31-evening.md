# What is left, 31 August 2026

Written after the alpha shipped. Everything in the shipping path is done: the release is in
brew, the news is published, the docs carry `ask` and the config keys, and four PRs merged
today. What follows is the work that is started and unfinished, or found and not yet acted on.

Ordered by what would be worst to leave.

## 1. A published claim we can no longer support

The news article and `alpha-model-decision.md` both say Qwen3.8-27B was held back because it
loops. That verdict was measured through **our own** chat template, which re-encoded tool
arguments with `tojson` — the one template in the whole comparison that differed from what
every other model got, and it differed silently. The confound is recorded in `MODELS.md` and
the decision report is caveated, but the *article* still asserts the rejection to readers.

Two attempts at the retest have failed for harness reasons, neither of them the model's
fault: the first switched the active profile without starting a server, so all eleven tasks
logged `turns=0`; the second called a `server-start` task that does not exist (it is
`server`).

**Do:** fix the runner, start a server actually loading Qwen3.8-27B-8bit, run the eleven-task
ladder, compare against the quarantined run. Then either lift the caveat or correct the
article. Half an hour, most of it weights loading.

**Until then:** the honest public position is "held back, reason under review", and the
article does not say that.

## 2. Field zeros mean three things and we report them as one

Two real users recorded sessions with zero dispatches. `RecordLocalSession` fires only when a
guard exists, so nav-pilot's side was wired — but that still leaves three worlds:

1. opencode never accepted the wiring (a plumbing failure downstream of us)
2. there was no dispatchable work in the session
3. the orchestrator saw the worker and declined

Only the third is the finding we want to read, and nothing currently separates them. The
disambiguator already passes through the guard and is thrown away: whether it forwarded
**any** request at all, model-list included. Traffic but no completions means opencode saw
the provider and declined. No traffic means the wiring never reached the client.

**Do:** add `SawTraffic()` to the guard and a `saw_traffic` attribute on `RecordLocalSession`.
One counter, one attribute, and every future zero becomes diagnostic instead of ambiguous.

**Until then:** no conclusion of the form "the orchestrator chose not to dispatch" belongs in
any report. With two devices it does not belong there anyway.

## 3. The scale ceiling result, and how nearly publishing it went wrong

Three valid runs, recovered after the first table turned out to be wrong twice over:

| | references / files | run 1 | run 2 | run 3 | passed |
|---|---|---|---|---|---|
| S1 | 18 / 9 | pass | fail | pass | 2 of 3 |
| S2 | 29 / 10 | fail | pass | fail | 1 of 3 |
| S3 | 108 / 35 | fail | pass | pass | 2 of 3 |
| S4 | 124 / 59 | pass | pass | pass | **3 of 3** |

**No ceiling up to 124 references across 59 files**, and the pass rate rises with size rather
than falling. The largest rename is the only one that works every time.

That is worth stating carefully, because at n=3 it is an observation and not an effect. The
plausible reading is that a 124-reference symbol is unambiguous and mechanical while an
18-reference one can be shadowed or ambiguous, and uncertainty reads as declining — but that
is a story, not a finding.

### What went wrong getting here, which matters more than the numbers

The first table said 3 of 3 for S3. It was wrong. The harness writes results to one canonical
filename per profile, and my repeat loop copied that file after each pass — so the copies
were off by one run, and the canonical file duplicated the last one. A reviewer caught two
identical files; recovering the third needed `bench/.previous/`, which is gitignored.

So the suite could quietly lose a run, and did, in a project whose README promises the runs
that went wrong are all in the repo. Fixed: `BENCH_RUN_TAG` makes each run write-once, and
the three runs are now tracked files rather than backups.

**Do before writing any section:** verify the tree really resets between tasks within a run
(the two small-task failures anti-correlate across runs, which is the signature of shared
state rather than independent chance), read the two failing transcripts — one declined after
2 tool calls, the other explored for 17 and still changed nothing, and those are not the same
behaviour — then rerun at n≥10, which is under an hour.

## 4. Instrumentation that has never worked

Fixed today, but the scope is worth stating plainly: **every delta counter nav-pilot has ever
emitted was silently dropped**, fleet-wide, not just for local inference. `command_total` has
one series in Mimir carrying no `device_id`. Counters are cumulative now and verified live.

**Do:** after a day of the new build being out, check that `command_total`,
`staleness_check_total`, `sync_updates_total` and `install_items_total` have live series with
device ids. If they do not, the fix is incomplete and the assumption that it was temporality
was wrong.

## 5. Templates are only safe behind a normalising server

Ten of eleven cached models break on tool arguments in the OpenAI wire format; only
`granite-4.1-8b` is clean. It does not affect our results, because mlx-lm normalises before
rendering and because the breakage is uniform. It does affect anyone pointing a different
runtime at these weights, which is exactly what issue #521 proposes for Linux.

**Do:** add the finding to #521 so whoever picks up Ollama support does not discover it the
hard way.

## 5b. A dashboard, and the aggregation today's fix invalidated

Filed as #531. Two halves.

There is telemetry and no way to look at it: no panel shows dispatches, ready time or server
events, and four devices have already reported. The panels worth having are the ones that
answer a question someone is asking, chief among them **the zero rate over time** — if it
stays at 100%, the feature is not earning its place, and that is what decides whether the
alpha widens.

The other half needs doing regardless. `dashboards/nav-pilot-cli.json` aggregates counters
with `sum_over_time` in eighteen places, which is the delta aggregation. Counters are
cumulative as of today, and summing a cumulative counter over a window means nothing. Those
panels showed nothing before because the data never arrived, so nobody noticed; once the new
build is out they will show data that is wrong rather than absent, which is worse. The other
two dashboards already use `increase()` and `rate()`.

## 5c. The harness cannot reliably switch models

Three attempts at the Qwen3.8 retest, three different harness faults, none of them the
model's: a profile switched without a server, a task name that does not exist, and
`omlx-server` serving `Qwen3.8-27B-MLX-6bit` while the profile said 8-bit. The third was
caught only because the runner now asks the server what it is serving and refuses to measure
a mismatch.

That guard should live in the harness rather than in a scratch script, because the failure it
catches is one we have already published a verdict from. Any result taken without it is a
result about an unknown model.

## 6. Smaller, and genuinely optional

- **Next.js target is not measurable** for compile-verified rungs: the repo has no typecheck
  script and bare `tsc` fails on an untouched tree. Suite-verified rungs work. Either give it
  a real compile command or use it only for test-verified tasks.
- **Eight review threads** from #483: `os.Rename` EXDEV, `startProcess` ignoring its context,
  a `slices.Clip` allocation, Tailwind-versus-Aksel tokens, two docs threads.
- **Dependabot**: 31 alerts, all npm in `apps/my-copilot`, none in the Go CLI. Filed as #523.
- **Linux support**: filed as #521, needs the requester's hardware before anything else.
- **The limits programme**: experiments 2 to 4 — decision-shaped tasks, long context, bigger
  models on this machine's 128 GB — are designed in `working/limits-benchmark-plan.md` and
  unstarted. Experiment 2 is the one that could weaken the report's spine, which is a reason
  to run it.

## The rule this list is built on

Nothing here is urgent because the alpha is out and working. The two items that matter are 1
and 2, and they matter for the same reason: **both are cases where we are telling people
something we cannot currently support.** One in a published article, one in how we read the
only field data we have.
