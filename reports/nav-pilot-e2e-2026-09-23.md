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
