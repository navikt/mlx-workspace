# Plan forward, 28 August 2026

The model question is closed. `mlx-community/Qwen3.6-35B-A3B-4bit` runs the alpha, decided on
[cheap-operations data](alpha-model-decision.md) against a real Nav Kotlin service. Everything
left is engineering and measurement, not model selection.

## Stop testing models

Seven models were measured across two benchmarks. The ranking of what moves the numbers is
recorded in [`../MODELS.md`](../MODELS.md) and model choice sits seventh. Spec precision, output
caps, backend choice and sampling each beat it. Another bake-off buys less than fixing the harness
bugs we already found, so the remaining model work is one cheap repeat run and nothing else.

The exception is issue #10. If opencode's dropped output turns out to be fixable, Granite 4.1 8B
at 5.1 GB replaces an 18.6 GB download, which changes what we can ask a developer to install. That
is worth a day, and it is not on the critical path.

## Three gates before a user touches this

**The server has to survive a working day.** Issue #11. It degrades until the model stops calling
tools and every later task fails silently, producing no error a user would recognise. The
benchmark works around it by restarting between tasks. A developer will not. Either find the cause
or ship a supervisor that restarts on a health check, and detect the condition rather than trusting
an uptime timer.

**One command has to install and configure everything.** Issues #7 and #8. Model download, wired
memory limit, server lifecycle, and both client configs. Copilot CLI is the sharp case: without
`.github/copilot-instructions.md` it found the call sites it needed to change, announced it would
edit them, and changed nothing. The same model with the file finished in 22 seconds. The two
clients read different instruction files, so nav-pilot generates both from one source or the alpha
fails for half its users.

**We have to be able to tell whether it worked.** Nothing measures this in the field today. Issue
#2 gets the premium request distribution, which tells us whether overage is concentrated in a few
heavy users or spread thin. That answer decides who the alpha is for and what a win looks like.
Define the success metric from that data before anyone installs anything, because a metric chosen
afterwards is a metric chosen to pass.

## Sequence

| Phase | Work | Done when |
|---|---|---|
| 1 | Issue #11, and three repeat runs of the chosen model (#3) | The server survives a day of use, and the headline numbers have a range instead of a single sample |
| 2 | `nav-pilot local install` and per-client config generation (#7, #8) | A developer with no context runs one command and gets a working setup |
| 3 | Premium request distribution (#2), success metric agreed | We know who to invite and what we are counting |
| 4 | Five volunteers from the capped users (#9), time-boxed | Measured against the metric from phase 3, with a stated kill date |

Phase 1 is a day. Phase 2 is the real work. Phases 3 and 4 need people outside this repo, so start
the conversation for #2 now rather than at the end of phase 2.

## Deferred on purpose

Issue #5, grading the four ungraded weather-cli submissions, and #6, the thinking flip on the
chosen model, both refine numbers that already point the same way. Issue #4, exposing
`repetition_penalty`, matters only if we see repetition loops in the field. None of them gate the
alpha.

## What would kill this

- **The degradation has no clean fix.** A local assistant that silently stops working is worse
  than no local assistant, because the developer keeps prompting into a dead session.
- **The waiting is unacceptable in practice.** 32 seconds median is fine on paper. Nobody has
  measured what it feels like across a working day, and the benchmark cannot tell us.
- **Support cost exceeds the saving.** Five volunteers producing a steady trickle of setup
  questions costs more than the overage it absorbs. Phase 2 exists to make this small.
- **The overage is not concentrated.** If heavy users are not a distinct group, routing their
  cheap operations locally does not move the invoice, and #2 is what tells us.

## What this does not cover

Nothing here addresses the seat price. Nav pays roughly 1.8x Enterprise list, and local models do
not touch that. It is a procurement question and it is worth more than this project is, so it
should run in parallel and not behind it.
