# What we are doing next

> **Living document.** The single tracker for outstanding work. Finished write-ups live in
> [`reports/`](reports/), the design behind individual experiments in [`working/`](working/).
> This file says what to do and why; it does not repeat their reasoning.

Last touched 31 August 2026, the day the alpha shipped.

**Landed since:** the delta-counter fix (#529) and the news figure (#524) are in main;
the Qwen3.8 correction (#532) is queued; and 30 of the 31 dependabot alerts were closed
by someone else (#525), so that stops being ours.

## Where things stand

The release is in brew, the news post is published, the docs carry the local-model section,
and the first field telemetry is arriving. Nothing below is urgent, which is exactly when the
wrong thing gets worked on — so it is ordered by what would be worst to leave.

## 1. Ambiguity we are still shipping

**Add `saw_traffic` to the guard.** Every session recorded before it exists is permanently
ambiguous, and it only reaches developers through a release plus their update lag, so the
clock on useful data starts late.

A session that dispatched nothing is one of three things and we currently report it as one:
opencode never accepted the wiring, there was no dispatchable work, or the orchestrator saw
the worker and declined. Only the third is a finding. The guard already sees the difference
and throws it away — whether it forwarded *any* request, model-list included. Traffic but no
completions means the client saw the provider and declined; no traffic means the wiring never
arrived.

One counter, one attribute on `RecordLocalSession`. Until it ships, no report says "the
orchestrator chose not to dispatch".

**Ask the two alpha users** whether their sessions had local work to hand off. One message,
and it separates "no dispatchable work" from the other two this week without waiting for a
release. Needs a person, not a script.

## 2. Telemetry that is fixed but unverified

Counters were exported delta and **every one was silently dropped, fleet-wide** — not just
local inference. Cumulative now, verified live: `nav_pilot_local_server_total` reached Mimir
within a minute of the change, for the first time.

- **Check the fleet counters came back** a day after the release: `command_total`,
  `staleness_check_total`, `sync_updates_total`, `install_items_total`, with device ids.
  Filter by `version` — old builds keep emitting delta until people update, and a mixed fleet
  reads as "the fix failed" when it has not.
- ~~Fix `dashboards/nav-pilot-cli.json`'s eighteen `sum_over_time` queries~~ — **wrong, and
  measured wrong.** Live data says `increase()` returns 0.0 on every one of those series while
  `sum_over_time` returns the real numbers, because a CLI process exports once and exits and
  `increase()` needs two samples in a window. Temporality was never what made those queries
  work. PR #536 closed; the existing queries stay. **The new dashboard must use
  `sum_over_time` too** — `copilot-ecosystem.json` uses `increase()` because it queries
  long-lived services, which nav-pilot is not.
  One real defect survives: the two `histogram_quantile` panels over `_bucket` series, where
  histograms were always cumulative and `sum_over_time` overcounts.
**The audit changed the shape of this section.** A reusable script now asks the
questions a panel cannot ask about itself — `scripts/telemetry-audit.py` in `navikt/copilot`
([#548](https://github.com/navikt/copilot/pull/548)) — and the first run found that **17 of 26
`nav_pilot_` metrics carry no `device_id` at all**, each collapsing to one series for the whole
fleet, while `nav_pilot_info` sees 266 distinct devices. Aggregate totals survive that;
per-device and per-version breakdowns, and `rate()`/`increase()`, do not. Four gauges are worse
than unattributed — `client_available`, `install_present`, `installed_items`, `up_to_date` are
last-write-wins across the fleet, so they read as fleet state and report whichever machine
exported last.

Ordered by what would be worst to leave:

- ~~**Opting out still shipped the repo name**~~ — [#549](https://github.com/navikt/copilot/pull/549).
  `DO_NOT_TRACK=1` gated only the device id; the collector endpoint, `COPILOT_OTEL_ENABLED=true`
  and `nav.repo` all went out anyway. An opted-out developer arrived as repo-labelled rows with
  no device id, indistinguishable from a lookup failure, so they could not be excluded after the
  fact either. Trust, not data quality, which is why it went first.
- **Add `device_id` to the nine instruments that keep it**, and **cut the two that do not earn
  their place**: `nav_pilot_command_total` is label-for-label identical to
  `nav_pilot_command_duration_ms_count` (same function, same `attrs` slice, one `Add` and one
  `Record`), and `nav_pilot_local_server_total` is redundant once #547 lands — same call site,
  same event, and its one stated purpose, catching `hung`, is unreachable because the call site
  passes `Status()` while only `Health(ctx)` produces that value. Decided with Hans: cut those
  two, keep `up_to_date` and `install_present` despite being derivable.
- **`launch_error_total` counts Ctrl-C as a launch failure.** Every `*exec.ExitError` maps to
  `launch_failed`, so the panel named "client launch failures" mostly shows normal session ends.
- **Three commands report as `command="unknown"`**: `alpha`, `update`, `auto_sync` are not in
  the allow-list and have no dot or hyphen to hit the escape hatch. Alpha adoption is invisible
  while we are running an alpha.
- **Sync's dry-run flag destroys its own `mode` label** — `"interactive_dry_run"` is not
  allow-listed, so it falls back to `"non_interactive"` and an interactive dry run is recorded
  as non-interactive.
- **`launch` and `startup` share a histogram with `nav-pilot list`.** They block for the whole
  session; default buckets top out at 10s, so both land in `+Inf` and any latency quantile is
  really session length.
- **Record ready time on the failure path too**, before the dashboard panel exists.
  `RecordLocalReadySeconds` fires only after `srv.Start` returns, so a start that times out
  or is interrupted records nothing and the slowest starts are missing from the histogram.
  A p95 off that panel is a p95 of the starts that worked. One `outcome` attribute fixes it
  and makes the same panel answer "how often does a start fail".
- **Then build the local-inference dashboard**, on a foundation known to be right.
  [#531](https://github.com/navikt/copilot/issues/531).

  Copy the house style from `navikt/copilot`'s `dashboards/nav-pilot-cli.json`: Grafana schema
  v2, `layout.kind = RowsLayout`, panels under `elements` keyed `panel-N`, and the variables
  every nav-pilot panel already filters on — `DS_METRICS`, `version`, `execution_context`.
  `copilot-ecosystem.json` is the one to copy *queries* from, because it already uses
  `increase()` and `rate()` rather than the delta aggregation.

  The metrics, all live in Mimir under `X-Scope-OrgID: nais`. **Mimir is only reachable from
  the Nav network**, so any of this that needs live data has to be done on the VPN — it
  fails as a bare connection error rather than an auth error, which reads like the service
  being down:

  | Metric | Panel it earns |
  |---|---|
  | `nav_pilot_local_dispatches` | dispatches per session as a distribution, never a mean |
  | `nav_pilot_local_dispatches` + `saw_traffic` | **the zero rate, split by whether the client saw the worker** |
  | `nav_pilot_local_ready_seconds` | time to ready, p50 and p95, replacing the docs' guess |
  | `nav_pilot_local_server_total` | server events by kind: `ready`, `hung`, `crashed` |
  | `count(count by (device_id) (...))` | how many people have this on at all |

  **The panel that matters is the zero rate over time**, now that `saw_traffic` can split it:
  zero-with-traffic is the orchestrator declining, zero-without is our wiring failing. If the
  first stays at 100%, the feature is not earning its place, and that is what decides whether
  the alpha widens. Before `saw_traffic` reaches people, that panel cannot tell the two apart,
  so build it to split from the start rather than retrofitting.

**Measured, and the docs were wrong.** Ten starts across six machines, all under 50 seconds,
six of them under ten. Six places said "the first start on a cold cache takes minutes", which
was also the stated reason `local_autostart` is off by default. Corrected in #546; autostart
stays off for the reason that survives, that a 21 GB process started unasked is a surprise.
Weights are downloaded by `init`, never by `start`, so no measurement here includes a download.

## 3. Measurements that are not finished

**Rerun the scale ladder at n≥10.** Three runs say the pass rate *rises* with size — 124
references across 59 files is the only rung that passes every time — which is the opposite of
what the experiment was built to find. Before writing that anywhere:

- verify the tree really resets between tasks within a run. The two small-task failures
  anti-correlate across runs, which is the signature of shared state rather than chance
- read the two failing transcripts. One declined after 2 tool calls; the other explored for 17
  and still changed nothing. Those are not the same behaviour

**Retest Qwen3.8-27B, but not by repeating the ladder blind.** Three attempts have failed for
three different harness reasons, the last because the server was serving the 6-bit build while
the profile said 8-bit. The published claim is specifically that it *loops*, so test that:
the two or three tasks that looped worst, corrected template, loop guard in observe-only mode
recording the longest identical run rather than aborting the turn. That separates "the model
loops" from "our guard fired", which a pass/fail ladder cannot.

Preconditions, both now met: the template passes all four shapes in
`mise run bench-template-check`, and the runner asserts the server's reported model matches
the profile before measuring.

## 4. Suite hygiene that compounds

- **Move the model-identity assertion into the harness.** It lives in a scratch script and it
  is the only reason we know a run was served the wrong model. A result taken without it is a
  result about an unknown model.
- **Convert the four `manual` tasks** to machine checks. A quarter of capability-ladder
  samples have never been judged and never will be; they already carry `expect_terms`.
- **Next.js target**: not measurable for compile-verified rungs, because the repo has no
  typecheck script and bare `tsc` fails on an untouched tree. Suite-verified rungs work.

## 5. Open questions worth an experiment

From [`working/limits-benchmark-plan.md`](working/limits-benchmark-plan.md), in the order they
would change a decision:

- **Decision-shaped tasks.** The report's spine — applies well, decides badly — rests on two
  task shapes that are *both* creation tasks. It is possible we measured "cannot create" and
  wrote down "cannot decide". This is the experiment that could weaken the central claim,
  which is a reason to run it rather than a reason not to.
- **Long context.** Every sample is a fresh session on a clean tree; real work is neither.
- **A bigger model.** This machine has 128 GB; the 48 GB ceiling was the alpha target's. The
  question is not whether a larger model is better but whether it moves the break-even.

## 6. Filed, owned elsewhere, not ours today

- [#521](https://github.com/navikt/copilot/issues/521) Linux support. Needs the requester's
  hardware first. **Add the template finding to it**: ten of eleven model templates break on
  tool arguments in the OpenAI wire format, and only mlx-lm's normalisation hides it — anyone
  pointing Ollama at these weights hits it directly.
- ~~[#523](https://github.com/navikt/copilot/issues/523) dependabot~~ — 30 of 31 closed by
  #525. None were ever in the Go CLI.
- Eight review threads from #483: `os.Rename` EXDEV, `startProcess` ignoring its context, a
  `slices.Clip` allocation, Tailwind-versus-Aksel tokens, two docs threads.
- `chat_templates/deepseek-v4-flash.jinja` breaks on three of four shapes. That model is not a
  candidate, so this is a note rather than a task.

## The rule

Two questions decide whether something belongs above the line: **are we telling anyone
something we cannot support**, and **can the evidence be reconstructed by someone else**. The
suite lost a run this week and the table built from it was wrong; that class of problem
outranks any single measurement.
