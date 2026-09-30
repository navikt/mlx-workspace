# Quality frontier, v2 base ladders, 2026-09-30

## Question
Harness v1 understated the local models: in the v2 validation, optiq's create-file r1–r3 went from 3/12
to 12/12. Under harness v2, does any class become `trusted` for local delegation on the two shipped
profiles, optiq and the 64 GB 8-bit?

This run gates the stop rule in [BENCHMARKING.md](../../BENCHMARKING.md) («Queued runs»). If no class
is trusted, the ladder work for these profiles stops. A trusted class would still need a delegate
cost-ratio measurement before `manifest/models.json` changes.

## What shipped
Nothing. `manifest/models.json` is unchanged. The frontier feed does not set delegate verdicts: those need
a measured hybrid/control cost ratio below 1, which frontier runs do not produce.

## Method
- Models: `qwen3.6-35b-a3b-optiq` and `qwen3.6-35b-a3b-8bit-64g`, harness_sha `f7507f42e5f4`.
- Classes and rungs: create-file r1–r4, edit-single r1–r5 and edit-multi-mechanical (emm) r1–r6, with 10 samples per rung.
- The queues are [v2-ladders.queue](v2-ladders.queue) (create-file, 30 Sep 04:31–08:35) and [v2-edit.queue](v2-edit.queue)
  (edit classes, 08:54–12:59). The first night's edit steps failed in 1 s on a missing validation file and were re-run.
- Verdicts come from the repo's own `rung_verdict` (`_frontier.py`): a one-sided 90 % monotone lower bound
  against the bar × p_cloud. The step table and full frontier tables are in [v2-ladders.md](v2-ladders.md).
- For comparison, v1 is harness `df7deb1af416`. Where v1 has no rung, the pre-v1 run is marked †.

## Results
k/n per rung, [two-sided 95 % Wilson], and the verdict. The sources are the six `bench/frontier-*-base-20260930-*.json` files.

**optiq**

| Class | r1 | r2 | r3 | r4 | r5 | r6 |
|---|---|---|---|---|---|---|
| create-file v2 | 2/10 [.06,.51] cloud | 1/10 [.02,.40] cloud | 2/10 [.06,.51] cloud | 0/10 [0,.28] cloud | | |
| create-file v1 | 5/20 | 1/4† | 1/4† | 0/4† | | |
| edit-single v2 | 7/10 [.40,.89] cloud | 9/10 [.60,.98] not-yet | 1/10 [.02,.40] cloud | 6/10 [.31,.83] cloud | 4/10 [.17,.69] cloud | |
| edit-single v1 | 13/16 | 10/16 | 3/8† | 6/8† | 6/8† | |
| emm v2 | 7/10 [.40,.89] **trusted** | 5/10 [.24,.76] cloud | 10/10 [.72,1] not-yet | 8/10 [.49,.94] cloud | 6/10 [.31,.83] cloud | 8/10 [.49,.94] cloud |
| emm v1 | 10/10† | 9/10† | 9/10† | 14/16 | 14/16 | 8/10† |

**8-bit-64g**

| Class | r1 | r2 | r3 | r4 | r5 | r6 |
|---|---|---|---|---|---|---|
| create-file v2 | 4/10 [.17,.69] cloud | 4/10 cloud | 3/10 [.11,.60] cloud | 1/10 [.02,.40] cloud | | |
| edit-single v2 | 10/10 [.72,1] not-yet | 7/10 [.40,.89] cloud | 7/10 cloud | 7/10 cloud | 3/10 [.11,.60] cloud | |
| edit-single v1 | 3/4 | 3/4 | 8/12 | 9/12 | 8/12 | |
| emm v2 | 9/10 [.60,.98] **trusted** | 10/10 [.72,1] **trusted** | 10/10 **trusted** | 10/10 not-yet | 8/10 [.49,.94] cloud | 7/10 [.40,.89] cloud |
| emm v1 | – | – | 4/4 | 4/4 | 3/4 | 4/4 |

There were 3 timeouts in 300 samples (one each: optiq and 8-bit create-file r4, optiq emm r5) and no
loops. Pooling with the 29 Sep validation files changes no verdict.

**Correction, 30 Sep: the create-file rows are invalid.** Since 29 Sep 15:11 the user's cplt config
no longer allowed any localhost port, and the harness granted only the model server's port. So the
agent's `./gradlew` inside the sandbox could not reach the Gradle daemon. 28 of 40 optiq and 29 of 40 8-bit
create-file samples hit "Could not connect to the Gradle daemon", and the model wrote its tests
without running them. On 29 Sep 07:44 (the 12/12 validation) all 43 Gradle calls ran. Harness, tasks,
sampling, context, wired limit, JDK, Gradle, prompt and caps were otherwise identical. The 12/12 is the
valid number. The edit-single and emm ladders made no Gradle calls inside the sandbox and are not affected.

## Verdict
- **create-file:** no verdict. The rows above are invalid (see the correction). They are re-run with
  a harness-scoped sandbox fix and a Gradle preflight, and the stop rule for create-file is decided again from that run.
- **edit-single:** trusted on neither model. The gap is model quality: it misses call sites more often as
  d grows, and sometimes makes no change.
- **emm:** trusted on the 8-bit at r1–r3, and on optiq at r1 only. optiq's r1 is weak, because the
  cloud arm passed only 7/10 there. Its failures are mostly "no changes made" within 1–2 turns. The 8-bit's
  r4 is 10/10 and still not-yet only because n=10.

**Decision** (owner, 30 Sep):
1. Stop the ladder work for edit-single on both profiles, and for emm on optiq.
2. Re-run create-file on both profiles with the sandbox fixed. The anomaly was the sandbox, not the model.
3. Go on only with emm on the 8-bit: a delegate cost-ratio measurement under the bench-only trust
   overlay (#147), plus 5 more r4 runs.

If the cost ratio is below 1, the 8-bit profile gets emm `trusted` in `manifest/models.json`, and that is a
release (see BENCHMARKING.md). The manifest is class-level, so that would include r5–r6, where the 8-bit is 7–8/10.
