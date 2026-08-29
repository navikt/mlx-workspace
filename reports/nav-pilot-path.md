# Bundling local models into nav-pilot

Whether to ship local MLX inference as an alpha command in
[nav-pilot](https://github.com/navikt/copilot), 27 Aug 2026, against the benchmark data in
[`../MODELS.md`](../MODELS.md) and [`48gb-question.md`](48gb-question.md). Hold the bundling: the
cost case looks better than expected but points at a different fix, and one number needs explaining.

## The number that needs explaining

650 seats at $45,000 per month is **$69.23 per seat per month**. GitHub Copilot Business lists at
$19, Enterprise at $39. Nav pays roughly 1.8x Enterprise list. That gap is $30-50 per seat per
month, $234,000 to $390,000 a year, and nobody has explained it.

| If the gap is | Then the fix is | Local models are |
|---|---|---|
| Premium request overage | Cap or absorb the overflow | A genuine fit, see below |
| Bundled with other GitHub products | Unbundle and attribute properly | Irrelevant to the cost question |
| Contract or reseller markup | A procurement conversation | Irrelevant to the cost question |

The overage row is confirmed. Our heaviest users burn their premium request allowance against a
$400 monthly cap, and that is what prompted this work. It does not explain the seat price, so
$69.23 against $39 list stays an open invoice question, and a separate one from anything local
models can fix.

## Break-even, with the real seat price

Assumptions, open to correction: a Nav developer fully loaded at ~700 NOK/hour and 10.5 NOK to the
dollar, so **$67/hour, or $1.11 per minute**. A $69.23 seat buys **62 minutes of developer time per
month**. The benchmark measured one task at 6m 45s locally against under a minute on Copilot. Call
it six minutes of extra waiting, and the seat pays for itself at roughly **10 tasks per month**.

The segmentation is the useful part. Above ~10 assisted tasks a month a developer is cheaper on a
Copilot seat, and the heavier the user the worse local gets. Below ~10 local wins, and below two
or three a month it is not close. An earlier pass assumed a $19 seat and called the cost case
hopeless. At $69 it is a segmentation problem, and reading the invoice is what changed it.

## Where the money is

Reclaiming unused seats beats local inference by an order of magnitude, and needs no engineering:

| Idle share | Annual saving |
|---|---|
| 20% | $108,000 |
| 30% | $162,000 |
| 40% | $216,000 |

Org-wide rollouts leave a long tail of near-zero users. If Nav's usage data shows that tail, pulling
those seats saves six figures this quarter, with no download, no sudo, and no support burden. Local
models then have one defensible role: serving the people reclaimed. They are light users by
definition, where break-even favours local, and their comparison is not Copilot but nothing at all.

## Fleet fit

Nav developers are mostly on Apple Silicon with 32-48 GB, better than the target this benchmark was
designed around. Both models that fit a 48 GB Pro are smaller than that ceiling:

| Model | Resident + KV | 32 GB Mac (~24 GB wired) | 48 GB Pro (~36 GB) |
|---|---|---|---|
| Qwen3.8-27B 4-bit | 14.6 + 3.3 = 17.9 GB | fits with headroom | comfortable |
| Qwen3.6-35B-A3B | 18.6 + 4.7 = 23.3 GB | marginal, needs `vram-set 26` | comfortable |

Both run across the 32-48 GB fleet, the MoE needing `vram-set 26` on a 32 GB machine. MLX is Apple
Silicon only, so Windows and Linux developers are excluded until a second backend exists.

## What the benchmark does not tell you

It measures writing a greenfield JavaScript CLI against two public HTTP APIs. Nav developers modify
existing Kotlin and Ktor services with Kafka, Postgres and Nais manifests. Nothing measured predicts
that work: different language, different task shape, and a real service does not fit a 131k-token
window. Eleven Kotlin operations have since been measured against `navikt/isoppfolgingstilfelle` at
a 12.7s median, which is a different task shape from a from-scratch build and does not replace the
six-minute figure the arithmetic above rests on. The break-even has not been recomputed on it.

## Product shape, if it ships

**The model layer is what we contribute, and it is the only part missing.** `navikt/grillmester`
already ships the agent payloads through a Tier 2 agentpakke contract wired to nav-pilot, and
deliberately does not own model selection: `defaultModel: "inherit"`, no catalog. `mise run
model-manifest` generates `manifest/models.json` from `profiles/`, which fills exactly that gap, and
composing with `grillmester local setup|doctor|launch` beats rebuilding it. Issue #14.

The support burden is the risk. A bad repo config produces a confusing prompt. A bad local setup
produces a stalled 20 GB download, a beachballing machine, and a sudo command to re-run every
reboot. Setup today is mise, a Python venv, oMLX built from source, a 14-20 GB model download, a
sudo VRAM adjustment, and a sandbox: roughly a day per developer, which at $67/hour is $470, about
seven months of the seat it would replace. Whatever ships has to absorb all of it, and the download
and the sudo step cannot be hidden, only explained.

## Recommended sequence

1. Get the invoice breakdown. Explain $69 against a $39 list price. An afternoon of work.
2. Pull seat usage data. An idle tail reclaimed is six figures a year, available now.
3. Recompute break-even on the Kotlin numbers. The task shape developers actually hit is the one
   the arithmetic should use.
4. Three repeat runs of the chosen model. Thirty minutes, and n = 1 becomes a spread.
5. Hold the bundling until 1 and 3 report. Cheap later, expensive to withdraw after install.

## What would kill this

- The $69 gap turns out to be contract structure rather than usage. Local models save nothing.
- Recomputed on Kotlin work, the break-even moves out of reach.
- Usage data shows few idle seats. The population local inference would serve does not exist.
- A material share of the fleet is not Apple Silicon. The alpha cannot reach the org.
