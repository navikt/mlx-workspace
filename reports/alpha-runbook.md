# Triage runbook: local inference in nav-pilot

For whoever picks up an alpha report. What the user needs is on the docs site at
`/nav-pilot/docs#lokal-modell`; this is the other side of that conversation.

Scope: nav-pilot with `alpha local`, `Qwen3.6-35B-A3B-OptiQ-4bit`, 30 August 2026. In an
alpha this goes stale quickly. If something here does not match what you see, the code is
right and this is wrong.

**Escalate to:** `#nav-pilot` on Slack, or an issue on `navikt/copilot` labelled
`local-inference`. Paste the block from "What to collect". There is no severity scale; say
in one line what the developer could not do.

Written to be used cold. If you had to ask a question it does not answer, add it.

## First, one command

```
nav-pilot alpha local status
```

Five states, not interchangeable.

| State | Means | You do | The developer does |
|---|---|---|---|
| `not started` | Nothing running, or never provisioned | `alpha local start`. If they never ran `init`, that first: it downloads 25 GB and sets up Python, once | Start it, or run `init` and wait |
| `starting` | Alive, mapping weights. The port opens before the model loads | Wait. Warm is seconds; cold is two to five minutes. Past ten, treat as stuck and collect | Wait, or carry on in the cloud meanwhile |
| `ready` | Answered a real completion, not just bound a port | The server is fine. Go to the symptom table | Nothing; the wait is generation |
| `crashed` | The process is gone | `tail -50 ~/.nav-pilot/local/server.log`. Look for a Python traceback or `ValueError`; the last lines before it stopped are the reason | `alpha local start` |
| `hung` | Alive, accepting connections, answering nothing | Will not recover. See the `hung` row below, and escalate if it happened through a plain launch | `alpha local stop && alpha local start`, then start a new session |

`status` also prints pid, port, resident memory and the wired-memory limit. That one paste
separates most of what follows.

## Symptom table

**"It just hangs."** Get `status` first; the state decides everything. `starting` on a cold
cache is not a hang. `ready` means it is generating, and on a large context that is slow but
progressing. Only `hung` is the failure.
*They do:* wait if `starting` or `ready`; restart if `hung`.

**"Status says `hung`."** The mlx-lm concurrency bug: the server took two overlapping
requests and wedged. nav-pilot serialises completions machine-wide precisely so a launch
cannot cause this, so **ask what else talked to the server**. Something that did (a curl, a
tool pointed at the port) is expected and closes the report.
**Reaching `hung` through nothing but nav-pilot launches means the serialisation is not
holding. Escalate that one.** It is the difference between a known upstream annoyance and a
defect in our own guard.
*They do:* `stop && start`, then start a new session. The restart ends any open session and
they will see a message saying so; that is the next row, not a second fault.

**"It says the server was restarted and I should start a new session."** Correct behaviour,
and usually the consequence of the previous row. The session was bound to a server that no
longer exists.
*They do:* start a new session. Nothing is lost but the conversation.

**"It stopped mid-task, something about identical tool calls."** The loop guard: nav-pilot
ends a *turn* after eight identical consecutive tool calls, because these models get stuck
repeating one. We measured runs of 203. The session survives, and any edits already written
are still in the working tree.
*They do:* check `git status` for partial edits, then rephrase or take the task themselves.
A legitimate task hitting the guard is worth reporting even though it worked as intended.

**"The model did nothing."** Expected when the task creates a file from scratch: zero of
three in measurement, zero lines written. Across all task shapes this is also the most
common failure.
*They do:* write the file themselves. Worth a report only if the task edited existing files.

**"It compiled but it was wrong."** The failure we have no instrument for and most want
reported. Get the diff.
*They do:* revert, redo it in the cloud, send us the diff. This is the report that decides
whether the alpha widens.

**"Every launch goes to the cloud though local is on."** Check `status`, then
`nav-pilot config get local_enabled`. A nav-pilot upgrade that bumps the pinned mlx versions
leaves the environment stale, and launches go hosted with one stderr line that is easy to
miss. Grep their scrolling for `not provisioned to the versions`.
*They do:* `alpha local init` again. It re-pins in about half a minute and does not
re-download the weights.

**"`init` hangs at 0%."** The network, not us. Weights need `huggingface.co`,
`cas-server.xethub.hf.co` and `transfer.xethub.hf.co`; behind TLS inspection the first works
and the other two stall.
*They do:* try off the Nav network. Not fixable from here.

**"`start` refuses and wants sudo."** Correct. macOS will not wire enough memory by default.
The command is in the refusal and resets at every reboot, so it recurs after every restart.
*They do:* run it, then `start`.

**"My app cannot bind its port."** Should be impossible: the server takes an ephemeral port.
If it happens, get `status` and `lsof -tiTCP:<port>` and escalate, because it means the port
recording is broken.

## What to collect

```
nav-pilot alpha local status
nav-pilot config get client
nav-pilot config get local_enabled
tail -50 ~/.nav-pilot/local/server.log
```

Plus the task in the developer's own words, whether it created or edited files, and for a
wrong result the diff. Paste into `#nav-pilot` with one line on what they could not do.

## Known, and not worth escalating

- **Concurrent requests wedge the server.** Upstream mlx-lm (#1139, #1256, the latter
  against the 0.31.3 we pin). Only when something bypasses nav-pilot. Through a launch, it
  is a defect: see the `hung` row.
- **A 46-reference rename works; a new test file does not.** Measured shape, not a bug.
- **It is slower, and the range is wide.** Roughly cloud-equal on small edits, up to four
  times as long on a rename, and faster than the cloud on the largest mechanical change we
  measured. If a developer says the wait is not worth it, that is data, not a complaint.
- **Two concurrent sessions are supported.** Each gets its own guard; both share the one
  server and queue behind each other.

## Removing it

```
nav-pilot alpha local off      # stop dispatching; weights stay, reversible with `on`
nav-pilot alpha local purge    # lists what and how much, deletes nothing
nav-pilot alpha local purge --yes   # actually deletes, about 24 GB
```

Run `off` before `purge`. Nothing else persists: the wired-memory limit resets at reboot on
its own, and there is no launch agent or privilege left behind.

## What we do not know

Nobody has used this for a working day. Everything measured is single tasks in a clean
repository on one machine: no interruptions, no half-finished work, no colleague waiting.
The first user's experience is the evidence we do not have, which is the point of the alpha.
A report that this is not worth the bother is as useful as any other, and more useful than
a polite one.
