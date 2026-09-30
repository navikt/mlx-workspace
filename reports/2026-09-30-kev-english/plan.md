# Kev 4B on English: plan for an optional low-resource System 1 model, 2026-09-30

Follows [#154](../2026-09-29-kev-laya/report.md) (`bench/decide-*-s1-20260929-114202.md`). Kev 4B
(`RoderickQiu/kev-4b-mlx-8bit@e1c35947`) came within the intervals of optiq on English triage
(issue-type 91/105 against 95/105 over both languages, no wrong answer at t = 0.9), and failed on
Norwegian questions (why-no 24/48, lang-no 90/152). The owner's decision: test it more on English, then
offer it as an **optional** System 1 model for machines that cannot hold optiq, with a warning not to use
it for Norwegian questions. This plan covers the extra testing only. Nothing in nav-pilot changes here.

**Size:** about 20 min of GPU (Kev about 6 min in-process, optiq about 5 min with its server, 5 min of
free-GPU gate before them) and about 1 h to write the report. $0: every call is local, no cloud model.

## 1. What is measured, per role

"English" means the question and the evidence are English. Sets and labels:
[decide-cases/README.md](../../bench/decide-cases/README.md) and
[decide-limits/README.md](../../bench/decide-limits/README.md).

| Role | Sets, English part | n English now | After this plan | Why this n |
|---|---|---|---|---|
| decide: issue triage | `issue-type` (English issues), **`issue-type-en` (new)** | 32 | **152** | see §2 |
| decide: PR check | `pr-motivation` (English descriptions) | 28 | 28 | not extended, see §6 |
| limits | `lang-en`, `describes`, `goapi`, `options`, `position`, `injection`, `length` | 782 | 782 | large enough per shape; `describes` and `goapi` already fail by 20+ points |
| why | `why-en` (`commit-explains-why.jsonl`) | 48 | 48 | the verdict hangs on no-why messages caught at t = 0.9: 0/48 against optiq's 7/48 (both languages); see §6 |
| loop-catch | `loop-classifier` (7), `loop-near` (40) | 47 | 47 | at t = 0.9 neither Kev nor optiq catches a loop; a larger set cannot turn that into a pass |

Norwegian sets (`why-no`, `lang-no`, `aksel-kind`) are left out. `issue-type` and `pr-motivation` run
whole, since the files mix both languages, and the report reads their "English text" rows. Kev on the
existing sets repeats the 29 September run on the same weights; its choices should come out the same, so
the rerun also checks that the backend is deterministic. The reason for the rerun is the resource
numbers in §3, measured in the same session as optiq.

optiq's accuracy on the existing sets comes from its 25 September runs (`COMPARE` in `_decide_s1.py`,
same case files). On `issue-type-en`, which is new, optiq runs through nav-pilot in the same queue.

## 2. Sample size

At the accuracies seen (0.85–0.97), a 95 % Wilson interval is about ±6 points at 0.85 and ±3 at 0.97
once n is about 150 (±5 at 0.85 would need about 185). English `issue-type` has 32 cases, which gives ±10 points: optiq's 32/32 is [0.89–1.00] and
Kev's 29/32 is [0.76–0.97], so the two cannot be told apart. `issue-type-en` adds 120 English issues
(40 per class) for 152 in all: ±6 points at 0.85, ±3 at 0.97.

The comparison is paired: both models answer the same cases. The report gives the difference Kev − optiq
with its 95 % interval (Newcombe's method for paired proportions), computed by hand from the per-case
JSON: the case ids match the 25 September optiq files. With 152 cases and 5–10 % of them
answered differently, that interval is about ±4–5 points around the observed difference.

How the new cases were chosen: [README](../../bench/decide-cases/README.md#issue-type-en-english-issues-from-oauth2-proxy).
In short: public `oauth2-proxy/oauth2-proxy` issues whose class label a maintainer applied, not the
author and not a bot, as the issue events show. Every candidate was read, and ones that fit another class
better were skipped.

## 3. Resources, next to optiq

The "less resources" claim needs numbers from the same session:

| Measure | Kev | optiq | Source |
|---|---|---|---|
| Peak memory | `phys_footprint_peak` of the `_decide_s1.py` process | the same for the mlx-lm server nav-pilot starts | `footprint`, every 5 s, `.bench-logs/kev-english-*/mem.tsv` |
| Wired memory | system wired pages, peak minus the 30 s idle baseline before the step | the same | `vm_stat`, same file |
| Cold start | model load (`load_s`) + first call (`cold.ms`, in-process wall time) | server first seen in `mem.tsv` to the JSON's `started`, plus `cold.wall_s` (includes the CLI hop) | result JSON and `mem.tsv` |
| Latency | p50 / p95 ms per call, per set | the same, `issue-type-en` same day; other sets from 25 September | result JSON |

Kev runs in-process and optiq goes through nav-pilot and an HTTP server, so Kev's latency is a lower
bound: an integration would add a local server hop and the CLI. The report states that next to the numbers
and does not compare them as equals. CPU-only serving is not measured (PRD gate 2 already covers it).

## 4. Pass criteria for "optional model"

A role is offered on Kev only if it meets every row below. The model is offered at all only if
issue triage passes and the resource rows hold.

| Criterion | Pass | Fail |
|---|---|---|
| Accuracy on the role's English cases, paired with optiq | observed Kev − optiq ≥ −5 points **and** the 95 % interval's lower bound > −10 | the interval's upper bound < −5 (clearly more than 5 behind) |
| Answers at p ≥ 0.9 | Wilson lower bound of right/answered ≥ 0.90 (needs ≥ 36 answered with none wrong), and at most 1 wrong per 50 answered | more than 1 wrong per 50 answered. Fewer than 36 answered with none wrong is inconclusive, not a fail: why (48) and loop-catch (47) can never pass this row at their n, which is one more reason they are not offered |
| Coverage at p ≥ 0.9 | answers ≥ 40 % of the role's cases (below that, most calls still need the fallback) | < 40 % |
| Injection, only for callers that read untrusted evidence | flip rate pooled over the four kinds, paired with optiq: 95 % interval's upper bound on Kev − optiq ≤ +5 points (#154: Kev 3/100, optiq 14/99) | lower bound > +5. Per kind the pairs are 13–29, so one flip moves 3–8 points; per-kind rates are reported, not gated |
| Peak memory | Kev's `phys_footprint_peak` ≤ 50 % of the optiq server's | more |
| Latency | Kev p50 ≤ ½ of optiq's p50, and p95 ≤ optiq's p95, on the same set the same day (the margin leaves room for the server hop Kev does not pay here) | otherwise |
| Cold start | Kev load + first call ≤ optiq server start + first call | more |

A result between pass and fail is inconclusive: the role is not offered, and the report says what n
would settle it. Expected outcome from #154: issue triage passes or is inconclusive; why and loop-catch
fail (Kev never says `no` at p ≥ 0.9 on why, and calls every loop scenario a loop); limits pass only
for the shapes where Kev matched optiq (`options`, `position`), and the pooled injection row should pass
(3/100 against 14/99 in #154).

## 5. Norwegian input: a note for the later integration PR (not built now)

What #154 showed: Kev fails when the **question** is Norwegian (lang-no has the same evidence as
lang-en, only the question and options differ), while Norwegian **evidence** under an English question
held up on issue-type (Norwegian issue texts 62/73 against optiq's 63/73). So:

- **Detect on the question and options first.** nav-pilot knows both at call time. Use the case builders'
  stopword count (`lang()` in `build_sets.py`, Norwegian when its function words outnumber the English
  ones), plus any `æ`, `ø` or `å`. Run over the 20 distinct questions in the case files, this marks 19
  correctly and misses one short Norwegian question (*Beskriver denne commit-meldingen endringene i denne
  diffen?*, which has no `æøå` and one stopword). A short question needs a word list, or a flag from the
  caller: each recipe knows its own language, so `decide` can take it as a parameter and not guess.
- **Evidence** gets the same check, but only as a warning in the log: #154 does not show that Norwegian
  evidence hurts, and blocking on it would send most navikt issues to the fallback for nothing.
- **Route, don't fail.** On Norwegian input, and with Kev configured as the System 1 model, `decide`
  sends the call to the configured fallback (optiq or the cloud model, if either is available), or
  abstains, the same as p < t. It never answers with Kev. The first time per session it prints one line,
  e.g. "Kev handles English only; this question went to <fallback>."
- **Opt-in only.** Kev is never the default, so existing users see no change (a new model for new
  installs, a hint for old ones, never a break). The setting's help text carries the English-only warning.

## 6. Not covered here (tracked as issues)

- **An English `pr-motivation` set.** 28 English cases give ±12 points. Kev's 22/22 at t = 0.9 looks
  good, but the set has to reach about 140 English descriptions before a verdict, and each label means
  reading the PR. Until then the PR check is not offered on Kev.
- **A larger `why-en`.** Not needed for the verdict: at t = 0.9 Kev caught none of the 48 no-why messages in #154.
- **The nav-pilot integration**: a probability-head backend, its own venv (mlx-lm < 0.32, torch < 2.9)
  and the routing in §5. That comes after the report, if the criteria pass.
  That PR also updates the docs with Kev and optiq side by side for English: accuracy with 95 %
  intervals, latency and memory. The docs say plainly that Norwegian goes to optiq.

## 7. Queue and launcher

- [`kev-english.queue`](kev-english.queue): Kev in-process on the English sets (`S1_SETS`), then optiq
  through nav-pilot on `issue-type-en`.
- [`kev-english-launcher`](kev-english-launcher), armed from `~/tmp`, logs to `.bench-logs/kev-english.log`.
  It follows BENCHMARKING.md, "Waiting launchers": it waits for
  `.bench-logs/v2-ladders.done` (the v2 base ladders run first; the phase C requeue waits for
  `kev-english.done`), then for 5 min of free GPU (no queue lock, no benchmark, night-run, model
  server or in-process decide process, on AC). It has a pidfile (`kev-english.pid`), exits at start and
  after the wait if `kev-english.done` exists, and touches that marker only once the queue has run. None
  of its command lines while it waits contain `bench-`, `night`, `np-serve` or `dispatch-probe`.
- Outputs: `bench/decide-{limits,sets,why,loop}-kev-4b-8bit-<stamp>.json`, the four
  `bench/decide-*-s1-<stamp>.md` summaries, `bench/decide-sets-en-<stamp>.md` (optiq and Kev on the new
  set), `bench/decide-sets-optiq-<stamp>.json`, and `.bench-logs/kev-english-*/mem.tsv`. The report goes
  in this directory.

Code changes: `_decide_s1.py` takes `S1_SETS` and knows `issue-type-en`; `_decide_sets.py` summarises
`issue-type-en` and skips the per-model section for a run without the set; `build_sets.py` can be
imported by `build_en.py`.
