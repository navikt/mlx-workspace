# bench

The measurement apparatus: harness support, targets, specs, and the raw result JSON behind
every table in `MODELS.md`.

## `agents-prompt.md` is the prompt under test

It is copied verbatim into every benchmark workspace as `AGENTS.md` before every run, so the
model being measured reads exactly those words and nothing else.

**Editing it changes the experiment.** Results taken after a change are not comparable with
results taken before one. `quarantine/` already holds a whole class of runs invalidated
exactly this way: `.POLLUTED`, measured through a system prompt carrying 8.5k tokens of
instructions the benchmark never chose.

It does not live at the repo root, where it used to, because the root `AGENTS.md` is read by
coding agents working *on* this repository. One file cannot be both an experimental variable
and a set of house rules: every house rule added to it would have been silently prepended to
every future measurement. The move was byte-preserving, so results before and after remain
comparable.

If you do change it: record the change in `MODELS.md` with a date, and treat every earlier
result as a different condition.

## What is here

| | |
|---|---|
| `agents-prompt.md` | The prompt under test. See above |
| `specs/` | What each benchmark measures: cheap-ops, weather-cli, escalation, refactor |
| `targets/` | One file per repository under test: its pinned ref, its verification commands, and its tasks |
| `analyse.py` | Recomputes every figure in `reports/`. Run it before trusting a number |
| `results-*.json` | Capability ladder, one file per model build |
| `hybrid-*.json`, `copilot-*.json`, `refactor-*.json` | Cost ladder, one file per target, rung and arm |
| `task-classes.json` | Task id → class (`read-qa`, `edit-single`, `edit-multi-mechanical`, `create-file`, `debug`). Not in `tasks.json`, which is hashed into `harness_sha` |
| `quarantine/` | Runs that are not results, kept for provenance. The suffix names the condition |
| `agents/archive/` | Worker agents from before the `local-worker` rename, kept because the language experiment ran against them |

## Before adding a target

Run `mise run bench-validate-target <name>`. It proves the baseline is green, that every break
site matches exactly once, and that every break actually fails the suite. A target that has
not passed it is not measurable, and finding that out mid-run costs a night.

## Re-scoring what goes local (the capabilities loop)

The rules are in `reports/2026-09-24-local-vs-cloud-routing/design.md` §2 and §4. After any run
that adds samples, a new offered model or profile, a harness change or a dispatch-text change:

1. `mise run bench-results -- --by-class` shows class × model × mode × condition: k/n, distinct
   tasks, runs and the one-sided 90% Wilson lower bound. Conditions are never pooled.
2. `mise run bench-capabilities` applies the bar and writes `manifest/capabilities.json`, with
   the condition and source files behind every verdict. `--self-check` runs its asserts;
   `--check` fails when the committed file is stale, and `mise run analyse` runs that check.
3. `mise run model-manifest` copies each model's verdicts (enums and counts only) into its
   `capabilities` block in `manifest/models.json`. An offered model with no runs gets `cloud`
   for every class.
4. Open a PR. Merging it to `main` publishes: nav-pilot picks the block up on its next manifest
   fetch and rebuilds the dispatch policy from it. nav-pilot releases that predate the block
   ignore it and keep their built-in text.

A new task needs a class in `task-classes.json`, or its runs are left out of every class. To
keep a task out of the bar without deleting it, set `"exclude_from_bar": true` with a `reason`.
