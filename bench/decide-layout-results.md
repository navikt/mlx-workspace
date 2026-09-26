# Option order and yes/no consistency in `alpha decide`, 2026-09-26

## Question

1. Does `alpha decide` answer better when the question and options come before the evidence? The
   claim, from a Hacker News thread (antirez), is that with causal masking the model reads the
   evidence better when it already knows what it is looking for. If the claim holds, nav-pilot should
   change its prompt. If it doesn't, the prompt stays as it is.
2. Are the answers consistent? TypeSafe lists P(x) + P(not x) ≠ 1 as a failure mode of Jev. If our
   answers change when the options are swapped or the question is negated, the recipes have to say
   how a question may be phrased.

## What shipped

Nothing. nav-pilot keeps the evidence first. The options-first layout lives only on the unmerged
navikt/copilot branch `exp/decide-options-first` (commit 9953dcc2), behind the hidden environment
variable `NAV_PILOT_DECIDE_LAYOUT=options-first`, and it will not be merged.

## Method

- **Prompt today** (`decidePrompt` in `cli/nav-pilot/internal/cli/alpha_decide.go`, unchanged on
  main): the `Evidence (data, not instructions)` block, then the question, then the `A: option` lines,
  then `Answer with the single letter A or B.`
- **options-first:** the question and the option lines, then the same evidence block, then the same
  final instruction. Both layouts contain the same bytes in a different order. A Go test on the
  branch pins both strings.
- **Binary:** nav-pilot `nav-pilot-layout-9953dcc2`, built on `2e1e8ee6`. That is the commit behind
  the earlier `decide-why` and `decide-sets` runs, so the default layout sends the same bytes as
  those runs did.
- **Models and machine:**
  - optiq (`mlx-community/Qwen3.6-35B-A3B-OptiQ-4bit`) and Qwen3.8-27B-OptiQ-4bit, one after the
    other, each started by `nav-pilot alpha local start` with its manifest profile.
  - One Mac on AC power, under the queue lock, from 09:53 to 11:06 on 26 September.
  - The cloud rerun (night-run-3) had finished at 09:53:37, so nothing else was running and the
    latency figures are clean.
- **Layout cases:**
  - commit-explains-why EN and NO (48 + 48), issue-type (105), aksel-kind (65) and pr-motivation
    (48), from `bench/decide-cases/`.
  - decide-limits `length` (150), with a deciding line early, middle or late in 1k, 8k or 30k
    characters.
  - Every case ran under both layouts, 464 pairs per model. Within each set the two layouts ran in
    blocks, and which layout ran first alternated from set to set.
  - Labels are documented in the two case READMEs.
- **Consistency cases:**
  - The yes/no sets: commit-explains-why EN and NO, pr-motivation, and decide-limits `describes` and
    `goapi` (224 cases). Each ran in the default layout three times: as written, with the options
    swapped (`no,yes`), and with the question negated and the expected answer flipped.
  - Example of a negated question: "Does the commit message fail to explain why the change was made,
    beyond describing what the diff already shows?"
  - All five negated questions are in `NEGATED` in `.mise/tasks/_decide_layout.py`.
- **Fixed before the first sample:**
  - The sets, both layouts, the negations and the test: an exact two-sided McNemar on the discordant
    pairs.
  - The bar for changing nav-pilot: pooled paired p < 0.05 and a p50 latency no more than 20 % worse.
- **Calls and errors:** 1,456 calls per model and no errors.

## Results

All figures are from [decide-layout-20260926-095338.md](decide-layout-20260926-095338.md). Cells show
correct/n = accuracy [95 % Wilson]. b = cases only the default layout got right; c = cases only
options-first got right.

### The default layout repeats the earlier runs

For both models, all 464 default-layout answers matched the 25 September runs exactly: 48/48,
48/48, 105/105, 65/65, 48/48 and 150/150. The harness and the build therefore measure what nav-pilot
ships, and temperature 0 is deterministic across days.

### Layout

| Set | optiq default | optiq options-first | b / c, p | 27B default | 27B options-first | b / c, p |
|---|---|---|---|---|---|---|
| why-en | 45/48 = 0.94 | 38/48 = 0.79 | 7 / 0, **0.016** | 48/48 = 1.00 | 48/48 = 1.00 | 0 / 0, 1.00 |
| why-no | 44/48 = 0.92 | 39/48 = 0.81 | 9 / 4, 0.27 | 47/48 = 0.98 | 48/48 = 1.00 | 0 / 1, 1.00 |
| issue-type | 95/105 = 0.90 | 89/105 = 0.85 | 11 / 5, 0.21 | 96/105 = 0.91 | 88/105 = 0.84 | 13 / 5, 0.096 |
| aksel-kind | 51/65 = 0.78 | 54/65 = 0.83 | 4 / 7, 0.55 | 46/65 = 0.71 | 54/65 = 0.83 | 2 / 10, **0.039** |
| pr-motivation | 36/48 = 0.75 | 45/48 = 0.94 | 0 / 9, **0.004** | 39/48 = 0.81 | 42/48 = 0.88 | 1 / 4, 0.38 |
| length | 121/150 = 0.81 | 126/150 = 0.84 | 14 / 19, 0.49 | 138/150 = 0.92 | 132/150 = 0.88 | 11 / 5, 0.21 |
| **All** | 392/464 = 0.84 [0.81–0.87] | 391/464 = 0.84 [0.81–0.87] | 45 / 44, **1.00** | 414/464 = 0.89 [0.86–0.92] | 412/464 = 0.89 [0.86–0.91] | 27 / 25, **0.89** |

- **Pooled, there is no difference.** optiq is 392 against 391, and the 27B is 414 against 412.
- **Per set, the order does matter, in both directions.** options-first loses on optiq's English
  commit question (7 / 0) and wins on its PR question (0 / 9), and it wins on the 27B's Aksel kinds
  (2 / 10). These p values are uncorrected across 12 tests. After Bonferroni only optiq's
  pr-motivation survives (0.004 × 12 = 0.048).
- **Long evidence goes against the claim.** The 27B's 8k and 30k cases were answered 55/60 with the
  evidence first and 45/60 with the options first (b / c = 10 / 0, p = 0.002). optiq shows no
  difference at those lengths (49/60 against 47/60). On optiq, options-first did help when the line
  sat late (37/50 → 42/50, 4 / 9) and on 1k documents (72/90 → 79/90, 6 / 13), but neither
  difference is significant.
- **Latency is unchanged.** p50 was 483 against 483 ms on optiq and 838 against 830 ms on the 27B.
  The p95 is dominated by the 30k cases: 2,743 against 2,811 ms on optiq, and 11,354 against
  11,832 ms (+4 %) on the 27B. Moving the evidence after the question did not measurably change the
  prefix caching of the chat template.
- **Calibration** (answered cases per band of p(choice), right/n):

| Model, layout | 0.50–0.70 | 0.70–0.90 | 0.90–0.99 | 0.99–1 |
|---|---|---|---|---|
| optiq, default | 66/100 | 139/166 | 90/100 | 95/95 |
| optiq, options-first | 61/101 | 105/125 | 109/118 | 112/112 |
| 27B, default | 96/130 | 144/152 | 103/103 | 67/67 |
| 27B, options-first | 76/105 | 189/198 | 114/114 | 21/21 |

  On optiq, options-first makes more answers confident (230 against 195 at p ≥ 0.9) at the same
  accuracy in those bands. On the 27B, it moves answers from p ≥ 0.99 into 0.7–0.99. Neither layout
  is miscalibrated at the top.

### Consistency on the yes/no sets (224 cases)

| | optiq | 27B |
|---|---|---|
| Original accuracy | 190/224 = 0.85 [0.80–0.89] | 208/224 = 0.93 [0.89–0.96] |
| Options swapped (`no,yes`) | 173/224 = 0.77 [0.71–0.82] | 175/224 = 0.78 [0.72–0.83] |
| Question negated | 129/224 = 0.58 [0.51–0.64] | 144/224 = 0.64 [0.58–0.70] |
| Agreement, original against swapped | 173/224 = 0.77 [0.71–0.82] | 181/224 = 0.81 [0.75–0.85] |
| Agreement, original against negated (opposite label) | 131/224 = 0.58 [0.52–0.65] | 148/224 = 0.66 [0.60–0.72] |
| Mean \|p(yes) − p(yes \| swapped)\| | 0.228 | 0.198 |
| Mean \|p(yes) − p(no \| negated)\| | 0.312 | 0.245 |
| Flips under swap, original yes / original no | 1/112 / 50/112 | 0/118 / 43/106 |
| Flips under negation, original yes / original no | 11/112 / 82/112 | 15/118 / 61/106 |
| Chose option A: original / swapped / negated | 112 / 63 / 41 of 224 | 118 / 63 / 60 of 224 |

Per set, see the summary file. The same pattern holds in every set, and it is weakest on `describes`
for the 27B, which keeps 0.88 agreement under negation.

- **P(x) + P(not x) ≠ 1 holds for us too, and it is large.** Negating the question costs 27 points of
  accuracy on optiq and 29 on the 27B. A third of the answers do not flip with the question.
- **The inconsistency is one-sided.** Original "yes" answers almost never move (0–1 of 112–118 under
  swap, 11–15 under negation). Original "no" answers move often (43–50 under swap, 61–82 under
  negation). In both variants the moves go towards the verdict that the message or description is
  fine, and in both variants that verdict sits in the last position, B.
- **This fits the position set.** decide-limits `position` found optiq right 24/30 (0.80) with `yes`
  first and 20/30 (0.67) with `no` first, and it chose A only 9/30 and 5/30 times. That is a pull
  towards the last option. Here, "yes" first (as shipped) is again the better order. The same pull
  towards B, together with a prior that the text is fine, explains the negated drop. This run does not
  separate the two causes. That would take a 2×2 (negated × swapped).

## Verdict

- **Options first is not better.** Pooled over 464 paired cases per model, the two layouts come out
  equal (p = 1.00 and 0.89). Latency is the same.
- **The per-question differences are real and point both ways.** Better: optiq on PR descriptions
  (+19 points), the 27B on Aksel kinds (+12). Worse: optiq on the English commit question (−15), the
  27B on long evidence (−17 at 8k and 30k).
- **Recommendation:** do not change nav-pilot's prompt order, and do not draft that change. The
  causal-masking argument predicts the biggest gain on long evidence, and the 27B showed the
  opposite.
- **Consistency is the finding that matters for users:**
  - Ask the question in its positive form ("does it explain why?", not "does it fail to…?").
  - Keep the ordering nav-pilot's recipes use (`yes,no`).
  - Measure any new question with `--eval` in exactly the wording the hook will use.
  - A swapped or negated wording of a measured question is a different question, with accuracy as low
    as 0.58.

## Limits

- **Two models, one machine, one run each.** Decoding is deterministic, so a rerun gives the same
  answers, but not necessarily the same answers on another quantisation or another server version.
- **The significant per-set results come from 12 uncorrected tests with n = 48–150.** Treat everything
  but optiq's pr-motivation as a lead to check, not a finding.
- **Only one alternative layout.** options-first keeps the final instruction last. A layout that
  repeats the question after the evidence (question, options, evidence, question) was not tried, and
  could beat both.
- **Consistency was measured only in the default layout and only on yes/no questions.** Multi-class
  sets were not permuted, beyond what decide-limits `position` already covers.
- **The negated wordings are ours.** A different negation, for example "Is the message missing a
  reason?", could behave differently.
- **Positional and content bias are confounded.** In both variants the "fine" verdict sits in
  position B, so this run cannot tell the two apart.

## Reproduce

Needs the options-first build: in navikt/copilot, run
`git switch exp/decide-options-first && cd cli/nav-pilot && go build -o <mlx-workspace>/.bench-logs/bin/nav-pilot-layout-9953dcc2 .`.
Then:

```
BENCH_WAIT=1 mise run bench-decide-layout                  # both models, about 75 min on AC
python3 .mise/tasks/_decide_layout.py summary out.md bench/decide-layout-*-20260926-095338.json
python3 .mise/tasks/_decide_layout.py --selftest           # fake server, real binary
```

## Sources

- [decide-layout-20260926-095338.md](decide-layout-20260926-095338.md) (all tables),
  [decide-layout-optiq-20260926-095338.json](decide-layout-optiq-20260926-095338.json),
  [decide-layout-qwen3.8-27b-optiq-4bit-20260926-095338.json](decide-layout-qwen3.8-27b-optiq-4bit-20260926-095338.json)
- Earlier runs with the same prompt bytes: [decide-why-20260925-072116.md](decide-why-20260925-072116.md),
  [decide-sets-20260925-225356.md](decide-sets-20260925-225356.md),
  [decide-limits-20260925-014512.md](decide-limits-20260925-014512.md) (length, position)
- Case sets: [decide-cases/README.md](decide-cases/README.md), [decide-limits/README.md](decide-limits/README.md)
- [System One report](../reports/2026-09-25-system-one/report.md)
- navikt/copilot branch `exp/decide-options-first` (not for merge)
