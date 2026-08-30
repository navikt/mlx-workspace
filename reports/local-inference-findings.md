# Local models in nav-pilot: what we measured

August 2026. 146 verified samples across two clients, six task shapes and three refactor
strategies, all on one M4 Max with 48 GB of memory running Qwen3.6-35B-A3B at 4-bit
through MLX.

This is the evidence behind the alpha. It is written to be argued with: every number has
the sample size next to it, the failures we caused ourselves are here alongside the
results, and the places where the evidence does not reach are marked.

## The question

Can a local model take enough work off a cloud coding agent to be worth the trouble?

Nav pays for GitHub Copilot per token now. Since 1 June 2026 the unit is AI credits at
$0.01 each, drawn down by input, output and cached tokens at each model's published rate.
A local model draws none of them. So the question is not whether the local model is as
good as Claude Sonnet, which it plainly is not, but whether there is work it can take that
is worth more than it costs in wall-clock time and mistakes.

## How we measured

Two clients, because they support different shapes:

- **opencode** runs a cloud orchestrator with a local worker bound as a sub-agent. The
  comparison is dispatch enabled against dispatch disabled, same cloud model in both arms.
- **Copilot CLI** resolves one provider per session, so the hybrid shape cannot be
  expressed at all. The comparison is the whole session on the local model against the
  whole session in the cloud.

Every run goes through `nav-pilot`, the tool developers actually use, rather than through
the model API. What we measure is the product, not the weights.

Six task shapes on a real Nav Kotlin service, from answering a question about the code to
threading a new field through a data class, its mapper and every construction site. Each
sample resets the repository to a fixed commit, so no sample sees another's work.

Cost is read from the client rather than computed. opencode prices each step; the Copilot
CLI prints AI credits in its session summary. An earlier version of the harness priced
tokens from a table copied out of GitHub's documentation, which is a second place to be
wrong every time a rate changes.

Quality is the repository's own checks: the project compiles, the old symbol is gone, no
test fails that was not already failing. Never the model's claim that it worked.

## What the orchestrator does with a local worker

opencode, cloud orchestrator with a local worker available, n=8 per arm or better:

| rung | task | dispatched | hybrid | control | ratio | p |
|---|---|---|---|---|---|---|
| 1 | answer a question about the code | 0/8 | $0.080 | $0.078 | 0.97x | |
| 2 | add a doc comment | 0/8 | $0.094 | $0.092 | 0.98x | |
| 3 | rename across call sites | 8/8 | $0.085 | $0.106 | 1.24x | 0.0045 |
| 6 | thread a field through a mapper | 12/12 | $0.134 | $0.339 | 2.54x | 0.0027 |

Every arm verified every sample. Quality is not what separates them.

**Dispatch is bimodal.** Sixteen samples on rungs 1 and 2 with no delegation at all;
twenty on rungs 3 and 6 with delegation every single time. Sonnet is not weighing each
case and sometimes saying yes. It recognises a shape: a question or a single comment it
answers itself, anything that repeats one mechanical edit across call sites it hands over.

**The saving scales with how much of the work is mechanical.** A quarter more on a rename,
two and a half times on threading a field through a mapper and its construction sites.

**Having the dispatch instruction installed and unused costs 2%.** Rungs 1 and 2 are the
control arm plus the dispatch fragment sitting in the system prompt doing nothing, and
they come out $0.002 dearer. A fifth of one AI credit. That is the number that decides
whether this can be on by default, and it is small enough that it can.

## What the local model can do on its own

Copilot CLI, whole session local against whole session cloud:

| rung | task | local | cloud |
|---|---|---|---|
| 1 | answer a question about the code | 3/3, 0 credits, 18s | 2/2, 7.2 credits, 12s |
| 2 | add a doc comment | 3/3, 0 credits, 24s | 2/2, 8.8 credits, 19s |
| 3 | rename across call sites | 3/3, 0 credits, 58s | 3/3, 8.5 credits, 16s |
| 4 | write a new unit test file | **0/3**, 0 lines written | 3/3, 28.9 credits, 67 lines |
| 5 | thread a field through a DTO | 3/3, 0 credits, 39s | 3/3, 15.2 credits, 36s |
| 6 | thread a field through a mapper | 7/12, 0 credits, 146s | 8/8, 67.3 credits, 288s |

The failures are not ordered by difficulty. Rung 5 verified 3 of 3 at the cloud's speed
for nothing, while rung 4, ranked easier, changed zero lines in three attempts. Rung 4
asks the model to create a file that does not exist and it declines. EDIT-Bench names this
refusal-to-edit and lists it as one of four categories, so it is a known property of
models in this class rather than a fault in our setup.

Rung 6 deserves its own note because the small sample lied. At n=3 the local arm verified
1 of 3 and we wrote it up as mostly failing. At n=12 it verifies 7, and it is *faster*
than the cloud arm as well as free. Since failure here is deterministic to detect, the
project compiles or it does not, trying locally first and escalating averages about 1.7
attempts, which is still under the cloud arm's wall clock and still costs nothing.

## The refactor: one rename, 46 references, 10 files

Three strategies. C is the cloud alone, A is the whole job handed to the local model, B is
the cloud specifying each file and dispatching it one at a time.

| strategy | samples | old symbol gone | compiles | wall | credits |
|---|---|---|---|---|---|
| C, cloud only | 2/2 | yes | yes | 28s, 44s | 14, 21 |
| A, all local | 2/2 | yes | yes | 171s, 332s | **0, 0** |
| B, decomposed | 2/2 | yes | yes | 270s, 891s | 5, 34 |

**Strategy A was the one we expected to fail.** The spec predicted it would, on the
grounds that a monolithic instruction is what a user tries first and what the literature
says a small model cannot carry. It carried it. Both samples took all 46 references to
zero across all 10 files with the project still compiling, unaided, for no credits at all.

That is the hypothesis in `REFACTOR_SPEC.md` confirmed from the strongest direction. The
local model fails on multi-file **judgement**, not multi-file **volume**. A rename contains
no judgement, only 46 mechanical applications, and volume is what this model is good at.

Strategy B is the interesting negative. Published work on cascaded editing says the large
model should decide and the small one apply, and that this beats the large model alone.
Here it lost to strategy A on every axis: it costs credits, it is slower, and its variance
is enormous (5 credits and 270 seconds one run, 34 credits and 891 seconds the next). The
reason is that decomposition earns its keep when there is a decision to make. This task
has none, so the orchestration is overhead.

## Where we were wrong

Four things we believed and measurement contradicted. They are the most useful part of
this document.

**We rewrote the dispatch instruction to encourage more delegation, and made the results
worse.** Rungs 4 and 5 never dispatched under the old text, which spent one clause on the
saving and four sentences on how the worker fails. The rewrite led with the economics.
Rung 4 moved from 0/6 dispatches to 2/6, and one of those two delegations introduced a
failing test, while all four non-delegating samples passed in a third of the wall clock.
The orchestrator declining rung 4 was correct, and we talked it into a mistake. The
instruction now backs its judgement instead of pushing against it.

That inverts how the bimodal dispatch pattern should be read. Zero dispatch on rungs 1, 2
and 4 is not reluctance to be tuned away. It is correct discrimination, and it is better
than the instruction we were about to write.

**We reported a ceiling that did not exist.** After rung 4 failed we wrote that the local
model tops out at rung 3. Rung 5 then verified 3 of 3. There is no ceiling, there is a
distinction: it fails at creating and at deciding, and succeeds at applying.

**We blamed a kernel panic on our own settings.** Two panics arrived during a benchmark
run and the panic file mentions the GPU driver, so we recorded that raising the wired
memory limit had destabilised the machine. It had not. Those strings appear in the
inventory of every thread on the system, both parked in `TH_WAIT`, and in neither panic do
they appear in the backtrace. The panicking task both times was a virtual machine daemon,
the two backtraces are the same kernel code path once the address randomisation is removed,
and the fault is a memory-tagging trap, which is not what memory pressure looks like.
Grepping a file is not reading a trace.

**We ran a benchmark that measured nothing and did not notice.** Eighteen samples exited
cleanly in 0.2 seconds scoring zero, because nav-pilot's auto-update had replaced the
binary mid-run with a build that has no launch flags, so every launch printed help text and
exited 0. The harness had warned about auto-update and let the run proceed.

## What broke in the measurement, and what it cost

The harness is now about as interesting as the results, because most of a night went into
making it refuse to produce numbers rather than produce wrong ones.

- **A red baseline.** The target repository's test suite fails on an untouched checkout:
  15 classes, because embedded PostgreSQL will not start on this machine. Every quality
  verdict was being taken against an unreachable green. Samples are now judged against the
  repository's own baseline, measured once per commit.
- **The fix for that introduced a worse bug.** `git clean` keeps `build/` so Gradle stays
  warm, which means a change that fails to *compile* leaves the previous run's test results
  in place, the baseline diff finds nothing new, and a broken build scores as a pass. The
  results are cleared before each run and a missing result file is now an explicit compile
  failure.
- **Invalid samples filled the quota.** `--samples 3` counted attempts, so three failures
  produced a results file that looked complete and contained nothing. It counts valid
  samples now, with an attempt cap so a broken arm gives up instead of running until
  morning.
- **A timeout that did not fire.** `Popen.wait(timeout=2400)` was observed thirteen minutes
  past its deadline with the child still alive. The cap is now enforced against the wall
  clock, with a test that gives a SIGTERM-ignoring child three seconds and asserts it dies.
- **Contention we could not see.** After a reboot, Spotlight reindexed at load average 16
  and nothing would have stopped a run from recording that as model latency. Both harnesses
  now refuse to start above a load ceiling.

The pattern in all of these is one failure shape: a run that produces plausible output
while measuring nothing. Every guard added is a refusal rather than a warning, because a
warning did not stop any of them.

## The bug worth shipping a fix for

The refactor experiment found the one thing that would have hurt real users.

Asked to work file by file, the orchestrator listed all ten files and dispatched ten
sub-agents at once. mlx-lm batched those concurrent requests into shared attention, the
differing prompt lengths raised `[broadcast_shapes] Shapes (1,1,1,12919) and
(1,16,1,14896)`, and the server was left hung: alive, accepting connections, answering
nothing, and unrecoverable without a restart. Local inference was down for the whole
machine. It reproduced on the next sample, which then got no local calls at all because
the server was already dead.

This is an upstream bug (ml-explore/mlx-lm #1139 and #1256, the latter against the 0.31.3
we pin) and not one we can fix. It is also trivially reachable from a feature we ship:
fanning a refactor out across files is the obvious thing for an orchestrator to do. The
loop guard already proxies every completion, so it now queues them one at a time.
Serialising costs nothing real, because one model on one GPU has no capacity for a second
stream and those requests were already going to queue.

nav-pilot's health check called it correctly on the first look: hung, it will not recover,
restart it. That is the one part of the system that needed no fixing.

## One rule

Hand this model a decision that has already been made and it will carry it a long way,
across ten files, for nothing. Ask it to make the decision and it declines or breaks
something.

Everything above is that sentence measured from four directions: the orchestrator
delegating exactly the mechanical shapes and refusing the rest, the whole-session runs
succeeding on specified edits and failing to create a file, the rename running entirely
locally, and the decomposition adding cost to a task with no decision left in it.

## What this does not establish

One model, one machine, one repository, and mostly one task per shape. The Kotlin service
is representative of Nav's newer backends and of nothing else; there are no numbers here
for TypeScript or React at a sample size worth quoting.

The agreement measure used in the refactor compares each strategy against the cloud-only
run. If the cloud model misunderstood the task, every strategy that agrees with it is
wrong in the same way and the measure calls them all correct. It decides what is worth
reading, not what is right.

Nothing here measures a team over a week. It measures single tasks in a clean repository
with no interruptions, no half-finished work and no colleague waiting. That is enough to
justify letting people try it. It is not enough to tell a team to change how they work.
