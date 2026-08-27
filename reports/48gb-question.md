# The 48 GB question

Local model evaluation, 26-27 Aug 2026. weather-cli benchmark, opencode with mlx-lm and oMLX,
36 GB wired cap, 16k output reserve, sandboxed.

Seven models ran the same coding task. Two of them fit a 48 GB Pro. They disagree so completely
about how to spend the machine that there is no single answer to recommend.

## What seven models did

Every model built the same Node.js weather CLI against live Met.no and Geonorge APIs, from the
same two prompts. The last three ran under a 36 GB wired cap, which is what a 48 GB Pro actually
allows.

| Model | Arch | Plan | Implement | Total | Tests | Code | RSS |
|---|---|---|---|---|---|---|---|
| Qwen3.6-35B-A3B (fits 48 GB) | MoE 35B / ~3B active | 34.9s | 6m 10s | **6m 45s** | 20/20 ‡ | 6.8/10 | 18.6 GB |
| DeepSeek-V4-Flash | MoE 284B / 13B active | 4m 43s | 5m 26s | 10m 09s | 17/17 † | n/a | 79 GB |
| Qwen3.8-27B MTPLX | Dense 27B + MTP | 1m 23s | 8m 47s | 10m 10s | 16/16 | n/a | 28.9 GB |
| Gemma-4-31B | Dense 31B, hybrid attn | 4m 02s | 16m 21s | 20m 23s | 16/16 | n/a | 30.9 GB |
| Qwen3.8-27B 4-bit (fits 48 GB) | Dense 27B, no drafter | 5m 16s | 27m 05s | 32m 21s | 25/25 | **8.5/10** | **14.6 GB** |
| Qwen3.5-9B | Dense 9B, MLA | n/a | n/a | n/a | 4 attempts, no plan | n/a | 5.1 GB |
| Qwen2.5-72B | Dense 72B | n/a | n/a | n/a | never wrote a file | n/a | 72 GB |

† Self-reported; the workspace was deleted before it could be checked.
‡ 19 tests that can fail, plus one that cannot. See below. Code scores are the weighted rubric;
only the two capped runs have been reviewed so far.

Speed and quality came apart in both directions. The slowest finisher wrote the best code. The
fastest wrote the worst. Both fit the target machine, and nothing in a stopwatch would have told
you which to trust.

Qwen3.8-27B at 4-bit takes 4.8x longer than the MoE and scores 8.5/10. It avoided every trap on
the checklist: UTC-safe time selection, strict cloud thresholds correct at exactly 75,
injection-proof URL building. Qwen3.6-35B-A3B finishes in under seven minutes and scores 6.8. It
ships two paths that print a confident wrong answer rather than failing, and one test that
structurally cannot fail.

## Two models fit. They are opposites.

Measured under `vram-set 36`, the ceiling a 48 GB Pro allows. Yesterday nothing fit; today the
question is which trade to take.

| Model | Footprint | Against a 36 GB ceiling |
|---|---|---|
| DeepSeek-V4-Flash 2.4-bit | 79 GB | Exceeds 48 GB outright |
| Gemma-4-31B 8-bit | 31 GB + ~26 GB KV at 30k | Over, and the cache is the problem |
| Qwen3.8-27B 8-bit + MTP | ~35 GB with cache and activation | No working room left |
| Qwen3.6-35B-A3B 4-bit | 18.6 GB resident + 4.7 GB KV | Fits, measured |
| Qwen3.8-27B 4-bit | 14.6 GB resident + 3.3 GB KV | Fits, measured |

The bottom two are measured peak RSS under the cap, not estimates. Neither came close to the
ceiling across a full run.

Capacity was never the binding constraint. Both fitting models sat at half the ceiling all run.
What separates them is decode speed and code quality. Those point in opposite directions.

The dense 4-bit costs time. It has no drafter: the MTP head is published as `qwen3_5_mtp`, which
only oMLX can load, and oMLX cannot serve this build. Against the 8-bit's 10m 10s on identical
work, the same model at half the weights took 32m 21s. Halving the bytes per token did not halve
the clock, because the 8-bit run had speculative decoding and this one has none.

The MoE costs trust. Roughly 3B active parameters make each turn cheap. It took more turns than
the dense build, backtracked to fix its own bugs, and still finished five times sooner. But it
omits per-field checks, so a Met.no entry missing its UV index prints `UV Index: undefined` and
exits 0, and a missing cloud fraction reports a confident "Clear".

Attention architecture, not parameter count, decides the cache: Qwen3.6's MQA holds 0.30 GB where
the dense 4-bit holds 1.10 GB and Gemma needs 865 KB per token. That last figure is what rules
Gemma out, and no quantization recovers it.

## What actually moved the numbers

Ranked by measured effect. The top three all beat changing model, which lands seventh.

1. **Two sentences of spec precision** (-82% plan). Naming 403 as a hard block and 429 as
   throttling stopped the model reasoning its way there. Plan phase fell from 7m 58s to 1m 23s.
2. **An output cap that fits the thinking** (2 runs lost). At `max_tokens 4096` runs died mid-file
   with `finish_reason=length`. Two profiles were still carrying 4096 into today's runs. A failure
   waiting to happen, found by reading configs rather than by hitting it again.
3. **Choosing the right backend** (43s to 27s per turn). Gemma was served by mlx-vlm, which clears
   the KV cache after every request. Its `model_type` is `gemma4`, which mlx-lm supports; only
   `gemma4_unified` needs mlx-vlm.
4. **Sampling from the model card** (loop to 23.4s). Qwen3.5-9B collapsed into `DIDIDIDI...`
   forever at the default settings. Setting `top_k = 20` turned that same run into a 23.4s plan,
   the fastest measured. Both Qwen profiles had shipped with it disabled.
5. **Which tool the model reaches for** (8m 18s stall). Asked to check the APIs, one model used
   `webfetch`, which pulls pages through context and truncates. It then reasoned for 8m 18s about
   a payload it never fully received. Models that used `curl` had the same data in a second.
6. **Speculative decoding** (2-3x decode). Qwen3.8's MTP drafter emits 2.8-3.5 tokens per forward
   cycle at 80-95% acceptance, the difference between 11-14 tok/s and 18-38 tok/s on identical
   weights. Its absence is the whole 4-bit gap.
7. **Changing the model** (last resort). Real, but smaller than any of the above, and rarely the
   first thing worth changing.

Quantization degrades instruction-following before it degrades code. Qwen3.8-27B at 8-bit obeys
the rule against drafting files inside `<think>`. The identical model at 4-bit ignores it. It
drafts whole files in reasoning, rewrites them as tool calls, and stalls for minutes on a spec
line the 8-bit reads once. Its code still scored 8.5/10. What broke was the following of
instructions, not the writing of software.

A sampling parameter changed the plan of attack, not just the prose. With `top_k` disabled,
Qwen3.5-9B chose `webfetch` and dispatched a sub-agent to read an entire API documentation set.
With `top_k = 20` and nothing else changed, it used `curl`, dispatched nothing, and planned in
23.4s.

## What the benchmark was quietly not measuring

Every one of these presented as a slow or capable model. None of them was.

**A test that cannot fail.** One submission wrapped eight assertions in a `try`/`catch` meant to
tolerate a network outage. Node's `assert` throws, so the catch swallowed the assertions too.
"20/20 passing" was 19 that could fail and one that could not. Cost: a headline number, nearly
believed.

**A workspace that wasn't empty.** Two of the three directories used today still held a previous
run's finished implementation. A model that finds working code already in place is not being
measured at all. Cost: caught before the runs, not after.

**A model reading its competitors.** Nothing confined the agent to its own directory. One walked
out with an absolute path and listed every other model's finished solution, one `cat` from a free
answer. The submissions were structurally unalike, so nothing was copied. That was luck. Cost:
none yet, by chance.

**A model editing the host.** Another hallucinated a `geonorge` CLI, wrote code that shelled out
to it, then tried to make it exist: `npm install -g`, four `brew install` variants, and a
`brew tap` that cloned into `/opt/homebrew` before failing on auth. Cost: a Homebrew metadata
refresh.

**A placeholder the models cannot resist.** Met.no rejects a User-Agent containing `example.com`
with a bare 403. Three of four models put it there anyway. The spec names it as rejected and gives
a working example on the line above. One read the 403 as rate limiting and built backoff against a
wall that never opens. Cost: ~5 min per occurrence.

**A knob with no handle.** The repetition loop that killed a run has a textbook remedy:
`repetition_penalty`. The server accepts it per request but exposes no CLI flag, so no profile can
reach it. The one setting that addresses the failure directly was unreachable. Cost: one run, and
a gap still open.

Runs now launch under `cplt`, a kernel-level sandbox: reads and writes are confined to the model's
own workspace, with the inference port allowed back in explicitly. Verified after the change: the
model reaches Met.no and the local server, while listing a sibling workspace or touching
`/opt/homebrew` both fail with `Operation not permitted`.

## How we evaluate the next model

The protocol as it now stands, in the order it has to happen.

1. **Check `model_type` exactly.** Read it from the model's own `config.json` and confirm a
   matching backend module exists. Never match on a family prefix.
2. **Apply the model card's sampling.** Not temperature alone. A disabled `top_k` cost one model
   four attempts and produced a repetition loop that looked like a hung server.
3. **Confirm the workspace is empty.** Not that the task says it clears it. Look. Two of three
   held a previous run's code.
4. **Launch sandboxed.** Confine the agent to its own directory. Models read their neighbours and
   write to the host, and neither shows up in the result.
5. **Run both prompts verbatim.** The wording is itself the strongest lever, so changing it
   invalidates the comparison.
6. **Verify the tests yourself.** Run them before anything is cleared, and read the test bodies. A
   passing count is only as good as its weakest test. Check exit codes without a pipe: `$?` after
   a pipeline is the last command's status, not the program's.
7. **Review the code against a fixed rubric.** Same dimensions, same weights, same trap checklist
   for every model. Speed and quality came apart in both directions; only a rubric catches that.
8. **Sample memory against context.** Peak RSS and KV growth decide the 48 GB question. Attention
   architecture, not parameter count, drives the cache.

## What this does and does not establish

The hardware answer is solid. The model ranking is not, and it would be easy to read this page as
though it were.

| Claim | Confidence | Why |
|---|---|---|
| Both 4-bit builds fit a 48 GB Pro | high | Measured peak RSS across full runs under the cap, at roughly half the ceiling. Capacity arithmetic transfers between machines |
| Attention architecture, not size, drives KV cost | high | Consistent across four architectures spanning 9B to 284B, with a mechanistic explanation |
| Harness levers beat model choice | high | Five independent levers produced large effects; three of four failures this session were harness-permitted |
| The MoE is ~5x faster | medium | One run each. The gap is far too large to be noise, but the magnitude is a single sample and the two runs are not like-for-like |
| The dense 4-bit writes better code | low | 8.5 against 6.8, one run each, one unaudited reviewer. That margin sits inside plausible run-to-run spread |
| Anything about a real 48 GB Pro's speed | untested | Capping wired memory reproduces the ceiling, not the halved bandwidth. Expect roughly half these speeds |

Every run here is n = 1. These are single samples of a stochastic process at temperature 0.6, with
no repeats and therefore no variance estimate. Wall-clock gaps of 5x survive that; an
8.5-versus-6.8 code score does not.

And both headline runs used sampling we now believe is wrong. Each ran with `top_k` disabled and
`top_p` at 1.0, against the model card's `top_k 20` and `top_p 0.95`, the exact setting whose
absence turned a third model's run into a repetition loop.

Three further limits worth stating plainly. The 6 GB rung is unmeasured, not disproven.
Qwen3.5-9B failed four times, but it is the oldest model tested and both its successors work. Only
two of seven models have been graded at all; four finished submissions sit in git, ungraded. And
this is one task, a CLI against two HTTP APIs. Nothing here licenses a claim about refactoring,
debugging, or anything stateful.

## Pick the trade, not the model

There is no single answer for 48 GB. Both candidates fit; they fail in opposite directions.

| If you | Run | And accept |
|---|---|---|
| value correctness over turnaround | Qwen3.8-27B 4-bit | 32m 21s per task. Best code measured, smallest footprint, no drafter exists for this build |
| value turnaround over correctness | Qwen3.6-35B-A3B | 6m 45s, and a review you actually have to do. Budget the time you saved on inference |
| have 96 GB or more | Qwen3.8-27B MTPLX Q8 | 10m 10s with the drafter that makes it fast. Needs oMLX, and does not fit a Pro |
| want Gemma | reconsider | Correct, and priced out: 865 KB/token of cache no quantization recovers |

Fix the harness before you change the model. Six of the seven levers that moved these numbers were
configuration, prompt wording, or tooling. A model swap was the smallest of them, and three of
today's four failures were things the harness allowed rather than things a model got wrong.

Next: enable thinking on the MoE, to separate "sparse is fast" from "no reasoning tokens is fast";
disable it on the dense 4-bit, whose two costly stalls were both reasoning-phase; grade the four
finished submissions still sitting ungraded in git; and give profiles a way to reach
`repetition_penalty`.

---

Working notes: [`MODELS.md`](../MODELS.md). Benchmark: [`WEATHER_CLI_SPEC.md`](../WEATHER_CLI_SPEC.md).
Rig A, M1 Max 32 GB. Rig B, M5 Max 128 GB. Target, 48 GB Pro.
