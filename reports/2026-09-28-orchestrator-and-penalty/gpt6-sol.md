# GPT-6 Sol as the cloud orchestrator, 2026-09-28

Item 1 of [follow-ups 2](plan.md). The run went from 09:58 to 11:43 on 28 September. It spent $6.10 of the $14.75 ledger, plus $0.05 on the two gate sessions. The files are in `.bench-logs/gpt6-sol-20260928-0957/` (hybrid) and `bench/frontier-cloud-gpt-6-sol-base-20260928-{111135,113122}.json` (frontier slice).

## Summary

- **GPT-6 Sol delegates without being forced.** Under `aggressive` it dispatched in all 7 valid samples on the large and create-file cells. The gate never had to refuse anything. Sonnet 5 dispatched in 6 of 8 at the same level, and 4 of those 6 came after a gate refusal. Under `conservative` GPT-6 Sol dispatched in 0 of 3, like Sonnet 5 (0 of 8).
- **Quality held.** All 16 valid GPT-6 Sol samples verified: controls, conservative and aggressive. So did all 7 dispatched ones. It also dispatched r6, the 60-site cell Sonnet 5 never sent. It sent the test file's 58 call sites to the worker and kept the definition and the other two call sites itself.
- **It still costs more than doing the work in the cloud.** Aggressive costs 0.71–2.33× GPT-6 Sol's own control, and it takes 1.6–7.5× the time. Only r6 came in under the control.
- **The frontier slice:** 19/20 [0.76–0.99] at 54–95 % of Sonnet 5's cost per sample, except create-file r1 at 1.9×. The one failure was a timeout at the 420 s cap on edit-multi r6. The session was still editing when the cap hit, and it did not loop.
- **9 of 25 hybrid sessions were lost to a permission prompt, not to the model.** GPT-6 Sol opens nav-pilot's instruction files, which sit outside the project. opencode asks for `external_directory` permission, and `opencode run` rejects it and ends the session. These samples are counted as invalid below (navikt/copilot#1120, navikt/mlx-workspace#116).
- **`balanced` was not measured.** Both balanced passes stopped at bench-hybrid's preflight, because the load average was 21 against a ceiling of 8.

## Setup

As in [the plan](plan.md) §1: binary `nav-pilot-xdgctx-f5c90a3c`, probe 6's bench-only capabilities block and workers (optiq-64g on the large and small cells, the Qwen3.6 8-bit on the tests cells), n = 2 per cell and level, one GPT-6 Sol control per cell. The tags are `probe-f5c90a3c-gpt-6-sol-<level>-caps`. The frontier slice ran cloud-only on `nav-pilot-main-2e1e8ee1` at `harness_sha` df7deb1af416, the same as Sonnet 5's frontier arm. Every frontier sample's `served_model` is `gpt-6-sol`.

## Invalid samples

bench-hybrid scored 9 samples as valid failures ("no changes made"). In each one, the transcript shows `permission requested: external_directory (…/hybrid-bench/.xdg-config/opencode/instructions/*); auto-rejecting`. The rejected tool call returned "The user rejected permission to use this specific tool call", and the session ended on that step (finish reason `tool-calls`) with no edit and no final message. Every sample that ended on `stop` verified. Some sessions survived a rejection and went on to pass. The 9 lost sessions are:

- the tests r2 control;
- conservative r4, r6, small and tests r1 (one sample each), and both tests r2 samples;
- aggressive small and tests r1 (one each).

They are left out below. Sonnet 5 never opened these files, and probe 6 has no rejections. The frontier slice has none either, because it runs without the Nav context.

## Hybrid results, valid samples only

| Level | Cell | Dispatched | Verified | Gate refusals | Cloud $ (× GPT-6 Sol control) | s (× control) | Sonnet 5, probe 6 |
|---|---|---|---|---|---|---|---|
| aggressive | r4 (12 files) | 2/2 (15 and 12 tasks) | 2/2 | 0 | 0.180 (2.33×) | 276 (5.9×) | 2/2 dispatched, 2/2, 1.41× |
| aggressive | r6 (60 sites, 3 files) | 2/2 (1 task, the test file) | 2/2 | 0 | 0.156 (0.71×) | 182 (1.6×) | 0/2 dispatched |
| aggressive | cf5-a (5 new tests) | 1/1 (5 tasks) | 1/1 | 0 | 0.214 (1.24×) | 298 (4.2×) | 2/2, 2/2, 1.20× |
| aggressive | cf5-b | 2/2 (5 tasks each) | 2/2 | 0 | 0.441 (1.32× Sonnet 5's control, its own was lost) | 865 (7.5×) | 2/2 plus 1 timeout, 1/2, 1.18× |
| aggressive | small (false positive) | 0/1 | 1/1 | 0 | 0.084 (1.09×) | 70 (2.1×) | 0/2 |
| conservative | r4 / r6 / cf5-a | 0/3 | 3/3 | no gate | 1.26× / 0.86× / 1.42× | 52 / 114 / 131 | 0/8 dispatched |
| conservative | small | 0/1 | 1/1 | no gate | 1.23× | 49 | 0/2 |
| balanced | all | not run (preflight: load average 21) | | | | | 2/6 dispatched, r6 and small unmeasured |

GPT-6 Sol's controls (n = 1 each), against Sonnet 5's from probes 4–6:

| Cell | GPT-6 Sol | Sonnet 5 |
|---|---|---|
| r4 | $0.077, 47 s | $0.133, 36 s |
| r6 | $0.221, 115 s | $0.119, 33 s |
| cf5-a | $0.173, 71 s | $0.303, 86 s |
| cf5-b | lost to the permission prompt | $0.334, 115 s |
| small | $0.077, 33 s | $0.119, 40 s |

**Per dispatched sample:** GPT-6 Sol ran a check after every dispatch (7/7). Rework was 42 tasks accepted and 2 redone, both in one r4 sample, with nothing fixed by hand. The workers made 5–73 local calls per sample.

## Verdicts per level

Probe 6's rules, on the large and create-file cells. "Local-first" means dispatch ≥ 50 %, the dispatched samples pass, and there is no false positive on the small cell, with cost informational only. The GO rule adds cost ≤ control.

| Level | Dispatched (valid) | Dispatched and passing | False positives (small) | Local-first | GO rule |
|---|---|---|---|---|---|
| aggressive | 7/7 | 7/7 | 0/1 | **GO** on these samples | NO-GO: 0.71–2.33× the control, above it in 3 of 4 cells |
| conservative | 0/3 | – | 0/1 | NO-GO | NO-GO |
| balanced | unmeasured | | | | |

With 1–2 valid samples per cell, and one small-cell sample, this is a probe, not a measurement. Sonnet 5's aggressive line in probe 6 failed on 1 of 6 dispatched samples. GPT-6 Sol's 7 of 7 does not show that the difference is real.

## Frontier slice

| Class, rung | GPT-6 Sol | $ a sample | median s | Sonnet 5 (same `harness_sha`) |
|---|---|---|---|---|
| edit-multi-mechanical r4 | 4/4 | 0.101 | 52 | 10/10, $0.129 |
| edit-multi-mechanical r6 | 3/4 (one timeout at 420 s) | 0.158 | 218 | 10/10, $0.167 |
| create-file r1 | 4/4 | 0.151 | 51 | 2/4, $0.08 |
| create-file r2 | 4/4 | 0.097 | 50 | 4/4, $0.18 |
| create-file r3 | 4/4 | 0.122 | 58 | 4/4, $0.21 |

At n = 4 per rung none of these cells can be `trusted` on its own, and GPT-6 Sol is level with Sonnet 5 within the noise. The timed-out r6 sample (fm-r6-b, run 2) had changed 9 files and was applying a patch from a subagent task when the cap hit.

## What changes

- **Nothing ships.** The per-level recommendation stays probe 6's: `balanced` as the default, and `aggressive` as the opt-in. Dispatch re-probe 7 measures Sonnet 5 again with the call-site gate.
- **An orchestrator that delegates on its own changes the question.** With GPT-6 Sol, aggressive's policy text alone made it send work, and the worker's output passed. What stops a GO is cost and time, not quality. If Nav users can pick GPT-6 Sol, it is the orchestrator to re-probe at n ≥ 5 per cell, balanced included, once navikt/copilot#1120 is fixed.
- **Fix before any further GPT-6 Sol run:** nav-pilot's opencode config should let the session read nav-pilot's own instructions directory (navikt/copilot#1120). bench-hybrid should mark a session that ends on a rejected permission as invalid (navikt/mlx-workspace#116).

## Harness notes

- **Balanced not run:** bench-hybrid's preflight saw a load average of 21.0 against its ceiling of 8.0, at 11:42, and stopped both balanced passes in under 20 s. The launcher logged exit 1 and went on to item 2.
- **Protected config:** the launcher's before/after check found one change: `~/.config/opencode/.nav-pilot-state.json` was rewritten at 11:41. That is the nais/pilot opencode export's state file, with a new `installed_at`, written during the frontier create-file slice. No other protected file changed.
