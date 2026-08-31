# Cleaning up the documents in this repo

The complaint is fair and specific: thirteen files sit in `reports/` and nothing tells you
which are finished, which are still being written, and which were true a week ago and are not
now. Specs live in three different places. One file is a stale copy of an agent that has since
been renamed, and one is an aider chat log that should never have been committed.

## The rule this is built on

**A document is either finished or it is working, and it says which in its first line.**

- **Finished** means: the numbers in it are reproducible, it will not change except to
  correct an error, and it is safe to link from outside this repo. It carries a date.
- **Working** means: it is being edited, and anyone reading it should expect it to change
  under them. No external link should ever point at one.
- **Superseded** means it was one of the above and no longer holds. It is kept because
  deleting the record of a wrong conclusion is how a team repeats it.

Everything else about the layout follows from that.

## What each document actually is

| File | Really is | Goes to |
|---|---|---|
| `local-inference-findings.md` | The study. Externally linked. | `reports/` — **path unchanged** |
| `alpha-model-decision.md` | A decision, made and closed | `reports/` |
| `48gb-question.md` | A question, answered and closed | `reports/` |
| `night-results-2026-08-31.md` | Finished results of one night | `reports/` |
| `alpha-runbook.md` | Operational, for whoever is on triage | `runbooks/` |
| `benchmark-suite-plan.md` | Working: what to measure next | `working/` |
| `alpha-onboarding-plan.md` | Working: the path to the first user | `working/` |
| `night-plan-2026-08-31.md` | Working, and now spent | fold into the results |
| `alpha-status.md` | Working tracker | `working/` |
| `plan-forward.md` | Superseded by the onboarding plan | `archive/` |
| `nav-pilot-path.md` | Superseded: argues a decision now made | `archive/` |
| `status-2026-08-27.md` | Superseded, says so in its own first line | `archive/` |
| `docs-cleanup-plan.md` | This. Working, delete when done | `working/` |

## The one path that must not move

`reports/local-inference-findings.md` is linked from PR #483 and will be linked from the
news article. It stays exactly where it is. Everything else reorganises around it, which is
the opposite of the usual instinct to put the most important document in the nicest place.

## Specs

Four spec files in two locations: `CHEAP_OPS_SPEC.md` and `WEATHER_CLI_SPEC.md` at the root,
`ESCALATION_SPEC.md` and `REFACTOR_SPEC.md` under `bench/`. They are all the same kind of
thing — what a benchmark measures and how — and they belong beside the harnesses that
implement them, in `bench/specs/`, named in lower case like everything else there.

## Deletions

- `.aider.chat.history.md` — a chat transcript, committed by accident. Delete and gitignore.
- `bench/agents/lokal-arbeider-{en,no}.agent.md` — copies of an agent that was renamed to
  `local-worker` two days ago. They are what the language experiment ran against, so they are
  evidence, not junk: they move to `bench/agents/archive/` with a note saying which
  experiment used them, rather than being deleted.

## Result

```
README.md                  what this is, how to run a benchmark
BENCHMARKING.md            how the harnesses work
MODELS.md                  the working record of every run

reports/                   FINISHED. Dated, reproducible, safe to link.
  local-inference-findings.md
  alpha-model-decision.md
  48gb-question.md
  night-results-2026-08-31.md

working/                   IN PROGRESS. Expect these to change.
  benchmark-suite-plan.md
  alpha-onboarding-plan.md
  alpha-status.md

runbooks/                  OPERATIONAL. For someone on call.
  alpha-runbook.md

archive/                   SUPERSEDED. Kept so we do not repeat ourselves.
  plan-forward.md
  nav-pilot-path.md
  status-2026-08-27.md

bench/specs/               what each benchmark measures
  cheap-ops.md  escalation.md  refactor.md  weather-cli.md
```

## What this does not do

It does not merge or rewrite the contents of any document. Moving files and changing what a
folder means is reversible and reviewable; rewriting six documents in the same commit is
neither. The `night-plan` and `night-results` pair is the single exception, because the plan
was written to be spent and the results already quote it.
