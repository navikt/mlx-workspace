# Plan to the first external alpha user

Written 30 August 2026. The measurement work is done; this is what stands between the
current branch and one developer outside our team running a local model on their own
machine, on their own code.

Sequence matters more than dates. Each phase has an exit criterion that can be checked by
someone who was not in the room.

## Phase 0: push, then verify what we changed last night

**0.0 Push first.** Seven commits exist only on this machine, including the fixes the rest
of Phase 0 exists to verify. Everything until the push is uninsured against one disk
failure, and pushing costs nothing.

Three fixes landed against a running system and are not yet proven end to end.

**0.1 Concurrency fix, end to end.** The loop guard now serialises completions. There is a
unit test that fires ten concurrent requests and asserts the server sees one at a time, but
the bug was found by a real ten-file fan-out and that is what should confirm it. Re-run
refactor strategy B against the rebuilt binary, two samples.
*Exit: two samples complete without the server entering `hung`, and `alpha local status`
reports `ready` afterwards.*

**0.2 Toolchain provisioning, into a throwaway HOME.** The part of `init` that rots is the
pinned toolchain: uv, the interpreter, mlx-lm and mlx are version strings in source, and mlx
ships macOS arm64 wheels for a narrow range of interpreters. The `realenv` test provisions
all of it against a temporary HOME without touching the working setup.
*Exit: `go test -tags realenv` passes, and the four pinned versions in `runtime.go` are
recorded in this plan on the day it passed.*
**Passed 30 August 2026** with uv 0.12.6, Python 3.12, mlx-lm 0.31.3, mlx 0.32.0. It failed
three times first, on a firewall blocking the compiled test binary while curl to the same
URL succeeded, which is worth knowing before blaming the pins on someone else's machine.

The weights download is deliberately not tested here. Doing it honestly means deleting 23 GB
from the machine the rest of this work runs on, and the result would be a timing figure from
a fast home connection rather than the one a developer gets. That test belongs on a machine
that has never seen this branch, which Phase 2.3 already requires, so it is folded into 2.3
rather than faked here.

## Phase 1: close the gaps a user would hit

**1.0 Port 8080 is the first user's own application port.** The local server binds
`DefaultPort = 8080` (`internal/local/runtime.go:69`) and the guard takes 8081. Phase 4
selects a Kotlin or Ktor developer, which is exactly the population whose service under
development binds 8080 by default. Both directions fail in week one. If their app holds the
port, `alpha local start` refuses and the remedy it prints tells them to run
`lsof -ti tcp:8080 | xargs kill`, which kills their own application. If our server holds it,
their app fails to bind with an error that never mentions nav-pilot.

The same constant makes the guard one-per-machine, so a second concurrent opencode session
fails to launch while local dispatch is on. Two terminal tabs in two repositories is
ordinary work.
The fix has three parts, and they have different lifetimes.

**The server is a singleton per machine and must stay one.** It holds 21 GB and a warm
prompt cache, so a second one is not a fallback, it is a machine with no memory left. It
binds an ephemeral port instead of 8080 and records the real port in `server.json` beside
the pid, which every reader already consults to find the pid and so learns the port for
free. Anything that wants a server looks for the recorded one first and attaches to it;
starting a second is a refusal, not a race.

**The guard is per session and may be many.** It binds an ephemeral port per launch and
writes that address into the client configuration for that session, which is written at
launch anyway. Copilot CLI takes it through `COPILOT_PROVIDER_BASE_URL`, the same mechanism
cplt uses for its own proxy; opencode takes it in the provider block the launch already
writes and the exit already removes.

**Concurrent launches must converge on the one server rather than race for it.** Two
nav-pilot instances starting at the same moment must not both decide to start a server.
Whatever arbitrates that has to hold across processes, and it has to fail towards attaching
rather than towards starting.

Concurrency then works out: many guards, one server, and completions already serialise at
the proxy, so two sessions queue rather than fan out into the mlx-lm batching bug.

*Exit: the server binds a port no common framework claims and records it; two concurrent
nav-pilot sessions both launch and both reach the same single server process; starting a
second server is refused with the running one named; no refusal message proposes killing a
process nav-pilot did not start.*

**1.0b Ctrl-C during `start` orphans the server.** The child runs in its own process group,
so an interrupt kills nav-pilot and leaves a 21 GB process loading, holding the port, with
no state file written yet, so `stop` and `status` both report nothing recorded. A cold start
takes minutes, which makes an impatient interrupt the normal case rather than the unlucky
one.
*Exit: interrupting `start` leaves no listener on the port and no orphan process.*

**1.0c No way to remove it.** `off` disables dispatch and leaves roughly 23 GB of weights
plus the virtual environment on disk, with no documented command to reclaim them. A user
who leaves the alpha should not have to learn the Hugging Face cache layout.
*Exit: one command removes everything `init` created, and says how much it freed.*

**1.0d No architecture check.** `init` on an Intel Mac provisions uv and then fails inside
pip with a wheel resolution error about something else.
*Exit: `init` on a non-arm64 Mac refuses in its first second, naming the reason.*

**1.0e Port-bound tests.** Three provider tests bind the real loop-guard port and fail
whenever a local session is running. CI has no local server, so this does not block green
CI; it blocks our own bench workflow.
*Exit: the full suite passes with a local server running.*

**1.1 `LaunchOpenCodeStaged` does no local dispatch setup.** A staged launch with local
enabled silently gets no worker binding, no dispatch fragment and no guard. Either wire it
or make it refuse.
*Exit: a staged opencode launch with a local session model exits non-zero naming local
inference, mirroring the staged copilot refusal; a staged launch with a hosted model writes
no local artefacts; both pinned by tests.*

**1.2 `nav-pilot sync` installs `lokal-arbeider` ungated.** Launch-time materialisation
already filters the worker agent when local is off; only the `sync` path bypasses that gate,
so the fix is narrower than it first looked. Still wrong in principle, and the same class as
the catalog leak.
*Exit: a sync with local disabled leaves no local artefacts.*

**1.3 Crash window in `RemoveOpenCodeLocalPolicy`.** The policy file is removed before the
instructions entry, so a crash between them leaves opencode pointing at a deleted file.
*Exit: order reversed, or the removal made atomic.*

**1.4 No `alpha local on`.** `off` does print that `init` brings it back, so this is a
missing verb rather than a dead end. Add it, or rename.
*Exit: one person who has not used the feature performs off, re-enable and start using only
`nav-pilot alpha local help`, asking nothing.*

**1.5 `local_autostart`.** Once the server is a discoverable singleton, starting it on
demand is small: on launch, if autostart is configured and no server is recorded, start one
and attach. It belongs here rather than in the deferred list because the singleton work in
1.0 is what makes it safe, and because a first user who has to remember `start` before every
session will simply stop using it. Three constraints, all from measurements: it must refuse
rather than fall back to the cloud silently, since a user who asked for local and got billed
has been wronged; it must say that a cold start takes minutes rather than appearing hung;
and it must not stop the server on exit, because the warm prompt cache is worth more than
the memory it holds.
*Exit: with autostart on and no server running, a launch starts exactly one server, says
what it is doing, and a second concurrent launch attaches to that same one.*

## Phase 2: merge and release

**2.1 Push and green CI.** Seven commits are local only, all of them last night's fixes,
including the three that make local inference work at all where `/usr/sbin` is not on the
PATH.

**2.2 Review.** 47 commits on `local-inference`. The review someone else should do is not
line-by-line; it is the trust boundary. What does the guard forward, what does `init`
download and verify, what does a launch write into a developer's own config, and what does
`off` take back out.
*Exit: the PR carries a reviewer's comment answering all four trust-boundary questions with
file references. If the reviewer refuses, the alpha does not start; there is no version of
this that ships on our own sign-off.*

**2.3 Release.** A tagged build in the Homebrew tap containing `alpha local`. Note that
auto-update is on for most users, so the release reaches machines without them asking; the
feature stays off until `init`, which is what makes that acceptable.
*Exit: on a machine that has never seen this branch, and on a Nav-managed network:
`brew upgrade navikt/tap/nav-pilot && nav-pilot alpha local status` prints that local
inference is not provisioned; then `init && start && status` reaches `ready`, with the
elapsed time and every prompt shown written down, because that is the number we quote to
users. Not `--help` for the first check: the global flag loop intercepts it and prints
top-level usage, so it passes on a build without the feature.*

## Phase 3: documentation and announcement

**3.1 Docs live.** The section is written and type-checks. It needs to be deployed and read
once on the live site, on a phone as well, since the capability table is two columns.
*Exit: `/nav-pilot/docs#lokal-modell` renders, and the table of contents entry works.*

**3.2 Runbook for us, not for them.** `reports/alpha-runbook.md` predates most of the
findings. It should carry the triage sequence: what `status` reports mean, what `hung`
means, that a wedged server needs `stop` and `start`, and that queued tasks are deliberate.
*Exit: a teammate who did not build this, handed the runbook cold and a wedged server,
reaches stop and start and can say what `hung` means. The runbook is then amended with
whatever they had to ask.*

**3.3 News post, after Phase 4, not before.** Release plus docs plus news is self-service
onboarding at curiosity's rate, and nothing technical enforces "one user first". The post
goes out when we decide to widen, which is 4.4.
*Exit: published, with the link to the findings report intact.*

## Phase 4: the first user

**4.1 Choose one, not five.** One developer, on a 48 GB Mac, working in Kotlin or Ktor,
who has hit their credit ceiling and is willing to be interrupted for questions. Kotlin
because it is the only stack where our numbers mean anything.

**4.2 Onboard in person.** Sit with them for the first `init`. Not because it is hard, but
because the first run is where we learn what the docs left out, and that is only observable
once.
*Exit: they reach `ready` without us touching the keyboard, and we write down every question
they asked.*

**4.3 One week, then ask.** Specific questions rather than "how did it go": did anything
hang, did anything compile but come out wrong, did you keep it on after the first day, and
what did you try that we had not thought of.
*Exit: written answers, in the repository, including the boring ones.*

**4.4 Decide.** Three outcomes are all acceptable. Widen to five users. Fix something
specific and try again. Or stop, on the grounds that the wall-clock cost is not worth the
credits saved in practice. The third is a real possibility and saying so now makes it easier
to say later.
*Exit: the decision and its grounds written into `reports/alpha-status.md`, with a name and
a date against it.*

## What would stop this

**Breaking the 650.** This is the largest risk and it is not about local inference at all.
The release is 47 commits through shared launch code, reaching machines by auto-update that
did not ask for it. A regression on the hosted path costs every nav-pilot user, not the one
volunteer. It needs a rollback story before release: how a bad build leaves the tap, and how
a developer already on it gets back.

**Self-service onboarding we did not choose.** Release plus docs plus news means anyone
curious can turn this on. Each of them is a support request for a feature we have labelled
unsupported, against a runbook nobody has tested. Phase 4.1 says "choose one, not five", but
nothing enforces it except the order of publication, which is why the news post moved after
Phase 4.

**The reviewer says no.** 2.2 is a real gate. An unsigned manifest selects weights and
environment variables inside allow-lists, and a reviewer may reasonably want that changed
before anyone runs it. There is no version of this that proceeds on our own sign-off.

**The saving may not survive our billing.** Distinct from "nobody wants it". The measured
saving is in AI credits on a per-token model. If Nav's effective constraint turns out to be
something else, the economics have to be recomputed rather than assumed.

**A wedged server in normal use.** If serialising is not enough and users still reach the
mlx-lm concurrency bug, local inference is not shippable, because the failure takes out the
whole machine's local model and looks like a hang with no explanation. This is the single
technical risk that would end the alpha rather than delay it.

**A quality failure we cannot see.** Everything we verified was verified by compilation or a
test suite. A change that compiles, passes, and is subtly wrong is the failure mode we have
no instrument for, and the first user is more likely to find it than we were.

**Nobody wants it.** The saving is real and small in absolute terms. If the answer is that
developers would rather spend credits than wait, that is a legitimate finding and the
capability can sit unused at no cost, since it is off by default.

## What is deliberately not in this plan

 dispatch telemetry, Spring and TypeScript measurements, and the
sketch-then-apply strategy. All are interesting; none of them block one developer from
trying this on their own machine, and each would be better informed by what the first user
reports than by more lab work.
