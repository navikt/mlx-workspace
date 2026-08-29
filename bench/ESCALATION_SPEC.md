# Where offloading stops paying

The alpha assumes routine work should go to the local model. This experiment finds the
point where that stops being true, measured in the unit Nav is actually billed in.

## The unit

**Premium requests per completed task.** Not tokens, not seconds. Nav's cap counts requests,
and no published study measures request count: every result we found measures tokens or
dollars, so their break-evens do not transfer.

A dispatched task costs the orchestrator at least:

1. one request to decide and call the task tool
2. one to receive the worker's result
3. one to verify, because our own dispatch fragment tells it to check the file actually changed

and, when the worker declines or produces a broken edit, however many more it takes to redo
the work in the cloud. So a task the cloud finishes in one request can cost four when
dispatched. Break-even is governed by the worker's success rate, not by how hard the task
looks.

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
| `seconds` | wall clock |
| `verified` | compile or test suite, run by us, never the model's claim |
| `redone_in_cloud` | did the main agent edit the file itself after the worker failed |

`cloud_turns` is the cost number. `local_calls` is free. The comparison is
`cloud_turns(hybrid)` against `cloud_turns(cloud only)` for the same verified outcome.

## First measurement, rung 2

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
