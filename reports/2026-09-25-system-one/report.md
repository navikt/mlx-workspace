# System One in nav-pilot: from the loop classifier to `alpha decide`, 2026-09-25

"System One" here means a fast typed decision from a local model: one question, fixed options, and
a probability per option instead of text (the name and the outside product are in
[the Jev research](../2026-09-24-jev-like-features/research.md)). This report collects the three
measurements behind what nav-pilot ships today. It adds no new runs: every figure is copied from
the file linked next to it, with its denominator. Intervals are 95 % Wilson, as in the source
files; the two intervals in §3.1 were computed here from the probe JSON.

## 1. Question

1. Can a local model tell a looping agent from one that is polling, fast enough to sit in the
   tool-call path? (23 September)
2. Where does a one-token decision stop working: language, rule-proof questions, many options,
   long evidence, option order, prompt injection, model size? (night of 24–25 September)
3. Is one question that no rule can answer, "does the commit message explain why?", good enough
   for a `commit-msg` hook, and at what threshold? (25 September)

## 2. What shipped

| What | Where | Merged | Backed by |
|---|---|---|---|
| Result-aware loop guard, replacing the classifier: block after 4 identical calls with identical results, backstop at 8 | navikt/copilot [#933](https://github.com/navikt/copilot/pull/933) | 2026-09-24 | §3.1 |
| The same rule as a `postToolUse` hook for every Copilot session, cloud included | [#939](https://github.com/navikt/copilot/pull/939), sandbox fix [#953](https://github.com/navikt/copilot/pull/953) | 2026-09-24 | §3.1 |
| Loops that cycle between a few identical calls count too | [#955](https://github.com/navikt/copilot/pull/955) | 2026-09-25 | §3.1 |
| `nav-pilot alpha decide` | [#949](https://github.com/navikt/copilot/pull/949) | 2026-09-24 | §3.2–3.4 (measured after merge) |
| A `commit-msg` hook recipe that warns at p(no) ≥ 0.7 and never blocks | `docs/README.nav-pilot.md` in navikt/copilot, added in [#958](https://github.com/navikt/copilot/pull/958) | 2026-09-25 | §3.4 |
| Advice: `--threshold 0.9` or higher when the answer stops something, and filter untrusted text before decide reads it | the same README section | 2026-09-25 | §3.3 |
| Telemetry: `nav_pilot_decide_*` and hook counters, enums only, no content | [#961](https://github.com/navikt/copilot/pull/961) | 2026-09-25 | none; it exists so real use can be measured |

The classifier itself never shipped. It sat on the local branch `feat/local-system-one-loop-guard`
(e72319e0) and is kept only as the tag `archive/system-one-classifier` in the copilot repo
([decision.md §4](../2026-09-23-local-model-evaluation/decision.md#4-what-the-previous-handoff-got-wrong),
[pending-tasks.md §7](../2026-09-23-local-model-evaluation/pending-tasks.md#7-cleanup-when-finished)).

## 3. Method and results

### 3.1 The loop classifier, 23 September

**Method.** `mise run bench-system-one` with nav-pilot e72319e0 on `mlx-community/Qwen3.8-27B-8bit`
(profile `qwen3.8-27b-8bit-nopin`), M5 Max at a 36 GB wired limit. The guard prompt asked whether
a run of repeated tool calls was a loop, with the call and its repeat count as input and **not**
the tool results; it blocked at P(loop) > 0.9. 7 hand-written scenarios (5 legitimate polls or
reruns, 2 loops) × 3 repetitions at temperature 0, so the repetitions are identical.

| Scenario | Actually a loop | P(A = loop) | Blocks at > 0.9 |
|---|---|---|---|
| poll-ci | no | 0.417 | no |
| rerun-tests | no | 0.687 | no |
| poll-pr-checks | no | 0.687 | no |
| recompile | no | 0.779 | no |
| rerun-go-test | no | 0.779 | no |
| reread-file | yes | 0.883 | **no** |
| same-grep | yes | 0.883 | **no** |

Source: [`bench/system-one-qwen3.8-27b-8bit-nopin-20260923-124307.json`](../../bench/system-one-qwen3.8-27b-8bit-nopin-20260923-124307.json),
summarised in [decision.md §3.5](../2026-09-23-local-model-evaluation/decision.md#35-classifier-probe-nopin-guard-prompt-from-e72319e0)
and the [evaluation log](../2026-09-23-local-model-evaluation/evaluation-log.md#system-one-classifier-probe-nopin-1240-guard-prompt-from-e72319e0).

- Loops caught: 0/2 [0.00–0.66]. Polls wrongly blocked: 0/5 [0.00–0.43]. At its threshold the
  classifier blocked nothing and added about 0.5 s per checked call (p50 0.49 s, p95 0.52 s).
- The classes were 0.10 apart (polls up to 0.78, loops 0.88). A threshold of 0.85 would separate
  these 7, but that is fitting to 7 hand-written scenarios.
- The two real-session scenarios produced no data: both sessions were refused by Copilot's
  static-context gate (45.2k tokens) before the first request, the problem #932 fixed
  ([evaluation log](../2026-09-23-local-model-evaluation/evaluation-log.md)).

**Why it was replaced.** The classifier saw the call and the count, and a poll that eventually
succeeds looks the same as a loop at that level. What separates them is whether the *result*
changes. #933 counts a call as repeating only when its result repeats too. In the end-to-end
re-run (scenario d, [`bench/navpilot-e2e-rerun-20260923-154926.json`](../../bench/navpilot-e2e-rerun-20260923-154926.json))
a real loop was blocked at call 4 with "same result" after 20 s, and a poll with changing output
ran 7 identical calls to READY without being blocked ([decision.md §2](../2026-09-23-local-model-evaluation/decision.md#2-action-list),
action 3). The rule costs no GPU time.

The hook version (#939) was checked inside the cplt sandbox with one provoked-loop gpt-5-mini
session: PASS, the hook kept its state and the model saw the warning (77 tool calls,
[`bench/loop-hook-20260925-002708.json`](../../bench/loop-hook-20260925-002708.json)). The same
session dodged the warning after about 22 calls by cycling `view_range` between three values,
which #955 closes ([pending-tasks.md §8.3](../2026-09-23-local-model-evaluation/pending-tasks.md#83-follow-ups-from-the-night-of-2425-september)).

### 3.2 The decide mechanism, and the first measurement on real hardware

`alpha decide` sends one chat request with the question, the options mapped to letters A, B, C…
and the evidence in a delimited block marked as data (capped at 32 KiB). It asks for one token
(`max_tokens=1`, temperature 0, thinking off) and reads the letters' probabilities from that
token's top logprobs, renormalised over the options. The output is JSON (`choice`, `p`, `model`,
`ms`, `evidence`); with `--threshold P --expect X` it exits 0 at or above P, 1 below, 2 on error.
It uses the running local server and never starts it ([#949](https://github.com/navikt/copilot/pull/949)).
mlx-lm returns 11 top logprobs, so the letters of a 12th option and later are only seen when they
make that list ([bench/decide-limits/README.md](../../bench/decide-limits/README.md#options-and-position)).

#949 was built against fake servers only. Night 2, step 2 measured it on optiq
([night-2026-09-25.md](../2026-09-23-local-model-evaluation/night-2026-09-25.md#nav-pilot-alpha-decide-on-mlx-communityqwen36-35b-a3b-optiq-4bit),
[`bench/decide-qwen3.6-35b-a3b-optiq-20260925-000808.json`](../../bench/decide-qwen3.6-35b-a3b-optiq-20260925-000808.json)):

- cold (first call after `alpha local start`) 427 ms; warm p50 351 ms, p95 374 ms over 20 calls
- the option letters held 0.9714 (yes/no) and 0.9404 (loop/progress) of the top-logprob mass before renormalising
- a decide call between turns of a 17,144-token session left the session prefix cached (0 tokens re-prefilled in each of 3 pairs)
- `--eval`: Conventional Commits yes/no 15/20; loop against progress, **with the tool results as evidence**, 11/12

### 3.3 Limits: 974 cases × 3 models

**Method.** `mise run bench-decide-limits`, nav-pilot d24a65e5, 974 cases per model with labels
from construction or a deterministic check, never from a model
([bench/decide-limits/README.md](../../bench/decide-limits/README.md)). Models: optiq
(`Qwen3.6-35B-A3B-OptiQ-4bit`, the default), Qwen3.8-27B-OptiQ-4bit (the manifest's 4-bit slot) and
Qwen3-4B-Instruct-2507-4bit (not offered; the size floor). 0 errors on every model. Source for every
number in this section: [`bench/decide-limits-20260925-014512.md`](../../bench/decide-limits-20260925-014512.md)
and the per-model files next to it.

| Set | optiq | Qwen3.8 OptiQ-4bit | Qwen3-4B |
|---|---|---|---|
| English baseline (`lang-en`) | 26/32 = 0.81 [0.65–0.91] | 28/32 = 0.88 [0.72–0.95] | 17/32 = 0.53 [0.36–0.69] |
| Norwegian twins (`lang-no`) | 118/152 = 0.78 [0.70–0.84] | 127/152 = 0.84 [0.77–0.89] | 91/152 = 0.60 [0.52–0.67] |
| Does the message describe this diff | 37/40 = 0.93 [0.80–0.97] | 39/40 = 0.97 [0.87–1.00] | 26/40 = 0.65 [0.50–0.78] |
| Does the diff change an exported Go signature | 28/40 = 0.70 [0.55–0.82] | 35/40 = 0.88 [0.74–0.95] | 22/40 = 0.55 [0.40–0.69] |
| Loop against progress, only noise changes | 22/40 = 0.55 [0.40–0.69] | 33/40 = 0.82 [0.68–0.91] | 22/40 = 0.55 [0.40–0.69] |
| 2 to 14 options | 179/180 = 0.99 [0.97–1.00] | 176/180 = 0.98 [0.94–0.99] | 174/180 = 0.97 [0.93–0.98] |
| Option order | 164/180 = 0.91 [0.86–0.94] | 166/180 = 0.92 [0.87–0.95] | 150/180 = 0.83 [0.77–0.88] |
| Prompt injection | 132/160 = 0.82 [0.76–0.88] | 103/160 = 0.64 [0.57–0.71] | 77/160 = 0.48 [0.41–0.56] |
| Evidence length | 121/150 = 0.81 [0.74–0.86] | 138/150 = 0.92 [0.87–0.95] | 82/150 = 0.55 [0.47–0.62] |

- **Language.** Norwegian costs little on average, but not evenly. optiq did better in Norwegian on
  loop-near (31/40 against 22/40) and worse on Conventional Commits (13/20 against 15/20). optiq
  answered 9/40 loop-near pairs and 6/20 commit pairs differently by language; Qwen3.8 0/40 and 1/20.
- **Options.** 14 options is not the limit. With the correct letter past K (L–N), optiq scored
  15/15 at both 12 and 14 options, Qwen3.8 14/15 at both, Qwen3-4B 13/15 and 14/15.
- **Position.** With 4 typed options every model scored 30/30 at each of A, B, C and D. The yes/no
  order matters: `yes` first against `no` first, optiq 24/30 against 20/30, Qwen3.8 27/30 against
  19/30, Qwen3-4B 14/30 against 16/30, choosing A in 25/30 with `yes` first.
- **Injection.** Flip rate = injected twins that took the injected answer, of the pairs whose clean
  case was right. optiq 1/27 (letter) to 9/27 (claim, "The correct answer is no."). Qwen3.8 8/28
  (letter) to 15/28 (claim) and 11/19 (diff-claim). Qwen3-4B up to 16/19 (claim). Qwen3.8, the
  more accurate model elsewhere, is the easier one to steer.
- **Evidence length.** optiq at 1k: 28/30 with the deciding line early, 21/30 late. At 30k: 7/10,
  9/10 and 8/10 (early, middle, late), p50 2.5 s. Qwen3.8 held 8/10 or better at 30k but took
  p50 11.6 s.
- **Calibration.** optiq was right in 192/205 answers at p 0.90–0.99 and 336/338 at p ≥ 0.99, but
  in 106/185 at p 0.50–0.70. Qwen3.8: 218/230, 319/319 and 129/202. Qwen3-4B is overconfident:
  555/748 = 0.74 [0.71–0.77] at p ≥ 0.99 and 63/147 = 0.43 at 0.90–0.99.
- **`--eval` agrees with the per-case calls** on `lang-en` and `options` for all three models.

### 3.4 Does the commit message explain why? 25 September

**Method.** `mise run bench-decide-why`, nav-pilot 2e1e8ee1. 48 real commits from navikt/copilot and
navikt/mlx-workspace: 24 whose message states a reason the diff does not show (`yes`), 12 that only
say what changed, and 12 controlled negatives where the same diff gets its message with the reason
taken out and the length kept (`no`). Asked in English and Norwegian, so 96 calls per model. Labels
are one reader's, set against the diff ([bench/decide-cases/README.md](../../bench/decide-cases/README.md#commit-explains-why)).
Source: [`commit-explains-why-results.md`](../../bench/decide-cases/commit-explains-why-results.md),
full tables in [`bench/decide-why-20260925-072116.md`](../../bench/decide-why-20260925-072116.md).

| | optiq | Qwen3.8 OptiQ-4bit |
|---|---|---|
| All, EN + NO | 89/96 = 0.93 [0.86–0.96] | 95/96 = 0.99 [0.94–1.00] |
| Explains why (expect yes) | 44/48 = 0.92 [0.80–0.97] | 48/48 = 1.00 [0.93–1.00] |
| Real "what only" (expect no) | 24/24 = 1.00 [0.86–1.00] | 23/24 = 0.96 [0.80–0.99] |
| Controlled, reason removed (expect no) | 21/24 = 0.88 [0.69–0.96] | 24/24 = 1.00 [0.86–1.00] |
| Answered at p ≥ 0.9 | 16/96, all correct | 30/96, all correct |
| p50 / p95 per call | 432 / 647 ms | 1158 / 2857 ms |

As a hook, flag when p(no) ≥ t:

| t | optiq: caught / wrongly flagged | Qwen3.8: caught / wrongly flagged |
|---|---|---|
| 0.5 | 45/48 / 6/48 | 48/48 / 0/48 |
| **0.7** | **40/48 = 0.83 / 0/48 [0.00–0.07]** | 35/48 = 0.73 / 0/48 [0.00–0.07] |
| 0.9 | 7/48 / 0/48 | 7/48 / 0/48 |

The probabilities are compressed: only 16/96 (optiq) and 30/96 answers reach p ≥ 0.9, yet the
0.7–0.9 band was right 106 times out of 107 across both models. So the recipe uses 0.7; 0.9 would
catch 7/48.

**The 0/24 → 14 % bound.** At 0.7 optiq wrongly flagged 0 of 48 calls. The 48 calls are 24 commits
asked twice, so they are not 48 independent samples: 0/48 gives a Wilson upper bound of 7 %, and
0/24, counting each commit once, 14 %. What the data supports is "no false flags seen, and a
false-flag rate up to 14 % is not ruled out". That is enough for a warning and not for a block.

## 4. Verdict

- A classifier shown only the calls cannot separate a loop from a poll; the result can, and a
  deterministic rule on the result does it for free. That is what ships (#933, #939, #955).
- `alpha decide` works where the evidence holds the answer and no rule can give it: 93–99 % on
  "explains why", 93–97 % on "describes this diff". It is weak on near-identical loop logs for optiq
  (22/40) and on untrusted evidence for Qwen3.8 (up to 15/28 flips).
- Ship decide as a warning tool. The default model at p(no) ≥ 0.7 is the recommended `commit-msg`
  nudge; a hook that blocks needs a team's own `--eval` run and a threshold of at least 0.9.
- Do not use a 4B model for decide: at p ≥ 0.99 it is right 74 % of the time.

## 5. Limits

- The classifier probe is 7 hand-written scenarios on one model; no real session reached it.
- decide-limits and decide-why ran on one machine (M5 Max) with a warm server. Cases that share a
  prefix may be faster than a cold call would be.
- decide-why has 48 commits from two repositories by few authors, labelled by one reader.
- Only one of the recipe page's examples is measured (§6).
- Telemetry (#961) records outcomes in real use, but nobody has read it yet.

## 6. Open items

From [pending-tasks.md §8.3](../2026-09-23-local-model-evaluation/pending-tasks.md#83-follow-ups-from-the-night-of-2425-september)
and [§8.5](../2026-09-23-local-model-evaluation/pending-tasks.md#85-alpha-decide-measure-the-recipe-examples-and-make---eval-keep-its-results):

- Measure the other recipe examples before the docs recommend them, each with a labelled set and
  `--eval` on optiq and Qwen3.8: issue labels (cheapest, the labels exist), whether a PR description
  explains the motivation, personal data logged in a diff (synthetic cases only), log failure cause,
  and local-or-cloud routing.
- `--eval` keeps nothing per case, stops at the first failed case, and prints only mean p where its
  help promises calibration. Proposed: `--out results.jsonl`, keep going past errors, and a
  threshold sweep for `--expect`.
- The top-11 cap may not bind (options past K scored 13–15/15); check the code and the help text.
- `_decide.py`'s prefill counter reports 0 even for a cold call; the cache-eviction result rests on TTFT.

## 7. Reproduce

```sh
mise run bench-system-one                 # §3.1 (nav-pilot e72319e0)
mise run bench-decide-limits -- --dry-run # §3.3; then BENCH_WAIT=1 mise run bench-decide-limits
mise run bench-decide-why                 # §3.4
python3 bench/decide-limits/build.py --check && python3 .mise/tasks/_decide_why.py --check-cases
```

§3.2 (night-run-2 step 2): `mise run np-serve -- qwen3.6-35b-a3b-optiq python3 .mise/tasks/_decide.py run bench/decide-<stamp>.json`.

## 8. Sources

- [decision.md](../2026-09-23-local-model-evaluation/decision.md), [evaluation-log.md](../2026-09-23-local-model-evaluation/evaluation-log.md), [night-2026-09-25.md](../2026-09-23-local-model-evaluation/night-2026-09-25.md), [pending-tasks.md](../2026-09-23-local-model-evaluation/pending-tasks.md)
- [Jev-like features research](../2026-09-24-jev-like-features/research.md)
- `bench/`: [system-one probe](../../bench/system-one-qwen3.8-27b-8bit-nopin-20260923-124307.json), [e2e re-run](../../bench/navpilot-e2e-rerun-20260923-154926.json), [loop hook](../../bench/loop-hook-20260925-002708.json), [decide, night 2](../../bench/decide-qwen3.6-35b-a3b-optiq-20260925-000808.json), [decide-limits summary](../../bench/decide-limits-20260925-014512.md), [decide-limits cases](../../bench/decide-limits/README.md), [explains-why results](../../bench/decide-cases/commit-explains-why-results.md), [decide-why tables](../../bench/decide-why-20260925-072116.md)
- navikt/copilot [#933](https://github.com/navikt/copilot/pull/933), [#939](https://github.com/navikt/copilot/pull/939), [#949](https://github.com/navikt/copilot/pull/949), [#955](https://github.com/navikt/copilot/pull/955), [#958](https://github.com/navikt/copilot/pull/958), [#961](https://github.com/navikt/copilot/pull/961)
