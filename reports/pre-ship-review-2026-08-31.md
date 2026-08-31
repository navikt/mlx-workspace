# Adversarial pass before shipping, 31 August 2026

The last gate before `navikt/copilot#483` merges. The human review is done; this looked
specifically for ways the trust boundary could be made to misbehave, and for what a first
user hits when the news article and the release land together.

## Verdict

**Nothing found that should hold the merge.** One stale comment fixed, one residual risk that
was already known and documented, and one operational gap created by the decision to publish
the news with the release rather than after the first user.

## What was attacked, and what happened

**Can the guard be made to forward to a server nav-pilot does not own?**
Not without a local attacker and a three-second window. `EnsureOwnServer` proves three
things per check: state exists, the recorded pid is still alive with its recorded start time,
and that pid is what `lsof` reports listening on the recorded port. The result is cached for
three seconds, so a server dying and something else taking its port is detected within that
window rather than instantly. The trade is documented at the constant and is the right one:
re-proving per request costs two subprocesses against a completion that takes seconds to
minutes. The port is ephemeral now, which narrows who can squat it.

*Fixed:* the comment justifying the TTL still described proxying to a fixed `127.0.0.1:8080`,
which stopped being true when ports became ephemeral. A future reader would have
mis-assessed the risk from a stale comment.

**Can autostart race two 21 GB servers onto one machine?**
No. `EnsureServerRunning` takes the cross-process lock and then *re-checks* whether a server
appeared while it was queued. Textbook double-checked locking, and the second check is
commented with the reason it exists.

**What does a session bound to a restarted server do?**
Refuses, per request, with an explanation and the command to fix it. The guard compares the
port it captured at session start against the port currently recorded, so a stop-and-start
mid-session cannot silently redirect a session to a different server.

**Does the local stats file leak anything?**
No. Each line holds a timestamp, two token counts and a duration. No prompt, no code, no file
name, no output. Mode `0600`, inside the directory `purge` removes.

**Is a machine that cannot run the model told before it downloads 24 GB?**
Yes, and this is the check most likely to matter when several people arrive at once.
`CheckWiredLimit` runs before the download confirmation, is fatal, and refuses when the
required limit would leave less than the system needs. A 16 GB machine is stopped in seconds
rather than after an afternoon of bandwidth.

**Do the system tools resolve under a different PATH?**
Yes in Go: `/usr/sbin/lsof` and `/usr/sbin/sysctl` are absolute. The same class of bug bit the
Python harnesses three times and is now fixed there too.

**Can remote text reach a system prompt or a terminal unchecked?**
No. The manifest is fetched, and `checkProse` bounds every prose field at 600 runes and
rejects control characters, because that text is both printed to a terminal and pasted into
the main agent's system prompt.

## The residual risk, unchanged and already documented

The manifest names weights a developer's machine downloads and loads into its own process.
Publisher and environment reach are therefore trust decisions, and they live in code
(`allowedPublishers`, `allowedParamKey`) rather than in the served file, so widening either
is a code review. The known caveat stands: **membership of `mlx-community` on Hugging Face is
open**, so the allowlist constrains *which org* publishes weights, not *who* can publish
under that org. That is accepted for an alpha with a pinned model and is documented at the
boundary. It is the first thing to revisit if the alpha widens.

## The gap created by shipping the news with the release

Publishing the article alongside the release means several people may install on the same
day, each downloading 24 GB and each hitting a sudo prompt, against a runbook that has never
been used on a real report. The plan sequenced news after the first user precisely to avoid
that, and that sequencing has now been overridden deliberately.

What that changes:

- The runbook needs a line for **several people arriving at once**, which is a different
  triage problem from one person stuck.
- The most likely first contact is not a bug: it is the sudo prompt and the download. Both are
  expected behaviour and both look alarming.
- Nobody has run `init` on a machine that has never seen this branch. That test is still
  outstanding and is now more important, not less, because the audience arrives sooner.
