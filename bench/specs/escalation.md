# Where offloading stops paying

The alpha assumes routine work should go to the local model. This experiment finds the
point where that stops being true, measured in the unit Nav is actually billed in.

## Two regimes, two answers

There is no single break-even, because there are two ways to spend.

**Interactive.** The developer is waiting. Latency is the binding constraint and cost is
secondary: a task the cloud finishes in 20 seconds and the local model finishes in two minutes
is a bad trade even when it is cheaper. The break-even is where local latency stops being
tolerable.

**Background.** Nobody is waiting, so cost binds and latency is nearly free. Another Nav team
already runs this way, accepting long waits deliberately. Here the ladder can be climbed much
further, and the limit becomes the repair rate rather than the clock: work the local model gets
wrong costs a cloud round trip, and that is what eventually exceeds doing it in the cloud.

Every rung therefore needs both numbers, cloud steps and wall clock, and the runbook needs two
sentences rather than one: what to dispatch when someone is waiting, and what to dispatch
overnight.

## The unit

**AI credits per completed task**, which is to say tokens priced per model. GitHub Copilot
moved off request-based billing on 1 June 2026: premium requests are gone, and a Copilot plan
now carries a monthly allowance of AI credits at $0.01 each, drawn down by input, output and
cached tokens at each model's published rate.

For Claude Sonnet 4.6 that is $3.00 per 1M input, $0.30 per 1M cached input, $3.75 per 1M
cache write and $15.00 per 1M output. Cached reads therefore cost a tenth of fresh input,
which matters a great deal here: 91 to 97 percent of the token totals we record are cache
reads, so a comparison denominated in raw token totals overstates the gap between the arms by
roughly a third. Record the priced figure. opencode emits a per-step `cost`, and GitHub prices
the same models at the same per-token rates, so a dollar of opencode cost is 100 AI credits.

This change moves the break-even in the local model's favour, and it invalidates the argument
this section used to make. Under request billing a dispatched task cost the orchestrator at
least three requests: one to decide and call the task tool, one to take the result, one to
verify the file actually changed, because our own dispatch fragment tells it to, so a task
the cloud finished in one request could cost four when dispatched, and break-even hung on the
worker's success rate. Under token billing those extra turns are cheap: they are short, and
they read a cache prefix that is already warm. What is expensive is generating code, and that
is precisely the part the local worker does for nothing.

The worker's success rate still decides the outcome, but through a different mechanism. A
declined or broken edit now costs a redo in the cloud at full output rates, not a fixed
request surcharge.

## Design

Two arms, same tasks, same repository, same starting commit.

- **Hybrid**: cloud main agent, `lokal-arbeider` bound to the local model, dispatch fragment
  installed.
- **Cloud only**: the same cloud main agent with no local model available.

Per task, per arm, record:

| Field | How |
|---|---|
| `cloud_turns` | `step_finish` events in the client's JSONL log |
| `local_calls` | `POST /v1/chat/completions` lines in `~/.nav-pilot/local/server.log` |
| `seconds` | wall clock, the deciding number for interactive work |
| `verified` | compile or test suite, run by us, never the model's claim |
| `redone_in_cloud` | did the main agent edit the file itself after the worker failed |

`cloud_turns` is the cost number. `local_calls` is free. The comparison is
`cloud_turns(hybrid)` against `cloud_turns(cloud only)` for the same verified outcome.

## Results, rungs 1 and 2

Claude Sonnet 4.6, three samples per arm. The control has dispatch disabled through
`alpha local off`, not merely an instruction that omits the task tool: with the fragment
installed, the cloud model dispatches on its own initiative even for a plain request, so an
arm that only omits the instruction is not a control. That mistake cost a step per run and
overstated the first version of this table.

| Rung | Arm | Steps | Cloud tokens | Lines |
|---|---|---|---|---|
| 1, answer a question | hybrid | 2, 2, 2 | ~32,500 | 0 |
| 1 | control | 3, 3, 3 | ~48,500 | 0 |
| 2, add a docstring | hybrid | 2, 3, 2 | 32.5k, 49k, 32.5k | 4 to 5 |
| 2 | control | 4, 4, 5 | 64k, 64k, 81k | 12 |

Hybrid costs about half the cloud steps and about half the tokens at both rungs, with tighter
variance than anything else we have measured.

Two things this does not yet establish. The outputs differ: the control writes twelve lines
where hybrid writes four or five, so some of the saving is the local model being terser rather
than cheaper, and the arms need scoring against one rubric before the token gap means what it
appears to mean. And these are the two easiest rungs; the interesting question is where the
lines cross.

## Superseded first measurement, rung 2

Claude Sonnet 4.6, add a docstring explaining the zero case, one sample per arm.

| Arm | Steps | Cloud tokens | Output | Cache read | Local calls | Lines |
|---|---|---|---|---|---|---|
| Hybrid | 3 | 49,012 | 285 | 47,940 | 3 | 5 |
| Cloud only | 5 | 82,044 | 418 | 64,837 | 0 | 12 |

Hybrid costs fewer cloud steps and fewer cloud tokens, which contradicts the arithmetic above:
the cloud-only path is not one request either, because it reads, edits and verifies. The
dispatch overhead is real and smaller than the work it displaces.

Two reasons not to quote this yet. It is one sample, against measurements that move 1.5x
between identical runs. And the arms did not produce the same output: cloud-only wrote twelve
lines where hybrid wrote five, so part of the difference is verbosity rather than efficiency.
Fix that by scoring both against the same rubric before comparing tokens.

Also note where the tokens actually go: 97.8% of the hybrid total is cache reads. Whether that
is billed at full rate decides the economics, and it is a fact about Nav's contract rather than
about our code.

## Rung 3 through the validated harness, both arms

Claude Sonnet 4.6, three samples per arm, driven through nav-pilot so the sandbox, the loop
guard and the config lifecycle are all in the path. Both arms produced the same six-line rename
and both compiled.

| | Cloud steps | Cloud tokens | Wall clock | Verified |
|---|---|---|---|---|
| Hybrid | 4, 2, 4 | 79k, 39k, 79k | 28.7s | 3 of 3 |
| Control | 6, 6, 6 | ~116,600 | 20.7s | 3 of 3 |

Hybrid costs a third fewer requests and a third fewer tokens, and takes about 40% longer. That
is the two-regime split in one measurement: dispatch this overnight, think twice while someone
is waiting.

## Rung 1: the orchestrator declines

Three samples, correct config every time, zero local calls. Asked a plain question about the
code, the cloud model answers it directly rather than pay a round trip to the worker. So the
saving cannot come from trivial reads, and the earlier rung 1 figures in this document measured
a prompt that ordered a dispatch rather than a model choosing one.

## The ladder

Rungs from our own measurements, easiest first. Each rung is a task shape we have data for,
so a failure here is interpretable rather than mysterious.

1. **Answer a question about the code.** No edit. Works on every stack we tested.
2. **Add a doc comment or a log line.** Single file, no logic. Works.
3. **Rename a symbol across call sites.** Mechanical, multi-file. Works on Kotlin, declined on
   TypeScript.
4. **Write a test file for an existing function.** Works on TypeScript, mixed on Kotlin.
5. **Thread a field through a type, its mapper and every construction site.** Passed on Spring
   and on TypeScript, failed on Ktor.
6. **Change a database row class, its mapper and all call sites, keeping the suite green.**
   Failed everywhere so far: 19 turns and 29 tool calls, then a broken suite.
7. **Add a small endpoint with a test.** Never attempted locally.

Stop climbing when hybrid costs more cloud turns than cloud-only for the same verified result,
twice in a row.

## What would make the answer wrong

- **One sample per rung.** Run each rung three times per arm. Our medians move 1.5x between
  identical runs.
- **Orchestrator family.** Dispatch compliance may vary: a model that ignores the fragment and
  edits directly scores as cheap hybrid while doing no offloading at all. Record whether
  `local_calls` was zero and treat those runs separately.
- **Task order.** The prompt cache favours later tasks in a session. Run each task in a fresh
  session.
- **The local server's own state.** Restart it between rungs, as the benchmark harness does.

## What the result is for

A rung number, and the sentence that goes in the runbook: send work at or below rung N to the
local model, and everything above it stays in the cloud. If rung 2 is already break-even, the
honest finding is that this saves nothing and the alpha should say so.
