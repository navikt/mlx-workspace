# Archived submissions

One directory per weather-cli run, named `<model key>-<run tag>`, copied out of
the workspace before the next run's `workspace-clear` deletes it. `node_modules`
is excluded; everything the model wrote is here.

This exists because the round of 3 September 2026 could not be scored. Six runs
finished, three an arm, and four of the six code trees were gone by the time
anyone read them: each run cleared the workspace its predecessor had written
into. Only the last run of each model survived, `qwen3.8-27b-4bit` run 05 and
`qwen3.6-35b-a3b-optiq` run 06, and those two are the first entries here.

Runs 01 through 04 of tag `20260903-072930` are not recoverable. Their result
files hold the timings, token counts and test results; the code they describe no
longer exists.

## Scoring blind

The rubric in `bench/specs/weather-cli.md` requires the scorer not to know which
model wrote which submission. These directory names carry the model key, so
before scoring, copy the submissions to `a/`, `b/`, `c/` in a scratch directory,
write the mapping to a file, and do not open it until the scores are written
down.
