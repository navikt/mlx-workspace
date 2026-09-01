# Quarantined: `results-qwen3.8-27b-4bit-20260901-QUARANTINED-no-edits-landed.json`

Verified 1 of 8. Still quarantined — but **the reason first written here was wrong**, and the
correction matters more than the quarantine.

## What I first wrote, and why it was wrong

The original note said the run edited no file on any task, and inferred "tool calls not landing".
The transcripts say otherwise. `.bench-logs/qwen3.8-27b-4bit-20260901-012940.jsonl` and
`-013153.jsonl` contain successful edit tool calls. The model was editing.

What actually happened is the profile-mismatch bug. The suite wrote its results to
`results-qwen3.6-35b-a3b-optiq-20260901-011421.json` while the transcripts for the same window
are named `qwen3.8-27b-4bit-*`: `bench-models` invoked the suite with `python3` rather than
`mise run`, so it inherited the launch-time profile and attributed one model's run to another.
Fixed in `185c6dc`, which lands *after* this run (01:26–01:58 against 03:19).

So the score of 1 is not a measurement of this model at all. It is a run whose verification and
whose generation were pointed at different things.

## Why the original criterion was bad, independently of being wrong here

"Zero edit tasks changed a file" is not applied uniformly. `results-granite-4.1-8b.json` has the
same signature and is published as a finding about the model ("never writes"). And
`results-qwen3.8-27b-8bit.json` — 0 tool calls, 2.1s per task, a server that was not up — sits
in `bench/` as an ordinary result. A criterion that quarantines one run and not two others with
the same shape is not a criterion, it is a preference.

**The replacement is mechanical and log-derived:** a run is invalid when the profile the harness
verified is not the profile the client generated with. That is checkable from the transcript
filename against the result filename, needs no judgement, and would have caught this without
anyone looking at the score.

## What this does to the published numbers

The four remaining runs stand — they postdate the fix and their transcript and result names
agree. The mean of 5.75 is unchanged. But the *reasoning* published alongside it was wrong, and
it was wrong in the direction that made the story tidier: "the model is erratic, one run was
tool calls failing" reads better than "our harness mislabelled a run and we did not notice for a
day".

Kept, not deleted, for the same reason as before.
