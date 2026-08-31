# Evolving the benchmark suite

31 August 2026. Written after the suite had produced 200 cost samples and 146 capability
samples, and after a night of running it hard enough to find where it wastes effort.

## What the suite is for

One decision: **should a task be handed to the local model, and does doing so pay?**
Everything that does not move that decision is overhead, however interesting.

Two findings currently rest on it. The model applies a decision well and makes one badly.
And the saving tracks how many steps the cloud-only arm needed, not the language.

## What it covers now

| | Ktor | Spring | Frontend TS |
|---|---|---|---|
| Capability ladder, 11–12 tasks | yes | yes | yes |
| Cost ladder, paired arms | rungs 1,2,3,6 | rung 6 | rung 3 |
| Copilot CLI, whole session local | yes | no | no |
| Debugging | no | no | 3 tasks, running |

Eight model builds compared on capability, one taken through cost. Two side experiments:
instruction language (English against Norwegian) and a wording intervention.

## Where the suite wastes effort

**A quarter of every capability run produces no verdict.** 37 of 146 samples are `verified:
null`, all from four tasks whose `verify` is `manual`: R1, R3, D1, S1. Nobody has ever gone
back and judged them by hand, so a quarter of the GPU time bought nothing. These are all
read tasks, which is exactly the shape that is cheapest to check mechanically: the answer
either contains the right file, symbol or number or it does not. `grep_answer` already
exists and R2 uses it successfully.

**Three tasks have never once succeeded and we know why.** G2 is 0 of 13, D3 is 0 of 11,
D2 is 1 of 12. All three require creating a file that does not exist, and the report's
central finding already explains it. Thirteen samples per model to re-derive a known result
is the most expensive way to learn nothing. One is a useful canary against a future model
that fixes this; three is a habit.

**The informative middle is thin.** M1 at 8 of 13, E3 at 6 of 13 and E1 at 10 of 13 are
where models actually differ. That is where samples belong.

## What to add, ranked by the decision each changes

Reviewed by Fable, which re-ordered this list against my first draft with two arguments I
accept.

The first is that §7.3 argues against my own ordering. Now that codebase identity is a proxy
for step count, a fifth codebase adds a point whose position on the curve is roughly
predictable in advance. That demotes every "new language" item.

The second is sharper: I listed the ragged coverage as a finding and then did not put fixing
it in the plan. The law was derived *across* codebases, so the clean falsification is *within*
one codebase across rungs.

0. **Suite hygiene, no GPU.** Convert the four manual tasks to machine checks. It makes every
   future night a quarter more productive, so it compounds ahead of any single experiment.
1. **Debugging.** Running. First data on the shape most likely to expose the
   applying-versus-deciding line.
2. **Fill the cost-ladder pairs within a codebase: Spring rungs 1–3, frontend rung 6.** This
   is the strongest available test of §7.3 and it needs no new target. If a high-step Spring
   rung shows a saving, the law holds and codebase identity stays dead. If Spring stays dear
   at 13 steps or more, codebase comes back and §7.3 is wrong. The report's spine currently
   rests on four points and one interpretation, and this is what would break it.
3. **Warm cache across a session.** Three consecutive dispatches against one warm server
   against cold-starting each. No new target, and it is the number that most changes the
   advice a user acts on mid-workday.
4. **The Copilot CLI arm on a second codebase.** It closes a hole in a claim we have already
   published: whole-session-local economics are currently one codebase presented beside a
   three-codebase result.
5. **Next.js**, built by stripping private-registry dependencies (see below).
6. **Python**, and only in the shape described below.

Deliberately not on this list: a ninth model build, and more rungs on Ktor. Neither answers a
pending question.

### Next.js: a doctored target, and the three rules that keep it honest

No Nav Next app installs without GitHub Packages credentials, so the target has to be a fork
with private dependencies stripped. That makes it not-quite-real code, and §7.3 is what
rescues it: since the economics turn on step count rather than dependency pedigree, what the
target must preserve is its *structure* — module layout, cross-references, call-site fan-out.

Three rules, because breaking the second makes the target worth less than no target:

1. Publish the strip as a diff and pin the fork. It is "derived from a Nav Next app,
   modifications listed", never "a Nav Next app".
2. **No task may touch a file the strip modified**, enforced mechanically in the task spec
   rather than trusted to memory. Stripping perturbs exactly the fan-out variable the law
   says drives the result, so a task over that seam measures our own surgery.
3. Report its control-arm step count beside every other point on the curve.

### Python: measure the missing compiler, not the fourth language

Field-threading in Python syntax would re-derive the step-count law in another language and
teach us nothing. What Python uniquely offers is the *absence of a type oracle*. Every task so
far had a compiler in the verification loop, and we do not know how much of the model's edit
success that carries.

So: the same task twice in one repo, once through pydantic models and once through plain
dicts where only the tests can catch an error. If the dict variant's success rate drops, the
safety story leans on typed targets, which directly qualifies the advice for Python and every
dynamically-typed corner of Nav.

Notebooks stay out, and the honest version of the reason is that `.ipynb` diffing would
dominate the measurement *and* that excluding it is convenient. If notebook work ever needs
measuring, jupytext-paired percent files dissolve the diffing problem; there is no need to
solve ipynb-as-JSON. Build none of it until the alpha's telemetry shows actual Python users.

## What to remove or convert

- Convert R1, R3, D1 and S1 from `manual` to `grep_answer` with expected terms. Any task
  that cannot be checked mechanically should not be in a suite that runs unattended.
- Cut G2 and D3 to a single canary task between them. Not at n=1, though: this canary guards
  the report's central finding, and a single sample of a stochastic model can pass or fail on
  luck. One task at n=3, run at model intake rather than every night. 0/3 against 3/3
  separates cleanly at trivial cost, and if a new build ever reaches 2 of 3 it is promoted
  back to a full run, because the product's dispatch policy changes that day.

## What was missing from the first draft entirely

All four are Fable's, and the first is the one that matters most.

**Field validation of §7.3.** The alpha is about to produce real dispatch data through the
local stats store. That store must record the same fields the lab records — step count, task
shape, credits, duration — or the step-count law will rest on lab pairs forever. This has to
be decided before the first user, not after, because a field record without step count cannot
be reconstructed later. It is the suite's endgame and it was not on the list.

**Step count as a pre-dispatch predictor.** §7.3 is descriptive; the decision it enables is a
policy. Can the orchestrator estimate step count cheaply before committing, and does
thresholding on it beat always-delegate and never-delegate? That converts the best finding we
have into product behaviour, and it is probably the highest-value experiment not yet named.

**Oracle strength as a variable.** Every economic result assumes a fast, trustworthy suite:
the frontend target runs 572 tests in 9.11 seconds. Nav repos vary enormously. One night
running a known rung against a deliberately weakened suite would say how much of the safety
story is the model and how much is the target's tests. It shares a design with the Python
typed-versus-dict experiment above.

**A formal model-intake battery.** The pieces exist but the protocol is not written down:
which tasks a new build must pass, at what n, and what result triggers spending a full ladder
on it. Proposed: the create-a-file canary at n=3, plus the discriminating middle (M1, E1, E3),
since those are the only tasks where models have actually differed.

## Infrastructure debt, in the order it has cost us time

1. **Bare system tools.** Fixed tonight across nine call sites, after the same defect
   appeared three times: a bare `sysctl` silently disabled the VRAM lockup warning, and a
   bare `lsof` killed the debug ladder the moment it ran under a different Node toolchain.
   The rule is now absolute paths for anything in `/usr/sbin` or `/usr/bin`.
2. **Config and binary isolation.** The harness reads the developer's own
   `~/.nav-pilot/config.toml`. A key written by the released build made the dev build refuse
   to start, and a benchmark once mutated that config. `NAV_PILOT_CONFIG` already exists and
   the harness should set it. Results should record the binary's path, version and commit,
   not just a version string.
3. **Launches that never start a session.** Every launch re-fetches the agentpakke from
   GitHub, and under load that fetch fails and nav-pilot prints its help and exits 0. It is
   invalid rather than a result, and the harness now backs off. Two open questions: whether
   a local artifact source removes the fetch entirely, and why the failure was reproducible
   on the Spring target while the frontend ran 16 of 16 minutes earlier.
4. **Invalid samples poison a results file.** A file holding 18 non-results made the loop
   believe the arm was finished, so later runs exited silently. The loop should count valid
   samples against the quota and prune non-results itself.

## Standing rules for the suite

- Every task carries a machine-checkable verdict or it does not go in.
- Every phase records its invalid count and reports the denominator.
- A new target is provisioned and its baseline proven green *before* any measurement, and
  the Node or JDK it needs is pinned in the target file, not in a shell that happens to be
  right. The frontend suite dies under Node 20 with 61 errors unrelated to any change.
- Analysis is fixed in writing before a run whose result would otherwise be arguable.
- `analyse.py` reproduces every figure in the report, and asserts relationships the report
  claims rather than leaving them to the reader's eye.
