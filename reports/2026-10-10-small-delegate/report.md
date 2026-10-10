# Small tasks locally and by delegation on optiq-64g and the 8-bit, 2026-10-10

## Question
Which of the audit's small PR types (edit-single, config-deploy, docs, test-only, deps; about 42 % of human Nav PRs) can `qwen3.6-35b-a3b-optiq-64g` and `qwen3.6-35b-a3b-8bit-64g` do locally? Would delegating O1 and T1 change any `manifest/models.json` delegate verdict?

## What shipped
Nothing. All delegate samples ran under the bench-only overlay `capabilities-bench-only-small.json`.

## Method
Three queues ran on 9–10 Oct: small-tasks (#180, 28 steps), small-delegate (#181, rungs 8 and 9 with 4 controls and 8 hybrid samples per worker) and small-fill (#182). Harness 1cb0ea736a5a, temp 0.6, 48 GB wired, nav-pilot-main-2bcca023 with aggressive dispatch, cloud claude-sonnet-5.

Excluded:
- the 14 optiq fill steps after 05:06, which produced no result file because of a stray `workspaces/…/src` (#186);
- the optiq pass 20261010-044328, during which that `src` appeared (E3b, T1 and D3 ended with "no changes made", T1 after 15 s against about 300 s in the pass before). Counted as failures instead, optiq would read T1 14/16 and E3b 12/16.

Valid passes: 15 optiq, 30 8-bit. O1 and T1 are not in `bench/task-classes.json`, so the tools leave them out; here they are mapped by hand (O1 to edit-single, T1 to create-file). Result branches: `bench/night3-results-20261009-194909`, `-20261010-012028`, `-20261010-014334` and `-20261010-020638`.

## Results
Local, per task: k/n [95 % Wilson]. "Can" means at least 75 % pass, "cannot" at most 25 %.

| Audit type (share) | Task | optiq-64g | 8-bit-64g |
|---|---|---|---|
| edit-single (21.1 %) | E1 | 15/15 [0.80, 1.00] can | 30/30 [0.89, 1.00] can |
| edit-single | E3b | 12/15 [0.55, 0.93] can | 29/30 [0.83, 0.99] can |
| config-deploy (9.0 %) | O1 | 0/15 [0.00, 0.20] cannot* | 0/30 [0.00, 0.11] cannot* |
| docs (4.8 %) | E1 (KDoc, proxy) | as E1 | as E1 |
| test-only (2.8 %) | T1 | 14/15 [0.70, 0.99] can | 28/30 [0.79, 0.98] can |
| deps by hand (4.5 %) | none | not measured | not measured |

\*Every O1 sample ended with "no changes made" after about 7 s and 3–5 turns, while the cloud control passed 4/4. That points to a harness defect, not a model limit; not yet confirmed from a transcript.

Local, per class (E1 and E3b only for edit-single; G2, D3 and T1 for create-file), with the `bench-capabilities` verdict:

| Class | optiq | 8-bit |
|---|---|---|
| edit-single | 27/30 [0.74, 0.97], not-yet | 59/60 [0.91, 1.00], trusted (cloud with O1: 59/90) |
| create-file | 33/45 [0.59, 0.84], cloud | 71/90 [0.69, 0.86], cloud |
| edit-multi-mechanical | 25/30 [0.66, 0.93], cloud | 37/60 [0.49, 0.73], cloud |
| read-qa | 43/45 [0.85, 0.99], not-yet | 84/90 [0.86, 0.97], cloud |

Delegation. Dispatch counts samples that reached the worker; pass rates are over dispatched samples.

| Worker, rung (class) | Dispatch | Pass dispatched | Control | Pooled cost ratio | bar_verdict |
|---|---|---|---|---|---|
| optiq, 8 O1 (edit-single) | 0/8 | – | 4/4 | – | no evidence |
| 8-bit, 8 O1 (edit-single) | 0/8 | – | 4/4 | – | no evidence |
| optiq, 9 T1 + 4 G2 (create-file) | 11/12 | 11/11 [0.74, 1.00] | 6/6 | 1.49 | cloud (ratio > 1) |
| 8-bit, 9 T1 (create-file) | 7/8 | 7/7 [0.65, 1.00] | 4/4 | 1.32 | cloud (ratio > 1) |
| optiq, rungs 1–3 (R2, E1, M1) | 0/12 | – | 6/6 | – | no evidence |

## Verdict
Both profiles do single edits, doc comments and test-only work locally: E1, E3b and T1 are at 80 % or higher. The 8-bit is more consistent (edit-single 59/60). Config-deploy cannot be judged until O1 is fixed. Delegation passes as often as the control, but costs 1.3–1.5× the cloud control. The orchestrator never hands over one-line edits (0/32 dispatches across O1, R2, E1 and M1).

Share of human Nav PRs a profile can take locally: edit-single 21.1 % + docs 4.8 % + test-only 2.8 % = about 28.7 % for each profile. Under the strict shipped bar it is 21.1 % for the 8-bit (edit-single trusted) and 0 % for optiq (not-yet). Config-deploy (9 %) and deps (4.5 %) are open.

## Limits
optiq has n = 15 per task, half the 8-bit's n = 30. The docs figure rests on a KDoc proxy. There is no deps-bump task. The O1 cause is not confirmed. The delegate n is 7–11 dispatched samples.

## Decision
No manifest change now. Every delegate row is cloud or has no evidence; create-file fails on cost (ratio 1.32–1.49), not quality.

Next, in order:
1. Find why O1 makes no edit (read one transcript), fix it, and re-run about 4 passes per profile.
2. Add `O1: edit-single` and `T1: create-file` to `bench/task-classes.json` once O1 is fixed, so the tools count them.
3. Fix the per-task reset (#186).
4. Add a by-hand deps-bump task so the remaining 4.5 % can be measured.

Open for the owner: whether to ship the 8-bit's local edit-single as trusted (59/60 [0.91, 1.00], without O1). The local verdict does not change routing today, since nav-pilot routes only on the delegate verdict.

## Reproduce
`mise run bench-results -- --by-class`, `mise run bench-capabilities` (with the O1 and T1 mapping added), `mise run bench-cheap-ops`.

## Sources
[small-tasks plan](../2026-10-09-small-tasks/plan.md), [small-delegate plan](plan.md), the results files on the four `bench/night3-results-*` branches above, [PR audit](../2026-10-09-navikt-pr-audit/report.md), #180, #181, #182, #186.
