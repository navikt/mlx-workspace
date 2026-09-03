# Weather CLI scoring

Kept out of `weather-cli.md` because that file is copied verbatim into the
model's workspace as `WEATHER_CLI_SPEC.md` and the first prompt is "Read the
weather-cli/WEATHER_CLI_SPEC.md". Between 1 and 3 September the checklist
lived in the spec, so every model in that period was handed the list of traps
it was about to be graded on, the reviewer's instructions, and a sentence
naming which model was expected to win.

## Scoring: the trap checklist

**Pre-registered 1 September 2026, before the next round of runs.** Written down because the
existing scores — 8.5/10 and 6.8/10 — live as prose in `MODELS.md` ("six traps avoided, one hit")
and cannot be reproduced. A score that only one reviewer can arrive at is an opinion with a
decimal point.

Each trap is a yes/no against the produced code. The score is the count of traps avoided out of
the total, and nothing else. No impression, no partial credit, no rounding toward the model you
expected to win.

| # | Trap | Avoided when |
|---|---|---|
| 1 | **UTC drift** | The forecast hour is selected in UTC. Using the host's local time silently returns the wrong hour for anyone not on UTC. |
| 2 | **Boundary at exactly 75** | Cloud cover of exactly 75 lands on the documented side of the threshold. Off-by-one here is invisible until it is wrong. |
| 3 | **URL injection** | The location string is encoded before it goes into the request URL, not concatenated. |
| 4 | **Missing UV index** | A payload without `ultraviolet_index_clear_sky` does not print `UV Index: undefined` and exit 0. Absent data must not read as data. |
| 5 | **Missing cloud fraction** | A payload without cloud cover does not print "Clear". A confident wrong answer is worse than an error. |
| 6 | **A test that cannot fail** | No assertion is wrapped in a `try`/`catch` that swallows it. Node's `assert` throws, so a catch meant to tolerate a network outage silently tolerates the assertion too. One submission reported "20/20 passing" where one could never fail. |
| 7 | **The `example.com` placeholder** | The User-Agent does not contain `example.com`. The spec names it as rejected and gives a working example on the line above; three of four models put it there anyway. |
| 8 | **403 read as throttling** | A hard 403 is not diagnosed as rate limiting. Met.no's block has no `Retry-After` and no `RateLimit-*` headers; real throttling returns 429. Backoff against a wall that never opens costs about five minutes per occurrence. |

### Trap 7 and trap 8 are scored from different evidence

Pre-registered 4 September 2026, before any submission from the `20260903-234313`
round was opened, because the first round showed two reviewers could read the
rule differently.

**Trap 7 is scored from the shipped code.** The User-Agent in the submitted
source either contains `example.com` or it does not. A model that probes the API
with a bad User-Agent, gets a 403 and corrects it has learned the thing the trap
is about, and scoring that as a hit punishes the behaviour we want. A model that
ships `example.com` has not.

**Trap 8 is scored from the session log**, `.bench-logs/<key>-<stamp>.jsonl`, not
from the wrapper summary. It is hit when the transcript shows repeated identical
requests against a 403, or a stated diagnosis of rate limiting for a 403. One
retry after changing something is not backoff. Seventeen retries with the same
rejected header is.

A model that never received a 403 cannot hit trap 8: record `n/a` and reduce the
denominator.

### Rules for the reviewer

**Score blind.** Strip the model identity from the workspace before reading the code. This
matters more now than it did: two instruments already agree that Qwen3.8 produces better output,
so a reviewer who knows which directory is which will find what they expect. Rename to `a/`,
`b/`, `c/` and keep the mapping in a file you do not open until the scores are written down.

**n>=3 per model.** Every conclusion this repository has reversed reversed on a second sample,
never on better reasoning. One generation run is an anecdote with a decimal point.

**Traps 1-5 are read from the code; 6 from the tests; 7-8 from the transcript.** A model that
never reaches the API cannot hit trap 8, and that is not the same as avoiding it — record it as
`n/a` and reduce the denominator rather than awarding a point for work not done.

**Add a trap only between rounds, never during one.** A trap added after seeing the output is a
description of that output.
