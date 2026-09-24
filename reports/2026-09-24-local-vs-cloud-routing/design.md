# When nav-pilot should use a local model: routing design, 2026-09-24

Design only. No GPU was used and there are no new measurements. Every number comes from a result
file in `bench/` and names it. Per-class figures were recomputed from the raw JSON for this
document. Task ids are those in `bench/tasks.json`.

## Summary

1. Only one local route is backed by data today: a cloud orchestrator delegating **mechanical multi-file edits** (renames, threading a field through call sites) to the optiq worker. 35/35 delegated samples verified across three codebases, at 0.39–0.80× the cloud-only cost when the cloud alone needs 5 or more steps. It cost 1.79× on Spring, where the cloud alone needed 2 steps.
2. Everything else should stay on cloud. Read/QA answers fail silently when they are wrong. Delegating single-file edits saves nothing (0.98–1.02×). The local model fails at new test files (3/11) and debugging (0/3).
3. Whole-session local (Copilot local mode, or opencode with a local main model) clears the bar for no task class yet. The closest are optiq on read/QA (15/15) and single-file edits (10/11), both short of the bar at this n.
4. **The bar:** a class goes local when the one-sided 90% Wilson lower bound of the local pass rate is at least X × the cloud pass rate, with ≥ 5 runs and ≥ 2 distinct tasks under one condition. X = 0.90 where a failure gets caught (a compile, tests, or the orchestrator's check) and 0.95 where it is silent (answers, explanations, diagnoses).
5. nav-pilot's dispatch policy currently tells the orchestrator to send "lookups, comments, log lines, a single test file". None of these is backed by data, and one of them, test files, is contradicted by it. The policy should name mechanical multi-file edits only.
6. Mechanism (a): a `capabilities` block per model in the manifest. It holds enum verdicts per class, generated from bench results. nav-pilot turns the verdicts into policy sentences that nav-pilot owns. That takes one nav-pilot release; after it, a manifest PR updates every installation.
7. Mechanism (b), a task classifier, is not needed for opencode. The orchestrator already routes bimodally and correctly, and pushing it to delegate more made results worse. Copilot's all-or-nothing mode is the only place without a router, and there nav-pilot never sees the task.
8. Mechanism (c), runtime feedback: the orchestrator tags each dispatch with a class id, and the guard records class, model and outcome (edited / no edit / loop trip / error) as telemetry enums with no content. It can demote a class. It never promotes one.
9. The loop: add a `class` to each task, add `bench-results --by-class`, add a new `bench-capabilities` task that applies the bar, and publish through `model-manifest`.
10. Tonight's run adds data for four profiles, two of them at temperature 0, but it cannot change any verdict: each new condition gets at most 3 runs, which is below the floor, and the run has no cloud arm and no delegate arm. Next come a cloud reference arm (no GPU needed), a delegate-mode rerun against today's policy text, and more create/debug tasks.

## 1. What the data says today

### 1.1 Sources and conditions

| Short name | What it is | Files |
|---|---|---|
| cheap-ops | Whole-session local through opencode headless, 11 tasks on `navikt/isoppfolgingstilfelle`, harness `492141135fe6`, server temperature 0.6 | `bench/results-<profile>-20260923-*.json`, the valid runs listed in [decision.md §3.1](../2026-09-23-local-model-evaluation/decision.md#31-head-to-head-cheap-ops-10-scored-tasks-d2-retired) |
| copilot-local / copilot-cloud | Whole session on one provider through nav-pilot, same repo and task ids, Aug 2026. Local is optiq; cloud is Claude Sonnet 4.6. Copilot sends temperature 0 | `bench/copilot-{1..6}-{local,cloud}.json` |
| hybrid / control | opencode with Sonnet 4.6 as the orchestrator. Hybrid can dispatch to the optiq `local-worker`; control cannot. Ktor, Spring and frontend targets, with the 1,572-byte Norwegian dispatch fragment | `bench/hybrid-*.json` |
| debug | optiq alone on three failing tests with no cause stated, frontend target | `bench/results-qwen3.6-35b-a3b-optiq-debug.json` |

Copilot rungs map to task ids as follows: 1 = R2, 2 = E1, 3 = M1, 4 = G2, 5 = M2, 6 = D2 (the `task` field in each file).
The cheap-ops runs from 1–3 September are void (`gen3-void`, [local-inference-findings.md §7.5](../local-inference-findings.md))
and are not used. Timeouts count as failures here: to the user, a timeout is a failure.

### 1.2 Task classes × models

Cells are verified/n and median seconds. Cloud cost is the Copilot credit median (1 credit = $0.01) or the
opencode control arm's median $. Local runs draw no credits.

| Class (tasks) | optiq, cheap-ops | optiq, copilot-local | Qwen3.8 8-bit nopin, cheap-ops | Qwen3.8 4-bit, cheap-ops | Cloud, copilot-cloud | Cloud, control | Delegated (hybrid): verified / cost ratio |
|---|---|---|---|---|---|---|---|
| Read/QA, lookups (R2, R3, D1) | 12/12, 10 s | R2 3/3, 18 s | 12/12, 47 s | 9/9, 28 s | R2 2/2, 12 s, 7.2 cr | R2 8/8, $0.078 | never delegated (0/8); 0.97× |
| Read/QA, explain (R1) | 0/4 | none | 0/4 | 0/3 | **none** | none | none |
| Single-file specified edit (E1 doc comment, E3 log line) | 7/8, 19 s | E1 3/3, 24 s | 8/8, 133 s | 6/6, 78 s | E1 2/2, 19 s, 8.8 cr | E1 Ktor 8/8 $0.092; Spring 8/8 $0.099 | Ktor 0/8 delegated, 0.98×; Spring 3/8 delegated, 3/3 verified, 1.02× |
| Mechanical multi-file (M1 rename, M2 DTO field) | 6/8, 12 s | 6/6 (M1 58 s, M2 39 s) | 7/8, 205 s | 2/6, 250 s | M1 3/3 16 s 8.5 cr; M2 3/3 36 s 15.2 cr | M1 Ktor 8/8 $0.106; frontend 8/8 $0.227 | M1 Ktor 8/8 → 8/8, 0.80×; frontend 7/8 → 7/7, 0.53×; M2 0/6 delegated |
| Multi-file, many construction sites (D2) | 0/4 (420 s cap, retired) | 7/12, 146 s | 0/4 (cap) | 0/3 (cap) | 8/8, 288 s, 67.3 cr | Ktor 8/8 $0.339; Spring 8/8 $0.092 | Ktor 12/12 → 12/12, 0.39×; Spring 8/8 → 8/8, 1.79× |
| Create a new test file (G2, D3) | 3/8, 78 s | G2 0/3 (+11 invalid), 55 s | 4/8, 409 s (4 timeouts) | 0/6, 204 s | G2 3/3, 85 s, 28.9 cr | G2 without delegation 4/4 (hybrid arm) | G2 2/6 delegated under the intervention fragment, **1/2 verified** |
| Debugging, fault localisation (X1–X3) | 0/3 (debug file, n = 1 each) | none | none | none | **none** | none | none |

In the delegated column, "M1 Ktor 8/8 → 8/8" means 8 of 8 samples delegated and all 8 of those
verified. The cost ratio is hybrid median over control median, from the same files.

Sources, row by row. Local cheap-ops: `bench/results-qwen3.6-35b-a3b-optiq-20260923-{115543-01,115543-02,115543-03,124337-01}.json`,
`bench/results-qwen3.8-27b-8bit-nopin-20260923-083958-0{1..4}.json`,
`bench/results-qwen3.8-27b-4bit-20260923-{125734-01,143323-01,143323-02}.json`. Copilot:
`bench/copilot-{1..6}-{local,cloud}.json`, which agree with Table 2 in
[local-inference-findings.md §3.2](../local-inference-findings.md). Hybrid and control:
`bench/hybrid-{1,2,3,4,5,6}-*.json`, `bench/hybrid-frontend-familie-tilbake-3-*.json` and
`bench/hybrid-spring-ia-tjenester-metrikker-{2,6}-*.json`. For G2 and M2 the hybrid column is the
intervention of findings §3.4 (`hybrid-4-hybrid.json`, `hybrid-5-hybrid.json`, a rewritten fragment that was
reverted afterwards). The `-oldfragment` files are the arms from before it, with 0/6 delegated each. Debug:
`bench/results-qwen3.6-35b-a3b-optiq-debug.json`, which agrees with
[local-inference-findings.md §7.4](../local-inference-findings.md).

**Where the data is too thin.**

- **No cloud arm on R1, R3, D1, E3, D3 or debugging.** On those, the cloud pass rate is assumed to be 1.0, which makes the bar stricter.
- **R1 failed in all 11 valid local runs** ([decision.md §3.1](../2026-09-23-local-model-evaluation/decision.md)). Its verifier wants the four literals 5, 100, 2 and 300 in the answer. Until a cloud arm runs R1, it is unknown whether R1 measures the model or the checker, so it is kept out of the read/QA class and shown on its own row. With R1 included, optiq's read/QA is 12/16.
- **No class has 5 runs under a single local condition.** cheap-ops has 3–4 runs per model at temperature 0.6. copilot-local has 3 runs per task at temperature 0, and 12 for D2. Users get temperature 0 ([qwen38-tuning.md §9](../2026-09-23-local-model-evaluation/qwen38-tuning.md)). Pooling the two conditions, as §2 does for optiq, is indicative only.
- **One codebase for everything except the hybrid arms.** Single-file edits and read/QA have never been measured locally on Spring or TypeScript.
- **Delegate mode was measured with an older dispatch fragment** (1,572 bytes, Norwegian). The text nav-pilot ships today is different ([local-inference-findings.md §3.1](../local-inference-findings.md)), and a rerun would measure compliance with it.
- Cost and time for Qwen3.8 in delegate mode have never been measured.

**What the table shows.** The local models pass read/QA and single-file edits nearly as often as the
cloud, and fail new test files, debugging, and the long D2 edit when they run alone. With a cloud
orchestrator the picture changes. It sends only the mechanical multi-file edits, every delegated one
of those verified, and it keeps QA, doc comments and test files for itself (0/16, and 0/6 before the intervention). In the
one intervention that pushed it to delegate test files, it got worse: 1 of 2 delegated samples failed
([local-inference-findings.md §3.4](../local-inference-findings.md)). One exception to "never":
on Spring the orchestrator delegated the doc comment 3 times out of 8 (`hybrid-spring-ia-tjenester-metrikker-2-hybrid.json`),
at no saving.

## 2. The policy

### 2.1 The bar

A class C is **trusted** for model m in mode M when all of these hold:

1. **Evidence floor:** ≥ 5 runs and ≥ 2 distinct tasks in C, all under one condition (§4.2). The 5 comes from [local-inference-findings.md §7.5](../local-inference-findings.md): "n>=5 before a row informs advice".
2. **Quality:** `wilson_lower(k, n, one-sided 90%) ≥ X × p_cloud(C)`, where `p_cloud` is the cloud point estimate for C (1.0 where no cloud arm exists).
3. **Delegate mode only:** the median hybrid/control cost ratio is below 1 on at least one codebase. If delegation does not save anything, there is no reason to take the risk.

What `k/n` counts depends on the mode:

- **delegate** (opencode, cloud orchestrator plus `local-worker`): k counts delegated samples that verified end to end, with the orchestrator's check included. That is the product the user gets.
- **local-only** (Copilot local mode, or opencode with a local main model): k counts raw local passes, with nothing checking the result.

**X = 0.90 when a failure is caught** before it reaches the user: a delegated task (the orchestrator
checks the file and retakes the task), or a class with a deterministic check (compile, tests, the old
symbol gone). The reasons:

- *Cost.* With a retake on failure, delegation saves money only if the local pass rate p is above the cost ratio r: expected cost is r + (1 − p) against 1. The measured savings run from r = 0.39 to r = 0.80 ([local-inference-findings.md §7.3](../local-inference-findings.md), Table 5). At p ≥ 0.90 there is a 10-point margin over the worst measured saving.
- *Trust.* At 0.90, at most one attempt in ten is wasted. On D2, retry-until-success averaged 1.7 attempts and was still faster than the cloud (§3.2 of the findings).
- *Reachable.* With no failures, a class reaches the bar at n = 15 (15/15 has lower bound 0.901), which is two or three benchmark nights. A higher X would keep every class on cloud until the benchmark budget ran out.

**X = 0.95 when a failure is silent:** answers, explanations, review comments, diagnoses. The user
has no check, and a wrong answer that sounds confident is exactly what the user worries about.
This number is a policy choice, not something derived from data: 0.95 is the smallest step above
the detectable bar that still separates the two cases, and reaching it takes 32 passes with no
failures.

Why the one-sided 90% interval and not 95%. The bar is recomputed from every valid run each
time. A class promoted on thin luck gets demoted by the next runs and by runtime feedback (§3c).
The stricter 95% interval would need 25 clean samples instead of 15 at X = 0.90 and 52 instead
of 32 at X = 0.95, which puts every read/QA verdict out of reach.

### 2.2 Current values

These are recomputed for this document. LB = one-sided 90% Wilson lower bound. The "needs" column is
the number of further samples, all passing, that it would take to clear the bar.

| Class | Mode | Model | k/n | LB | Bar | Verdict | Needs |
|---|---|---|---|---|---|---|---|
| Mechanical multi-file (M1, M2, D2) | delegate | optiq | 35/35 (M1 Ktor 8, M1 frontend 7, D2 Ktor 12, D2 Spring 8) | 0.955 | 0.90; cost 0.39–0.80× on 3 of 4 pairs | **trusted** | none. Must be rerun with today's policy text |
| Single-file edit | delegate | optiq | 3/3 | 0.65 | 0.90; cost 0.98–1.02× | **cloud**: saves nothing | none worth running |
| Read/QA | delegate | optiq | 0/8 delegated | none | 0.95; cost 0.97× | **cloud** | none |
| Create test file | delegate | optiq | 1/2 | 0.16 | 0.90 | **cloud** | none planned |
| Debugging | delegate | any | none | none | 0.95 | **cloud** | a cloud arm first |
| Read/QA (R2, R3, D1) | local-only | optiq | 15/15 (cheap-ops 12 + copilot-local 3) | 0.90 | 0.95 | not yet | 17 |
| Single-file edit (E1, E3) | local-only | optiq | 10/11 (7/8 + 3/3) | 0.74 | 0.90 | not yet | 21 |
| Mechanical multi-file | local-only | optiq | 19/26 (6/8 + 13/18) | 0.61 | 0.90 | **cloud** | 85 |
| Create test file | local-only | optiq | 3/11 | 0.14 | 0.90 | **cloud** | not reachable |
| Debugging | local-only | optiq | 0/3 | 0 | 0.95 | **cloud** | not reachable |
| Read/QA | local-only | 8-bit nopin | 12/12, 4 runs | 0.88 | 0.95 | not yet (floor) | 20 |
| Single-file edit | local-only | 8-bit nopin | 8/8, 4 runs | 0.83 | 0.90 | not yet (floor) | 7 |
| Mechanical multi-file | local-only | 8-bit nopin | 7/8 | 0.66 | 0.90 | **cloud** | |
| Read/QA | local-only | 4-bit | 9/9, 3 runs | 0.85 | 0.95 | not yet (floor) | 23 |
| Single-file edit | local-only | 4-bit | 6/6, 3 runs | 0.79 | 0.90 | not yet (floor) | 9 |
| Mechanical multi-file | local-only | 4-bit | 2/6 | 0.15 | 0.90 | **cloud** | |

The one trusted cell clears its bar with margin: one failed delegation among the next
samples (35/36) still gives 0.912. It still rests on an old fragment and on Sonnet 4.6 as the
orchestrator, so what the next measurement has to confirm is that cell under current conditions
(§5).

### 2.3 What that means in words

- **Local (delegate):** mechanical edits across several files that follow one pattern: renames, threading a field through a DTO or mapper and its call sites. Delegate when the cloud model would otherwise need several steps. For a two-step change it is cheaper for the cloud to do it (Spring D2, 1.79×).
- **Cloud:** answering questions about code, explanations, review text, doc comments and log lines, new files including tests, debugging, and anything that needs a decision per file.
- **Copilot local mode:** no class is trusted. It stays an explicit opt-in for volunteers, and nav-pilot should say that at launch (§3a).
- **Qwen3.8 builds:** no class is trusted in either mode. They have never been measured in delegate mode.

## 3. Mechanism, smallest first

### (a) Capabilities in the manifest drive the dispatch text

Today `LocalDispatchPolicy` (`cli/nav-pilot/internal/provider/opencode_launch.go:627`, navikt/copilot `main`
f1507caa) hard-codes the list of what to send (line 640) and what not to send (line 642). Only the `role` and `expect` prose come from
the manifest. The change is to generate those two lines from verdicts in the manifest.

**Manifest schema change.** Add an optional field per model. `schema_version` stays 1: `Parse`
does not set `DisallowUnknownFields`, so the field is additive, and older binaries ignore it.

```json
"capabilities": {
  "generated_at": "2026-09-24",
  "bar": {"confidence": 0.90, "x_caught": 0.90, "x_silent": 0.95, "min_runs": 5, "min_tasks": 2},
  "classes": {
    "edit-multi-mechanical": {"delegate": "trusted", "local": "cloud",   "delegate_n": 35, "delegate_k": 35, "local_n": 26, "local_k": 19},
    "edit-single":           {"delegate": "cloud",   "local": "not-yet", "delegate_n": 3,  "delegate_k": 3,  "local_n": 11, "local_k": 10},
    "read-qa":               {"delegate": "cloud",   "local": "not-yet", "delegate_n": 0,  "delegate_k": 0,  "local_n": 15, "local_k": 15},
    "create-file":           {"delegate": "cloud",   "local": "cloud",   "delegate_n": 2,  "delegate_k": 1,  "local_n": 11, "local_k": 3},
    "debug":                 {"delegate": "cloud",   "local": "cloud",   "delegate_n": 0,  "delegate_k": 0,  "local_n": 3,  "local_k": 0}
  }
}
```

**Trust boundary.** The verdicts are an enum, `trusted | not-yet | cloud`, and the counts are
integers. The class ids come from an allow-list compiled into nav-pilot. The sentence for each class
lives in nav-pilot, never in the manifest. The manifest is fetched from the network, and
`checkProse` (`internal/local/local.go`) already treats text that reaches the system prompt as a
security property. This design adds no new free text. nav-pilot ignores a class id it does not
know, and refuses the whole manifest over a verdict outside the enum, as `checkModels` does
today for any bad entry.

**nav-pilot touch points** (navikt/copilot `cli/nav-pilot`):

- `internal/local/local.go`: `Model` gets `Capabilities`. `checkModels` (line 260) validates class ids and the enum.
- `internal/provider/opencode_launch.go:640–642`: build "Send it:" from the `trusted` delegate classes and "Do not send it:" from the rest, using nav-pilot's own sentences. If the manifest has no capabilities, the old text stays. The function has to stay pure, because the prompt cache depends on a byte-stable prefix (its doc comment), and the text changes only when the manifest does.
- `internal/provider/copilot_launch.go` (`copilotLocalWorker`): when the session model is local, print one line at launch, e.g. "Local model trusted for: nothing yet. Not for: debugging, new files. Use a cloud model for those." That advisory is the only place the bar reaches Copilot, whose mode is all or nothing.
- The model picker (`role`/`expect`) could show the same verdicts. Leave that out until someone asks.

**Rollout.** One nav-pilot release reads the field. After it, every change to what gets delegated
is a PR to `manifest/models.json` in this repo. That file is versioned and reviewed, reaches the
whole fleet within one manifest fetch, and needs no nav-pilot release.

### (b) A fast task classifier: not needed now

The Jev-style typed decision (research PR navikt/mlx-workspace#24) is fast. LiteLLM measured 127 ms
against Haiku's 688 ms for tier routing, with a 95% tier match against 73.75%
(research.md §1, vendor-adjacent, measuring the classifier and not the downstream quality). The
question is whether nav-pilot needs one. Here is what the data says:

- **In opencode the cloud orchestrator already classifies, and does it well.** Delegation is bimodal: 0/16 on QA and comments, 20/20 on mechanical multi-file edits, and the same answer in English as in Norwegian (0/6 and 0/6, findings §7.1). When an instruction pushed it to delegate test files, 1 of the 2 delegated samples failed (§3.4). A classifier placed in front would have to beat a frontier model at a judgement that model already makes correctly, using less context.
- **The System One classifier we built failed** on 0 of 7 probe scenarios ([decision.md §3.5](../2026-09-23-local-model-evaluation/decision.md)). The lesson the research draws: a classifier needs the evidence the decision depends on, and before a task runs that evidence (how many steps the cloud would need) does not exist.
- **Copilot is where routing is missing, and there nav-pilot does not see the task.** An interactive session's prompt never passes through nav-pilot at launch, and switching providers mid-session loses the context and the cache (research.md §2, use case 6).

So: no classifier. The orchestrator is the classifier, and (c) asks it to state its label. Reopen
this if Copilot gets per-agent providers, or if nav-pilot gets a one-shot `-p` path where the
prompt passes through it. In either case, start with keyword rules and add a small-model Choice
question only on what the rules leave undecided, as research.md §5 recommends.

### (c) Runtime feedback from real sessions

**Labels.** The generated policy asks the orchestrator to start each worker task with one line,
`class: <id>`, taken from the allow-list. The guard already parses every local request (`repeatedToolCall`,
`internal/local/guard.go:687`). It reads that one line, matches it against the allow-list, and keeps only
the enum. Anything else becomes `unlabelled`. Copilot local sessions have no orchestrator, so they are
always `unlabelled`.

**Outcomes the guard can see without content:** whether the worker's reply contained an edit or
write tool call (tool name only), which catches the measured "says no, changes nothing" failure; a
loop-guard trip and which rule tripped (same result, or backstop); an error or timeout from the
local server; and the number of completions for the dispatch.

**Telemetry.** Add `RecordLocalDispatch(client, model, class, outcome)` next to
`RecordLocalSession` (`internal/telemetry/telemetry.go:392`), and call it where the guard records
completions (`guard.go:548`). Only enums and counts are sent. No prompts, paths, tool arguments
or results. The existing telemetry opt-out covers it.

**How it moves the bar.** Runtime outcomes are proxies. The guard can see that no edit happened,
but it cannot see that an edit was correct. So feedback only demotes. If the fleet's no-edit rate
plus loop-trip rate for a trusted class goes above 1 − X over at least 50 dispatches, the class
drops to `not-yet` in the next manifest, and the benchmark has to promote it again. The fleet data
also decides which classes get benchmark time next, by where the dispatches actually go.

**Cost of the label.** Adding the tag line changes the dispatch fragment, which is the experimental
variable for delegate mode (findings §3.1). The delegate verdicts have to be re-measured with the
tag in place (§5). That rerun is needed anyway.

## 4. The measurement loop

### 4.1 Steps

1. **Classify tasks.** Add `"class"` to every task in `bench/tasks.json` and `bench/targets/*.json`: R2, R3, D1 → `read-qa`. R1 → `read-qa` once a cloud arm shows it is fair. E1, E3 → `edit-single`. M1, M2, D2 → `edit-multi-mechanical`. G2, D3 → `create-file`. X1–X3 → `debug`. Whether a class counts as silent or caught is a property of the class and lives in the bar code, not in the tasks.
2. **Summarise per class.** `mise run bench-results -- --by-class [--json]` extends `.mise/tasks/bench-results`, whose `load()` and `summarise_tasks()` already read all three file shapes. Its output: condition × model × mode × class → runs, distinct tasks, k/n, median seconds, cost, and LB. Void and quarantined runs stay out, as they do today.
3. **Apply the bar.** A new `mise run bench-capabilities` holds the bar function, the X values and the floor. It writes `manifest/capabilities.json` with the source file behind every count. Its self-check asserts the test vectors from this document: 15/15 → 0.901, 35/35 → 0.955, 10/11 → 0.739.
4. **Publish.** `.mise/tasks/model-manifest` gets an `evidence` list per offered key (profile globs, because the 8-bit manifest entry is measured through its `nopin` profiles) and merges the verdicts. `mise run analyse` fails if the committed capabilities differ from a fresh computation. A PR to `main` publishes, and nav-pilot picks the change up on its next fetch.

### 4.2 Conditions: what may be pooled

One condition is a model build, the profile parameters that change output (`MLX_TEMP`, context
cap), the harness sha, the client and its version, the target and ref, and, in delegate mode, the
orchestrator model and a hash of the dispatch fragment. Runs are pooled only within one condition.
If any part changes, the count starts again at zero. That is why the §2.2 pooling of cheap-ops
(temperature 0.6) with copilot-local (temperature 0) is marked indicative.

**Triggers for a re-score:** a new offered model or profile, a harness change, a policy text
change, a client upgrade, or a runtime demotion. A new model gets `cloud` everywhere until its
own runs clear the floor. The verdicts are recomputed from all data every time, so they can go
down as well as up.

## 5. Tonight's run, and what comes after

**What it will add** ([qwen38-tuning.md §6](../2026-09-23-local-model-evaluation/qwen38-tuning.md), steps 1–15):

- optiq at temperature 0, cheap-ops ×3 (steps 6–8). This is the first cheap-ops data under the condition users actually get: read-qa +9, edit-single +6, mechanical multi-file +6, create-file +6. The Fisher test against the 0.6 runs shows whether temperature matters, though a p above 0.05 does not show the two are equivalent.
- The 8-bit nopin c32k at temperature 0 ×2, and the 4-bit c64k-8g ×2 and Qwen3.8 OptiQ-4bit ×3 at the server's 0.6 default, on cheap-ops (steps 9–15). Only the two `-t0` profiles set `MLX_TEMP`.
- Copilot local sessions through nav-pilot for three Qwen3.8 profiles (steps 1, 2 and 5; `bench-np-e2e` runs R2, E1 and M1 four times each, per `NP_E2E_RUNGS` and `NP_E2E_SAMPLES` in `.mise/tasks/_np_checks.py`). This is local-only mode data per class.

**What it won't tell us:** anything about delegate mode (no `bench-hybrid` step), any cloud
reference, debugging, codebases other than Ktor, real 48 GB hardware, or real prompts. No verdict
changes. Every new condition ends at 2–3 runs, which is below the floor, and older runs are not
pooled with it.

**Experiments for later,** in order of what they unlock:

1. **Cloud reference arm on all 11 cheap-ops task ids**, ×5, through `bench-copilot`'s cloud arm extended to the missing tasks. It needs no GPU, so it can run in the daytime, but it takes the bench lock, so queue it with `BENCH_WAIT=1`. It settles R1 and gives `p_cloud` for R3, D1, E3 and D3. Estimated cost: about 11 × 5 × 15 credits ≈ 800 credits (≈ $8), using the Table 2 medians of 7–29 credits as the guide. That is an estimate, not a measurement.
2. **Delegate-mode rerun with today's policy text and the class tag**, `bench-hybrid` rungs 3 and 6 on Ktor and frontend, n = 8 per arm. This re-confirms the one trusted cell under current conditions. Rungs 1, 2 and 4 hybrid, n = 6 each, check that the new text still keeps QA, comments and test files on cloud.
3. **Thin classes.** Two more create-file tasks, and three debugging tasks on Ktor built with `bench-validate-target` breaks next to X1–X3. Each runs ×5 per offered model at temperature 0 and with a cloud arm, so that these classes get numbers instead of anecdotes.
4. **A second codebase for cheap-ops classes** (the Spring target), because single-file edits and read/QA have only ever been measured on one Ktor service.
5. **Qwen3.8 in delegate mode**, only if a Qwen3.8 build clears a local-only class first. At 115 s per task against 12 ([decision.md §3.1](../2026-09-23-local-model-evaluation/decision.md)), the worker's latency could cancel out what it saves.
6. **A runtime feedback pilot:** two weeks of alpha telemetry from (c), with fleet no-edit and loop rates per class compared against the benchmark.

## 6. Risks

- **Wrong routing costs quality, silently.** A local QA answer or diagnosis that is wrong looks the same as a right one. The mitigations: silent classes get the 0.95 bar, the default is `cloud` for any class or model without data, and demotion needs no benchmark. The residual risk is that the benchmark measures 11 tasks on one Ktor service, and a class verdict generalises beyond that.
- **The user's trust.** One bad local edit is remembered longer than a hundred good ones. Trusted classes are kept to failures that get caught, the transcript names the model (already the case in the policy text), and the launch line tells Copilot-local users what the model is not trusted for.
- **Copilot CLI is all or nothing.** The bar cannot route per task there. It can only advise at launch. Until Copilot has per-agent providers, the practical recommendation for Copilot users stays cloud, with local mode as an opt-in.
- **Dependence on opencode.** Delegate mode exists only in opencode (`agent.<name>.model`, verified on 1.18.23 per `bindLocalWorker`). An opencode upgrade that changes how the task tool or the per-agent model works can break the one trusted route. The client version is part of the condition key, so an upgrade starts the count again at zero.
- **The manifest as a control channel.** Verdicts steer a cloud agent with full tool access. The enum-only schema keeps that channel to "send more or less to the local worker", with no text of its own.
- **Overfitting the benchmark.** A class promoted on 15 samples of 2 tasks can pass the bar without being generally true. Runtime demotion and the second-codebase experiment are the checks against that.
- **The policy text is the experiment.** Every change to the dispatch fragment invalidates the delegate verdicts (findings §3.1, §3.4). Any edit to `LocalDispatchPolicy`, including this design's, has to be followed by a delegate-mode rerun before the manifest calls a class trusted again.
