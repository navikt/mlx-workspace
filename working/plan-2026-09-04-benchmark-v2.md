# Benchmark v2: what changes, and how this scales to bigger models

4 September 2026, after the `20260903-234313` round and three adversarial
reviews. Supersedes the benchmarking half of
`working/plan-2026-09-03-local-models.md`. The rollout half of that plan stands.

## What the round bought us

The first scored round where the models could not read the rubric, and the first
where the rubric discriminated. Seven scorable submissions:

    qwen3.8-27b-4bit        7/8, 7/8, 5/7
    qwen3.6-35b-a3b-optiq   5/7, 5/7, 5/8, 5/7

Four of eight traps carried no information: 1, 2, 3 and 6 were avoided by every
submission. Trap 4 was hit by every submission. That leaves trap 5 as the only
one that separated the arms, at n=3 against n=4.

Two results worth more than the scores. **Every local model we have measured
prints `UV Index: undefined` and exits 0** when the field is absent; several
wrote a test that would have caught it and ran it only against the live API,
which always supplies the field. And **a passing test suite predicts nothing
about a working program**: across two rounds, one submission called an unimported
function, one guarded `run()` behind `require.main` and loaded it through `bin`,
one shipped a User-Agent that 403s on every live call. All three passed their own
tests.

## The instrument is now the bottleneck, not the models

Of the three failures in this round, two were caused by the harness and one was
scored backwards. The pkill I added on 3 September killed the client mid-prefill,
which took the MLX server down with `METAL Insufficient Memory`, and nothing
restarts the server after a kill, so the implement turn waited out its full cap
against a dead generation thread. A permission rejection ends an opencode session
and the wrapper prints `exit 0`. Both were invisible in the records and both
changed a published number.

Every fix below is aimed at the same thing: a failure in a record should be the
model's failure.

## Changes, ranked, before the next round

1. **Restart and probe the server after any kill.** `bench-weather-cli:94-108`.
   Call `restart_server()` after the pkill, and send a one-token completion
   before every phase, restarting on failure. Without it, one capped plan phase
   costs the implement cap too.
2. **Find the session log by timestamp, not by the wrapper's last line.**
   `bench-weather-cli:144` parses `log:` out of output a killed wrapper never
   prints, so exactly the runs whose logs matter most record `session_log: null`.
   `opencode-headless` knows the path before it launches; print it first. This
   also lets the session id come from the jsonl, which removes the `--continue`
   fallback that is reached only when it is most dangerous.
3. **Treat a permission rejection as an aborted run.** Grep the jsonl for
   `auto-rejecting`, record `aborted: permission`, re-queue. Name workspaces by
   run tag rather than by model key, so there is no repo-id casing for the model
   to "correct" itself into.
4. **Cap turns, not wall-clock.** A 900s plan cap is about 27 turns for
   qwen3.8 and over 100 for qwen3.6. The cap currently measures tokens per
   second and calls it planning.
5. **Equalise context or record compaction.** Three of four qwen3.6 implement
   phases compacted mid-build; no qwen3.8 phase did. Either run both at the
   48 GB contract of 65536, or count `compaction_continue` into the record and
   report it beside the score.
6. **Fix `python3` in the sandbox.** `_sandbox.py` `toolchain_grants` never
   grants the mise python install, so `python3` dies with
   `Fatal Python error: init_import_site`. It cost a turn in 7 of 10 plan phases,
   and a turn costs the slow arm more.
7. **Teach `run_tests()` vitest**, and fall back to `node --test` over discovered
   files when `npm test` exits non-zero with no counts. Two runs this round
   reported null counts while their suites passed 35/35 and 37/37.
8. **Say in the spec whether coordinates are one argument or two.** Three
   submissions read `argv[2]`, three joined `argv`. Any entry-point gate has to
   pick one, so the spec has to say.

## The rubric changes shape

Scoring by five reviewers a round does not scale to more models, and half the
traps are dead weight. The replacement is mechanical.

- **A local fixture server**, with the base URLs overridable by env, one line in
  the spec. Traps 2, 4, 5 and 8 become black-box checks against the program:
  exactly 75, absent UV index, absent cloud fraction, empty timeseries, a 403 for
  `example.com`, a 429. Deterministic, and it stops trap 8 depending on met.no's
  mood.
- **Traps 1, 3 and 7 become greps.** Drop 3 from the denominator: axios `params`
  avoids it for free and nobody has ever hit it.
- **Trap 6 becomes a mutation**: flip the 75 threshold in the shipped source,
  run the model's own tests, expect red.
- **The entry point is a gate, not a ninth trap.** A ninth trap would let a
  program that cannot run score 8 of 9. Run the `bin` entry, record
  `cli: runs|crashes|inert`, report it as the primary result with the trap count
  secondary. Do not exclude failures from the denominator; that is the
  survivorship bias that flattered qwen3.8 in the previous round.

## Scaling to bigger models and harder tasks

The weather CLI is a ceiling check, not a discriminator: at 48 GB every model
writes something plausible, and the traps that separate them are down to one.
Larger models need tasks with a machine-checkable definition of done.

**Build in this order.**

1. **Server watchdog and phase-level resume** (changes 1 and 2 above). Hours of
   work, and nothing else is trustworthy until it exists.
2. **Fixture server and the black-box acceptance runner.** Turns scoring from
   five reviewers into a script, which is what makes more models affordable.
3. **Turn-based caps with parity between arms.** A dense 8-bit model at 64 GB is
   roughly twice as slow again; wall-clock caps would bury it.
4. **Break-fix tasks on the existing targets.** `bench-validate-target` already
   proves every break site matches once and fails the suite. Revert a real fix,
   hand the model the red test, verify with `test`. SWE-bench shaped, no reviewer,
   and the infrastructure is built.
5. **The context curve.** One task at 8k, 32k and 64k prefill per model. A 64 GB
   machine buys context before it buys parameters, and we have never measured
   what the decode rate costs at length. This is the measurement that tells us
   whether the 64 GB tier is worth defining.

**Models to add, all 2026, all currently unmeasured on this suite:**
`qwen3.6-27b-4bit` (16 GB) and `kat-coder-v2.5` (22 GB) in the 48 GB class;
`gemma-4-31b-8bit` (31 GB) and `qwen3.8-27b-8bit` (27 GB, 96 GB wired) above it;
`deepseek-v4-flash-3bit` (105 GB) on the 128 GB machine only. Everything older
than 2026 is out by decision, which removes the whole 70B-class tail.

## What the provider documentation changed

Cerebras serves exactly two public models: `gpt-oss-120b`, a 2025 release, and
`qwen-3.8-27b`, which we already run. Their dedicated-endpoint names are
700B-to-1T class and do not fit any machine here. So there is nothing in that
lineup to adopt. Two things in the documentation matter anyway.

**They keep activations, attention and the KV cache unquantised** and compress
only weights in storage. Their quality claims therefore describe something close
to our 8-bit build, not the 4-bit we have been running as the Qwen3.8 arm.
`mlx-community/Qwen3.8-27B-8bit` is 29.5 GB, fits the 36 GB limit with about
6 GB left for KV, and is already in the cache.

**`reasoning_effort` defaults to `high` for this model, and `"none"` disables
it.** Our qwen3.8 profile sends `{"enable_thinking": false, "reasoning_effort":
"medium"}` while both qwen3.6 profiles send `{"enable_thinking": false}` alone.
Either the two flags contradict each other or one is ignored, on one arm only,
and nobody has checked which. Settle it before the next comparison: send a
request with each combination and read what the server does with it.

**A third arm is worth more than a fourth run.** `qwen3.6-27b-4bit` is the dense
sibling of our alpha model in the same generation and tokenizer family, 16.1 GB,
profile written, weights in the cache, never benchmarked. Published cards put it
above the 35B-A3B on SWE-bench Verified, which is a card claim rather than
anything we have measured, and that is precisely the reason to measure it. If
the experiment still cannot separate the current two, a third arm from the same
family tells us whether the instrument or the models are the problem.

## Rules that stay

One queue, held by the lock. No harness edits between runs of a comparison.
Nothing published from fewer than five runs. Every number in a document comes
from a script that reads the files. A failure is classified from the session log
before it is counted.
