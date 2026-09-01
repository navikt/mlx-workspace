# Quarantined: `results-qwen3.8-27b-4bit-20260901-QUARANTINED-no-edits-landed.json`

Verified 1 of 8. Excluded from the reported average, on a mechanical criterion decided by
looking at the tool calls rather than at the score.

**The criterion: no edit task changed a file.**

| run | verified | edit tasks that changed a file |
|---|---|---|
| `…-044010` | 5 | 6 of 7 |
| `…-192222-04` | 7 | 6 of 7 |
| `…-192222-06` | 6 | 6 of 7 |
| `…-192222-08` | 5 | 6 of 7 |
| **this one** | **1** | **0 of 7** |

Every other run of this profile edits a file on six of seven edit tasks. This one edited nothing,
on any task, after 4 to 17 tool calls each. That is the signature of tool calls not landing, not
of a model that cannot edit — a weak model still writes something wrong.

It was produced on the night of 31 August, during the hours when three harness faults were being
found and fixed: a TypeScript repo sitting in the Kotlin workspace, result files overwriting each
other, and a chat template passed as a path. `MODELS.md` records that all three "produced numbers
that looked like weak models". This run has the same shape.

**Kept, not deleted.** Excluding a run because it is inconvenient is how a benchmark becomes a
press release. The file stays, the reason is written down here, and both numbers get published:
5.75 of 8 over four clean runs, and 4.80 over all five. The difference between them is exactly
this run, and a reader who disagrees with the criterion can use the other number.

With it excluded the two models do not overlap at all (3.6: 3,3,3,4,4 — 3.8: 5,5,6,7), exact
two-sided Mann-Whitney p = 0.008. With it included, p = 0.175. So it decides whether the
difference is publishable, which is exactly why the criterion had to be mechanical and stated
before the number was quoted.
