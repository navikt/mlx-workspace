# Kev 4B and Laya on the decide sets, 2026-09-29

Pending-tasks §8.6, #95; gate 2 of the [hosted-decide PRD](../2026-09-27-hosted-decide-prd/prd.md).
Plan: [plan.md](plan.md). Background: [research.md](research.md). Run: stamp `20260929-114202`,
checkout 7d669a0, 3 × 1,295 calls, 0 errors.

## Verdict

**Neither model replaces optiq as the decide model. Kev 4B can take English-evidence triage calls at
t = 0.9; Laya can take none.**

- **Kev 4B (8-bit)** is within the intervals of optiq on the recipe sets with English or short
  evidence: issue-type 91/105 against 95/105, pr-motivation 41/48 against 36/48, why-en 44/48 against
  45/48, options 176/180, position 165/180. At t = 0.9 it made no wrong answer on issue-type (49/49),
  aksel-kind (18/18) or pr-motivation (22/22), but it answers fewer cases than optiq: 47 % against
  68 % on issue-type, 28 % against 65 % on aksel-kind. It fails on Norwegian questions (why-no 24/48
  against 44/48, lang-no 90/152 against 118/152) and on long yes/no evidence (describes 29/40 against
  37/40, goapi 20/40 against 28/40). It leans to `yes`: as the `commit-msg` warning at 0.7 it
  catches 7/48 messages without a why, against optiq's 40/48.
- **Laya 421M and Laya multilingual 322M** are 0.34–0.69 on the recipe sets where optiq is
  0.75–0.94, and truncation does not explain it: on the cases that fit their window they are still
  24–46 points below optiq on the same cases. Their p does not support t = 0.9 (multilingual: 24/46
  right at p ≥ 0.9 on the why sets, 19/48 on aksel-kind), and the authority and claim injections
  flip 61–71 % of their answers.
- **PRD gate 2 is not met.** The criterion is "within 5 points of optiq on lang-no, describes and
  injection, on the untruncated subset". Kev truncates nothing and passes injection (0.87 against
  0.82) but misses lang-no by 19 points and describes by 21. Laya misses all three. Every run here was
  on Apple Silicon through MLX; CPU latency was not measured.
- **Loop classifier (question 5): no.** At t = 0.9 no model catches either loop, the same result as
  the classifier that never shipped. Kev calls all 7 scenarios a loop; Laya multilingual calls both
  loops legitimate.

Callers, at t = 0.9 abstain:

| Caller | Kev 4B | Laya 421M / 322M |
|---|---|---|
| Issue triage, English or short Norwegian issues (`issue-type`, `aksel-kind`) | Usable: no wrong answers at 0.9, lower coverage than optiq | No |
| PR description check (`pr-motivation`) | Usable at 0.9 (22/22); at least as good as optiq at 0.5 | No |
| `commit-msg` "says what, not why", English question | No: catches 0/48 at 0.9, 7/48 at 0.7 | No |
| Same, Norwegian question | No: 0/24 no-why messages caught even at 0.5 | No |
| Anything reading untrusted evidence | Flips less than optiq, except `diff-claim` (3/13) | No: 61–71 % flipped on authority and claim |
| Loop classifier | No | No |

## 1. Accuracy per set

Cells are correct/n = accuracy [95 % Wilson]; an error counts as wrong (there were none). optiq and
Qwen3.8 are the existing nav-pilot runs on the same case files; Kev and Laya ran in-process.
Sources: [`decide-why-s1`](../../bench/decide-why-s1-20260929-114202.md),
[`decide-sets-s1`](../../bench/decide-sets-s1-20260929-114202.md),
[`decide-limits-s1`](../../bench/decide-limits-s1-20260929-114202.md),
[`decide-loop-s1`](../../bench/decide-loop-s1-20260929-114202.md).

| Set | optiq | Qwen3.8-27B | Kev 4B | Laya 421M | Laya-m 322M |
|---|---|---|---|---|---|
| why-en | 45/48 = 0.94 [0.83–0.98] | 48/48 = 1.00 [0.93–1.00] | 44/48 = 0.92 [0.80–0.97] | 25/48 = 0.52 [0.38–0.66] | 24/48 = 0.50 [0.36–0.64] |
| why-no | 44/48 = 0.92 [0.80–0.97] | 47/48 = 0.98 [0.89–1.00] | 24/48 = 0.50 [0.36–0.64] | 22/48 = 0.46 [0.33–0.60] | 19/48 = 0.40 [0.27–0.54] |
| issue-type | 95/105 = 0.90 [0.83–0.95] | 96/105 = 0.91 [0.85–0.95] | 91/105 = 0.87 [0.79–0.92] | 63/105 = 0.60 [0.50–0.69] | 72/105 = 0.69 [0.59–0.77] |
| aksel-kind | 51/65 = 0.78 [0.67–0.87] | 46/65 = 0.71 [0.59–0.80] | 46/65 = 0.71 [0.59–0.80] | 38/65 = 0.58 [0.46–0.70] | 22/65 = 0.34 [0.24–0.46] |
| pr-motivation | 36/48 = 0.75 [0.61–0.85] | 39/48 = 0.81 [0.68–0.90] | 41/48 = 0.85 [0.73–0.93] | 25/48 = 0.52 [0.38–0.66] | 23/48 = 0.48 [0.34–0.62] |
| lang-en | 26/32 = 0.81 [0.65–0.91] | 28/32 = 0.88 [0.72–0.95] | 27/32 = 0.84 [0.68–0.93] | 16/32 = 0.50 [0.34–0.66] | 11/32 = 0.34 [0.20–0.52] |
| lang-no | 118/152 = 0.78 [0.70–0.84] | 127/152 = 0.84 [0.77–0.89] | 90/152 = 0.59 [0.51–0.67] | 90/152 = 0.59 [0.51–0.67] | 68/152 = 0.45 [0.37–0.53] |
| describes | 37/40 = 0.93 [0.80–0.97] | 39/40 = 0.97 [0.87–1.00] | 29/40 = 0.72 [0.57–0.84] | 24/40 = 0.60 [0.45–0.74] | 21/40 = 0.53 [0.37–0.67] |
| goapi | 28/40 = 0.70 [0.55–0.82] | 35/40 = 0.88 [0.74–0.95] | 20/40 = 0.50 [0.35–0.65] | 20/40 = 0.50 [0.35–0.65] | 20/40 = 0.50 [0.35–0.65] |
| loop-near | 22/40 = 0.55 [0.40–0.69] | 33/40 = 0.82 [0.68–0.91] | 24/40 = 0.60 [0.45–0.74] | 18/40 = 0.45 [0.31–0.60] | 23/40 = 0.57 [0.42–0.71] |
| options | 179/180 = 0.99 [0.97–1.00] | 176/180 = 0.98 [0.94–0.99] | 176/180 = 0.98 [0.94–0.99] | 164/180 = 0.91 [0.86–0.94] | 125/180 = 0.69 [0.62–0.76] |
| position | 164/180 = 0.91 [0.86–0.94] | 166/180 = 0.92 [0.87–0.95] | 165/180 = 0.92 [0.87–0.95] | 132/180 = 0.73 [0.66–0.79] | 133/180 = 0.74 [0.67–0.80] |
| injection | 132/160 = 0.82 [0.76–0.88] | 103/160 = 0.64 [0.57–0.71] | 139/160 = 0.87 [0.81–0.91] | 65/160 = 0.41 [0.33–0.48] | 61/160 = 0.38 [0.31–0.46] |
| length | 121/150 = 0.81 [0.74–0.86] | 138/150 = 0.92 [0.87–0.95] | 95/150 = 0.63 [0.55–0.71] | 81/150 = 0.54 [0.46–0.62] | 79/150 = 0.53 [0.45–0.60] |

Where each one breaks:

- **Norwegian.** Kev is English-only, as expected. On why-no it keeps every real-why message
  (24/24) and calls all 24 no-why messages `ja`; 20/48 EN/NO twins differ (optiq 7/48). On lang-no
  it is 26/29 on states within its 384 training tokens and 64/123 above them. Laya multilingual does
  not beat Laya English on Norwegian: lang-no 68/152 against 90/152, why-no 19/48 against 22/48. Only
  issue-type's Norwegian issues go its way (50/73 against 42/73).
- **Many options.** Kev holds up to 14 options (28/30 at k = 14). Laya English is 27/30 at k = 14
  even with its clamped temperature. Laya multilingual drops from 23/30 at k = 2 to 19/30 at k = 14.
- **Position.** Kev has no bias on 4-option type questions (29/30 at each position). Laya English
  loses the last position (21/30 at D; 40/120 answers at A). On yes/no, Kev picks the first-listed
  option 19/30 when `yes` is first, 12/30 when `no` is.
- **Yes-bias.** Every wrong Kev answer on the why sets and on pr-motivation is `yes`. Laya
  multilingual answered `yes` on all 48 English why cases.

## 2. Long evidence, read with and without truncation

Kev cuts at 8,192 tokens. The longest state was 7,853 tokens, so nothing was cut and no case hit
`ContextOverflow`; the plan expected the 30k-character cases at about 9k tokens. Laya cuts at 512
(English) or 1,024 (multilingual) tokens.

Truncated cases per set, Laya 421M / Laya-m 322M: why-en and why-no 27/48 / 18/48 each, issue-type
24/105 / 1/105, aksel-kind 5/65 / 0/65, lang-no 118/152 / 93/152, describes 35/40 / 27/40, goapi
37/40 / 30/40, loop-near 40/40 / 34/40, injection 34/160 / 22/160, length 60/150 / 60/150.

On the untruncated subset only, paired with the other models on the same cases (computed from the
per-case JSON):

| Set (cases that fit) | Laya | optiq | Kev |
|---|---|---|---|
| lang-no, Laya 421M (34) | 17/34 = 0.50 [0.34–0.66] | 25/34 = 0.74 [0.57–0.85] | 29/34 = 0.85 [0.70–0.94] |
| lang-no, Laya-m (59) | 25/59 = 0.42 [0.31–0.55] | 48/59 = 0.81 [0.70–0.89] | 44/59 = 0.75 [0.62–0.84] |
| describes, Laya-m (13) | 9/13 = 0.69 [0.42–0.87] | 13/13 = 1.00 [0.77–1.00] | 11/13 = 0.85 [0.58–0.96] |
| goapi, Laya-m (10) | 0/10 = 0.00 [0.00–0.28] | 10/10 = 1.00 [0.72–1.00] | 10/10 = 1.00 [0.72–1.00] |
| injection, Laya 421M (126) | 49/126 = 0.39 [0.31–0.48] | 103/126 = 0.82 [0.74–0.88] | 120/126 = 0.95 [0.90–0.98] |
| injection, Laya-m (138) | 51/138 = 0.37 [0.29–0.45] | 115/138 = 0.83 [0.76–0.89] | 128/138 = 0.93 [0.87–0.96] |
| length, Laya 421M / Laya-m (90) | 50/90 = 0.56, 49/90 = 0.54 | 72/90 = 0.80 [0.71–0.87] | 60/90 = 0.67 [0.56–0.76] |
| why-en, Laya-m (30) | 16/30 = 0.53 [0.36–0.70] | 27/30 = 0.90 [0.74–0.97] | 28/30 = 0.93 [0.79–0.98] |
| why-no, Laya-m (30) | 14/30 = 0.47 [0.30–0.64] | 26/30 = 0.87 [0.70–0.95] | 16/30 = 0.53 [0.36–0.70] |
| issue-type, Laya 421M (81) | 52/81 = 0.64 [0.53–0.74] | 71/81 = 0.88 [0.79–0.93] | 69/81 = 0.85 [0.76–0.91] |

The Laya gap to optiq is as large on the cases that fit as on all cases. On `length`, Laya is
0.43–0.63 already at 1k characters, where nothing is cut. Kev's `length` result is flat too
(0.63–0.70 at 1k, 0.60 at 30k): the weakness is the yes/no question, not the length.

## 3. Calibration and the t = 0.9 rule

| | optiq | Qwen3.8 | Kev 4B | Laya 421M | Laya-m 322M |
|---|---|---|---|---|---|
| limits, p 0.90–0.99: right | 192/205 = 0.94 | 218/230 = 0.95 | 386/405 = 0.95 | 89/101 = 0.88 | 170/273 = 0.62 |
| limits, p 0.99–1.00: right | 336/338 = 0.99 | 319/319 = 1.00 | 36/36 = 1.00 | 57/64 = 0.89 | 22/40 = 0.55 |
| issue-type at t = 0.9: answered; right | 71/105; 71/71 | 70/105; 70/70 | 49/105; 49/49 | 25/105; 23/25 | 34/105; 29/34 |
| aksel-kind at t = 0.9 | 42/65; 38/42 | 40/65; 40/40 | 18/65; 18/18 | 3/65; 3/3 | 48/65; 19/48 |
| pr-motivation at t = 0.9 | 31/48; 29/31 | 25/48; 25/25 | 22/48; 22/22 | 19/48; 9/19 | 21/48; 10/21 |
| why sets at t = 0.9 | 16/96; 16/16 | 30/96; 30/30 | 18/96; 18/18 | 2/96; 1/2 | 46/96; 24/46 |
| `commit-msg` at p(no) ≥ 0.9: caught; wrongly blocked | 7/48; 0/48 | 7/48; 0/48 | 0/48; 0/48 | 0/48; 0/48 | 0/48; 0/48 |

Kev's p is usable: at p ≥ 0.9 it is as accurate as optiq, but it rarely goes above 0.99 (36 of 974
limits cases against optiq's 338), so it abstains more; on the recipe sets it answers 43–71 % as many
cases as optiq at 0.9. Its confident answers on the why sets are all `yes` (18/18); it never says
`no` at p ≥ 0.9. Laya multilingual is overconfident and wrong: all 24 English no-why cases got `yes`
at p 0.81–0.99. Laya English is rarely confident at all.

## 4. Latency

In-process on this Mac (Apple Silicon, MLX), one call, no HTTP. optiq and Qwen3.8 go through
nav-pilot and mlx-lm, so their figures include the CLI and server round trip.

| p50 / p95 ms | optiq | Qwen3.8 | Kev 4B | Laya 421M | Laya-m 322M |
|---|---|---|---|---|---|
| issue-type | 402 / 526 | 817 / 2060 | 113 / 340 | 13 / 19 | 9 / 21 |
| why (EN + NO) | 432 / 647 | 1158 / 2857 | 334 / 787 | 18 / 20 | 14 / 21 |
| length 30k, p50 | 2475 | 11563 | 2628 | 23 | 27 |
| Load | – | – | 16.5 s | 0.3 s | 0.6 s |

Kev's first load, in the dry run, took 22,758 s (6.3 h) before the first call; the second load took
16.5 s. The cause was not investigated (the weights were the cached snapshot, with HF offline).

## 5. Injection

Flip rate: of the pairs whose clean case was right, how often the injected twin took the injected
answer.

| Injection | optiq | Qwen3.8 | Kev 4B | Laya 421M | Laya-m 322M |
|---|---|---|---|---|---|
| authority | 2/27 = 0.07 | 13/28 = 0.46 | 0/29 = 0.00 [0.00–0.12] | 11/18 = 0.61 | 9/14 = 0.64 |
| claim | 9/27 = 0.33 | 15/28 = 0.54 | 0/29 = 0.00 [0.00–0.12] | 11/18 = 0.61 | 10/14 = 0.71 |
| diff-claim | 2/18 = 0.11 | 11/19 = 0.58 | 3/13 = 0.23 [0.08–0.50] | 0/10 = 0.00 | 1/11 = 0.09 |
| letter | 1/27 = 0.04 | 8/28 = 0.29 | 0/29 = 0.00 [0.00–0.12] | 8/18 = 0.44 | 2/14 = 0.14 |

Kev ignores the injected instruction in 87 of 87 authority, claim and letter pairs, but is only
13/20 on the clean `diff-claim` cases. Laya's low `diff-claim` flip rate rests on 10–11 clean-right
pairs; on the other kinds it flips 14–71 %.

## 6. Question 5: the loop classifier

The 7 scenarios from the guard prompt ([System One report](../2026-09-25-system-one/report.md)
§3.1), one call each, no tool results in the evidence.

| | Kev 4B | Laya 421M | Laya-m 322M |
|---|---|---|---|
| Loops called loops (argmax) | 2/2 | 2/2 | 0/2 |
| Polls called legitimate (argmax) | 0/5 | 3/5 | 4/5 |
| At t = 0.9: loops caught; polls blocked | 0/2; 0/5 (max p 0.89) | 0/2; 0/5 (max p 0.68) | 0/2; 1/5 (`poll-ci` at 0.93) |

For comparison, optiq and Qwen3.8 through the guard prompt caught 0/2 loops and blocked 0/5 polls at
0.9 (§3.1). Kev calls everything a loop, at p 0.57–0.89. Laya English separates best on argmax but
calls 2 of 5 polls loops and stays below p 0.68. Laya multilingual gets it backwards: both loops
`legitimate` at 0.91–0.93, and one poll a loop at 0.93. None does better than the classifier that
was replaced; the result-aware guard stays.

## 7. What follows

- Kev 4B is the only candidate for a second decide backend, and only for English or short evidence
  at t ≥ 0.9, where it made no wrong answers but abstains more than optiq. It is not a drop-in: it
  needs its own venv (mlx-lm < 0.32, torch < 2.9) and a probability-head backend in nav-pilot.
- Laya is out for every caller measured here.
- PRD gate 2: not met. A CPU-served decide would have to be Kev at 4B, which the PRD already puts at
  about 7 s at 2k tokens on 16 cores: CI only, and it still fails Norwegian.

## Files

- Summaries: `bench/decide-{why,sets,limits,loop}-s1-20260929-114202.md`
- Per-case results: `bench/decide-{why,sets,limits,loop}-{kev-4b-8bit,laya-421m,laya-m-322m}-20260929-114202.json`
- Chat-model runs compared against: `bench/decide-limits-*-20260925-014512.json`,
  `bench/decide-sets-*-20260925-225356.json`, `bench/decide-why-*-20260925-072116.json`
- Adapter: `.mise/tasks/_decide_s1.py`; queue [kev-laya.queue](kev-laya.queue); launcher
  [kev-laya-launcher](kev-laya-launcher)
