# Working in this repository

Rules for a coding agent working **on** this repo. They are not style preferences: each one
is here because ignoring it cost a night of GPU time or produced a number we had to throw
away.

If you are looking for the prompt given to models under test, that is
[`bench/agents-prompt.md`](bench/agents-prompt.md), and editing it changes the experiment.

## Measurement

1. **A result you cannot reproduce is not a result.** Every figure quoted anywhere must come
   out of `python3 bench/analyse.py`. If a number is in a report and not in the script, one
   of the two is wrong.
2. **Fix the analysis before the run, not after.** When a result would be arguable either
   way, write the statistic, the test and what each outcome would mean into a plan and commit
   it *before* the first sample. Otherwise the answer is unfalsifiable after the fact.
3. **Report the denominator.** Every phase records how many samples it discarded. A quarter
   of one ladder's samples were never judged at all and nobody noticed for a week.
4. **A validated target or no target.** `mise run bench-validate-target <name>` proves the
   baseline is green and that every break actually fails. Discovering otherwise mid-run costs
   the run.
5. **Every task carries a machine-checkable verdict.** A task whose `verify` is `manual` will
   never be judged, because nobody goes back.
6. **Runs that are not results go to `bench/quarantine/`** with a suffix naming the condition.
   Deleting them loses the reason.

## The machine

7. **One thing at a time.** The harness refuses to measure above a load average of 8 and it is
   right to: a busy machine is indistinguishable from a slow model. This includes your own
   test suites — running one during a measurement poisoned an arm.
8. **Absolute paths for system tools.** `/usr/sbin/sysctl`, `/usr/sbin/lsof`, `/usr/bin/pgrep`.
   PATH differs under mise shims, detached processes and a pinned Node, and a bare `lsof`
   killed a run three separate times.
9. **Pin the runtime in the target file.** A target names the Node or JDK its suite needs, and
   the harness must honour it. Eight samples scored 0 of 8 because a suite ran under Node 20
   while the target pinned 24.

## Code and documents

10. **Write tasks, not one-off scripts.** Anything worth running once belongs in
    `.mise/tasks/` with a `# mise description=` line and a `--self-check`. Inline heredocs die
    with the session and have to be rewritten from memory.
11. **A document is finished, working, or living**, and its location says which: `reports/`,
    `working/`, or in place. Living documents like `MODELS.md` are append-only and never
    migrate. Nothing in `working/` may be linked from outside this repo.
12. **State each fact once.** Three places claimed which model ships, and they could drift
    independently. Point at the authority instead of restating it.
13. **`mise run secrets` before pushing** anything that touched a config or a transcript. This
    repo's workflow — curl against local servers, pasted client transcripts — has committed a
    credential before.
