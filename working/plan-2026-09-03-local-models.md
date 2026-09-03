# Local models: rollout, usage, implementation, benchmarking

Written 3 September 2026, after the weather round finished and before the ops
rerun that was scheduled for tonight. It replaces the plan in
working/tonight-2026-09-03.md, which assumed the ops rerun was the next useful
thing to do. It is not.

## Where this actually stands

Three facts, none of them comfortable.

**The ops suite cannot separate the two models, and more runs will not change
that.** Ten runs on a repaired harness: qwen3.6-35b-a3b-optiq 2, 3, 2, 4, 3;
qwen3.8-27b-4bit 4, 4, 2, 4, 4. Exact two-sided Mann-Whitney U = 19 over 252
arrangements, p = 0.21. Four of the eleven tasks are never scored and three
fail for both arms, so the whole comparison rests on three tasks. A one-task
difference at that width needs about fifteen runs an arm. Tonight's ten more
runs of the same suite buy roughly nothing.

**The weather round is not gradeable.** Six runs finished, three an arm.
`bench-weather-cli` calls `workspace-clear` before it starts, so each run
deletes the previous submission from the same model. Two code trees survive out
of six. The turn output is thrown away after the regex reads token counts off
it, and traps 7 and 8 are read from the transcript, so not one of the six can be
scored on those. The round measured wall-clock and test counts, which is the
thing we already had.

**The client cannot dispatch to the local model.** Copilot CLI carries a
subagent's `model:` to the provider, but `COPILOT_PROVIDER_BASE_URL` is
process-wide, so there is exactly one provider per process and no way to point a
subagent at the local server while the main agent stays on the cloud. That is
github/copilot-cli#4703, filed last night, with no maintainer response. Dispatch
was the entire point of the feature.

## What follows from that

Stop trying to rank Qwen3.6 against Qwen3.8. The instrument cannot do it at any
sample size we can afford, and the answer would not change what we ship: 3.6
stays default, 3.8 is opt-in inside 48 GB, both are already in the manifest.
Ranking them was never the decision the benchmark existed to serve.

The decision it should serve is narrower and answerable: **for the task shapes
we actually dispatch, is a local model good enough to send the work to at all?**
That is an absolute threshold against a fixed rubric, not a comparison, and one
model clearing it is a result by itself.

## Phase 1, fix the instrument. Nothing runs until this lands

Neither suite currently keeps enough evidence to score what it ran.

- Archive every submission. `bench-weather-cli` copies the finished `weather-cli`
  tree to `bench/submissions/<key>-<tag>/` before the next run clears the
  workspace. Without this, n>=3 is arithmetic on top of one surviving sample.
- Keep the transcripts. Write each turn's raw output to
  `.bench-logs/weather-<key>-<tag>-<phase>.log`. Traps 7 and 8 are unscorable
  without it, and trap 8 in particular (403 read as throttling) is the one that
  costs five minutes a run.
- Make the result check suite-aware. `bench-models` looks for
  `results-*.json` whatever `BENCH_SUITE` is set to, so it declared run 06 a
  failure while the file sat on disk beside it. My change this morning, and the
  reason a false failure line matters is that it teaches us to ignore the real
  one.
- Extend `harness_sha` past `bench-cheap-ops` to `tasks.json`, `_sandbox.py`,
  `agents-prompt.md` and the profile files. Today a task-set edit leaves the
  generation stamp unchanged, which is exactly the pooling `bench/ops.py` was
  written to refuse.

## Phase 2, benchmarking, split in two

**Track A, the capability gate.** Absolute, not comparative. The weather-cli
challenge scored against the eight pre-registered traps, blind, n>=3 an arm,
with the archive from phase 1 making the blind scoring possible. A model that
avoids 7 of 8 with green tests is fit to dispatch to. One that prints
`UV Index: undefined` and exits 0 is not, whatever it scores against another
model. This is the number that decides the rollout, and it is cheap: two runs
already fit in a night.

**Track B, the comparison, parked.** Ten more ops runs answer a question we do
not need answered. Restart it only when the task set can discriminate, which
means fixing the three known holes first: the sandbox grants gradle but no
usable JDK, `agents-prompt.md` tells the model to run a `mise run` the sandbox
blocks, and four tasks are never scored. Until then the honest published claim
is the one already in MODELS.md, that the experiment cannot separate the two
models.

Tonight's GPU time goes to track A.

## Phase 3, usage, and being honest about the client

Documentation currently implies a working dispatch story. It does not exist in
Copilot CLI, and users found that out by looking at an empty graph.

- Name the supported client. opencode drives the local server today and every
  benchmark number in this repository came through it. Copilot CLI runs the
  local model only as the whole session's provider, never as a subagent.
- Say so where the user is standing, before they spend 25 GB of download on it.
  `nav-pilot alpha local init` now prints the caveat ahead of the download
  prompt; the same sentence belongs in MODELS.md and the alpha onboarding doc.
- Answer #4703 once if it is auto-closed, calmly, with the instrumentation that
  shows the subagent's model id reaching the provider. Three neighbouring issues
  were closed within hours by a templated reply pointing at the BYOK docs.

## Phase 4, implementation, the queue that does not need a GPU

- Per-machine requirements ship. `min_ram_gb` is in the manifest and
  `CheckWiredLimit` enforces it. Next is the 64 GB tier, which is the first
  profile that can hold a model the 48 GB machines cannot.
- `assert_serving_profile` cannot fail while both models sit in the HF cache,
  because `/v1/models` lists the cache rather than what is loaded. Read the
  loaded key from the server instead, or drop the check and stop believing it.
- `bench-results` and `bench-loop-analysis` still glob across harness
  generations. `bench/ops.py` refuses to; those two should route through it or
  go away.
- Config asymmetry between the arms: `MLX_OPENCODE_CONTEXT` 65536 against
  131072, and `reasoning_effort=medium` set on 3.8 only. Harmless for an
  absolute gate, fatal for a comparison, so fix it before track B restarts.

## Decisions, taken 3 September

1. **Tonight's GPU time goes to track A.** Phase 1 lands first, then three
   weather runs an arm that can be scored.
2. **opencode is the documented path for local work.** Copilot CLI is marked
   unsupported for local dispatch until #4703 moves. It matches what works and
   what every number in this repository came through.
3. **The 64 GB tier waits for the capability gate.** If a 48 GB model clears the
   bar the tier is not urgent; if it does not, the tier is the answer, and we
   would rather know which before defining it.

## Phase 1, done

- `bench-models` derives the result-file prefix from `BENCH_SUITE`. It was
  checking for the ops name whatever the suite was, so it called every weather
  run a failure with the file on disk beside it.
- `bench-weather-cli` writes each turn's raw output to
  `.bench-logs/weather-<key>-<tag>-<phase>.log` and records the path in the
  result. Traps 7 and 8 are readable again.
- `bench-weather-cli` copies the finished tree to `bench/submissions/<key>-<tag>/`
  before the next run clears the workspace.
- The two trees that survived today's round are archived under their run tags,
  labelled void. `bench/submissions/README.md` says why.
- The weather suite reads `workspace-clear`'s exit code and refuses to measure
  when the clear failed, and refuses if the workspace holds anything but
  `AGENTS.md`, `opencode.json` and `weather-cli`.

The round of 3 September is void for a reason worse than the missing archive.
`workspace-clear` will not delete git-tracked files, `afb1bd7` tracked the
weather-cli trees that morning, and the suite printed "nothing to do" over the
refusal. Every run started from the finished code of the run before. The trees
are untracked and ignored now.

- `HARNESS_SHA` now exists. It was referenced in the record and defined nowhere,
  added this morning and never run since, so the ops suite would have raised
  `NameError` on the first task tonight. It hashes the suite, `_sandbox.py`,
  `_profiles.py`, `tasks.json` and `agents-prompt.md` together, which also
  closes the "only the suite is hashed" item from the review.

Phase 1 is complete. Neither suite has been run since these edits, so the first
run of either is also their test.

## Rules that stay

One queue at a time, held by the lock. No harness edits between runs of the same
comparison. Nothing published from fewer than three runs, or five for a
comparison. A partial run goes to `bench/partial/`. Every number in a document
comes out of a script that reads the files, never out of a transcript.
