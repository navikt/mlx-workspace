# Does the commit message explain why? Results

`nav-pilot alpha decide`, question *Does the commit message explain why the change was made, beyond
describing what the diff already shows?* with the message and diff as evidence, on the 48 cases in
`commit-explains-why.jsonl` and their Norwegian twins (`ja`/`nei`). How the cases were built: [README.md](README.md).
Run on 25 September 2026 with nav-pilot `2e1e8ee1`; full tables:
[../decide-why-20260925-072116.md](../decide-why-20260925-072116.md). Cells are correct/n = accuracy [95 % Wilson].

| | optiq (Qwen3.6 35B-A3B OptiQ 4-bit, the default) | Qwen3.8 27B OptiQ 4-bit |
|---|---|---|
| All, EN + NO | 89/96 = 0.93 [0.86–0.96] | 95/96 = 0.99 [0.94–1.00] |
| English question | 45/48 = 0.94 [0.83–0.98] | 48/48 = 1.00 [0.93–1.00] |
| Norwegian question | 44/48 = 0.92 [0.80–0.97] | 47/48 = 0.98 [0.89–1.00] |
| Explains why (expect yes) | 44/48 = 0.92 [0.80–0.97] | 48/48 = 1.00 [0.93–1.00] |
| Real "what only" messages (expect no) | 24/24 = 1.00 [0.86–1.00] | 23/24 = 0.96 [0.80–0.99] |
| Controlled: same diff, reason removed (expect no) | 21/24 = 0.88 [0.69–0.96] | 24/24 = 1.00 [0.86–1.00] |
| Answered at p ≥ 0.9, and their accuracy | 16/96, 16/16 correct | 30/96, 30/30 correct |
| Calibration, p 0.5–0.7 / 0.7–0.9 / ≥ 0.9 | 0.74 / 0.98 / 1.00 (n 23 / 57 / 16) | 0.94 / 1.00 / 1.00 (n 16 / 50 / 30) |
| p50 / p95 per call | 432 / 647 ms | 1158 / 2857 ms |
| `--eval` totals, EN; NO | 45/48; 44/48 | 48/48; 47/48 |

What this says:

- **The question works.** Both models separate messages that give a reason from ones that only restate
  the diff. The controlled negatives, where the message keeps its length and style and only loses the
  reason, are answered as well as the real ones, so this is not a length or "has a body" effect.
- **The probabilities are compressed.** Few answers reach p ≥ 0.9 (17 % and 31 %), yet the band
  0.7–0.9 is right 106 times out of 107. A p ≥ 0.9 threshold throws away most correct answers.
- **optiq's mistakes are all below p 0.71.** Seven wrong: three controlled negatives it called "yes"
  (p 0.50, 0.50, 0.71) and four Norwegian-question cases where it said `nei` to a message that does
  explain why (p 0.59–0.65). The Norwegian question leans towards `nei` at low confidence; 7 of 48
  twins got different answers in English and Norwegian (Qwen3.8: 1 of 48).
- **Qwen3.8 is more accurate and about 2.7× slower** (1.2 s against 0.4 s per call, warm).

## As a `commit-msg` hook

Treat p(no) ≥ t as "this message does not say why". Over all 96 calls per model:

| t | optiq: caught / wrongly flagged | Qwen3.8: caught / wrongly flagged |
|---|---|---|
| 0.5 (the plain answer) | 45/48 / 6/48 | 48/48 / 0/48 |
| **0.7** | **40/48 = 0.83 / 0/48 [0.00–0.07]** | 35/48 = 0.73 / 0/48 [0.00–0.07] |
| 0.8 | 25/48 / 0/48 | 18/48 / 0/48 |
| 0.9 | 7/48 / 0/48 | 7/48 / 0/48 |

Recommended: **optiq, flag at p(no) ≥ 0.7**, as a warning, not a block. At 0.7 it caught 83 % of the
no-reason calls and flagged none of the 48 calls (24 commits, EN and NO) whose message had one. Zero out of 48 still allows a
false-flag rate up to 7 % (Wilson upper bound; 14 % counting only the 24 distinct commits), the cases come from two repositories written by few
people, and the labels are one reader's. That is good enough to print a nudge and let the author
commit anyway; it is not enough evidence to stop a commit. A team that wants to block should first
run `nav-pilot alpha decide --eval` on its own commit history and set t from that. A threshold of 0.9
would be safe but nearly useless: it catches 15 %.
