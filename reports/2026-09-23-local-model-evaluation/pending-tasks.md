# Pending tasks

Written 2026-09-24. These are what's left of the 2026-09-23 evaluation that can't be done right now.
Each one needs the machine on mains power (GPU) and/or a normal network. The order below is the
suggested order.

## How to start tonight

Tasks 1–3 below are now one unattended run, `mise run night-run` (task 1, the download, is done
already). The queue, timeouts and failure handling are in [qwen38-tuning.md §6](qwen38-tuning.md#6-resume).

```sh
cd /Users/hans/mlx-workspace
# 1. plug in the charger
mise run night-preflight                 # every line PASS (a WARN is fine); fix any FAIL
nohup mise run night-run > .bench-logs/night.log 2>&1 &
```

In the morning, read `reports/2026-09-23-local-model-evaluation/night-2026-09-24.md`. It is
committed on a local branch `bench/night-results-<stamp>` (not pushed), together with tonight's
`bench/*.json`. `.bench-logs/night-<stamp>/steps.jsonl` has one line per step, with status
(OK / FAIL / TIMEOUT / SKIP), exit code, times and result file. To resume, run
`mise run night-run -- --from N`.

Before any GPU work (night-preflight checks all of this):

- Use a nav-pilot binary built from current `main` of navikt/copilot, which contains #931 to #937:
  `.bench-logs/bin/nav-pilot-main-f1507caa` (built at f1507caa, so it includes #934). night-run sets
  `BENCH_NAV_PILOT` to it. The rebuild command is in [qwen38-tuning.md §6](qwen38-tuning.md#6-resume).
  The older `nav-pilot-combined-915e27c6` ignores `MLX_PREFILL_STEP_SIZE`.
- Queue any manual jobs with `BENCH_WAIT=1`, and never edit a `.mise/tasks/*` bash script in place while an
  instance is running or waiting (bash reads scripts by byte offset).
- Keep the 36 GB wired limit (`iogpu.wired_limit_mb` = 36864) that fits 48 GB machines.

## 1. Finish the OptiQ-4bit download (network): done

Done 2026-09-24: `mlx-community/Qwen3.8-27B-OptiQ-4bit`, 5 shards, 20.3 GB, no `.incomplete` blobs
(`mise run night-preflight` checks it). A resume leaves the old partial `.incomplete` files behind
and starts new ones, so move the orphans out before retrying. Don't use `taskpolicy -b`: it throttles
the network as well, down to about 2 MB/s.

## 2. Qwen3.8 tuning sweep (GPU): night-run steps 1–5 and 11–15

Goal: confirm or replace the provisional parameters in PR navikt/mlx-workspace#20 (8-bit
32,768/4,096/2.25 GiB cache; 4-bit 65,536/8,192/8 GiB). Details and pass criteria are in
[qwen38-tuning.md](qwen38-tuning.md).

1. `bench-np-e2e` through nav-pilot, one run per profile:
   - `qwen3.8-27b-8bit-nopin-c32k` (full; 2.25 GiB cache)
   - `qwen3.8-27b-8bit-nopin-c40k-3g` (`--latency-only`)
   - `qwen3.8-27b-8bit-nopin-c48k` (`--latency-only`; its 30k point is already measured)
   - `qwen3.8-27b-4bit-c64k-8g` (full)
   - `qwen3.8-27b-optiq-4bit` (full; needs task 1)
2. **New since #936:** `MLX_PREFILL_STEP_SIZE` variants for the 8-bit (512 or 1024 at 40k/48k). A
   smaller prefill chunk shrinks the attention score transient, the part that caused the Metal OOM,
   and may make a larger context fit. The arithmetic and the two variant profiles (c40k-3g at 1024,
   c48k at 512 with a 3.25 GiB cache) are in [qwen38-tuning.md §4](qwen38-tuning.md#4-the-pruned-grid).
3. `bench-cheap-ops` for the winners: ×2 for the 8-bit and the 4-bit, ×3 for OptiQ-4bit.
4. Pass: no `Insufficient Memory`, peak footprint ≤ 41 GB with a warm cache at max context, and
   Copilot sessions verify ≥ 5/6.

## 3. Sampling (temperature) comparison (GPU): temp 0 is night-run steps 6–10

**Done for every manifest entry.** Optiq at temp 0 scored 17/30 against 28/40 at 0.6
(Fisher p = 0.32), and the Qwen3.8 8-bit 12/20 against 31/40 (p = 0.22). Temp 0 is not better
for either, so all three entries set `MLX_NAV_PILOT_TEMPERATURE = "0.6"` and
`MLX_NAV_PILOT_TOP_P = "0.95"`, matching what was measured (qwen38-tuning.md §9). The Qwen3.8
4-bit was not measured at temp 0; it gets the same setting by analogy.

Local models ran greedy (temp 0) until then: opencode sends no temperature, and Copilot CLI sends 0.
navikt/copilot#934 (merged 2026-09-24) lets the manifest set `MLX_NAV_PILOT_TEMPERATURE` /
`MLX_NAV_PILOT_TOP_P`, which the guard enforces.

- Compare temp 0 against 0.7 with top_p 0.8, on optiq and the tuned Qwen3.8 profiles:
  `bench-cheap-ops` ×3 per cell, comparing verified tasks and loop-guard trips.
- First cell, tonight: temp 0 (`-t0` profiles) against the existing 0.6 runs. Every cheap-ops score
  so far was measured at 0.6, the workspace server's `MLX_TEMP` default, not at the greedy 0 users get.
  The report gives Fisher p-values against optiq 28/40 and 8-bit nopin 31/40.
- `nav-pilot-main-f1507caa` includes #934.
- Afterwards, set the values in the manifest in a new PR. Done for all three entries.

## 4. Update the manifest with measured values (network, after 2–3)

#20 (provisional tuned params) and #21 (this evaluation) were merged on 2026-09-24. Open a new PR
that replaces the provisional Qwen3.8 params with the measured ones (and sets a temperature if
task 3 gives one). Merging publishes to every nav-pilot user.

## 5. Verify on real hardware (needs other machines)

Everything so far was measured on an M5 Max with 128 GB at a 36 GB wired limit. The tier list is in
[hardware-tier-backlog.md](hardware-tier-backlog.md). The most important checks:

- a real 48 GB machine, preferably a Pro chip: decode speed and memory pressure with an IDE and
  browser open
- 64 GB: whether the 8-bit can run at full context with a higher wired limit

## 6. Parked (decided not now)

- The oMLX MTP profiles (`Jundot/Qwen3.8-27B-oQ8e-mtp`) need a 96 GB wired limit. They're parked by
  decision (stay at 36 GB).
- Qwen3.8-Flash-Next 125B MoE (mlx-vlm, about 118 GB wired): 128 GB tier only.

## 7. Cleanup when finished

- The worktree `copilot-e2e` and its local branch `test/e2e-combined`: a test build, which can go
  once the sweep uses a binary from main.
- The local tag `archive/system-one-classifier` in the copilot repo: delete it once nobody needs
  the classifier code anymore.
- `~/.copilot/session-state/*/files/*-worktree`: git worktrees left by other agent sessions. #932
  stops them from inflating Copilot's context, but they still take up disk. It's the user's call.
- `~/.copilot/copilot-instructions.md` tells Copilot to prefix shell commands with `rtk`, which
  hides output in local cplt sessions ([decision.md](decision.md)). It's the user's call.

## 8. Follow-ups from the night of 24 September

Steps 1–4 of `night-run` are locked in ([qwen38-tuning.md](qwen38-tuning.md#night-24-sept-locked-in-so-far)).
The 8-bit entry moved to 48k / 4k / 3.25 GiB with a 512-token prefill step, and the 4-bit lost
"provisional". Still open:

- **Full e2e at 48k for the 8-bit.** Step 4 was `--latency-only`: no Copilot sessions ran at 48k.
  Put `bench-np-e2e` (full) with `qwen3.8-27b-8bit-nopin-c48k-ps512` at the front of the next night
  run. If it fails, the 8-bit goes back to 32k, which step 1 confirmed (37.28 GB, 10 of 10 launched
  sessions verified).
- ~~**Old nav-pilot clients and 48k.**~~ Done: manifest entries carry `min_nav_pilot`
  (navikt/copilot#943, released in `nav-pilot/2026.09.24-165412-524c840`;
  [navikt/mlx-workspace#30](https://github.com/navikt/mlx-workspace/pull/30)). The generator sets it
  from the `MIN_NAV_PILOT` table, so the 8-bit entry needs `2026.09.24-110317-3596754` (#936), and a
  client that reads the field hides the entry from an older binary and falls back to the default.
  Only params that are unsafe to ignore are gated; the sampling params and `capabilities` are not.
  Remaining gap: clients older than the release with #943 ignore the field, so they still prefill
  48k in 2048-token chunks (estimated 43.6–44.3 GB, qwen38-tuning.md §4). The expect text still
  tells them to update, and a schema-major bump stays the emergency brake.
- **Network blips.** Three Copilot launches failed because nav-pilot could not clone `nais/pilot`
  (two R2 in step 1, one M1 in step 2: "Could not resolve host: github.com" and a connect
  timeout). navikt/copilot is getting a PR that falls back to the cached source (in progress).
  Until then a blip costs a session, and the e2e verdicts count it as a path error.
- **The #939 loop hook inside cplt: unverified.** The hook keeps its state in
  `~/.nav-pilot/hook-state/`. Inside the cplt sandbox that directory may not be writable, and the
  hook fails open, so it would pass silently and do nothing. Also unverified: whether local sessions
  skip it, since that depends on what environment the hook process inherits. Tonight's M1 stop in
  step 2 came from nav-pilot's own local loop guard (8 identical `gradlew compileKotlin` calls with
  changing results), not from the hook.
- **rtk in Copilot's instructions.** The proposal to change `~/.copilot/copilot-instructions.md`
  (the `rtk` prefix hides output in local cplt sessions, §7) is still the user's call.
- **`~/.copilot/session-state` worktrees.** 27 GB in total, 6 `*-worktree` directories. The user
  deletes them.
- **Temperature and OptiQ-4bit.** Temperature is done for every entry (steps 6–10, task 3; the
  Qwen3.8 4-bit by analogy, not measured). ~~OptiQ-4bit decision~~ done: steps 5 and 11–15 met the
  rule (cheap-ops 18/30 against the plain 4-bit's 11/20, 0 timeouts against 4, 12 of 12 Copilot
  sessions), so the manifest's 4-bit slot serves `mlx-community/Qwen3.8-27B-OptiQ-4bit` under the
  key `qwen3.8-27b-optiq-4bit` ([qwen38-tuning.md §10](qwen38-tuning.md#10-optiq-4bit-replaces-the-plain-4-bit)).
  The 0.7 / top_p 0.8 cell of task 3 is still unrun.
- **Refresh capabilities after tonight.** `mise run bench-capabilities && mise run model-manifest`
  once both nights' JSON is on `main` (`bench/night-results-*` and `bench/night2-results-*` merged),
  and a PR if the verdicts move. Until then the OptiQ-4bit entry carries the unmeasured block
  (cloud for every class), and `manifest/capabilities.json` still lists the plain 4-bit.
- **opencode regression arm through nav-pilot.** Nothing re-measures delegate mode today: the
  one trusted cell (mechanical multi-file, 35/35) is from August, with Sonnet 4.6 and the old
  dispatch text, and #941 now generates a narrower text from the manifest. Before the next night
  run, one harness PR: a `BENCH_HYBRID_TAG` in `bench-hybrid`'s output stem (it would otherwise top
  up the August files), the policy file's sha256 and `opencode --version` in its preflight, and
  `_by_class.py` reading orchestrator, worker and policy hash from the file. Then a `hybrid` step
  kind in `night-run` and eight queue lines: rungs 3 and 6 on Ktor, rung 3 on frontend, rung 6 on
  Spring, both arms ×8, plus rungs 1, 2, 4 and 5 hybrid ×6. Pin `claude-sonnet-4.6` first, then
  repeat the four trusted-cell lines with the default GPT-6 Sol. Needs a nav-pilot binary at
  `7362715c` or later (the current `nav-pilot-main-f1507caa` predates #941). About 4 h and $13 per
  run. The exact steps are in [copilot mixed mode §3.2](../2026-09-24-copilot-mixed-mode/research.md#32-the-proposed-arm-hybrid-steps-in-the-night-run-driver).
- **Measure `nav-pilot alpha decide` on real hardware.** The command
  ([navikt/copilot#949](https://github.com/navikt/copilot/pull/949)) was built tonight against
  fake servers only, because the night run owned the GPU. In the daytime PoC or the next night run, measure: latency warm and cold (the first call
  after `alpha local start`, then repeats), whether a decide call evicts a concurrent agent
  session's prefix from the prompt cache (session TTFT before and after), and accuracy with
  `--eval` on 2–3 of our own questions, such as "is this commit message conventional?" (yes/no)
  and loop versus progress with the tool results as evidence, which is the case the loop
  classifier got wrong without them ([research](../2026-09-24-jev-like-features/research.md)).
- **Narrow `harness_sha` to what scores a run (after both night runs exit).** Today
  `_harness_sha()` in `bench-cheap-ops` hashes `_profiles.py` whole, so e5c34cd, which only added
  `MLX_NAV_PILOT_TEMPERATURE`/`TOP_P` to `OPTIONAL_DEFAULTS`, moved the sha from 492141135fe6 to
  f62fbb8cbeae and would have dropped every older run from the bar. `_by_class.py` now pools that
  pair through `EQUIVALENT_HARNESS`; the change below stops the next one. Meanwhile the profile
  TOMLs, which do reach a score, are not hashed at all (5e29c51 changed the 8-bit's cache and
  opencode context with no new generation). The change, in `bench-cheap-ops`:
  1. Drop `.mise/tasks/_profiles.py` from the tuple in `_harness_sha()`. What stays applies to every
     profile and decides the score: `bench-cheap-ops` (runner and `verify()`), `_sandbox.py`,
     `bench/tasks.json`, `bench/agents-prompt.md`.
  2. Stamp each per-task record with `profile_sha` next to `harness_sha`: the first 12 hex of
     sha256 over `json.dumps({k: v for k, v in P.params_for(profile).items() if not
     k.startswith("MLX_NAV_PILOT_")}, sort_keys=True)`.
  3. In `_by_class.py`, add `profile_sha` to the cheap-ops condition when present, so a changed
     profile splits its own row without resetting every other profile's generation.
  The first run after this is a new generation by construction. Map it onto 492141135fe6 in
  `EQUIVALENT_HARNESS` only after diffing the inputs, as was done for f62fbb8cbeae. Known history
  on the Ktor suite: 492141135fe6 (inputs as committed in a387e4b; stamped runs 23 Sept 08:39 to
  24 Sept 20:01), f62fbb8cbeae (e5c34cd; runs from 24 Sept 20:39), and 1b8ef6f69ba3 on one 18 Sept 8-bit file,
  which matches no commit (an uncommitted tree) and is older, so it never pools.
- **What tonight cannot answer.** Real 48 GB hardware and Pro chips (task 5), a cloud reference
  arm for the same tasks, and a rerun of the delegation benchmark.

### 8.1 Night 2 (queued for the night of 24–25 September)

`mise run night-run-2` starts on its own once `night-run` has exited and committed
(`.mise/tasks/night-chain`, log in `.bench-logs/night-chain.log`), from the main checkout, with
`nav-pilot-main-d24a65e5` (navikt/copilot main with #941, #942, #943 and #949). Report:
`night-2026-09-25.md`, committed on a local `bench/night2-results-*` branch. It covers these items
from the list above:

| # | Step | Timeout | Closes |
|---|---|---|---|
| 1 | `bench-np-e2e` full, `qwen3.8-27b-8bit-nopin-c48k-ps512` | 90 min | full e2e at 48k for the 8-bit |
| 2 | `alpha decide` on optiq (`np-serve` + `_decide.py`): cold and 20 warm calls, letter mass in top_logprobs, `--eval` on `bench/decide-cases/`, cache eviction | 30 min | measure `alpha decide` on real hardware |
| 3 | `bench-loop-hook`: one gpt-5-mini Copilot session through cplt, provoked loop | 15 min | the #939 loop hook inside cplt |
| 4–8 | `bench-models` cheap-ops ×5, `qwen3.6-35b-a3b-optiq` (temp 0.6, top_p 0.95) | 30 min each | read-qa and edit-single past n ≥ 5 for `bench-capabilities` |
| 9 | opencode hybrid arm, Sonnet 4.6 pinned, tag `np-d24a65e5-sonnet46`: the eight lines from [mixed mode §3.2](../2026-09-24-copilot-mixed-mode/research.md#32-the-proposed-arm-hybrid-steps-in-the-night-run-driver) | 4 h 30 min | opencode regression arm through nav-pilot |

Step 9 runs only if its harness gate passes at that moment (`bench-hybrid --self-check` with the
tag, the `_by_class.py` self-check, and a binary with #941); otherwise it is recorded as SKIP with
the reason. The three harness fixes are in the same PR: `BENCH_HYBRID_TAG` in the output stem, the
policy file's sha256 per hybrid sample plus `opencode --version` in the preflight, and
`_by_class.py` reading orchestrator, worker and policy from a tagged file. `bench-hybrid` also
honours `NAV_PILOT_CONFIG` now, so the run uses a scratch config (auto-update off, optiq as the
local model) and leaves `~/.nav-pilot/config.toml` alone. Expected about 6 h 15 min, worst case
9 h 15 min.

Still for the daytime, after night 2:

- **The mixed-mode PoC** ([research §4](../2026-09-24-copilot-mixed-mode/research.md#4-next-steps)
  items 1, 4 and 5): an extension that adds the local provider, tested against a recording
  server, no GPU. It decides between options 1 and 2, then `bench-copilot --arm mixed` and the
  comment on #4703.
- The GPT-6 Sol repeat of the four trusted-cell lines (the second orchestrator in §3.2).
- `mise run bench-capabilities && mise run model-manifest` once both nights' results are on `main`.
- Merging the two local result branches (`bench/night-results-*`, `bench/night2-results-*`).

### 8.2 After night 2: the limits of `alpha decide`

`mise run bench-decide-limits` runs `alpha decide` on 974 cases per model with labels from ground
truth: Norwegian against English, questions a regex cannot answer (does the message describe the
diff, does the diff change an exported Go signature, loop against progress when only noise
changes), 2 to 14 options, evidence up to 30k characters, option order, and prompt injection. It
runs on optiq, Qwen3.8 27B OptiQ-4bit and Qwen3-4B-Instruct-2507-4bit, for about 1 h of GPU time.
The cases and how their labels were built are in
[bench/decide-limits/README.md](../../bench/decide-limits/README.md).

Queue it only after night-run-2 has exited. The night drivers hold no lock between steps, so a
`BENCH_WAIT` job started earlier would take the lock between two of their steps. night-run-2 also
leaves the checkout on its local `bench/night2-results-*` branch, which was cut before this task
reached `main`. The line below waits for night-chain's closing line and for night-run-2's commit,
switches to an up-to-date `main` (and stops if the checkout is dirty or the pull is not a
fast-forward), then queues behind any lock:

```sh
cd /Users/hans/mlx-workspace && nohup bash -c 'until grep -q "=== night-run-2 exited" .bench-logs/night-chain.log; do sleep 60; done; while [ -e .git/index.lock ]; do sleep 5; done; git switch main && git pull --ff-only origin main && BENCH_WAIT=1 mise run bench-decide-limits' > .bench-logs/decide-limits.log 2>&1 &
```

Check it first with `mise run bench-decide-limits -- --dry-run`. The results are in
`bench/decide-limits-<model>-<stamp>.json` and `.md`, and `bench/decide-limits-<stamp>.md` compares
the models.
