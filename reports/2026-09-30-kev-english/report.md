# Kev 4B as an optional English System 1 model, 2026-09-30

## Question
Can Kev 4B (`RoderickQiu/kev-4b-mlx-8bit@e1c35947`) be offered as an opt-in, lower-resource
System 1 model for English questions, with Norwegian routed to optiq? A pass would add an
opt-in model to nav-pilot, a warning against Norwegian, and a side-by-side comparison in the docs.
A fail keeps optiq as the only System 1 model.

## What shipped
Nothing. The verdict is FAIL, so there is no nav-pilot integration.

## Method
- Plan and criteria: [plan.md](plan.md), fixed before the first sample.
- Models: Kev 4B 8-bit, in-process; optiq (`mlx-community/Qwen3.6-35B-A3B-OptiQ-4bit`) through its server.
- Cases: English triage, `issue-type-en` (120 new issues from `oauth2-proxy/oauth2-proxy`, labelled by
  a maintainer, see the README in `bench/decide-cases/`) plus the 32 existing English triage cases, n=152.
  The other sets were re-run unchanged.
- Run: 2026-09-30 08:40–08:47, [kev-english-launcher](kev-english-launcher), [kev-english.queue](kev-english.queue).
- Memory is sampled every 5 s ([mem.tsv](mem.tsv)): the machine's wired memory and the process's
  `phys_footprint_peak`.
- The paired figures are reproduced by [paired.py](paired.py).

## Results
English triage, paired, n=152. Sources: `bench/decide-sets-en-20260930-084038.md`,
`bench/decide-sets-kev-4b-8bit-20260930-084038.json` and `bench/decide-sets-optiq-20260930-084531.json`.

| Criterion (plan) | Kev | optiq | Result |
|---|---|---|---|
| Accuracy: at most 5 points behind optiq, lower bound above −10 | 125/152 | 127/152 | −1.3 points [−6.1, +3.3]: **pass** |
| Answers at p ≥ 0.9: Wilson lower bound ≥ 0.90, at most 1 wrong per 50 | 99/107, lower bound 0.859, 3.7 wrong per 50 | 109/126 (17 wrong) | **fail** (optiq would fail this row too) |
| Coverage at p ≥ 0.9: at least 40 % | 107/152 (70 %) | – | **pass** |
| Pooled injection flip rate within +5 points of optiq | 3/100 | 14/99 | paired over 90 twins, −11.1 [−20.3, −2.4]: **pass** |
| Latency: p50 ≤ half of optiq, p95 ≤ optiq | 120 / 276 ms | 396 / 518 ms | **pass** |
| Cold start ≤ optiq | 3.98 s | 3.6–4.6 s | inconclusive (sampled every 5 s) |
| Peak memory ≤ 50 % of optiq | `phys_footprint_peak` 50.4 GB | 25.0 GB | **fail** (see below) |

Kev gave the same choice and p on all 1,030 cases it shared with the 29 Sep run.

**Memory.** The 50.4 GB `phys_footprint_peak` is not a clean measure of the model: it includes lazy
buffers and compressed pages. Wired memory is the better proxy.
- Kev: wired rose from 4.0 GB idle to 19.6 GB at peak, about 15.6 GB for the process.
- optiq: its server held 25.3–25.9 GB wired.

Even measured that way, Kev uses about 60–75 % of optiq's memory, depending on the idle baseline
counted for optiq. That is still over the 50 % criterion. A 4B 8-bit model should need about 5 GB, so
the in-process loader, not the model, is the likely cost. That would take engineering to fix, not
another run.

## Verdict
**FAIL.** Kev matches optiq on English accuracy, resists injection better, and answers in a third of
the time. It fails the memory criterion even on wired memory, because of how it is loaded, and it
fails the p ≥ 0.9 precision row, which optiq also fails.

**Decision:** optiq stays the only System 1 model, and the Kev track is closed. Reopen it only if
someone makes a loader that keeps Kev under half of optiq's wired memory. The p ≥ 0.9 criterion should
then be "no worse than optiq", since optiq itself does not meet an absolute 0.90.
