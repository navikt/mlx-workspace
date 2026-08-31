# Finding the ceiling: a benchmark for harder engineering work

Working document. Everything measured so far was chosen to be *achievable*, because the first
question was whether a local model could do useful work at all. It can. The next question is
the opposite one: **where does it stop?**

## What we already know the shape of

| | Result | Confidence |
|---|---|---|
| Apply a specified change across files | 46 references, 10 files, unaided, twice | good, n=2 plus 20 ladder samples |
| Create a file that does not exist | nothing at all, 0 of 3 | good, and consistent across models |
| Debug a failing test with no stated cause | 0 of 3, one timeout | thin, n=1 per task |
| Whether delegation pays | tracks the cloud arm's step count, 4 points, monotone | the report's spine |

The gap in all of it: every task was sized to be doable. Nobody has asked the model to do
something and watched it fail *because the task got bigger*, which is the number a developer
actually needs — not "can it rename", but "how much can it rename".

## The four experiments, ranked

### 1. Scale ceiling. Where does a mechanical change stop working?

The cheapest and most useful. The rename verifier already exists, is machine-checkable, and
the failure mode is unambiguous: either every reference is gone and it compiles, or it is not.

Grow one axis at a time from the known-good point:

| | references | files | known |
|---|---|---|---|
| A | 46 | 10 | passes, twice |
| B | ~100 | ~10 | more references, same spread |
| C | ~46 | ~40 | same references, wider spread |
| D | ~200 | ~40 | both |

B against C is the interesting comparison: it separates *how much text* from *how many places
to look*. If C fails where B passes, the limit is context and file-hopping rather than volume,
which is a different piece of advice.

Output is a sentence a developer can hold: "dispatch mechanical changes up to about N files."

### 2. Decision-shaped tasks. Is the central finding real?

The report's spine — applies well, decides badly — rests on two task shapes, both of which
happen to be *creation* tasks (write a new file, find an unknown cause). It is possible we
measured "cannot create" and called it "cannot decide".

The test that separates them: a task that changes only existing code but requires a judgement
with no single specified answer. Extract a helper and choose its boundary. Pick which of three
call sites is the one that should own a check. Rename a concept where the new name is not given.

Hard to verify mechanically, which is exactly why it has not been done, and why it belongs
second rather than first. Verification is agreement with the cloud model's choice plus the
suite, the measure `_refactor_quality.py` already implements.

### 3. Long context. Does a session decay?

Every sample is a fresh session against a clean tree. Real work is neither. This measures
verification rate as a session accumulates context, which is the closest we can get to the
working-day question without a user.

Needs a harness that does not reset between tasks, which is new machinery rather than a new
target. Second-highest value, highest build cost.

### 4. Bigger models. Is the ceiling the model or the class?

This machine has 128 GB. The 48 GB limit was the alpha target's, never ours. `Qwen3.8-27B` was
held back for hanging, not for weakness, and a 64 GB build is the natural retest.

Only worth running *after* 1, because the ceiling has to be measured before it can be moved.
The interesting result is not "the bigger model is better" but whether it shifts the 2-step
break-even, which would change the advice to users completely.

## Rules carried over, because each was paid for

- **Validate the target before spending GPU time.** `mise run bench-validate-target` checks
  both the test and compile baselines on an untouched tree. Thirty-two samples were lost this
  week to a compile that was red before anyone touched it.
- **Both arms failing is a broken task**, not a finding. Rung 5 scored 0/8 in the control arm
  too; that is a task written for another codebase.
- **Write the analysis down first** when the result would be arguable either way.
- **Report the denominator.** `mise run bench-results` prints discards beside valid samples.
- **One thing at a time on the machine.** The harness refuses above a load of 8, correctly.

## What this is not

Not a quality benchmark. Nothing here measures whether the code is *good*, only whether it is
complete and passes the target's own checks. The report is explicit that "compiles but wrong"
has no instrument, and none of these four adds one.
