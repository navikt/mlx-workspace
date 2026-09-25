# Quality frontier: how far each task class can be pushed, and whether the model or the harness is the limit

Design, 2026-09-25. No GPU was used and there are no new measurements. The ladders, the
verifiers, the runner and the night driver are built and self-tested; the build-level
validation (Gradle) has not run yet (§8). Task ids are from
`bench/frontier/tasks-isoppfolgingstilfelle.json`, tasks sha `17d0cf33d776`.

## Summary

1. Today a class is local or cloud as a whole. This benchmark asks how far each class stays local: a rename of 2 call sites is not a rename of 300.
2. Each class gets a ladder of 4–6 rungs. Difficulty is a number read from the code (call sites, files to find, functions to test, hint level), not an opinion. Every task has a deterministic verifier and a reference solution.
3. 65 tasks, generated from `navikt/isoppfolgingstilfelle` at the pinned ref (the cheap-ops target, so the workspaces are shared): edit-multi-mechanical (6 rungs, 2–317 call sites), edit-single (5 rungs, 1–64 sites), read-qa (5 rungs, 1–12 files), create-file (4 rungs), debug (4 rungs).
4. A rung is judged against the existing routing bar: one-sided 90% Wilson lower bound ≥ X × p_cloud, X = 0.90 caught / 0.95 silent. The frontier is the highest rung with every rung below it clear.
5. Ten samples a rung cannot clear 0.90 on their own (10/10 gives 0.86). Lower bounds pool upward under a monotonicity assumption, so easy rungs borrow the harder rungs' samples. A logistic fit gives the break point (d50) as a number.
6. Model or harness: five levers are run on the same model at the rungs just past its base frontier. These are more time, verifier retries, oracle decomposition, a worked example plus trimmed tool output, and sampling. A lever that moves the frontier is harvestable. Where no lever moves it and the cloud passes, the model is the limit.
7. Cloud reference arm: Claude Sonnet 5 through nav-pilot (Copilot retired Sonnet 4.6 on 25 September) on the same rungs, capped at $80 in the driver. Estimated $53 for night 1.
8. Night 1 (`night-run-3`): optiq on every class at base, then the time and retry levers past each frontier, then the cloud arm. That is about 6.0 h of GPU for base, up to 1.8 h for levers and about 5.6 h of cloud wall time with no GPU.
9. Nights 2–5 add decomposition and prompt levers, sampling, then the Qwen3.8 builds (§6.2).
10. Frontier results feed `bench-capabilities` as a scope per class, for example "trusted up to 16 call sites". A lever becomes the default when it moves a frontier and replicates (§7). That feed is designed here and not wired in, because the files it touches are in use by tonight's runs.

## 1. What is known, and why a ladder

| Evidence | What it says about limits | Source |
|---|---|---|
| Rename scale ladder, frontend, S1–S4 up to 124 refs / 59 files | No volume ceiling for renames: 9/12 passed, and every failure was a 5–30 s "no changes made" at the small rungs, not at the big ones | `bench/results-qwen3.6-35b-a3b-optiq-scale-run{1,2,3}.json` |
| D2, a field through a mapper and every construction site | 0/4 at the 420 s cap in cheap-ops; 7/12 in Copilot local at 146 s | design.md §1.2 (routing) |
| Create a test file | 3/11 local | same |
| Debugging, cause not stated | 0/3, one timeout at 900 s | local-inference-findings §7.4 |
| Delegation saving | Tracks the cloud arm's step count: 19 steps 0.39×, 2 steps 1.79× | findings §7.3 |

Two lessons shape the design. Renames are the wrong axis for mechanical work: one `sed` covers
any number of sites, so the scale ladder measured whether the model starts, not how far it
goes. And nothing measured so far varies one difficulty number while holding the task shape
fixed, which is what a frontier needs. So the mechanical ladders use an edit that cannot be done
with one substitution: every call site gets a different value.

## 2. The ladders

All five are generated or listed in `.mise/tasks/_frontier.py` and written by
`mise run bench-frontier -- gen --repo <checkout at the pinned ref>`. Every rung has three
generated tasks where the code offers them: two are run, and the third is the spare that
validation falls back to.

### 2.1 edit-multi-mechanical: thread a required argument

"Add a first parameter `origin: String` to function F, no default. At every call site, main and
test code, pass the calling file's name without `.kt`." One file-specific literal per file, so
the edit cannot be done with one substitution. It also cannot be half done: the parameter has no
default, so a missed call site fails to compile.

| Rung | Call sites | Tasks (sites / files) |
|---|---|---|
| 1 | 1–2 | `apiModule` 2/2, `createIfMissing` 2/2 (+ spare) |
| 2 | 3–4 | `httpClientDefault` 4/4, `createOppfolgingstilfelleBit` 4/3 (+ spare) |
| 3 | 5–8 | `toHistoricalPersonIdentNumber` 6/6, `bearerHeader` 6/4 (+ spare) |
| 4 | 9–16 | `configuredJacksonMapper` 12/12, `respondOk` 13/6 (+ spare) |
| 5 | 17–40 | `setupApiAndClient` 29/4, `generateKafkaSyketilfellebitRelevantSykmeldingBekreftet` 22/2 (+ spare) |
| 6 | 41+ | `generateOppfolgingstilfelleList` 60/3, `nowUTC` 317/8 |

Candidates are functions with exactly one definition, no `override`/`open`/`operator`/`infix`,
no `::F` reference and a name of at least 6 characters. Within a bin the pick is nearest the
bin's geometric middle, and ties go to more files. d = call sites.

**Verifier** (`verify_thread_arg`): exactly one definition (an overload keeping the old
signature fails); first parameter `origin: String` with no default; the per-file call count
unchanged; every call's first argument (or `origin =`) is the file-stem literal; nothing changed
outside the definition and call-site files; then `compileKotlin compileTestKotlin`.
**Known-bad fixtures**, each must fail: untouched, one call site skipped, a wrong literal, a
default value instead of call sites, definition only.

### 2.2 edit-single: the same edit, all calls in one file

The same family restricted to functions only called from the file that defines them. The axis
is the number of in-file sites (1, 2–3, 4–8, 9–24, 25+). The file size is recorded as a
second axis (49–712 lines). The top rungs are `getEnvVar` (39 sites) and `daysFromToday`
(64 sites). The verifier is the same as 2.1 with the allowed-files set of one.

### 2.3 read-qa: which files call F

"List every file, main and test, that calls F. End with `ANSWER: A.kt, B.kt`." The axis is
the number of files to find (1, 2, 3–4, 5–7, 8+). Rung 5 is `configuredJacksonMapper` (12
files), `dropData` (10) and `nowUTC` (8 files, 317 sites). Scoring is exact set equality on
the last `ANSWER` line: missing and extra files both fail. That is stricter than cheap-ops'
`grep_answer`, which is recall only, and it fits a silent class. The full reply is read from
the JSONL log, because `opencode-headless` prints only the first 300 characters. The gold
answer is the scanner's, so only camelCase names are used, to keep library calls out.

### 2.4 create-file: a new test file that tests something

Curated, not generated: what makes a test hard to write (building domain objects, finding the
boundary) cannot be counted from call sites. d = rung.

| Rung | Tasks | What it takes |
|---|---|---|
| 1 | `dagerMellomDatoer`; `isBeforeOrEqual` | one pure function |
| 2 | `isBeforeOrEqual` + `isAfterOrEqual`; `dagerMellomDatoer` + `isAfterOrEqual` | two pure functions |
| 3 | `isLongTilfelle`; `daysInTilfelle` | one member of a domain object |
| 4 | three members of `Oppfolgingstilfelle`; `hasGjentakendeSykefravar` at its 5-tilfelle boundary | several, or a boundary over constructed lists |

**Verifier**: exactly one new file at the named path; each function named in it, with at least
one `@Test` per function. `gradle test --tests <class>` must go green, and it fails if no test ran.
Then **one mutant per function** (an off-by-one or an inverted comparison in main code): the
new class must go red on every mutant. The mutants are the only instrument here for "the test
tests something". An August submission passed with its assertions inside a catch block.
**Fixtures**: each task carries a hand-written reference test that must pass and kill every
mutant. It also carries a vacuous version (every assertion shadowed by a no-op), which must be
rejected.

### 2.5 debug: the same break, less and less help

Six hand-picked breaks, each a single-occurrence find/replace applied as uncommitted state:
three adjacent (their unit test mirrors the file) and three far (the failing tests are in
another package). The rung is the **hint level**, with the break held fixed. Rung 1 names
the file and function. Rung 2 names the failing test class, read from Gradle's XML reports
at validation. Rung 3 says only "the suite is failing". Rung 4 is rung 3 with a far break.
**Verifier**: no test file touched, and the full suite is green.

This fixes a flaw in cheap-ops' debug verifier, which is not modified here. Because the break
is uncommitted, an exact fix leaves a clean tree, and `bench-cheap-ops` scores that perfect fix
as "no changes made (the bug is still there)". Here the suite decides, and doing nothing leaves
it red.

## 3. Harness levers: can the harness harvest more from the same model?

A variant is a set of tokens joined by `+` (`--variant cap900+retry2`) or a profile. The
frontier is measured per (model, variant).

| Lever | Variant | What changes | Applies to | Product equivalent |
|---|---|---|---|---|
| More time | `cap900`, `cap1800` | Per-attempt cap 420 → 900 → 1800 s (debug base is 900) | all | nav-pilot's per-dispatch timeout |
| Verifier retries | `retry1`, `retry2` | After a failed verify, `--continue` with the verifier's note and the last 30 build lines, up to K times | caught classes only; a retry on read-qa would leak the gold answer, and a silent class has no verifier in production | the orchestrator's check-and-retake loop |
| Decomposition | `decompose` | Oracle split: definition first, then one fresh session per call-site file; verify at the end | thread-arg tasks | dispatch policy telling the orchestrator to split per file |
| Worked example | `example` | A class-specific worked example before the prompt | all | the local-worker agent prompt |
| Trimmed tool output | `trim` | An instruction to pipe long output through `head`/`tail` and run Gradle `-q` | all | agent prompt, or an rtk-like filter in nav-pilot |
| Sampling | profile `qwen3.6-35b-a3b-optiq-t07p08` (new) | temp 0.7 / top_p 0.8 instead of 0.6 / 0.95 | all | manifest `MLX_NAV_PILOT_TEMPERATURE` / `_TOP_P` |
| Context cap | existing profiles `…-nopin-c32k` vs `…-c48k-ps512` | 32k vs 48k for the 8-bit | 8-bit only | manifest `MLX_OPENCODE_CONTEXT` |

Decomposition here is scripted from the task's own call-site list, so it is an upper bound on
what an orchestrator's split can harvest, with no orchestration cost. If it does not move the
frontier, a real orchestrator will not either. The trim lever is a prompt instruction, because
opencode's tool output cannot be filtered without modifying the client. It is weaker than a
real filter, so it is named as an approximation.

**Reading the result:** a lever that moves the frontier on a model means that rung was limited
by the harness. Where no lever moves the frontier and the cloud arm passes, the model is the
limit. Where the cloud also fails, the rung is hard for everyone. The bar then falls with
p_cloud, and the task goes on the "both arms failing" list for review.

## 4. Statistics

Per (class, model, variant, condition):

- **Per rung**: k/n, and the one-sided 90% Wilson interval, as `bench-capabilities`.
- **Bar**: the routing design's §2.1, unchanged: `LB ≥ X × p_cloud(class, rung)`, with X = 0.90 for caught classes (edits, create-file) and 0.95 for silent ones (read-qa, debug). p_cloud is the cloud arm's pooled point estimate at that rung, or 1.0 without one. The floor is also unchanged: at least 5 runs and 2 distinct tasks at the rung.
- **Monotone pooled lower bound**: on its own, a rung needs 15/15 to clear 0.90 and 32/32 to clear 0.95; 10/10 gives 0.86. If harder rungs are never easier, the pooled pass rate over rungs r..s is at most p(r), so its Wilson bound bounds p(r) from below. `monotone_lower` takes the best such window. Rung 1 borrows rungs 2–3, and the top passing rung still stands on its own samples. The max over windows is a small multiple-comparison optimism: at most 6 windows, marked `ponytail:` in the code.
- **Verdict per rung**: `trusted` (clears the bar with the floor met), `not-yet` (point estimate clears, bound does not), `cloud` (point estimate below the bar).
- **Frontier**: *trusted* is the highest rung with every rung up to it trusted. *Open* is the same for "not ruled out", and *first break* is the lowest `cloud` rung. The open frontier is what night 1 can deliver; the trusted frontier accumulates across nights.
- **Logistic fit**: pass ~ log2(d), penalised Newton–Raphson in the standard library. It gives **d50** (the break point, where the pass rate is 0.5) and **d at bar** (the point estimate where the fitted curve crosses the bar). These describe the shape of the curve; verdicts come from the counts. A delta-method band was tried and dropped: with every sample passing, its width is set by the penalty, not by the data.
- **Harvest**: the open frontier of each variant against base, same model and condition.

**n planning.** Base: 2 tasks × 4–5 runs = 8–10 a rung. With the monotone pooling that is
enough for the open frontier on night 1, and for a trusted frontier on the lower rungs of a
class that passes. A strict trusted verdict at the frontier rung itself needs 15 passes there
(32 for read-qa), which is a top-up on night 2 at that rung only. Levers: 2 rungs × 2 tasks × 2
runs = 8 per step, enough to see a rung go from 0/8 to 6/8. That is the size of effect worth
chasing. Moving it by one sample is not.

**Conditions** are the routing design's §4.2: profile params (temperature, context), harness
sha (the runner, the library, the borrowed cheap-ops helpers, the sandbox, the tasks file and
the agent prompt) and the tasks sha. Rows never pool across conditions.

## 5. Models and the cloud arm

| Arm | Profile / model | Why |
|---|---|---|
| Local, default | `qwen3.6-35b-a3b-optiq` | The shipped default; night 1 |
| Local, dense 4-bit | `qwen3.8-27b-optiq-4bit`, the manifest's 4-bit entry on origin/main since the night of 24 September (it replaced the plain 4-bit) | Night 3; `FRONTIER_MODEL` selects it |
| Local, 8-bit | `qwen3.8-27b-8bit-nopin-c48k-ps512` (the offered 8-bit entry's params) | Night 4, with `…-c32k` as the context lever |
| Cloud | `claude-sonnet-5` (Copilot retired `claude-sonnet-4.6` by 25 September) through nav-pilot, as `bench-hybrid`'s control arm runs it (`alpha local off` first; a sample where nav-pilot announces local dispatch is invalid) | What users run; `FRONTIER_CLOUD_MODEL` switches to a GPT-5.x-class model |

**Cloud cost estimate for night 1** (Sonnet 4.6 as opencode priced it; Sonnet 5 may cost more, and the cap is what bounds it). The anchors are the
August control-arm medians: R2 $0.078, E1 $0.092, M1 Ktor $0.106 (5 steps), M1 frontend
$0.227 (13 steps), D2 Ktor $0.339 (19 steps), and Copilot G2 ≈ $0.29. Cost rises with call
sites, because the cloud arm grinds through them.

| Class | Samples | Assumed $/sample by rung | Estimate |
|---|---|---|---|
| edit-multi-mechanical | 60 (5 runs) | 0.10, 0.12, 0.20, 0.35, 0.70, 1.50 | $29.7 |
| edit-single | 40 (4 runs) | 0.08, 0.09, 0.12, 0.25, 0.40 | $7.5 |
| read-qa | 40 (4 runs) | 0.06, 0.07, 0.09, 0.12, 0.18 | $4.2 |
| create-file | 16 (2 runs) | 0.25, 0.35, 0.40, 0.60 | $6.4 |
| debug | 8 (rungs 1 and 3, 2 runs) | 0.50, 0.90 | $5.6 |
| **Total** | **164** | | **≈ $53** (range $35–80) |

**The cap is enforced in two places.** `bench-frontier run --cost-cap 80 --cost-ledger <night
dir>/cloud-ledger.json` checks, before each sample, the spend so far plus the median sample so
far. It stops before the sample that would cross the cap, records `meta.stopped` in the result
file and exits 0. `night-run-3` then skips the remaining cloud steps as `SKIP: cost cap`. A
timed-out cloud sample's partial cost is counted, not dropped (`cost_partial: true`).

## 6. The multi-night plan

### 6.1 Night 1: `mise run night-run-3`

Run `mise run bench-frontier -- validate` in the daytime first: about 40 minutes of CPU, no
GPU. If it has not run, step 1 does it at night.

| # | Part | Step | Classes | Variant | Runs | Rungs | Samples | Expect | Watchdog |
|---|---|---|---|---|---|---|---|---|---|
| 1 | local | validate (skipped if present) | all | | | | | 40 min | 60 |
| 2 | local | base | edit-multi-mechanical | base | 5 | 1–6 | 60 | 138 | 170 |
| 3 | local | base | edit-single | base | 4 | 1–5 | 40 | 76 | 100 |
| 4 | local | base | read-qa | base | 4 | 1–5 | 40 | 40 | 55 |
| 5 | local | base | create-file | base | 2 | 1–4 | 16 | 56 | 75 |
| 6 | local | base | debug (floor: is a named bug fixable?) | base | 2 | 1 | 4 | 48 | 65 |
| 7 | local | lever | edit-multi-mechanical | cap900 | 2 | past frontier | 8 | 22 | 35 |
| 8 | local | lever | edit-multi-mechanical | retry2 | 2 | past frontier | 8 | 24 | 35 |
| 9 | local | lever | edit-single | retry2 | 2 | past frontier | 8 | 18 | 25 |
| 10 | local | lever | read-qa | cap900 | 2 | past frontier | 8 | 10 | 15 |
| 11 | local | lever | create-file | retry2 | 2 | past frontier | 8 | 32 | 45 |
| 12–16 | cloud | cloud | each class as 2–6 | base | same | same | 164 | 336 | 425 |

- **GPU:** base 5.97 h. The levers add up to 1.77 h, and only for classes that broke inside their ladder. "Past frontier" means the two rungs after the open frontier, read from the base files the same night. A class that never broke is skipped, since there is nothing to move. Expected about 7 h, 7.7 h if every class breaks, and 10.3 h if every watchdog fires (validation done in the daytime).
- **Cloud:** about 5.6 h wall, no GPU, ≈ $53, hard cap $80. It runs last, after the GPU part, so it spills into the morning. Alternatively start it in the afternoon with `--part cloud` and the GPU part at night with `--part local`.
- Per-sample minutes are estimates from cheap-ops (optiq ~1.7 min a task including restart and compile) plus each class's verification; night 1 replaces them with measurements.
- Samples go round-robin over the ladder, not rung by rung, so a step cut short by its watchdog leaves every rung at n−1 instead of the top rungs empty.

### 6.2 Later nights (a sketch; night 1's frontiers decide the rungs)

| Night | GPU | Cloud | What |
|---|---|---|---|
| 2 | ~7 h | top-up ≤ $15 | optiq at the two rungs past each frontier: `decompose` (the two edit classes), `example+trim` (all), `cap1800` (debug rung 1, create-file), `cap900` (edit-single, create-file). Sampling profile `…-t07p08` base on read-qa and edit-single, the two near the bar. Top up the frontier rung to n = 15 for a strict verdict |
| 3 | ~7 h | none | Qwen3.8 OptiQ-4bit base ladders at 3 runs (×1.8 time per sample): all classes, debug rung 1 |
| 4 | ~7 h | none | Qwen3.8 8-bit c48k-ps512 base at 3 runs on the edit classes and read-qa (×2.6 per sample), plus the context lever (c32k) past its mechanical frontier |
| 5 | ~7 h | none | The levers that moved optiq's frontier, applied to the better Qwen3.8 build; replication of any lever that is a candidate default (§7) |
| later | | ~$50 | A second cloud model (GPT-5.x class) on the same rungs, if the Sonnet arm leaves p_cloud below 0.9 anywhere |

Total: five GPU nights (~35 h) and ≈ $70–120 of cloud. A night that shows nothing new at a
rung stops that rung's line early.

## 7. The learning loop

**How the bar moves.** The bar is still X × p_cloud. What moves is the scope of a class: the
frontier rung. The routing design's capabilities block holds one enum per class. The frontier
adds an integer limit next to it, in the unit of the ladder:

```json
"edit-multi-mechanical": {"local": "trusted", "local_k": 48, "local_n": 50,
                          "limits": {"call_sites": 16}}
```

Integer limits with keys from an allow-list compiled into nav-pilot ("call_sites", "files",
"functions") keep the manifest free of free text, as §3a of the routing design requires. The
sentence ("mechanical edits up to 16 call sites") belongs to nav-pilot. `bench-capabilities`
reads frontier rows through `_by_class.rows()` as their own condition
(`frontier harness=… variant=…`). A class verdict counts samples at rungs ≤ the trusted
frontier, and `limits` is the upper edge of that rung's bin. Wiring that in touches
`_by_class.py`, `bench-capabilities` and `model-manifest`, which tonight's runs use, so it is a
follow-up PR once the queue is done. `bench-frontier summary --json` already writes the
feed (`bench/frontier-summary.json`).

**When "the harness improves".** A variant V becomes the default for a class when all of
these hold:

1. On the same model and condition, it moves the open frontier at least one rung over base.
2. It replicates on a second night at the rung it moved, with n ≥ 8 per arm and a one-sided Fisher p < 0.1 against base.
3. It costs no more than 2× base median wall time at that rung, and cloud credits do not rise (retries and decomposition run locally).
4. The product can express it. Retries are nav-pilot's check-and-retake. Time is its dispatch timeout. Decomposition is a sentence in the generated dispatch policy (navikt/copilot#941). Example and trim go in the worker's agent prompt. Sampling goes in the manifest.

Adopting it changes the harness sha. The base ladders then run again under the new default,
the count restarts at zero (routing design §4.2), and the new base frontier is what the next
levers are measured against. A new model or quantisation goes the same way: base ladders
first, then only the levers that worked before.

**Runtime demotion** from the routing design (§3c) still only demotes. A fleet no-edit rate
above 1 − X on dispatches beyond the limit lowers `limits` in the next manifest, and the
benchmark has to raise it again.

## 8. What is built, and how it was checked

| File | What |
|---|---|
| `.mise/tasks/_frontier.py` | Kotlin scanner (regex over source with comments and strings blanked), the five ladders, reference solutions, known-bad fixtures, verifiers, Wilson, monotone bound, frontier, logistic fit. `python3 .mise/tasks/_frontier.py` self-checks |
| `.mise/tasks/bench-frontier` | `gen`, `validate`, `run` (local profile or `--cloud`, any variant, `--rungs past-frontier`, `--cost-cap`, `--dry-run`), `summary [--json]`, `selftest` |
| `bench/frontier/tasks-isoppfolgingstilfelle.json` | The 65 generated tasks; `gen --check` proves it regenerates byte for byte |
| `.mise/tasks/night-run-3`, `night-run-3-selftest` | The night driver and its stub-step test |
| `profiles/qwen3.6-35b-a3b-optiq-t07p08.toml` | The sampling lever; not offered in the manifest |

**Nothing existing is modified.** `bench-cheap-ops` reads only `bench/tasks.json` and takes no
tasks-file argument. So the runner borrows its helpers instead of copying them: clean-workspace
check, pinned clone, reset, hidden git history, break, server restart, served-model check and
loop count. It parses `bench-cheap-ops` with `ast` at start-up and runs those 13 functions
unchanged, so a fix there reaches this suite, and a renamed helper fails loudly. The
tasks file has the same repo and ref as `bench/tasks.json`, so it shares cheap-ops' workspaces.
Results go to `bench/frontier-<key>-<variant>-<stamp>.json` as `{"meta", "samples"}`.

**Checks run:**

- `_frontier.py` self-check: the Wilson test vectors from the routing design (15/15 → 0.901, 10/11 → 0.739), verdicts, frontiers, the monotone bound, and the logistic fit recovering a synthetic break at d ≈ 16.
- `gen` on the pinned checkout: for all 30 thread-arg tasks the reference passes its own verifier and all 5 known-bad fixtures fail it. For all 15 read-qa tasks the gold answer passes, and one-missing and one-extra fail. Every create-file mutant site and every debug break occurs exactly once. The reference and vacuous tests pass the file check, and a stray edit fails it.
- `bench-frontier selftest`: a three-file fixture repo, a fake model and a fake Gradle. It runs generator, validation, the runner under base, retry2 and decompose, and five model behaviours (good, lazy, sloppy, wrong, vacuous test). It then checks the summary, the past-frontier selection and the cost cap.
- `night-run-3-selftest`: 16 stub steps with OK, FAIL, TIMEOUT (a tree ignoring SIGTERM plus a setsid stray), battery skip, lever skip and the cost cap crossing at $1. It checks lock release, the report and the commit list.
- `night-run-3 --dry-run`: plan and preflight. It failed only on the nav-pilot binary, which lives in the main checkout's `.bench-logs/bin`.

**Not run: the build-level validation.** It compiles each reference, compiles a
definition-only change that must fail, runs each debug break against the suite (and names the
failing class), and runs each reference and vacuous test against the mutants. Running Gradle on
the target was blocked in this session. It also would have competed with the live night run
for CPU and the Gradle cache. It is `mise run bench-frontier -- validate` (about 40 minutes of
CPU), and the runner refuses to run a ladder without it. Tasks that fail it fall back to the
spare, and a rung with fewer than two valid tasks says so.

## 9. Limits of this design

- **One codebase.** Everything here is one Ktor service with 153 Kotlin files. The frontier is "up to 16 call sites *here*". The generator is Kotlin-only; the TypeScript and Spring targets need a scanner per language (marked `ponytail:` in the code).
- **Mechanical means mechanical.** The thread-arg edit has a determined answer at every site. The routing design's distinction between applying and deciding stays: nothing here measures a change that needs a decision per site.
- **The regex scanner** can miss calls (string templates, calls without parentheses) or count look-alikes. Validation catches a miss as a reference that does not compile; for read-qa, a look-alike would be a wrong gold answer. Only camelCase names are used there, and the rung 5 gold lists are short enough to check by eye in the tasks file.
- **Mutants are single.** One mutant per function shows a test is not vacuous. It does not show the test is good.
- **The cloud arm runs through nav-pilot, the local arm through `opencode-headless`.** They use different clients, with a different system prompt around the same task prompt. It is a reference for p_cloud, not a controlled pair.
- **Estimates are estimates.** Per-sample minutes and cloud dollars come from older runs of different tasks. Night 1 replaces them; the cap and the watchdogs are what bound the risk until then.

## 10. What is needed from the user

1. Review this design and the queue in `night-run-3` (§6.1): runs per class, the lever list and the $80 cap. Then merge the PR.
2. After merge, and when nothing else is running, in the main checkout: `mise run bench-frontier -- validate` (CPU, ~40 min), then `mise run night-run-3 -- --dry-run`.
3. Launch when ready. To queue behind `bench-decide-limits`, run a copy from outside the checkout, so a `git pull` cannot rewrite the script while it waits: `cp .mise/tasks/night-run-3 .bench-logs/bin/ && nohup .bench-logs/bin/night-run-3 --after <pid> > .bench-logs/night3.log 2>&1 &`
