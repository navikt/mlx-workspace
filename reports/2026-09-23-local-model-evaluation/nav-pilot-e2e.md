# nav-pilot end to end with #931, #932 and #933 combined

Before the three navikt/copilot PRs merge: do they work together, on the manifest from
mlx-workspace#20 (optiq default, 4-bit capped at 65536, 8-bit removed)?

- Binary: `.bench-logs/bin/nav-pilot-combined-915e27c6`, built from `test/e2e-combined` (local only,
  worktree `~/go/src/github.com/navikt/copilot-e2e`): `origin/main` 5b8d5a05 with
  `fix/local-server-dead-generation-thread` (#931), `fix/copilot-instructions-dir` (#932) and
  `feat/local-result-aware-loop-guard` (#933) merged. No conflicts. `go test -race ./...` passes.
- Manifest: `fix/manifest-context-caps` (#20), written into `~/.nav-pilot/local-models.json` with
  `start` kept off the network, as `bench-np-e2e` does. Restored on exit.
- Run: `mise run bench-navpilot-e2e`, results in `bench/navpilot-e2e-<stamp>.json`.

| | scenario | pass criteria |
|---|---|---|
| a | Copilot CLI + optiq (default) | R2, E1, M1 verify; `systemTokens + toolDefinitionsTokens` from the new session's shutdown event is 15–25k (expected 19–21k; ~45k before #932) |
| b | opencode, cloud main agent + `local-worker` | one R2 task, the prompt asks for the worker: verified, nav-pilot announces local dispatch, local server takes at least one call. Cloud cost recorded |
| c | Copilot CLI + qwen3.8-27b-4bit at 65536 | E1 verifies, no `Insufficient Memory` in server.log; peak footprint recorded |
| d | loop guard (#933) | provoked loop (read `ready.txt` until GO) blocked at 4 with "same result"; the poll (READY on call 7, output changes each call) completes without a same-result block. Whether the 8-call backstop fired is recorded |
| e | crash reporting (#931) | 8-bit at 65536 (pre-#20 entry), cache warmed at 30k, then ~60k tokens: the server exits within 5 min with the status-70 marker in server.log, and the next launch fails within 60 s with "generation thread died, most likely out of memory" |

Exit status 70 is read from the marker line the bootstrap prints just before `os._exit(70)`:
the server's parent (`alpha local start`) has exited by then, so nothing can `waitpid` it.

## Results

Run `navpilot-e2e-20260923-140805.json`, finished 2026-09-23 14:32.

| | scenario | expected | observed | evidence | result |
|---|---|---|---|---|---|
| a | Copilot CLI + optiq (default) | R2, E1, M1 verify; Copilot static context 19–21k (not ~45k) (#932) | 2/3 verified; static [21709, 21700, 21704] | .bench-logs/copilot-1-local-0-20260923-140811.log, .bench-logs/copilot-2-local-1-20260923-140835.log, .bench-logs/copilot-3-local-2-20260923-140912.log | **FAIL** |
| b | opencode, cloud main + local-worker | R2 verified, nav-pilot announces local dispatch, local server takes >= 1 call | verified=True local_calls=2 announced=True cloud_steps=2 cost=$0.0242 | .bench-logs/navpilot-e2e-opencode-20260923-142232.jsonl | pass |
| c | Copilot CLI + qwen3.8-27b-4bit at 65536 | 1 task verifies, no 'Insufficient Memory' in server.log | verified=True 60.2s oom=False peak 29.58 GB | .bench-logs/copilot-2-local-0-20260923-142256.log | pass |
| d | loop guard (#933) | loop blocked at 4 with 'same result'; poll reaches READY on call 7, not blocked by the same-result rule | loop: max_run=0 msg=''; poll: completed=True max_run=0 msg='400 nav-pilot stopped this turn: the local model repeated the same tool call with the same result 4 times — bash({"command": "rtk find /User'; backstop mattered=False | .bench-logs/system-one-loop-20260923-140942.log, .bench-logs/system-one-poll-20260923-142010.log | **FAIL** |
| e | crash reporting (#931) | server exits 70 within 5 min of the ~60k prompt; next launch fails fast with the local_server_lost message | exited=False after 300.5s status_70=False launch 121.5s exit=-9 lost_message=False | .bench-logs/navpilot-e2e-crash-20260923-143030.server.log, .bench-logs/navpilot-e2e-crash-launch-20260923-143030.log | **FAIL** |

## Re-run of d and e

d and e failed on test design, not on the product. `mise run bench-navpilot-e2e-rerun`
redid both; results in `bench/navpilot-e2e-rerun-20260923-154926.json`, log
`.bench-logs/navpilot-e2e-rerun-20260923-154926.log`.

What was wrong the first time:

- **Wrong cwd.** cplt uses the git root as the project dir, and Copilot runs there. For the
  sessions that was `/Users/hans/mlx-workspace`, not the session's work dir. The poll session
  never found `./poll.sh`. It went looking under `/Users/hans`, then ran `rtk find ...` 4 times,
  got "Permission denied" each time, and #933's same-result rule stopped it correctly (evidence:
  `.bench-logs/system-one-poll-20260923-142010.log`). In the loop session, optiq wrote one shell
  `while true; do cat ready.txt; sleep 2; done` instead of repeated view calls. The guard never
  saw a repeat, and Copilot's own 600 s background-task timeout ended the session.
- **No OOM.** The 8-bit reproducer did not reproduce: the prompt cache held 0.31 GB, not 4 GB,
  and the ~60k prompt finished prefill. The server stayed up, so there was nothing to report.

What changed: a wrapper turns each session's work dir into a git root (so cplt and Copilot use
it), and the prompts give absolute paths. The loop session runs with
`--excluded-tools=bash --deny-tool=shell`, so the view tool is the only way to read the file.
For e, a `sitecustomize.py` sits on `PYTHONPATH` for `alpha local start` only. nav-pilot passes
its environment through to the server (`runtime.go`: `env := os.Environ()`). The patch makes
`mlx_lm.generate.BatchGenerator.next` raise `RuntimeError("[metal::malloc] injected Metal OOM")`
once a sentinel file exists. The shared venv is not touched. The small optiq model is used.

| | scenario | expected | observed | evidence | result |
|---|---|---|---|---|---|
| d | loop, bash excluded | blocked at 4 with "same result" | 4 turns, all `view(<abs>/ready.txt)`; "repeated the same tool call with the same result 4 times — view(...)", after 20 s | .bench-logs/system-one-loop-20260923-154930.log | pass |
| d | poll, absolute path | READY on call 7, no same-result block | 7 identical `bash` calls, output changed each time, READY on check 7, `task_complete`, no guard message, 27 s | .bench-logs/system-one-poll-20260923-154951.log | pass |
| e | injected generation-thread death | healthy completion; after the sentinel, one request kills the server within 30 s, and the last line of server.log is the status-70 marker; the next launch prints "generation thread died, most likely out of memory" within 60 s | healthy request ok; server pid gone 0.5 s after the faulting request; last line "nav-pilot: the server's thread Thread-1 (_generate) died, ... exiting with status 70" after the injected traceback; `nav-pilot --client copilot` printed "Launch failed: ... exited because its generation thread died, most likely out of memory" and exited after 2.0 s | .bench-logs/navpilot-rerun-fault-20260923-155023.server.log, .bench-logs/navpilot-rerun-fault-launch-20260923-155023.log | pass |

Notes:

- The failed launch in e exits with status **0**. It prints the right message, but a script
  wrapping nav-pilot cannot tell the failure from a success by exit code.
- In the poll session, no classifier calls were seen at runs 6–7 (`classifier_calls: []`). With
  #933 the same-result rule decides here, and the output changed on every call.
- Why the model types `rtk`: `~/.copilot/copilot-instructions.md` begins with
  `<!-- rtk-instructions v2 -->` and "Always prefix shell commands with `rtk`". Copilot loads that
  file into the system message as `<custom_instruction>` in every session, including both re-run
  sessions (`~/.copilot/session-state/df83f542-.../events.jsonl`,
  `cebbc28a-.../events.jsonl`). The model wrote the `rtk ...` commands itself; they appear in
  `toolRequests`. Separately, `~/.copilot/hooks/rtk-rewrite.json` registers a `preToolUse` hook,
  `rtk hook copilot`, which can rewrite shell commands too. Neither file was changed.

### 8-bit past ~40k on this tier

The first run's 8-bit prompt (`.bench-logs/navpilot-e2e-crash-20260923-143030.server.log`,
59,210 tokens, wired limit 36 GB) did not OOM, but prefill slowed down as the prompt grew.
Seconds per 2048-token chunk:

| prompt position | s / 2048 tokens |
|---|---|
| 4k–36k | 3.5–4.5 |
| 41k | 7.1 |
| 45k | 11.0 |
| 49k | 25.0 |
| 55k–59k | 25.5–30.3 |

That is about 6× slower from ~40k to 59k. The cause is memory pressure, not an OOM. The
remaining ~19k tokens took about 3 min of prefill, compared with about 35 s at the earlier rate.
Even when it does not crash, the 8-bit is not usable past ~40k tokens on this tier. That
supports #20 removing it.
