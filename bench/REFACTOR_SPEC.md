# How much of a large refactor can run locally

A single edit saving two cloud steps is a curiosity. A refactor touching forty files is where
that becomes money, and it is also where the local model's known failure lives. This finds the
pattern that works and the tradeoff it costs.

## The hypothesis

The local model fails on multi-file **judgement**, not multi-file **volume**. Evidence from our
own runs: it threaded a new field through a Spring read model, its mapper and every
construction site with the suite still green, and failed the same shape on Ktor. It renames
across call sites on Kotlin and declines on TypeScript. The successes are the cases where the
decision was already made and the work was mechanical.

If that is right, the economics are structural rather than incidental: **planning is O(1) and
application is O(n)**. The cloud decides once. Each file after that is free.

## Three strategies, same refactor, same repository

**A, monolithic.** One instruction to the local worker: "do this refactor". Expected to fail,
and worth measuring because it is what a user will try first.

**B, decomposed.** The cloud reads the code, writes a per-file specification precise enough
that each edit is mechanical, then dispatches one task per file. Deterministic verification
between files. The cloud repairs only what fails.

**C, cloud only.** The control, dispatch disabled.

Per strategy record: cloud steps, cloud tokens, local calls, files correctly changed, suite
green at the end, and how many files the cloud had to repair.

## What decides the answer

`cloud_steps(B) / files_changed`. If that falls as the file count rises, the pattern scales and
the recommendation is decomposition. If it stays flat, the cloud is paying per file anyway and
the local model is only saving the typing.

The second number is **repair rate**: files the worker got wrong that the cloud had to redo.
Each repair costs a cloud round trip plus a wasted local one, so a strategy with a 30% repair
rate can be more expensive than not dispatching at all. That is the tradeoff to quantify rather
than assert.

## The refactor to use

Something real, mechanical in the large and requiring one decision at the start. Candidates
from the targets we already have pinned:

- Rename a widely used domain function across a Kotlin service, including its tests.
- Replace a deprecated call with its successor across every call site.
- Move a shared helper to a new package and update every import.

Pick one where the suite is fast, because strategy B runs it between files.

## What would make the answer wrong

- **Decomposition quality is a confound.** Strategy B's result depends on how good the cloud's
  per-file spec is, which depends on the cloud model. Run B with at least two orchestrator
  families before generalising.
- **File independence.** A refactor whose files can be edited in any order flatters B. Note
  whether the chosen refactor has ordering constraints, because real ones usually do.
- **The suite has to be trustworthy.** If it passes on a broken refactor, everything above is
  measuring nothing.

## What we expect to conclude, and would like to be wrong about

That the pattern is: cloud plans, cloud writes an explicit per-file spec, local applies,
deterministic checks verify, cloud repairs the remainder. And that the tradeoff is a repair
rate high enough that the saving only appears above some file count, which is the number the
runbook should carry.
