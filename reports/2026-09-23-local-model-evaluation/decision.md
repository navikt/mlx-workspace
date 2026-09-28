# Local models for nav-pilot: decision and action list, 2026-09-23

**Updated 2026-09-28:** what landed on 26–28 September is in [Status on 2026-09-28](#status-on-2026-09-28),
decision items 11–18 and actions 12 and 14–21. Every line cites the merged report it comes from.

**Updated 2026-09-24:** the user changed the decision. Both Qwen3.8-27B builds stay in the
manifest for the 48 GB tier as tuned opt-ins, pending the sweep in
[qwen38-tuning.md](qwen38-tuning.md). Items 2–5 of §1 and action 4 are revised below; the
evidence behind the original items is kept.

For a Nav platform engineer who was not part of today's work. Every number is re-derived from the
raw file it cites. `bench/` files are in this repo; `.bench-logs/` is git-ignored and exists only
on the benchmark machine (M5 Max, 128 GB, `iogpu.wired_limit_mb` = 36864 to emulate a 48 GB
machine, nav-pilot's runtime mlx-lm 0.31.3 / mlx 0.32.0).

## Documents in this folder

- [evaluation-log.md](evaluation-log.md): the running log of the Qwen3.8 nopin evaluation, with every run and its raw file.
- [nav-pilot-e2e.md](nav-pilot-e2e.md): the combined end-to-end test of navikt/copilot #931, #932 and #933 on the #20 manifest.
- [hardware-tier-backlog.md](hardware-tier-backlog.md): tests still to run on 48, 64 and 128 GB machines.
- [profile-audit.md](profile-audit.md): every profile checked against Hugging Face and the loader; which were removed, repointed or kept.
- [pending-tasks.md](pending-tasks.md): what is left that needs mains power (GPU), network or other machines, in suggested order.
- [qwen38-tuning.md](qwen38-tuning.md): the 2026-09-24 tuning sweep for both Qwen3.8-27B builds at 36 GB wired: constraints, the pruned grid, partial results, the resume commands and the provisional parameters.

## Status on 2026-09-24

Checked 13:20 CEST. Merged into navikt/copilot `main`:

- #932 (instructions dir) → be565bcc
- #931 (dead generation thread) → 129d9074
- #933 (result-aware loop guard) → a0785257
- #935 (a failed launch exits non-zero) → 35967543
- #937 (follow-up: an unresolvable client exits 1) → d328ee68
- #936 (`MLX_PREFILL_STEP_SIZE` → `--prefill-step-size` whitelist) → baf72f2c

Still open:

- navikt/copilot#934 (sampling override, `MLX_NAV_PILOT_TEMPERATURE` / `MLX_NAV_PILOT_TOP_P`) merged on 2026-09-24 (this line said "stays a draft" until 2026-09-26).
- navikt/mlx-workspace#20 stays a draft and will be re-scoped (action 4): it will ship the tuned parameters for both Qwen3.8 builds instead of removing the 8-bit.

## Status on 2026-09-28

Checked 12:55 CEST. Merged since 2026-09-24, in navikt/mlx-workspace unless marked:

- #108 (nights 64-4 and 64-5, with reviews) and #109 (the 64 GB manifest entry `qwen3.6-35b-a3b-8bit`), 2026-09-28.
- #112 (dispatch probe 6, the `local_dispatch` levels) and navikt/copilot#1114 (the gate counts call sites and checks the worker's result), 2026-09-28.
- #111 (own-endpoint validation) with navikt/copilot#1100 (two setup fixes), #110 (Linux smoke test) and #120 (the network reruns: Ollama `--pull`, Linux passes 1–2), 2026-09-28.
- #115 (quality frontier, follow-ups 1) and #118 (GPT-6 Sol as the cloud orchestrator), 2026-09-28.
- #106 (PRD for a hosted `alpha decide`, plan only), 2026-09-27.

Still open or queued: dispatch re-probe 7 (#121), night 64-6 ([plan-64-6.md](../2026-09-26-64gb-tier/plan-64-6.md)),
the presence_penalty A/B and Linux pass 3 (both queued, [UNMEASURED.md](../UNMEASURED.md)), and frontier
harness v2 (#113, merged after re-probe 7 and the presence_penalty A/B). Night 64-6 runs after v2's validation night.

## 1. Decision summary

1. `qwen3.6-35b-a3b-optiq` stays the only default. Its quality is level with the best local alternative (28/40 vs 31/40, Fisher p = 0.61), and it is about 9× faster per task.
2. **Revised 2026-09-24.** The 8-bit Qwen3.8-27B stays on the 48 GB tier as an opt-in with tuned parameters, provisionally 32,768 context, 4,096 output and a 2.25 GiB prompt cache ([qwen38-tuning.md §7](qwen38-tuning.md#7-provisional-parameters)). *Original item:* withdrawn from the 48 GB tier, because at 36 GB wired it hit a Metal OOM at about 51k tokens once and slows about 6× past 40k. That evidence stands and is why the context stays at or below 40k.
3. **Revised 2026-09-24.** Full-context 8-bit (64k and up) stays on the 64 GB backlog. *Original item:* the whole 8-bit moved there.
4. **Revised 2026-09-24; superseded the same day:** the plain 4-bit was replaced by Qwen3.8-27B-OptiQ-4bit ([qwen38-tuning.md](qwen38-tuning.md) §10). The text below is the earlier revision. The 4-bit stays on offer, provisionally at 65,536 context, 8,192 output and an 8 GiB prompt cache (was 12 GiB), with the OptiQ-4bit build measured as a possible replacement. *Original item:* capped at 65,536 (from 131,072) in #20. It verified an E1 session through nav-pilot at that cap and peaked at 29.6 GB.
5. ~~**Recommendation:** stop offering the 4-bit as well, in a follow-up to #20.~~ **Superseded by the user's decision of 2026-09-24** to keep offering it. The evidence is unchanged: it scored 17/30, below optiq (p = 0.32, §3.2), at about 6.6× the time per task and less than half optiq's decode speed, and its 30k and 60k cold TTFT fail the §12 latency criteria (§5).
6. The LLM loop classifier ("System One") is dropped. At its 0.9 threshold it blocked none of 7 probe scenarios, loops included.
7. It is replaced by a deterministic rule (navikt/copilot#933): block after 4 identical calls with identical results, and keep a backstop at 8 identical calls.
8. Two nav-pilot fixes go with it: #931 (a dead generation thread makes the server exit, so it no longer hangs) and #932 (Copilot static context 45.1k → 21.7k tokens).
9. All four PRs were tested together end to end, and every scenario passed after a re-run that fixed the test design.
10. Not measured: real 48 GB hardware or Pro-chip decode speed. The 4-bit at 60k works on 36 GB wired but is slow: 109 s to first token, 22 tok/s, peaking at 39.0 GB.

**Added 2026-09-28.**

11. **64 GB machines get an opt-in: `qwen3.6-35b-a3b-8bit`** (#109, shipped 2026-09-28 by the user's decision to ship as measured). It is the default's model at 8-bit: `min_ram_gb` 64, 48 GB wired, 64k context and a 16k reply, never the default. It won the tier over Occamy 4-bit: Copilot e2e 12/12 against 8/12, create-file with one retry 19/24 against 13/24 (p = 0.062, moderate evidence), decomposed edits level, and Occamy's publisher is not allowed ([night-64-4.md](../2026-09-26-64gb-tier/night-64-4.md) and [night-64-5.md](../2026-09-26-64gb-tier/night-64-5.md), Reviews; #108). Its peak was 46.18 GB at the 49k probe, 0.18 GB over the 46 GB line. Prompts past 49k are unmeasured and extrapolate to about 50 GB; night 64-6 measures them ([plan-64-6.md](../2026-09-26-64gb-tier/plan-64-6.md)). Its capabilities block is all `cloud`, so the orchestrator is told to send it nothing: for now it is a selectable local model, not a worker ([pending-tasks.md §8.8](pending-tasks.md#88-the-64-gb-tier-a-worker-directed-by-a-cloud-orchestrator-downloaded-profiles-in-place)).
12. **`local_dispatch = balanced` stays the default; `aggressive` is the opt-in** (dispatch probe 6, pending-tasks §8.8, #112). The gate (navikt/copilot#999) is the first thing that made Sonnet 5 dispatch: 8 of 16 valid hybrid samples at the enforcing levels, against 1 of 29 on advisory text in probes 1–5. `aggressive` dispatched in 6 of 8 valid samples, but 1 of the 6 failed and another attempt timed out, and it cost 1.18–1.56× the control. The cloud model's own work passed 18 of 18. `create-file` is not shipped as trusted for any 64 GB worker.
13. **The gate and verification fixes are in nav-pilot; the re-probe is pending.** navikt/copilot#1114 (merged 2026-09-28) counts call sites toward the multi-file rule, so probe 6's 60-site, 3-file r6 is now gated. It also appends build, test and break-the-code checks to a worker's result, for the two quality failures probe 6 found. Whether that is enough for `aggressive` to become a default is dispatch re-probe 7 (#121); until then item 12 stands.
14. **GPT-6 Sol delegates without being forced, but does not save credits** ([gpt6-sol.md](../2026-09-28-orchestrator-and-penalty/gpt6-sol.md), #118). Under `aggressive` it dispatched in 7 of 7 valid samples with no gate refusal, r6 included, and all 16 valid samples verified. It cost 0.71–2.33× its own control, so it fails the GO rule on cost. `balanced` was not run. 9 of 25 sessions were lost to an auto-rejected read of nav-pilot's own instructions (navikt/copilot#1120, #116). Nothing ships.
15. **The own-endpoint path works** on `mlx_lm.server`, Ollama 0.34.4 and llama-server 0.5.0 ([endpoint report](../2026-09-28-local-endpoint-validation/report.md), #111, #120). Doctor passes all five checks on all three. Decide through an endpoint to `mlx_lm.server` gives exactly the managed answers (89/96, 95/105, 323/364). The unsloth GGUF on Ollama or llama-server is level within the intervals (87/96, 94/105, 321/364), with half the prefill (TTFT 17–19 s against 9–10 s at 30k). Ollama's library `qwen3.6:35b` pulled through `setup --pull` (21.1 GiB; setup done in 711 s) and passed setup and doctor. navikt/copilot#1100 fixed two first-run setup/doctor bugs. macOS only.
16. **Linux is partly tested** ([linux-smoke report](../2026-09-27-linux-smoke/report.md), #110, #120), in Colima: arm64, CPU, a 5 GiB container, Qwen3 1.7B. The apt install works in a terminal and needs `-y` without one (navikt/copilot#1128). Setup ran against Ollama and llama-server, but in 5 GiB the 30k context check cannot pass, so setup saved nothing (navikt/copilot#1126). An OOM shows as "connection refused" (navikt/copilot#1127), and llama.cpp's ubuntu-arm64 build needs libgomp1 (navikt/copilot#1129). Doctor, decide and an opencode session on Linux are still unverified; pass 3 is queued. x86_64 and NVIDIA are unmeasured (#124).
17. **Follow-ups 1 changes nothing in nav-pilot** ([night-followups-1.md](../2026-09-25-quality-frontier/night-followups-1.md), Review, #115). decide's yes/no inconsistency is a pull to the last-listed option, not a "text is fine" prior. read-qa's `example` prefix replicates (57/80 against 32/80), but every rung stays `cloud` (next lever: #114). create-file `retry2` pooled with night 2 is 15/20 against 5/20 at 2.02× the median time per sample, over design §7's 2× limit, and cheaper per verified result (322 s against 618 s); which rule applies is the user's call (#126).
18. **Hosted `alpha decide`: a plan, no-go today** ([PRD](../2026-09-27-hosted-decide-prd/prd.md), #106). None of the four data gates in [pending-tasks §8.10](pending-tasks.md#810-a-prd-for-a-hosted-alpha-decide-once-the-data-is-in) is met, and the user has ruled out running GCP infrastructure for now. If the gates pass and the user says go, the PRD recommends a G4 in `europe-north1` behind the nav-pilot CLI gateway: about $1.0k a month for an office-hours pilot, $3.2–7.2k for 1+1.

## 2. Action list

All actions are for the user (Hans). Suggested order follows the table.

| # | Action | Link | Evidence | Risk if not done |
|---|---|---|---|---|
| 1 | **Done** (be565bcc). Merge navikt/copilot#932 (scope `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` to `~/.copilot/.github/instructions`) | https://github.com/navikt/copilot/pull/932 | Static context 21,709 / 21,700 / 21,704 tokens with it, 45.1k without (§3.4). CI green, mergeable | Every Copilot session, including cloud sessions, carries ~23k duplicate instruction tokens per request, and local 32k models can't start at all |
| 2 | **Done** (129d9074). Merge navikt/copilot#931 (the server exits with status 70 when its generation thread dies) | https://github.com/navikt/copilot/pull/931 | `bench/navpilot-e2e-rerun-20260923-154926.json` `e`: server gone 0.5 s after an injected fault, and the next launch prints "generation thread died, most likely out of memory" after 2.0 s. The PR body still says "not yet verified"; update it (fault injection, not a real OOM) | After an OOM, sessions attach to the dead server and hang for 900 s per attempt |
| 3 | **Done** (a0785257). Merge navikt/copilot#933 (result-aware loop guard) | https://github.com/navikt/copilot/pull/933 | Re-run `d`: the loop was blocked at 4 with "same result" after 20 s. A poll with changing output ran 7 identical calls to READY without being blocked | The guard keeps treating a legitimate poll like a loop (it fires at 8 regardless of the result), and a genuinely stuck loop runs until call 8 |
| 4 | **Re-scoped 2026-09-24.** Finish the tuning sweep, then update navikt/mlx-workspace#20 to ship the tuned parameters for both Qwen3.8 builds (and OptiQ-4bit if it wins) instead of removing the 8-bit; then mark it ready and merge | https://github.com/navikt/mlx-workspace/pull/20 | [qwen38-tuning.md](qwen38-tuning.md) §6 (resume commands) and §7 (provisional parameters). Draft, mergeable, CodeQL green; its current manifest `9a6e7ff` was used in the combined e2e run | The shipped 8-bit entry keeps its 65,536 context: OOM or a 6× slowdown past 40k on 48 GB machines |
| 5 | **Done** as PRs instead of an issue: #935 (35967543) makes a failed launch exit non-zero, and #937 (d328ee68) makes an unresolvable client exit 1. Was: open an issue, "Launch failed" exits 0 | https://github.com/navikt/copilot/pull/935, https://github.com/navikt/copilot/pull/937 | `.bench-logs/navpilot-rerun-fault-launch-20260923-155023.log`, `launch.exit: 0` in the re-run JSON. The cause is in `offerLaunchCopilot` (`internal/cli/interactive.go:1092-1096`), which prints the error and returns. That code is on `main` already and wasn't introduced by #931, so it should be a **separate issue**, not a #931 follow-up | Scripts and CI that wrap nav-pilot can't tell a failed launch from a successful one |
| 6 | Decide what to do about the rtk instructions reaching local sessions (options below) | `~/.copilot/copilot-instructions.md`, `~/.copilot/hooks/rtk-rewrite.json` | §3.6 | Small local models burn turns on `rtk` output they can't read |
| 7 | Merge the evaluation branch into mlx-workspace `main` (details below; result files are committed) | [navikt/mlx-workspace#21](https://github.com/navikt/mlx-workspace/pull/21) | branch `bench/2026-09-23-local-model-evaluation` | Harness fixes stay off `main`. Today's raw results are **untracked**, although `.gitignore:23` says `bench/results-*.json` is tracked evidence |
| 8 | Correct PLAN.md (details below) | `PLAN.md:104`, `:371`, `:376-379` | §4 | The next reader believes the 8-bit went 7/7 and that System One shipped |
| 9 | Remove stale branches and worktrees after the merges (details below) | | | Disk use, and the main copilot checkout stays on a superseded branch |
| 10 | Your call: remove the `~/.copilot/session-state` worktrees | 5 directories, listed below | They caused the 45.1k static context | After #932 they no longer reach nav-pilot sessions. Before #932 they do |
| 11 | **Done** (#936, baf72f2c; values 1–16,384 accepted). Add `MLX_PREFILL_STEP_SIZE` → `--prefill-step-size` to nav-pilot's `serverFlags` whitelist | navikt/copilot `cli/nav-pilot/internal/local/runtime.go:1002-1011` | The score-matrix transient (~5 GB per 2048-token chunk at 51k, §3.3) is the term that puts the 8-bit at 40–48k over the limit ([qwen38-tuning.md §3–4](qwen38-tuning.md#3-knobs)). `--decode-concurrency` and `--prompt-concurrency` are still missing | The 8-bit stays capped at 32k on this tier. Next: the prefill-step variants in [qwen38-tuning.md §8](qwen38-tuning.md#8-what-would-change-these) |
| 12 | **Done** (navikt/copilot#934 merged 2026-09-24; manifest #31, #32): temp 0.6 / top_p 0.95 for every entry, as benchmarked ([qwen38-tuning.md §9](qwen38-tuning.md#9-sampling-temperature)). Was: decide the default temperature. The mechanism is navikt/copilot#934 (draft); the values come from the sampling sweep | manifest `MLX_TEMP`, or `MLX_NAV_PILOT_TEMPERATURE` / `MLX_NAV_PILOT_TOP_P` once #934 merges; https://github.com/navikt/copilot/pull/934 | Whitelisted but set in no profile; mlx-lm's `--temp` defaults to 0.0, so requests without a client temperature are greedy, the default optiq model included ([qwen38-tuning.md §3](qwen38-tuning.md#3-knobs)) | Every quality number, including optiq's, reflects greedy decoding that may not be what Qwen recommends |
| 13 | Exit codes: nav-pilot's half is **done** (action 5); fixing the tuning queue's `run()` is still open | action 5; `.bench-logs/qwen38-tuning-queue.sh` | The queue logs `exit $?` after a `$(date)` substitution, so a failed run logs `exit 0` ([qwen38-tuning.md §6](qwen38-tuning.md#6-resume)) | Failed runs, from nav-pilot or the queue, look like successes to anything reading the status |
| 14 | **Done** (#109, 2026-09-28). Ship `qwen3.6-35b-a3b-8bit` as a 64 GB opt-in. Next: night 64-6, after the v2 validation night; phase A needs `sudo sysctl iogpu.wired_limit_mb=53248` and 49152 after it, and phase C needs re-probe 7's binary and level | [plan-64-6.md](../2026-09-26-64gb-tier/plan-64-6.md) | Decision item 11 | Prompts past 49k stay unmeasured on the shipped 64k entry, and its capabilities block stays all `cloud` |
| 15 | **Done** (#112, navikt/copilot#1114). Keep `balanced` as the default and offer `aggressive` as an opt-in; the gate counts call sites and checks the worker's result. Next: dispatch re-probe 7 | #121 | Decision items 12–13 | `aggressive` stays opt-in on two samples per cell, and night 64-6's delegate cells have no binary or level |
| 16 | After re-probe 7: decide whether measured capabilities ship in the manifest, and whether any level changes its default | navikt/copilot#1010, #1014 | pending-tasks §8.8, probe 6 recommendation | Routing keeps its all-`cloud` block for the 64 GB entry |
| 17 | GPT-6 Sol: fix the rejected read of nav-pilot's instructions and mark such sessions invalid, then re-probe at n ≥ 5 per cell, `balanced` included | navikt/copilot#1120, #116 | Decision item 14 | 9 of 25 GPT-6 Sol sessions ended on a permission prompt, and its `balanced` result stays unknown |
| 18 | Linux: fix the setup and install findings; pass 3 (saved config, doctor, decide, a session) is queued; real hardware needs machines | navikt/copilot#1099, #1126–#1129, #124 | Decision item 16 | A small Linux machine gets no usable config and no message saying so |
| 19 | Own endpoint: **done** (navikt/copilot#1100). Two smaller findings are open | navikt/copilot#1101, #1102 | Decision item 15 | decide waits about 2.5 s at exit when the telemetry host is unreachable |
| 20 | Decide which time rule applies to create-file `retry2`: per sample (fails, 2.02×) or per verified result (passes) | #126 | Decision item 17 | retry2 stays unreplicated on create-file |
| 21 | Hosted decide: no action until the §8.10 gates are met. Kev 4B and Laya install from 2026-09-29 (gate 2) | #95, #96, navikt/copilot#1015 | Decision item 18 | – |

**Merge order and dependencies.** #932, #931 and #933 merged on 2026-09-24, followed by #935,
#937 and #936. Before that they had been merged together without conflicts into
`test/e2e-combined` (915e27c6) and passed `go test -race` and the e2e run. #20 still goes last,
after the tuning sweep, and the sweep must use a nav-pilot binary built from current `main`
([qwen38-tuning.md §6](qwen38-tuning.md#6-resume)). Recommendation 5 is superseded; there is no
follow-up to stop offering the 4-bit.

**rtk options (#6), undecided:**

- A. Delete the `<!-- rtk-instructions v2 -->` block from `~/.copilot/copilot-instructions.md`. Simple, but cloud Copilot sessions lose rtk's savings too.
- B. Have nav-pilot/cplt give local sessions a Copilot config without that file. Needs a code change; whether Copilot can skip `copilot-instructions.md` per session has not been checked.
- C. Keep it. #933 already stops the resulting repeat at 4 calls; the cost is wasted turns.
- D. Configure rtk not to collapse short `find`/`grep` output to "N filtered". This keeps rtk but has to be tested against rtk's own configuration.

**`fix/bench-results-schema` (#7), notable commits:** harness repairs 41f4f95 (bench-results
schema) and 9cc6ba3 (`assert_serving_profile` was a no-op, so every run failed in seconds);
39658a1/fe47f33 (`BENCH_WAIT=1`: queues wait instead of refusing); d827d81 (INT/TERM now exit.
Before, killing a queue ran only its lock-removing trap and the queue kept going without the lock,
which is how two queues ran at once at 13:47–13:55); new tasks 01d8070 `bench-np-e2e`, 6af4d80
`bench-system-one`, 9724e1b `bench-navpilot-e2e`, 8c69310 `bench-navpilot-e2e-rerun`; profile
cap cbe77ea. Before merging, commit the untracked `bench/*-20260923-*.json`, including the invalid
runs, which the report cites as excluded, and the 4-bit latency file once it is complete. The two
untracked profiles are settled by the [profile audit](profile-audit.md):
`qwen3.8-27b-4bit-quasar` is removed (no such repo; QUASAR exists only as CUDA NVFP4) and
`qwen3.8-flash-next-4bit` is kept and committed, moved to the mlx-vlm backend.

**PLAN.md (#8):**

- Line 104 ("7/7 on all mechanically verified tasks … zero tool loops") and line 371 (§11.5, "1 stellar run (7/7, 0 loops)"): the run was 7 passed out of 11 (D2 timed out, R1/R3/D1 unscored), `bench/results-qwen3.8-27b-8bit-nopin-20260918-104324-01.json`. The current-harness figure is 31/40.
- Lines 376–379 (§11.6, "PROVEN & INTEGRATED … merged into `navikt/copilot`"): it was never merged. It sat in an unrelated PR (#928), then on local branch `feat/local-system-one-loop-guard`, and it is now superseded by #933. The 4/4 probe did not hold up on 7 scenarios (§3.5).

**Stale branches and worktrees (#9):**

- `feat/local-system-one-loop-guard` (e72319e0): local only, superseded by #933. The main checkout `~/go/src/github.com/navikt/copilot` is **on** this branch; switch it to `main` before deleting the branch.
- The 2026-09-23 copilot worktrees, all PRs now merged, so they can go: `copilot-deadthread` (#931), `copilot-instrdirs` (#932), `copilot-loopguard` (#933), `copilot-e2e` (`test/e2e-combined`, local only; it built `.bench-logs/bin/nav-pilot-combined-915e27c6`).
- `/Users/hans/mlx-workspace-hotfix`: worktree for #20's branch, clean. Remove after #20 merges.
- 39 other `~/go/src/github.com/navikt/copilot-*` worktrees predate today and were not reviewed here.
- `~/.copilot/session-state` (#10): `a4734d79…/files/{copilot-worktree,cplt-worktree}` and `fbe281f6…/files/{article,benchmark,models}-worktree`.

## 3. Evidence

### 3.1 Head-to-head (cheap-ops, 10 scored tasks, D2 retired)

| Model | Valid runs | Pass | Median s/task (pooled) | TTFT / decode at 2k | TTFT / decode at 30k | Peak footprint |
|---|---|---|---|---|---|---|
| optiq (default) | 4 (`115543-01/02/03`, `124337-01`) | 28/40 (70%) | 12.2 | 0.99 s / 68.6 tok/s | 11.1 s / 58.6 tok/s | 34.3 GB at 60k |
| optiq, without stress-overlapped `115543-01` | 3 | 19/30 (63%) | 11.9 | | | |
| 8-bit nopin | 4 (`083958-01..04`) | 31/40 (78%) | 115 | 4.3 s / 14.8 tok/s | 59.6 s / 13.8 tok/s | 43.8 GB, then OOM |
| 4-bit | 3 (`125734-01`, `143323-01/02`) | 17/30 (57%) | 80 | 2.5 s / 30.1 tok/s | 47.0 s / 25.1 tok/s | 39.0 GB at 60k (TTFT 109 s, 22.2 tok/s) |
| 8-bit pinned (`8bit-mlx`) | 0 valid | | | not measured | | |

Sources: `bench/results-<profile>-20260923-<run>.json`; latency from `bench/np-e2e-qwen3.6-35b-a3b-optiq-20260923-114534.json`,
`np-e2e-qwen3.8-27b-8bit-nopin-20260923-112533.json` and `np-e2e-qwen3.8-27b-4bit-20260923-155027.json` (cold
probes, 256 output tokens). Peaks: optiq from its np-e2e `memory.peak_gb`; nopin from
`.bench-logs/np-e2e-qwen3.8-27b-8bit-nopin-20260923-112533.footprint` (max 43,828,073,688 bytes);
4-bit from `bench/navpilot-e2e-20260923-140805.json` `memory.peak_gb_by_phase.c-E1`.
Excluded as invalid (two queues ran at once): 4-bit `125734-03` and `134745-02`, 8bit-mlx `125734-02`.
The 4-bit latency run (15:50–15:56) finished all targets. 60k: TTFT 109 s, decode 22.2 tok/s, peak 39.0 GB, no OOM.

Per-run pass counts: optiq 9, 8, 5, 6. nopin 8, 9, 6, 8. 4-bit 6, 5, 6. R1 failed in all 11 valid
runs across the three models, so it probably tests the task, not the model.

### 3.2 Significance (two-sided Fisher exact, computed here, confirmed with scipy)

| Comparison | p |
|---|---|
| nopin 31/40 vs optiq 28/40 | 0.61 |
| nopin 31/40 vs optiq 19/30 (without `115543-01`) | 0.29 |
| optiq 28/40 vs 4-bit 17/30 | 0.32 |
| optiq 19/30 vs 4-bit 17/30 | 0.79 |
| nopin 31/40 vs 4-bit 17/30 | 0.07 |

None of the differences is significant at this n. Speed is: the difference is 9–10× per task.

### 3.3 The OOM

In the nav-pilot runtime, the nopin 60k probe died during prefill at about 51k tokens with
`[METAL] Command buffer execution failed: Insufficient Memory` (`.bench-logs/server-restart.log:84885`),
after a peak of 43.8 GB. The generation thread died while HTTP stayed up, so later requests hung.
That is what #931 fixes. According to the running log, the cause is the 36 GB wired cap plus
mlx 0.32.0 having no fused attention kernel for head_dim 256, which gives a ~5 GB score-matrix spike
per 2048-token chunk. The OOM is not deterministic. A later 8-bit run with a 59,210-token prompt
peaked at 46.31 GB without an OOM (`bench/navpilot-e2e-20260923-140805.json`, `e-crash`), but its
prefill slowed from 3.5–4.5 s per 2048 tokens below 36k to 25–30 s past 49k
(`.bench-logs/navpilot-e2e-crash-20260923-143030.server.log`). At the 32k cap the 8-bit peaked at
37.23 GB without an OOM (`bench/np-e2e-qwen3.8-27b-8bit-nopin-20260923-123952.json`).

### 3.4 Copilot static context: 45.1k → 21.7k

Copilot CLI refuses to start when static context exceeds about 80% of
`COPILOT_PROVIDER_MAX_PROMPT_TOKENS`. On 23 Sep the blocked sessions recorded `systemTokens`
36,749–36,753 plus `toolDefinitionsTokens` 8,358 ≈ 45.1k (`session.shutdown` events in
`~/.copilot/session-state/*/events.jsonl`; the log rounds this to 45.2k). The cause was
`COPILOT_CUSTOM_INSTRUCTIONS_DIRS=~/.copilot`, searched recursively into agent worktrees under
`session-state`. With #932: 13,351 + 8,358 = 21,709, and 21,700 and 21,704 on the other two
sessions (`bench/navpilot-e2e-20260923-140805.json`, scenario `a`). All 12 nopin e2e sessions at
32k ended within 6–9 s at that gate and produced no quality data
(`np-e2e-qwen3.8-27b-8bit-nopin-20260923-123952.json`, `e2e`).

### 3.5 Classifier probe (nopin, guard prompt from e72319e0)

7 scenarios × 3 repetitions at temperature 0, all identical. Values from
`bench/system-one-qwen3.8-27b-8bit-nopin-20260923-124307.json` (same values in `np-e2e-…-123952.json`).

| Scenario | Actually a loop | P(A = loop) | Blocks at > 0.9 |
|---|---|---|---|
| poll-ci | no | 0.417 | no |
| rerun-tests | no | 0.687 | no |
| poll-pr-checks | no | 0.687 | no |
| recompile | no | 0.779 | no |
| rerun-go-test | no | 0.779 | no |
| reread-file | yes | 0.883 | **no** |
| same-grep | yes | 0.883 | **no** |

The probe had no false positives and no true positives. Latency p50 was 0.49 s and p95 0.52 s.
The classifier sees the call and the count but not the result, and the result is what separates a
poll from a loop. #933 uses the result.

### 3.6 Combined e2e (#931 + #932 + #933 + #20 manifest)

`bench/navpilot-e2e-20260923-140805.json`, and for d and e `bench/navpilot-e2e-rerun-20260923-154926.json`:

- a, Copilot + optiq: R2 and E1 verified. M1 made no edit ("no changes made"). This counts as a model miss, not an integration failure, so it doesn't block the merges. Static context was 21.7k.
- b, opencode cloud main with `local-worker`: verified, 2 local calls, $0.0242 of cloud cost.
- c, Copilot + 4-bit at 65,536: E1 verified in 60.2 s, no OOM, peak 29.58 GB.
- d, loop guard: the first run was invalid because the session ran in the wrong cwd. The re-run passed: the loop was blocked at 4 and the poll finished at call 7.
- e, crash reporting: the first run did not reproduce the OOM. The re-run with an injected fault passed, but the failed launch exits 0 (action 5).

rtk, from events in `~/.copilot/session-state/958221ad-…/events.jsonl` (the first poll session):
the model issued `rtk grep`/`rtk find` because `copilot-instructions.md` tells it to. Inside the
repo, rtk **ran** (exit 0), but it reduced the output to `... (51 filtered) [+51 hidden: rtk recall …]`,
so the model never saw the file list and repeated the call. The later calls on `/Users/hans` were
denied by Copilot's permission layer, and the plain `find` was denied just the same. The
denial is about the path, not about rtk. The four identical denied `rtk find` calls tripped #933,
correctly.

## 4. What the previous handoff got wrong

- "nopin 7/7": the run was 7/11 (above). PLAN.md still says 7/7.
- "System One merged into navikt/copilot": it was never merged, and it has been superseded.
- "A 6-run validation queue is running": it never started, and when it was started every run failed within seconds because of the `assert_serving_profile` stub (9cc6ba3).
- The `bench-results` validity fix broke the schema (41f4f95).
- The oMLX MTP comparison pointed at an abliterated finetune (fixed in 9c660c3).
- The same-day e2e report says the poll session's `rtk find` got "Permission denied" each time. Only the calls outside the repo were denied; inside it, rtk ran and hid its output (§3.6).
- "The 8-bit OOMs at ~51k" held once. A second attempt reached 59k without an OOM but ran about 6× slower, which leads to the same decision.
- "The 4-bit is below both optiq and nopin": that is true of the point estimates only (p = 0.32 and 0.79 against optiq).

## 5. Open questions and what was not measured

- **Real 48 GB hardware.** Everything above ran on a 128 GB M5 Max with the wired limit set to 36 GB. Whole-system pressure with an IDE, a browser and Copilot running (48 − 36 = 12 GB for everything else) is unmeasured.
- **Pro-chip decode.** Decode is bandwidth-bound. The running log estimates about 9 tok/s for the 8-bit on a 273 GB/s Pro chip, and for the 4-bit and optiq it is unmeasured. Which chips Nav developers actually have decides whether any dense model is usable.
- **4-bit at 60k** (`bench/np-e2e-qwen3.8-27b-4bit-20260923-155027.json`): no OOM, peak 39.0 GB, cold TTFT 109 s (a repeat gave 123 s), decode 22.2 tok/s. This fails the §12 latency criteria (cold TTFT at 30k is 47.0 s against a 30 s limit, and at 60k 109 s against 90 s). That was the case for recommendation 5, which the user's 2026-09-24 decision supersedes; the 4-bit is offered as an opt-in regardless.
- **`min_ram_gb` is not enforced by nav-pilot**, so per-tier manifest entries do nothing until it is.
- **Quality n is small.** 3–4 runs per model can't separate 57–78% pass rates. Variance within a model (optiq 5–9/10) is as large as the differences between models.
- Tests for the 64 GB and 128 GB tiers (8-bit at full context, `--prefill-step-size 512`, oMLX MTP, Qwen3.8-Flash-Next) are listed in [hardware-tier-backlog.md](hardware-tier-backlog.md).
