# Local models: what alpha users need to know

For the first developers running `nav-pilot alpha local`. Written from measurements, not
expectations. Everything here was measured on a 48 GB machine, at the memory cap you will
actually run at.

## What this is

A local model that the main agent dispatches focused tasks to, so those tasks stop consuming
Copilot premium requests. It is not a replacement for Copilot and it does not hold a
conversation. The main agent still runs in the cloud and still decides what to do.

## What it does well

Measured across eleven tasks against a real Nav Kotlin service and a real Nav TypeScript app:

| Task | Typical | Works |
|---|---|---|
| Answer a question about the code | 5 to 15s | yes |
| Add a doc comment or a log line | 10 to 25s | yes |
| Rename a symbol across call sites | 15s | Kotlin yes, TypeScript no |
| Write a test file | 30s to 4 min | mixed |
| Thread a field through a type and its uses | minutes | TypeScript yes, Kotlin no |

Median across the set: **21 seconds** on Kotlin, **15 seconds** on TypeScript. It verified 4 of 8
objectively checkable Kotlin tasks and 6 of 8 TypeScript ones. Read what it changes.

## What it does badly, and what that looks like

**It declines.** The most common failure is no edit at all: it reads the files, explains what it
would do, and stops. You lose a minute. Ask the cloud model instead.

**It loops.** Roughly once per eleven tasks at the memory cap, a model repeats the same command
until something stops it. We measured runs of 203 and 220 identical calls. The client aborts a
turn that repeats itself, so you should see an error rather than a hang, but if a task is still
going after a couple of minutes, that is what happened.

**It runs out of room.** Long sessions grow the cache until the server dies. `nav-pilot alpha
local status` tells you whether the server is healthy, and restarting it costs seconds.

## What it costs you

- **25 GB of disk** for the weights, plus about 1 GB for the runtime.
- **Memory while running.** The model holds around 19 GB. On a 48 GB machine with containers and
  an IDE open, expect the machine to feel full.
- **Seconds to minutes per task**, against roughly a second for a cloud model. The saving is your
  premium request allowance, not your time.

## Which machine

48 GB Apple Silicon or better. On 32 GB it does not fit. Nothing here is tested on Intel.

## When to report something

Report anything in this list, because each is a result we do not have:

- A task that hangs for more than two minutes.
- A loop the client did not catch.
- An edit that compiles but is wrong in a way you would not expect from a careless colleague.
- The server dying more than once in a working day.
- Anything on a stack other than Kotlin, Ktor, TypeScript or React, since those are the only
  ones measured.

Include what you asked for and what came back. `nav-pilot alpha local status` output helps.

## What we do not know

- **Spring is untested.** Our JVM measurements are Ktor only.
- **Nobody has used this for a full working day.** Every number here comes from batches of eleven
  tasks, not from a person doing their job.
- **We have not measured the saving.** The main agent still spends a premium request per dispatch,
  so whether this reduces your consumption depends on a ratio nobody has measured yet. Your usage
  data is the point of the alpha.
