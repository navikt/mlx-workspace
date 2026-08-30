# Local inference alpha: state and outstanding work

Written 29 August 2026. The tracking file for `navikt/copilot#483` and everything around it.
Update it rather than remembering.

## Verified working, on real hardware

| Thing | Evidence |
|---|---|
| `alpha local init/start/stop/status/off` | Run on this machine. Server ready in ~20s warm, 21.0 GB resident |
| Dispatch through nav-pilot to opencode to the local model | Correct edit in 11 to 13 seconds, cplt audit intact |
| Worker bound to the local model | `opencode debug agent lokal-arbeider` resolves `mlx/mlx-community/Qwen3.6-35B-A3B-OptiQ-4bit` |
| **Copilot CLI against the local server** | `COPILOT_PROVIDER_BASE_URL=http://localhost:8080/v1` plus `COPILOT_PROVIDER_TYPE`, `COPILOT_PROVIDER_API_KEY`, `COPILOT_MODEL`, `COPILOT_OFFLINE=true`. Edit made in 10s |
| **Cloud orchestrator dispatching to the local worker** | Claude Sonnet 5 as main agent dispatched through the task tool to `lokal-arbeider`; the local server served four completions and the edit landed. Sonnet then read the file back to confirm, which is the dispatch fragment working: it tells the main agent to check that the file actually changed, because the local model's commonest failure is announcing an edit it did not make. Also proves opencode's task tool honours a provider-config binding even though it ignores model frontmatter |
| Loop guard | Mutation-tested: neutering the gate forwards a prompt to a server nav-pilot cannot vouch for |
| Server log | Mutation-tested: removing the wiring leaves a crash report with nothing to read |
| Port ownership | Refuses a port it does not own, at `start` and per request behind a 3s cache |
| `stop` identity | Refuses to signal a pid whose recorded start time does not match |

## Blocking the alpha: nothing

Reviewed four times. The final verdict is ship, for five users on opencode. The last blocker,
the worker agent leaking into two generated catalogs where it would have run on the premium
cloud model while claiming to be free, is closed by `593fae43`: excluded through a flag all
three generators already honour, verified in every catalog, with a regression test, and
nav-pilot's own materialisation proven not to route through it.

## Found after the ship call, fixed

**Local setup was gated on the session model, not on dispatch being enabled.** A cloud main
agent with a local worker, which is the entire point, got no binding, no dispatch fragment and
no loop guard. Hand testing missed it because an earlier local-model session had written those
markers and they persisted; the automated harness caught it on its first run by asserting what
appeared after a launch from a clean state. Fixed in `6abd51b0` and re-verified end to end.

**nav-pilot's auto-update replaced the binary mid-ladder.** Eighteen ladder samples exited 0
in 0.2 seconds having printed nav-pilot's help text, and were recorded as clean runs scoring
zero. Preflight had passed minutes earlier against the development build; the released build it
swapped to has no launch flags. The harness had warned about `auto_update` and let the run
proceed. It now refuses to start, and any sample that exits under two seconds with no step is
marked invalid instead of counted. That second guard is the one that matters: it does not
depend on knowing which mechanism swallowed the session.

**Still open, from the same review:** `LaunchOpenCodeStaged` does no local dispatch setup at
all, and `LaunchCopilotStaged` never hits the refusal the legacy Copilot path has, so a staged
launch with a local model id sends it to GitHub.

## Follow-ups, outside the alpha's blast radius

0. **Three provider tests bind the real loop-guard port (8081)**, so they fail whenever a
   local session is actually running, including every time the benchmark harness is mid-run.
   `TestCopilotLocalSessionRunsOnTheGuardedLocalServer`,
   `TestCopilotHostedSessionIsUntouchedWithLocalEnabled` and `TestHostedLaunchStartsNoLoopGuard`.
   A test suite that cannot run while the product runs is a suite people stop running. The
   port needs injecting the way `portListeners` already is.

0. **A crash window in `RemoveOpenCodeLocalPolicy`**: the policy file is removed before the
   instructions entry, so a crash between them leaves opencode's config pointing at a deleted
   file. Same class as the one fixed a level up, harmless in practice, worth closing.

## Copilot CLI supports a different product shape, not the same one

Verified from the client: `COPILOT_PROVIDER_BASE_URL` replaces GitHub's model routing for the
whole session, and its own help says so. There is no per-agent endpoint, so **the orchestration
this work is built around, a cloud main agent dispatching to a local worker, cannot be
expressed in Copilot CLI**. What it can do is run a local model as the session model, which is
how another Nav team already works: long background tasks, no premium requests, no cloud
orchestrator.

Both are worth having and they are not the same feature:

| | opencode | Copilot CLI |
|---|---|---|
| Cloud orchestrator, local worker | yes, measured | not possible |
| Whole session on a local model | yes | yes, wired and unmeasured |

That means "Copilot CLI support at GA" has to be stated as the second row, not the first. The
wiring is done (`d1ee0e52`): BYOK env vars pointing at the loop guard, the guard verified
against a real captured Copilot CLI request that loops, refusals kept where they are still
true, and a hosted session byte-identical to today.

## Outstanding, not blocking

3. **Copilot CLI support in nav-pilot.** The branch refuses the Copilot launch for a local model, on the belief that its endpoint cannot be overridden. That belief is now disproven. Needs the env wiring, and the loop guard has never been exercised from Copilot CLI.
4. **`local_autostart`.** Start the server during an interactive launch, config key plus flag, default off. Must refuse rather than fall back to cloud, must be honest about a cold start taking minutes, must not auto-stop on exit because the prompt cache is worth more warm.
5. **Corrections to the reports from the prior-art research**, listed below.
6. **Telemetry for the orchestration-to-dispatch ratio.** Deliberately out of alpha scope, and it is the number that decides whether any of this saves money.
7. **Spring and TypeScript numbers are one and two samples.** Nothing has three.

## Corrections owed to our own documents

- **"Small models loop" is unvalidated.** Infinite Agentic Loops is an established failure class: 68 confirmed cases, 95.6% causing cost exhaustion, 100% sharing "missing strong bound" as root cause, and the literature does not find that smaller models loop more. The guard is the right fix; the attribution to model size is ours and unsupported.
- **No one has measured a reduction in paid request count under a per-request cap.** Every published result measures tokens or dollars. Nav's cap counts requests, so those numbers do not transfer and our reports must not borrow them.
- **The orchestrator eats about half the saving.** HERA offloads 45.67% of subtasks for a 19 to 30% cost reduction.
- **Copilot CLI reads `AGENTS.md`.** `copilot --help`: "Disable loading of custom instructions from AGENTS.md and related files". Our claim that instructions are strictly per-client was wrong.
- **opencode strips `model:` frontmatter from subagents**, a known bug closed as not planned (opencode#35126), so binding must happen in the provider config. This is why the worker silently ran on the cloud model until `cc9e7d71`.

## The machine panicked twice, and it was not us

Two kernel panics on 30 August 2026, 00:23 and 00:41, while the benchmarks were running.
The first read of them blamed our own settings, on the grounds that the panic file
mentions `AGXAcceleratorG17X` and the IOGPU work loop. That was wrong, and the mistake is
worth keeping: those strings appear in the inventory of every thread on the system, both
in `TH_WAIT`, and in neither panic do they appear in the backtrace. Grepping the file is
not reading the trace.

What the evidence says. The panicking task both times is `tbxd`, running as the developer's
own uid and hosting `com.apple.Virtualization.VirtualMachine` XPC services, a virtual
machine daemon. The two backtraces are the same code path: 20 of 21 frames identical once
the KASLR slide is removed, a constant `0x1ceb8000` apart, with only the userspace return
address differing. The fault is a `Kernel tag check fault`, a memory-tagging trap inside
the kernel, which is what a kernel memory-safety bug looks like and is not what memory
pressure looks like: the same report records the compressor at 0% of its limits with OK
swap space. The panics stopped when that daemon stopped.

So a VM daemon reached a kernel bug through the virtualization path, twice, in the same
place. The 36 GB wired limit and the MLX server were bystanders. No wired-limit ceiling is
owed on this evidence, and the runbook needs no warning.

## The refactor experiment: the local model did the whole thing alone

One rename, 46 references across 10 files, three strategies. Strategy C is the cloud
working alone, A is the whole session on the local model, B is the cloud specifying each
file and dispatching it.

| strategy | samples | old symbol gone | compiles | wall | credits |
|---|---|---|---|---|---|
| C, cloud only | 2/2 | yes | yes | 28s, 44s | ~8 each |
| A, all local | 2/2 | yes | yes | 171s, 332s | **0** |
| B, decomposed | 0/2 so far | — | — | stalled past 40 min | — |

**Strategy A was expected to fail and did not.** The spec predicted it would: a
monolithic instruction is what a user tries first and what the literature says a small
model cannot carry. It carried it. Both samples took all 46 references to zero across all
10 files with the project still compiling, unaided, for no credits at all, at four to
twelve times the cloud's wall clock.

That is the spec's own hypothesis confirmed from the strongest possible direction. The
local model fails on multi-file **judgement**, not multi-file **volume**. A rename is
fully specified by its definition, old name and new name, so there is no judgement left in
it, only 46 mechanical applications, and volume is what this model is good at.

Read together with the rest of the night it gives one rule rather than four findings: hand
this model a decision already made and it will carry it a long way; ask it to make one and
it declines or breaks something.

**Strategy B stalled**, which is a result about the strategy and a bug in the harness at
the same time. The orchestrator issued one grep and then emitted nothing for 53 minutes.
Worse, the harness's own 40-minute cap did not fire: `proc.wait(timeout=cap)` was 13
minutes past its deadline with the child still alive, and the sample was only recorded
once the child was killed by hand. Everything measured with that harness needs the cap
verified before it is quoted.

## The reworded fragment increased dispatch and made the result worse

The dispatch fragment was rewritten because it priced the worker in premium requests, a
unit GitHub retired on 1 June 2026. The rewrite also rebalanced it: economics first,
failure modes described as cheap to check, and an instruction to specify each change
fully before dispatching. The theory was that rungs 4 and 5 never dispatched because the
old text read as a warning label.

Measured, six samples per arm, same rungs, same model, same commit, the fragment the only
difference:

| rung | before | after |
|---|---|---|
| 4, write a new unit test file | 0/6 dispatched | 2/6 dispatched |
| 5, thread a field through a DTO | 0/6 | 0/6 |

The rung 4 change is not significant on its own (one-sided Fisher p = 0.227; six per arm
can only detect a large effect). What matters is what the two dispatches did:

| rung 4 sample | dispatched | verified | wall |
|---|---|---|---|
| n=1 | yes | **no, introduced a new failing test** | 100s |
| n=3 | yes | yes | 123s |
| the other four | no | yes, all four | ~34s |

Half the delegations broke the build; none of the four non-delegations did, and they
finished in a third of the time for the same money. **The orchestrator declining to
dispatch rung 4 was the correct decision, and the rewrite talked it into a mistake.**

Rung 4 is writing a new test file, which is exactly where the Copilot CLI ladder shows
this model refusing outright: 0 of 3, zero lines written. Sonnet had that judgement right.

This reverses how the ladder's bimodal dispatch should be read. Zero dispatch on rungs 1,
2 and 4 is not a limitation to tune away; it is correct discrimination. The orchestrator
delegates where the worker is strong (rung 3: 8/8 dispatched, all verified; rung 6: 12/12,
all verified) and declines where it is weak, and it does so more reliably than the
instruction we were about to write for it.

**Owed:** keep the billing correction, which stands on its own, and remove the sentence
encouraging delegation. On this evidence it encourages delegation into failure.

## OpenCode: the orchestrator dispatches on task shape, and the saving scales with it

The full ladder at n=8 or better per arm, priced in AI credits from opencode's own
per-step cost. Every arm verified every sample, so quality is not what separates them:

| rung | task | dispatched | hybrid | control | ratio | p |
|---|---|---|---|---|---|---|
| 1 | answer a question about the code | **0/8** | $0.080 | $0.078 | 0.97x | — |
| 2 | add a doc comment | **0/8** | $0.094 | $0.092 | 0.98x | — |
| 3 | rename across call sites | **8/8** | $0.085 | $0.106 | 1.24x | 0.0045 |
| 6 | thread a field through a mapper | **12/12** | $0.134 | $0.339 | 2.54x | 0.0027 |

Dispatch is bimodal, not gradual. On rungs 1 and 2 the orchestrator never delegates, in
sixteen samples; on rungs 3 and 6 it always does, in twenty. It is not weighing each case
and sometimes deciding yes. It recognises a shape. Answering a question and writing one
comment it does itself; anything that repeats one mechanical edit across call sites it
hands over, every time.

Where it dispatches, the saving scales with how much of the work is mechanical: 24% on a
rename, 154% on threading a field through a mapper and its construction sites. Both hold
at p < 0.005 on a one-sided Mann-Whitney.

**The cost of having the fragment installed and unused is 2%.** Rungs 1 and 2 are the
hybrid arm behaving exactly like the control plus the dispatch fragment in the system
prompt, and they come out $0.002 dearer, a fifth of one AI credit. That is the number
that decides whether this can be on by default, and it is small enough that it can.

An earlier three-sample ladder showed rungs 1 and 2 dispatching two to four times each.
That was measured before the harness asserted which arm it was actually in, and it is
wrong. Sixteen clean samples say zero.

## Copilot CLI: the local model fails at creating and at deciding, not at difficulty

The Copilot CLI resolves one provider per session, so the hybrid shape cannot be
expressed there. What it supports is the whole session on the local model, and that is
what `bench-copilot` measures against the whole session in the cloud. Medians, n=2-3 per
cell, same commit and same tasks as the OpenCode ladder:

| rung | task | local | cloud |
|---|---|---|---|
| 1 | answer a question about the code | 3/3 verified, 0 credits, 18s | 2/2, 7.2 credits, 12s |
| 2 | add a doc comment | 3/3, 0 credits, 24s | 2/2, 8.8 credits, 19s |
| 3 | rename across call sites | 3/3, 0 credits, 58s | 3/3, 8.5 credits, 16s |
| 4 | write a new unit test file | **0/3**, 0 lines changed | 3/3, 28.9 credits, 67 lines |
| 5 | thread a field through a DTO | 3/3, 0 credits, 39s | 3/3, 15.2 credits, 36s |
| 6 | thread a field through a mapper | **1/3**, 3 lines | 2/2, 76.1 credits, 6 lines |

The first reading of this table stopped at rung 4 and called rung 3 the ceiling. Rung 5
then verified 3 of 3, at 39 seconds against the cloud's 36, for no credits at all, so
the failures are not ordered by difficulty and there is no ceiling to point at. Rung 5 is
a two-line edit in a file it was told to change. Rung 4 asks it to create a file that does
not exist, and rung 6 to work out which construction sites a change reaches.

What fails is creating and deciding. Rung 4's three samples changed zero lines: the model
read the task and declined, which EDIT-Bench names refusal-to-edit and lists as one of its
four failure categories. Rung 6 needs the change threaded to sites nobody enumerated.
Everything the model was handed already-specified, it did, including the rung 3 rename
across call sites, which is multi-file and mechanical.

### Rung 6 at depth: the thin sample was wrong by a factor of two

Rung 6 was run to n=12 local and n=8 cloud, because at three samples a single
outcome moves the rate by a third. It did:

| | local | cloud |
|---|---|---|
| verified | 7/12 (58%) | 8/8 |
| median wall | 146s | 288s |
| median credits | 0 | 67 |

At three samples the local arm looked like 1 in 3. At 12 it is 7 in 12, and it is
*faster* than the cloud arm as well as free. That changes the recommendation: a task
whose failure is cheap to detect, since this one compiles or it does not, can be tried
locally first and escalated, because a failed attempt costs seconds and no credits.
Retrying until success at a 58% rate averages about 1.7 attempts, which is
still under the cloud arm's wall clock and still zero credits.

This is also the clearest evidence tonight for running the depth pass at all. Three
samples produced a number that was wrong in the direction that would have had us tell
developers not to bother.

The rung 6 row is the finding worth arguing about. Whole-session-local verified 7 of 12.
The **same model on the same machine doing the same task verified 12 of 12** when a cloud
orchestrator drove and delegated pieces of it. Identical weights either way; what differs
is who decides what to do. Published work on cascaded editing says exactly this. The
large model should make the decision and the small one carries it out, and we reproduced it
without setting out to.

Recommendation splits by client. On opencode, a cloud orchestrator with a local worker. On
the Copilot CLI, run local sessions for work that is already specified, and cloud for
anything that has to create a file or decide where a change goes. That is a sharper rule
than a rung number, and it survives the rung 5 result that killed the rung-number version.

## The pre-ship review, and what it found

Three adversarial reviews before merge, on the code, the data and the documents. Each found
something the work would otherwise have shipped with.

**The code review found the autostart building the second server the design exists to
prevent.** It treated every ownership failure as "nothing is running", and three of those
failures mean the opposite: a corrupt state file, `lsof` timing out under load, and a
readiness timeout leaving a live but unrecorded server. Each would take a fresh port that
the in-use check cannot object to, orphan the running server, and put 42 GB of weights on a
48 GB machine, with every retry adding another 21. It also caught a regression introduced
the same day: `Attach` still pinned to 8080, so `status` posted a chat completion at
whatever the developer had on that port.

**The data review found the study reporting a superseded run beside a claim that run
disproves.** Table 3's strategy B row came from the file the report describes as holding the
crashed attempts. That file also holds two completed runs, and those were the row. The
current file shows B faster than A, so "underperforms A on every axis" was false. Both p
values were the normal approximation while the abstract quoted the exact test, in a report
claiming exactness. The sample count was 146 where the script prints 148.

Its most useful finding was an omission rather than an error: the dispatch instruction names
some of the shapes the study reports as the model's own discrimination, and the study did
not say so. It does now, along with what the instruction cannot explain, and a warning that
the fragment has since been edited to state the conclusion, so a rerun measures compliance.

**The documentation review found that the documented first run does not work.** Every
document presented init then start as the whole path. On a fresh machine `start` refuses
until a macOS memory limit is raised with sudo, and that limit resets at every reboot. The
first alpha user would have met a sudo prompt nothing prepared them for, on day one and
after every restart. The disk figure was three gigabytes short of what `init` itself prints.

**What this says about the process.** None of the three would have been caught by asking
whether the tests pass, and two were introduced by fixes made hours earlier. That is the
argument for reviewing a body of work rather than the diffs it arrived in.

## Known ceilings, accepted for the alpha

- The manifest is unsigned. Integrity rests on TLS and write access to the generating repo, with the publisher and parameter allow-lists bounding the blast radius. Recorded in the package doc.
- One guard per machine on a fixed port. A second concurrent session is a clean bind failure.
- The ownership check has a 3 second window: the server can die between the proof and the write.
- Two of the four benchmark stacks are single runs.

## Prior art worth knowing

Docker `cagent` binds a model per agent statically. Cline binds Plan and Act separately and documents it for local models. Aider's architect/editor is the same split, cloud to cloud. HERA and AIMS partition subtasks between a local small model and a cloud model with an automatic router. **Goose removed its lead/worker split rather than extending it**, and no system found lets the cloud model choose per task when to offload: routing is pinned to a role or to a trained classifier. Our dispatch fragment asks the cloud model to decide, which is the untested part of the design.
