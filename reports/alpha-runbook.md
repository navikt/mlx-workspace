# Triage runbook: local inference in nav-pilot

For whoever picks up an alpha report, not for the alpha user. What the user needs is on
the docs site under `/nav-pilot/docs#lokal-modell`.

Written to be usable cold, by someone who did not build this. If you had to ask a question
it does not answer, add it.

## First, one command

```
nav-pilot alpha local status
```

It reports five states, and they are not interchangeable.

| State | What it means | What to do |
|---|---|---|
| `not started` | Nothing is running | `alpha local start`. If the user expected it up, ask whether they interrupted a start |
| `starting` | Alive, mapping weights. The port opens before the model loads | Wait. A cold start is minutes; a warm one seconds |
| `ready` | Answered a real completion, not just bound a port | The server is not your problem. Go to the symptom table |
| `crashed` | The process is gone | `~/.nav-pilot/local/server.log` has what it printed on the way out |
| `hung` | Alive, accepting connections, answering nothing | It will not recover. `alpha local stop && alpha local start` |

`status` also prints the pid, the port, resident memory and the wired-memory limit. Get the
whole output in any report, because it distinguishes most of what follows in one paste.

## The symptom table

**"It just hangs."** Get `status`. `hung` is the mlx-lm concurrency bug and needs a restart.
`starting` on a cold cache is not a hang. `ready` means the model is answering and the wait
is generation, which on a large context can genuinely be minutes per token.

**"It stopped mid-task and said something about identical calls."** Working as intended. The
loop guard ends a turn after eight identical consecutive tool calls, because these models
get stuck repeating one. We measured runs of 203. Ask what the task was; a legitimate task
hitting the guard is worth knowing about.

**"The model did nothing."** Expected on anything that creates a file from scratch: zero of
three in our measurements, with zero lines written. Also the most common failure generally.
Not a bug, and the docs say so, but confirm the task shape before concluding anything.

**"It compiled but it was wrong."** The failure we have no instrument for and most want
reported. Get the diff. This is the one that decides whether the alpha widens.

**"My app can't bind its port."** Should no longer happen: the server takes an ephemeral
port and records it. If it does, get `status` and `lsof -tiTCP:<port>`, because it means the
port recording is broken and that is serious.

**"It says the server was restarted and I should start a new session."** Correct behaviour.
The session was bound to a server that no longer exists. Restarting the server mid-session
ends the session.

**"Every launch goes to the cloud even though local is on."** Check `alpha local status`
first, then `nav-pilot config get local_enabled`. A nav-pilot upgrade that bumps the pinned
mlx versions turns the environment stale, and launches go hosted with one line on stderr
until `alpha local init` runs again. That line is easy to miss.

**"init hangs at 0%."** Almost certainly the network. The weights need `huggingface.co`,
`cas-server.xethub.hf.co` and `transfer.xethub.hf.co`; behind TLS inspection the first
works and the other two stall. Not a nav-pilot fault and not fixable from here.

**"start refuses and wants sudo."** Correct. macOS will not let the GPU wire enough memory
by default. The command is in the refusal, and the limit resets at every reboot, so this
recurs after every restart.

## What to collect before escalating

- The whole of `nav-pilot alpha local status`
- `~/.nav-pilot/local/server.log`, at least the tail
- Which client: `nav-pilot config get client`. opencode and the Copilot CLI have different
  shapes and different failure modes
- The task, in the user's words, and whether it created a file or changed existing ones
- For a wrong result, the diff

## What we know breaks, and is not worth escalating

**Concurrent requests wedge the server.** Upstream mlx-lm (#1139, #1256, the latter against
the 0.31.3 we pin). nav-pilot serialises completions machine-wide so it should not be
reachable through a launch, but a developer who calls the server directly can still do it.
That is what `hung` is.

**A rename with 46 references works; writing a new test file does not.** This is the
measured shape of the thing, not a defect. See the findings report.

**It is slower.** Roughly cloud-equal on small edits, up to four times on a rename. On the
largest mechanical change we measured it was faster than the cloud. Wide range, and the
user's impatience is legitimate data.

## Getting rid of it

```
nav-pilot alpha local off      # stop dispatching; weights stay
nav-pilot alpha local purge    # remove everything, ~24 GB, shows what first
```

`off` is reversible with `on` and costs no download. `purge` needs `--yes` and is not.

## What we do not know

Nobody has used this for a working day. Everything measured is single tasks in a clean
repository on one machine: no interruptions, no half-finished work, no colleague waiting.
The first user's experience is the evidence we do not have, which is the whole point of
running an alpha, and a report that this is not worth the bother is as useful as any other.
