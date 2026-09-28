# Follow-ups 2: GPT-6 Sol as orchestrator, and presence_penalty

Two items the user decided on 2026-09-27. Both run from
[followups-2-launcher](followups-2-launcher), after the per-level dispatch probe and follow-ups 1.
Nothing here ships in nav-pilot.

## Queue

| # | What | Starts when | Expected start | Takes |
|---|---|---|---|---|
| – | 64-4 / 64-5 (launcher 98187) | running | – | ends ~01:00 28 Sep, worst case ~06:00 |
| – | `local_endpoint` validation (agent) | after 64-5 | ~01:00 28 Sep | ~1 h (guess) |
| – | per-level dispatch probe (dlv-waiter, touches `dispatch-levels.done`) | after the validation | ~02:00 | ~2 h |
| – | follow-ups 1 (fu1-launcher, pid 4384) | after the probe | ~04:00 | ~3 h 30 min |
| 1 | **GPT-6 Sol**, cap $15 | `dispatch-levels.done`, fu1-launcher gone, GPU free 5 min | **~07:45 28 Sep** | done, $6.14 (#118) |
| 2 | **presence_penalty A/B** | after item 1 (`gpt6-sol.done`), GPU free 5 min | **~10:45 28 Sep** | done 12:20–18:58, [review](presence-penalty-night.md) |

The times assume each step starts as soon as the one before it ends. The validation is an agent
task, so if it starts late everything after it moves by the same amount. The launcher gives up at
2026-10-02 06:00.

Start the launcher:

```sh
cp reports/2026-09-28-orchestrator-and-penalty/followups-2-launcher ~/tmp/fu2-launcher \
  && nohup bash ~/tmp/fu2-launcher >> .bench-logs/followups-2-launcher.log 2>&1 &
```

## 1. GPT-6 Sol as the cloud orchestrator

**Question.** Across probes 1–5 Sonnet 5 delegated in 1 of 29 hybrid samples. Does GPT-6 Sol
delegate on the same cells? And on work it keeps, does it match Sonnet 5's pass rate and cost?

**Availability, checked 2026-09-27.** `opencode models` lists `github-copilot/gpt-6-sol`. A
one-line `opencode run --pure -m github-copilot/gpt-6-sol` through Nav's Copilot login answered
"OK" and opencode priced it at $0.027. nav-pilot maps the bare id `gpt-6-sol` to
`github-copilot/gpt-6-sol`. So bench-hybrid and bench-frontier can use it through
`BENCH_CLOUD_MODEL` and `--cloud`. models.dev prices it the same as Sonnet 5 on Copilot ($2 in,
$10 out, $0.2 cache read per M tokens). At the start of the run, the launcher sends one gate
session through each nav-pilot binary (`bench-frontier cloud-probe`). If a gate fails, the
matching part is skipped and the log names it as a blocker.

**Cells.** These match the dispatch probes. The workers, the bench-only capabilities block, the
binary and n = 2 per level are the same as probe 6 (the dlv-waiter), so each GPT-6 Sol cell lines
up with a Sonnet 5 cell:

| Cells | Worker | Sonnet 5 so far |
|---|---|---|
| `isoppfolgingstilfelle-large` r4, r6 (thread-arg) | optiq-64g | probe 4: 0/6 dispatched |
| `isoppfolgingstilfelle-small` r3 (false positive) | optiq-64g | probe 6 control |
| `isoppfolgingstilfelle-tests` r1, r2 (5 test files) | 8-bit | probe 5: 0/6 dispatched, control 10/10 files per cell at $0.30–0.33 |

Levels: conservative (advisory text, no gate, the closest to probes 4–5), aggressive, then
balanced. Each GPT-6 Sol cell gets one control of its own. Binary `nav-pilot-xdgctx-f5c90a3c`.
The tags read `probe-f5c90a3c-gpt-6-sol-<level>-caps`. `dispatch-probe` now adds any orchestrator
other than Sonnet 5 to the tag, and Sonnet 5's tags are unchanged.

**Frontier slice.** The classes the probe cells come from, cloud-only, at n = 2: edit-multi-mechanical
r4 and r6, and create-file r1–r3. It uses the binary Sonnet 5's frontier arm ran on
(`nav-pilot-main-2e1e8ee1`). It runs only if `harness_sha` is still `df7deb1af416`, Sonnet 5's value.
If frontier harness v2 has landed by then, the slice is skipped. Sonnet 5 at that sha: em r4 10/10
($0.129 a sample), r6 10/10 ($0.167); cf r1 2/4 ($0.08), r2 4/4 ($0.18), r3 4/4 ($0.21).

**Budget.** There is one ledger for both parts, `.bench-logs/gpt6-sol-*/ledger.json`, capped at
$14.75. bench-hybrid and bench-frontier both check it before each sample, and bench-hybrid kills
a sample in flight at the cap. The two gate sessions (~$0.05 each) run outside the ledger. So is
today's $0.03 check. That keeps the total under $15. The order is set by value: conservative and
aggressive with controls, then the frontier slice, then balanced, which the cap may cut. At
Sonnet 5's per-sample costs the full run is about $11.

**Outcome.** The dispatch rate per level, set against Sonnet 5 at the same level. Also: whether
dispatched samples pass, and cost against GPT-6 Sol's own control. The GO rule is the probes'
rule: ≥ 50 % dispatched, the dispatched samples pass, and cost ≤ control. Write the short report
as `gpt6-sol.md` in this directory. The files are in `.bench-logs/gpt6-sol-*/`, and the frontier
JSON is `bench/frontier-cloud-gpt-6-sol-*.json`.

## 2. presence_penalty A/B

**Support.** mlx_lm.server 0.32.0 takes `presence_penalty` per request only, with no CLI flag
(server.py:1182). It applies it over the last `presence_context_size` tokens, 20 by default.
vLLM applies it over the whole output. So "1.5" here means the card's value under mlx's
semantics. That is the path a user's mlx server takes. The bench can already send it:
`MLX_PRESENCE_PENALTY` in a profile goes through `opencode-init` into the model's options in
opencode.json, and @ai-sdk/openai-compatible copies it into the request body. This was checked
against a recording server on 2026-09-27: every request carried `"presence_penalty": 1.5`. No
llama-server or Ollama arm is needed.

**The card's value.** For Qwen3.6-35B-A3B, non-thinking mode, the card gives temperature 0.7,
top_p 0.8, top_k 20, presence_penalty 1.5. It adds that 0–2 reduces endless repetition, and that
higher values "may occasionally result in language mixing and a slight decrease in model
performance". Our profiles run non-thinking at 0.6 / 0.95 / 20 with no penalty. The A/B changes
only the penalty. The sampling cell (0.7 / 0.8) stays a separate row in UNMEASURED.md.

**What the data shows before the A/B.** We have not seen a repetition loop on the 8-bit. Its 109
frontier samples have no run of 3 or more identical tool calls. Its 227 opencode transcripts
repeat at most 7 % of 8-grams in a text part, and none stopped on the token limit. The only loop-like
failures are the create-file timeouts at the 420 s cap (cf-r1-a and cf-r3-b on 64-2, and cf-r1-a
again on 64-5 tonight). The one we read was not a loop. The model spent the time fighting Gradle's
Java 21 toolchain. That is the JAVA_HOME defect frontier harness v2 fixes. So the A/B cells are
where loops would show if they exist, and where the timeouts are. We should expect the A/B to
answer "does 1.5 cost pass rate?" more than "does it stop loops?".

**Design.** [presence-penalty.queue](presence-penalty.queue). Arm A is `qwen3.6-35b-a3b-8bit-64g`.
Arm B is [`qwen3.6-35b-a3b-8bit-64g-pp15`](../../profiles/qwen3.6-35b-a3b-8bit-64g-pp15.toml),
identical except `MLX_PRESENCE_PENALTY = "1.5"`. Profiles are not a `harness_sha` input, so the
series is unaffected.

- create-file retry2, rungs 1 and 3, ABBA twice, runs 2 per block: n = 16 per rung per arm.
- edit-single base, rungs 3–5, ABBA once, runs 2 per block: n = 8 per rung per arm.

**Measures.** For each arm, [presence_ab.py](presence_ab.py) reports:
- the pass rate, with Fisher's exact test between arms;
- the loop-or-timeout rate (3+ identical consecutive tool calls, or a timeout);
- text loops per transcript (a step that stops on the token limit, or a text part repeating ≥ 50 %
  of its 8-grams).

Run it with the stamp the launcher logs at the start of item 2:
`python3 reports/2026-09-28-orchestrator-and-penalty/presence_ab.py 20260928-HHMMSS`.

**Decision rule.** Recommend 1.5 (in the manifest, as a separate change) only if B's loop or
timeout rate is lower and its pass rate is not lower. With zero loops at baseline, the most likely
result is "no effect on loops". The penalty then stays off, and the card's warning about pass rate
is what we measure.
