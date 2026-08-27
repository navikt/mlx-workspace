# Bundling local models into nav-pilot

Analysis of whether to ship local MLX inference as an alpha command in
[nav-pilot](https://github.com/navikt/copilot), written 27 Aug 2026 against the benchmark data
in [`../MODELS.md`](../MODELS.md) and summarised in [`48gb-question.md`](48gb-question.md).

Short version: hold the bundling. The cost case has a much better shape than expected, but it
points at a different intervention than local models, and one number needs explaining before
we build anything.

## The number that needs explaining

650 seats at $45,000 per month is **$69.23 per seat per month**.

GitHub Copilot Business lists at $19. Enterprise lists at $39. Nav is paying roughly 1.8x
Enterprise list. That difference is $30-50 per seat per month, which is $234,000 to $390,000 a
year, and nobody should build anything until we can explain it.

Three candidates, and they lead to opposite strategies:

| If the gap is | Then the fix is | Local models are |
|---|---|---|
| Premium request overage | Cap or absorb the overflow | A genuine fit, see below |
| Bundled with other GitHub products | Unbundle and attribute properly | Irrelevant to the cost question |
| Contract or reseller markup | A procurement conversation | Irrelevant to the cost question |

Only the first makes local inference part of the answer. Get the invoice breakdown first.

## Break-even, with the real seat price

Assumptions, flagged so they can be corrected: a fully loaded Nav developer at ~700 NOK/hour,
and 10.5 NOK to the dollar. That is **$67/hour, or $1.11 per minute**.

A $69.23 seat buys **62 minutes of developer time per month**.

The benchmark measured one task at 6m 45s locally against well under a minute on Copilot. Call
it six minutes of extra waiting per task. So the seat pays for itself at roughly **10 tasks per
month**.

That cuts both ways, and the segmentation is the useful part:

- A developer running **more than ~10 assisted tasks a month** is cheaper on a Copilot seat.
  Local inference costs Nav money for these people, and the heavier the user the worse it gets.
- A developer running **fewer than ~10** is cheaper served locally, and below about two or three
  a month it is not close.

An earlier pass assumed a $19 seat and concluded the cost case was hopeless. At $69 it is not
hopeless, it is a segmentation problem. That change came from using the invoice instead of list
price.

## Where the money is

Reclaiming unused seats beats local inference by an order of magnitude, and needs no engineering:

| Idle share | Annual saving |
|---|---|
| 20% | $108,000 |
| 30% | $162,000 |
| 40% | $216,000 |

Org-wide rollouts tend to leave a long tail of near-zero users. If Nav's usage data shows that
tail, pulling those seats saves six figures this quarter, with no download, no sudo, and no
support burden.

Local models then have a narrow and defensible role: **serving the people who were reclaimed**.
Those are light users by definition, the segment where the break-even favours local, and their
comparison is not Copilot but nothing at all. Six minutes is an easy sell against nothing.

That reframes the pitch from "cheaper than Copilot" to "covers the tail we stopped paying for".
Same budget outcome, and the benchmark data supports it.

## Fleet fit

Nav developers are mostly on Apple Silicon with 32-48 GB, which is better than the target this
benchmark was designed around. Both models that fit a 48 GB Pro are smaller than that ceiling:

| Model | Resident + KV | 32 GB Mac (~24 GB wired) | 48 GB Pro (~36 GB) |
|---|---|---|---|
| Qwen3.8-27B 4-bit | 14.6 + 3.3 = 17.9 GB | fits with headroom | comfortable |
| Qwen3.6-35B-A3B | 18.6 + 4.7 = 23.3 GB | marginal, needs `vram-set 26` | comfortable |

The dense 4-bit runs across the whole 32-48 GB fleet with no special tuning. It also scored
8.5/10 and took 32m 21s. The trade in one line: **the model that fits every machine is the slow
one.**

MLX is Apple Silicon only. Any developer on Windows or Linux is excluded, and would need a
second backend before a general rollout.

## What the benchmark does not tell you

It measures writing a greenfield JavaScript CLI against two public HTTP APIs. Nav developers
modify existing Kotlin and Ktor services with Kafka, Postgres and Nais manifests.

Nothing measured predicts performance on that work. Different language, different task shape,
and a different context problem, since a real service does not fit in a 131k-token window. A
model that writes a clean weather CLI may be useless at adding a consumer to an existing topic.

The six-minute figure that all the arithmetic above rests on comes from the JavaScript task. It
could be much worse on Nav's real code, which moves the break-even against local inference. Every
number here holds only until a Nav-shaped task is measured.

## Product shape, if it ships

nav-pilot prepares repositories. It writes agents, skills and instructions into a codebase and
hands off to Copilot. Local inference is a different kind of product: it runs a server on a
laptop and points a client at it. A `nav-pilot local` command would be the first one that does
not touch the repo.

The support burden differs too. A bad repo config produces a confusing prompt. A bad local setup
produces a stalled 20 GB download, a machine that beachballs, and a sudo command that must be
re-run after every reboot.

Setup today is mise, a Python venv, oMLX built from source, a 14-20 GB model download, a sudo
VRAM adjustment, and a sandbox. That is roughly a day per developer, which at $67/hour is
$470, or about seven months of the seat it would replace. `nav-pilot local install` has to
absorb all of it. The download and the sudo step cannot be hidden, only explained well.

## Recommended sequence

1. **Get the invoice breakdown.** Explain $69 against a $39 list price. An afternoon of work that
   could redirect the whole project, and may surface a saving needing no engineering.
2. **Pull seat usage data.** An idle tail reclaimed is six figures a year, available now. This is
   the intervention the numbers support.
3. **Add a Kotlin and Ktor task to the benchmark.** Modify an existing service rather than
   create one. Highest-value technical work available, and it decides whether local models are
   viable for Nav work at all.
4. **Three Qwen3.6 runs with corrected sampling.** Thirty minutes. Turns the fastest recorded
   result from a single sample into a measurement with a spread, and fixes sampling both headline
   runs got wrong.
5. **Hold the bundling** until 1 and 3 report. Bundling is cheap to do later and expensive to
   withdraw once developers have installed it.

## What would kill this

- The $69 gap turns out to be contract structure rather than usage. Local models save nothing.
- The Kotlin task shows much worse performance than the JavaScript one. The break-even moves out
  of reach.
- Usage data shows few idle seats. The population local inference is meant to serve does not
  exist.
- A material share of the fleet is not Apple Silicon. The alpha cannot reach the org.

Any one of these is worth knowing before writing the command, and all four are cheaper to check
than to discover after a rollout.
