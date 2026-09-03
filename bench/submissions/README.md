# Archived submissions

One directory per weather-cli run, named `<model key>-<run tag>`, copied out of
the workspace before the next run's `workspace-clear` deletes it. `node_modules`
is excluded; everything the model wrote is here.

This exists because the round of 3 September 2026 could not be scored, and then
turned out to be void for a second reason.

Six runs finished, three an arm, and only two code trees were on disk when
anyone looked: `qwen3.8-27b-4bit` run 05 and `qwen3.6-35b-a3b-optiq` run 06.
The first reading was that each run's `workspace-clear` had deleted its
predecessor. It had not. `workspace-clear` refuses to delete git-tracked files,
`afb1bd7` had swept these trees into git that morning, and the suite ignored the
refusal and logged "nothing to do". So every run began on top of the finished
code of the run before it, and the two surviving trees are cumulative, not
submissions. The tag `20260903-072930` measures nothing and is kept only as the
record of how it failed.

Runs 01 through 04 of that tag do not exist in any form. Their result files hold
timings, token counts and test results for work that was partly done by an
earlier run.

## Scoring blind

The rubric in `bench/specs/weather-cli.md` requires the scorer not to know which
model wrote which submission. These directory names carry the model key, so
before scoring, copy the submissions to `a/`, `b/`, `c/` in a scratch directory,
write the mapping to a file, and do not open it until the scores are written
down.
