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
| `quarantine/` | Runs that are not results, kept for provenance. The suffix names the condition |
| `agents/archive/` | Worker agents from before the `local-worker` rename, kept because the language experiment ran against them |

## Before adding a target

Run `mise run bench-validate-target <name>`. It proves the baseline is green, that every break
site matches exactly once, and that every break actually fails the suite. A target that has
not passed it is not measurable, and finding that out mid-run costs a night.
