# Why optiq scores 27/27 on cheap-ops read-qa and 18/40 on the frontier ladder

Written 2026-09-26 from `bench/frontier-qwen3.6-35b-a3b-optiq-base-20260925-181200.json`, its opencode transcripts (`.bench-logs/qwen3.6-35b-a3b-optiq-20260925-1812*.jsonl` to `-1822*.jsonl`) and the target repository at `b0351ed8`. No GPU was used. Pending item: [pending-tasks §8.7](../2026-09-23-local-model-evaluation/pending-tasks.md#87-after-night-3-quality-frontier-night-1-2026-09-26).

## Conclusion

The two numbers measure different things. The frontier verifier is correct, and optiq's failures are its own mistakes. The main failure is a single instruction that optiq ignores when it answers without explaining first: "Count the defining file only if it also calls the function." It greps for the bare name, gets the `fun name(` line along with the calls, and lists every file the grep matched. Cheap-ops read-qa never tests this, because it only checks that one or two expected strings appear somewhere in the reply.

So this is a model limit on a stricter task, not an artefact of the verifier or the format. There is a prompt lever for it, and the harness already has that lever: the `example` variant, which says to "drop the line that defines it".

## The two tasks

| | cheap-ops (D1, R2, R3) | frontier read-qa (rq-r1 to rq-r5) |
|---|---|---|
| Question | D1: what a function returns. R2: the file and line that read `PDL_URL`. R3: "List every call site of calculateCurrentVarighetUker" | "List every file … that contains a call to F. Count the defining file only if it also calls the function." |
| Required format | none | the last `ANSWER: A.kt, B.kt` line |
| Verifier | `grep_answer`: every `expect_terms` string is a substring of the reply | `verify_answer_set`: the set of `*.kt` names on the last ANSWER line equals the gold set exactly |
| Extras | not penalised | fail |
| Missing test callers | not checked | fail |

R3's single expected term is `OppfolgingstilfellePerson.kt`, which is the defining file (it also calls the function). The two test files that call it are not required, and anything extra is fine. An answer that makes exactly optiq's frontier mistake passes R3.

## What optiq answered (base, 4 runs × 10 tasks)

The gold sets were checked against the repository with `grep -rn '\bF\b' src`. Every extra file below is where F is defined, and none of them calls F.

| Failure | Samples | Tasks |
|---|---|---|
| Only extra: the defining file | 16 | rq-r1-b ×4 (`AzureADMock.kt`), rq-r3-a ×4 (`RequestUtil.kt`), rq-r3-b ×4 (`JWTUtil.kt`), rq-r1-a ×2 (`ArbeidsforholdMock.kt`), rq-r2-b ×2 (`SykmeldtUtenArbeidsgiverKandidatRepository.kt`) |
| The defining file plus a misspelt file name | 3 | rq-r5-b ×2 (`IdenthendendelseServiceTest.kt`, plus `TestDatabase.kt`), rq-r2-b ×1 (`ModiaAOversendingCronjobTest.kt`) |
| No ANSWER line | 3 | rq-r4-a, rq-r5-a, rq-r5-b: the session ended after "let me verify this", with the list written as prose or not written at all |
| Missing a real caller | 0 | |
| Test files wrongly left out or wrongly included | 0 | |

- **The pattern in the transcripts:** almost every sample makes one `grep` for the bare name and then answers. When optiq writes a sentence of reasoning before the ANSWER line (`apiModule`, `respondOk`), it notices the definition and excludes it ("ApiModule.kt defines the function but does not call it"). When it goes straight to `ANSWER:`, it lists every file the grep hit. The same tasks fail the same way run after run, so this is not sampling noise.
- **Why the ladder looks inverted:** both r3 functions (`bearerHeader`, `generateJWT`) are ones whose defining file optiq lists every time, while at r4 it excluded the definition (`respondOk` in `MockUtils.kt`). That is why r3 is 0/8 and r4 is 7/8. Which function sits at a rung decides the cell, not the number of files the rung asks for.
- **cap900 (step 10)** failed the same way: 2/8, with 4 defining-file extras (`ApiModule.kt` among them) and 2 missing ANSWER lines. More time does not help, because optiq finishes in 5 to 20 s.
- **Cloud:** 40/40. Sonnet excluded the defining file every time.

With lenient scoring the base run would be 34/40 if a defining-file extra were forgiven, and 37/40 if misspelt names were forgiven as well. That shows how much of the gap comes from one instruction. It is not an argument for changing the gold: the prompt states the rule, and a caller list that includes the definition is wrong for the job it stands in for, such as listing the files a signature change must touch.

## What to do

1. **Run the `example` variant on read-qa (no harness change).** Its prefix already says "drop the line that defines it", and `applies()` allows it for read-qa. One `local lever read-qa example` line in a night queue, about 10 GPU minutes for 4 runs. This is the direct test of whether the gap is the prompt: if optiq's cells reach the cloud's bar under `example`, the frontier for read-qa is a prompt default, not a model limit.
2. **Report the failure kind in the verifier note (a harness change: hold until after the 64 GB nights).** `verify_answer_set` in `_frontier.py` could tag an extra that is the defining file (`def_file` would have to be added to the read-qa `verify` block, which changes the tasks file too), so the summary separates "listed the definition" from "listed an unrelated file". It changes no verdict. `_frontier.py` and the tasks file are `harness_sha` inputs, so this waits and is not applied here.
3. **Do not loosen the verifier or reword the base prompt mid-series.** Both would break comparability with night 1 and the cloud baseline. If a reworded prompt is wanted, it becomes a new variant next to `example`, not a change to base.
