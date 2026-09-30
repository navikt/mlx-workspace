# The GPU queue after night 64-6

**Results:** [results.md](results.md) (29–30 September; the queue ran twice). The action check stays
log-only; #122 showed no effect.

What runs when night 64-6 is done, so the GPU does not sit idle. Everything here runs on this Mac,
on the GPU only, with cached models, at 48 GB wired, and costs $0. The queue is
[after-64-6.queue](after-64-6.queue). [after-64-6-launcher](after-64-6-launcher) starts it when
`.bench-logs/tier64-6.done` exists and the GPU has been free for 5 min. If 64-6 gives up waiting
for sudo, the launcher starts once the v2 validation night is done (`V2_DONE`, default
`.bench-logs/v2-validate.done`; give it the same value as the 64-6 launcher) and the 64-6 launcher has been
gone for 30 min. Either way harness v2 is on `main` first. The launcher logs to
`.bench-logs/after-64-6.log` and touches `.bench-logs/after-64-6.done` when the queue is done.

| # | Item | GPU time, expected (cap) | Cost |
|---|---|---|---|
| 1 | The action check on its case set (navikt/copilot#1161) | 23 min (1 h 45) | $0 |
| 2 | #122: Qwen3.8 at the card's non-thinking sampling | 4 h 40 (9 h 20) | $0 |
| | Total | about 5 h (11 h) | $0 |

The order is by value per GPU hour. Item 1 decides whether a hook that is already written may do
more than log, and it takes minutes. Item 2 decides whether a nav-pilot change is worth building.

## 1. The action check

**Question.** Do the three questions of the log-only action check (#1163) answer well enough, and
fast enough, for the hook to act on them, and at which threshold? The PR proposes 0.7.

**Method.** `mise run bench-decide-action` (new): `bench-decide-sets`, including its lock, AC wait
and server lifecycle, on `bench/decide-cases/action-check.jsonl`. That file is a copy of the set in
#1163 at 902aa5af: 53 commands × 3 questions (proportional, destructive, evidence) = 159 lines,
24 risky and 29 harmless commands, 17 of the harmless ones still sent by the classifier. Each line
is one `alpha decide` call, followed by nav-pilot's own `--eval` totals. The summary reports:
- accuracy and p50/p95 ms for each question;
- for each command, as the hook sees it (flagged when any question's flag answer has p ≥ t), at
  t = 0.5 to 0.99: risky commands flagged, harmless flagged, and harmless commands the classifier
  sends that get flagged (the false positives users would see). Three harmless commands carry a
  flag answer as a label, so a perfect model flags 3 harmless commands, not 0.

**Models.** optiq (`qwen3.6-35b-a3b-optiq`) and Qwen3.8 OptiQ-4bit, the manifest's two default
decide models, with the newest `nav-pilot-main-*` binary.

**n.** 159 cases per model. The `--eval` pass repeats them, so 318 calls per model.

**Limit.** The calls run one at a time here. The hook runs its three at once within 500 ms, so the
p95 here is a lower bound on the hook's time. Whether three concurrent calls fit in 500 ms is a
question for a follow-up, if the accuracy is good enough to make it matter.

## 2. #122: Qwen3.8 at the card's non-thinking sampling

**Question.** Does the Qwen3.8 card's non-thinking sampling (temperature 0.7, top_p 0.8, top_k 20,
presence_penalty 1.5) change pass rate or loops against ours (0.6, 0.95, 20, no penalty)? #122 is
blocked for the product because nav-pilot cannot send presence_penalty. The bench can send it
through opencode.json, as the presence_penalty A/B does. This answers whether the nav-pilot change
is worth building. It does not measure Copilot CLI through nav-pilot.

**Method.** Cheap-ops, one pass per step, on Qwen3.8 OptiQ-4bit. Arm A is
`qwen3.8-27b-optiq-4bit` (as shipped). Arm B is
[`qwen3.8-27b-optiq-4bit-card`](../../profiles/qwen3.8-27b-optiq-4bit-card.toml), identical except
the card's values. The order is ABBA twice, so drift over the run falls on both arms.

**n.** 4 passes per arm: 40 tasks per arm (D2 is retired), 36 without R1, which fails for every
model. The earlier baseline is 18/30 (3 passes).

**Measures.** For each arm: verified tasks, with Fisher's exact test between the arms; timeouts;
and the loop-guard trips and longest run of identical tool calls, as in pending-tasks §8 task 3.
There is no script yet: the results agent counts them by hand from `bench/results-*.json`.

**Decision rule.** Arm B changes three values at once, so it answers #122 ("do our values cost
quality?"), not which value matters. B counts as better only if Fisher's p < 0.05, or B verifies at
least 6 more tasks than A. With 36 tasks per arm at about 60 %, Fisher needs about +30 points for
80 % power, so only a large effect will show. Arm A had 0 loops and 0 timeouts on 24 September, so
fewer loops is not a reachable outcome; the expected result is no effect.
- B better: a penalty-only re-test (0.7 / 0.8 in both arms, the penalty in one) before anyone
  builds the nav-pilot change. The temperature and top_p alone are a manifest change.
- Otherwise: #122 is closed as "no effect seen at n = 36".

**Duration.** About 35 min per pass (24 Sep: 21:58, 22:31, 23:08), 8 passes.

## Not queued, and why

- **#123, the mlx-lm #1623 norm shift:** a desk check, not GPU work. It needs the Hugging Face
  original's norm tensors, which is a download.
- **#125, the decide recipe examples:** no labelled sets exist yet.
- **#127, selective rule loading:** the labelled set and a rule-sensitive cheap-ops cell are not
  built. The cloud arms are about $85.
- **#128, redaction:** no case set or runner, and redaction is not GPU work.
- **read-qa with an ANSWER-line reminder (#114):** not built. It is a new variant, so it changes
  `harness_sha`.
- **Kev and Laya:** the download opens after 29 September.

## ETA

Upstream: the presence_penalty A/B (ends about 19:00 on 28 September), re-probe 7 (#121), the v2 merge (#113),
the v2 validation night (#89), then 64-6 (#134), which waits for the user's sudo twice. If 64-6 starts on the
morning of 29 September, it ends about 13:00. This queue then ends about 18:00 the same day, and
by the next morning at the latest if every step runs to its cap.
