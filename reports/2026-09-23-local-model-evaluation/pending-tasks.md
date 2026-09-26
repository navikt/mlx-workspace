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
mise run bench-netcheck -- --for ops,e2e # night-run-2: --for ops,e2e,hybrid; a FAIL names the firewall rule
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

## 8.3 Follow-ups from the night of 24–25 September

Found by the two night batches and decide-limits, and not yet acted on. Each line names where the evidence is.

- **The opencode hybrid arm has no data yet.** `api.githubcopilot.com` (and the individual/business/enterprise hosts) timed out from about 01:27 to 06:33, with DNS resolving and github.com reachable. cplt's proxy turned that into "Bad Gateway". All attempts failed within seconds, at no cost. Rerun with `mise run night-run-2 -- --from 9` once the API answers.
- **Short-cycle loops evade both loop guards.** In the verified cplt session (`bench/loop-hook-20260925-002708.json`), gpt-5-mini dodged the warning after about 22 calls by cycling `view_range` between three values. A period-≤3 cycle with identical normalised results should count as a loop in the local guard and in the hook.
- ~~**bench-cheap-ops scores a perfect debug fix as a failure.**~~ Done (branch `fix/bench-debug-scoring-and-e3`): the suite decides, as in the frontier runner, and `bench-cheap-ops --self-check` checks that an exact fix passes and an untouched bug fails. Smaller than feared: only `verify: "debug"` took that branch, which is X1–X3 on the frontend-debug target, not D1 (a read) or D3 (a new test). The one stored debug file (`results-qwen3.6-35b-a3b-optiq-debug.json`) changed a file in all three records, so none was scored by it and nothing needed re-scoring.
- ~~**Task E3 asks the model to log `personIdent` (a fødselsnummer) and passes on compile.**~~ Done (same branch): E3 left `bench/tasks.json` and is excluded from the bar in `task-classes.json` with the reason; its results stay as recorded. E3b logs how many tilfeller `getOppfolgingstilfeller` returns, and its verifier fails a diff that adds a line naming `personIdent` (`forbid_added`). edit-single rests on E1 alone until E3b has runs; no verdict moved.
- **`alpha decide` and the top-11 cap:** options at letters L–N scored 15/15 on optiq and 14/15 on Qwen3.8 (corrected 2026-09-26) (`bench/decide-limits-*-20260925-014512.md`), so the cap may not bind. Check the code and correct the help text if needed.
- **`alpha decide` guidance for the docs and the news draft (navikt/copilot#950):** use a threshold of at least 0.9; filter injection before decide reads untrusted tool output (Qwen3.8 flips 29–58% of correct answers on injected claims, optiq 4–33%); Qwen3-4B is not usable (overconfident: 74% right at p ≥ 0.99).
- **The `_decide.py` prefill counter reports 0 even for a cold call** (the eviction conclusion rests on TTFT instead). Fix the counter.
- **Silent model fallback on autostart:** a user whose `local_model` is no longer offered gets a warning from `alpha local init/start` but not from a launch that autostarts the server.
- ~~**Narrow `harness_sha` to scoring inputs and add a `profile_sha`**~~ Steps 1 and 2 done with the two fixes above: `_profiles.py` left the hash, and records carry `profile_sha`. The new generation d1229ad0e89f pools with 492141135fe6 in `EQUIVALENT_HARNESS` (the diff is in the entry's comment). Step 3, `profile_sha` in the `_by_class` condition, is not done: every stored run lacks the field, so the first stamped run would split from its own profile's history. Add it once each profile has stamped runs to pool.
- **Network preflight: `mise run bench-netcheck -- --for <kinds>`.** The firewall (Little Snitch) rules are per program, so it makes each program reach its hosts itself: curl (L1), then git, gh, opencode, curl inside `cplt` (the proxy connects as cplt), hf's python and java (L2), and with `--l3` one real session per cloud client path through nav-pilot and cplt (about $0.04). A failure names the likely cause, for example a per-app rule. Kinds: e2e, decide, hybrid, ops, frontier-local, frontier-cloud, download. `--json` for drivers, `--inventory` for the endpoint table. night-run-3 runs it in its preflight as a WARN. For night-run use `--for ops,e2e`, and for night-run-2 `--for ops,e2e,hybrid`. On 25 September at 07:10, after the firewall fix, the frontier-cloud, e2e and hybrid paths passed at L2 and L3. curl is still blocked from api.githubcopilot.com (on and off), models.dev and most Copilot, xet and Maven hosts, which is harmless because cplt, opencode and java get through. Still blocked for the program that needs them: `cas-server.xethub.hf.co` for hf's python (model downloads over xet fail), `telemetry.business.githubcopilot.com` and `mcp-registry.ekstern.dev.nav.no` for cplt (soft: a gpt-5-mini session still answered), and `opencode.ai` for cplt (soft).
- **Capabilities proposal for the maintainer:** refreshing `manifest/capabilities.json` with both nights adds a measured OptiQ-4bit block (local read-qa and edit-single move to not-yet; nothing becomes trusted; no existing verdict changes). Not published pending a decision.

## 8.4 Night 3: the quality frontier, scheduled for the night of 25–26 September

[Quality-frontier design](../2026-09-25-quality-frontier/design.md) §6.1, night 1. It is prepared and waits for 18:00:

- **Launcher:** `.bench-logs/bin/night3-launcher`, started 2026-09-25 06:55 with nohup, PID **18210**, log `.bench-logs/night3-launcher.log`. At 18:00 it waits for AC power and for a free queue (no `.bench-logs/.queue.lock`, nothing matching `night-run|bench-`), up to 2 h for each, then execs `.bench-logs/bin/night-run-3`. That copy is the driver from 8746f14, outside the checkout so a `git pull` cannot rewrite it. The steps' own scripts (`bench-frontier` and friends) run from the checkout, which was at fb204c9 when this was set up. Pulling a change to them before tonight changes `harness_sha` for the whole night, but a pull during the night splits it between steps.
- **Stop it** before 18:00 with `kill 18210`. After 18:00 the launcher has exec'd into the driver under the same PID, so `kill 18210` then stops the driver: its trap kills the current step's process tree and stops the server. Resume with `.bench-logs/bin/night-run-3 --from N`.
- **Pinned:** nav-pilot `.bench-logs/bin/nav-pilot-main-2e1e8ee1`, built from navikt/copilot main at 2e1e8ee6 (#953 and #954; `go version -m` shows `vcs.revision=2e1e8ee6…`, not modified). If a loop-detection fix lands before 18:00, rebuild and change `BENCH_NAV_PILOT` in the launcher: it is read at exec time.
- **Validated:** `mise run bench-frontier -- validate` passed on 2026-09-25 (baseline suite green, 51/65 valid, `bench/frontier/validated-17d0cf33d776.json`, left untracked in the checkout). The only rejected candidate was `db-r4-b5`, a debug mutant the suite does not catch. Rung 4 still has b4 and b6. The first attempt failed because all 32 System V shared-memory IDs (`kern.sysv.shmmni`) had been taken by segments that killed embedded-Postgres runs left behind. Removing them fixed it, and the driver now purges orphans itself (#48).
- **Cloud arm:** Copilot has retired `claude-sonnet-4.6` (the API's `/models` lists only claude-sonnet-5, opus-4.8, opus-5 and opus-5.5), so the reference is now **`claude-sonnet-5`**, with the $80 cap unchanged. The $53 estimate was made with Sonnet 4.6 prices. Before each cloud step, and every 15 minutes during one, the driver runs a tiny real session through the same nav-pilot, opencode-in-cplt path and model. If that fails, the step is skipped (or killed as UNREACHABLE), and the log names the error. The local part is not affected. Resume with `--part cloud --from N`. The firewall rules are per program, so a curl probe is not enough: the gap from 01:27 to 06:33 in 8.3 was the local firewall, not a GitHub outage.
- **Network check before the launch:** `.bench-logs/bin/night3-netcheck` (nohup, outside the checkout, with its own copy of `bench-netcheck`) runs `bench-netcheck --for frontier-local,frontier-cloud` at 17:45. It appends PASS or the failing rows, each with its cause, to `.bench-logs/night3-launcher.log`, and writes the full table to `.bench-logs/night3-netcheck-<HHMM>.log`. It changes nothing. The driver's real-session cloud gate still decides whether the cloud steps run. It exits long before 18:00, because the launcher's busy check matches `bench-` in any command line. Stop it with the PID on its log line.
- **Local steps and the network:** every Gradle call in the frontier runner is `--offline` (the cache is warm, since validate used the same commands), the workspace clone is at its pinned commit (so `ensure_clone` does not fetch), and the model loads from the Hugging Face cache. The one remaining exposure is opencode's refresh of the models.dev catalog, which falls back to its cache.
- **Expected:** GPU part ~7.7 h (validation is already done, so step 1 skips), cloud part ~5.6 h after that, with the finish around 07:30. The worst case, where every watchdog fires, runs to about noon. The report goes to `reports/2026-09-25-quality-frontier/night-1.md`, committed on a local branch `bench/night3-results-<stamp>`.

## 8.5 `alpha decide`: measure the recipe examples, and make `--eval` keep its results

Parked on 25 September (not now). The recipe page for sharing internally has 10 examples, and only the commit-message question has been measured ([`commit-explains-why-results.md`](../../bench/decide-cases/commit-explains-why-results.md)). Each of the others needs a labelled case set and an `--eval` run on optiq and Qwen3.8 before the docs recommend it:

- **Issue labels and bug/feature/question.** Free ground truth: navikt repos with labels applied by people. Cheapest to do first.
- **Does the PR description explain the motivation.** Label about 50 merged navikt PRs by hand, and add controlled negatives the same way as the commit set.
- **Logging of personal data in a diff.** Synthetic controlled cases (the same diff with and without an fnr or name in the log call). Never use real personal data.
- **Log failure cause and whether a dependency is down.** Needs labelled incident logs, so it's the hardest. Ask a team for postmortems with logs.
- **Local or cloud routing.** Needs an outcome label (did the local model finish the task?), which the nopin/frontier runs already have per task.

`--eval` today (`cli/nav-pilot/internal/cli/alpha_decide.go`, runDecideEval): it reads the whole JSONL into memory, runs the cases one at a time, and prints only totals (accuracy, confusion, mean p, p50/p95). It writes nothing per case. The first failed case aborts the run with exit 2, and everything up to then is lost. The help text promises "calibration", but it only prints the mean p for right and wrong answers. The per-case tables and the threshold sweep in the bench come from `_decide_limits.py`, not from the CLI. Proposal: `--out results.jsonl` (one line per case: expect, choice, p, ms, error), keep going past errors and count them, and a threshold sweep for `--expect` (caught and wrongly flagged at 0.5/0.7/0.8/0.9), so a team can choose a threshold without our harness.

## 8.6 Kev 4B and Laya (MLX): plan

Two open decision models that answer the same typed questions as Jev ([Jev research](../2026-09-24-jev-like-features/research.md)). Neither of them generates a letter token, so neither can run through `alpha decide` and the mlx-lm server: each one returns a probability per option from its own head. Nothing is downloaded yet.

- **Kev 4B** ([jaredpalmer/kev-4b](https://huggingface.co/jaredpalmer/kev-4b), code at [jaredpalmer/kev](https://github.com/jaredpalmer/kev), Apache-2.0). A rank-16 LoRA adapter plus a pointer head (`head.pt`, with a fitted temperature) on `Qwen/Qwen3.5-4B-Base`, English only. The model serves TypeSafe's `POST /v1/systemone` through `python -m kev.serve` (torch, transformers ≥ 5.17 and peft; the Kev README says it picks an mlx-lm backend on Apple Silicon by itself). Options per question are 1 to 255. Mac numbers come from the Kev README, not from Opper: 721 ms on new text and 136 ms on cached text for Kev-4B on a 32 GB M5. The HF card says 0.78 s for five questions in bf16 on an M5, because the DeltaNet layers have no MPS kernels. Opper's post ([blog](https://opper.ai/blog/jev-vs-kev-open-decision-model), [code](https://github.com/opper-ai/jev-vs-kev)) only measured the hosted endpoint: 95.0 / 98.3 / 93.9 % on arXiv, Stack Exchange and GitHub bug-or-feature (n = 160 / 120 / 82), about 220 ms from Stockholm, and they warn that differences under 5 points are noise. Kev was trained on short states and misses detail deep in long documents.
- **Laya** ([convaiinnovations/laya](https://huggingface.co/convaiinnovations/laya), Apache-2.0) is a bidirectional encoder with a decision head: 421M (ModernBERT-large, 512 tokens, English) and a 322M multilingual variant (mmBERT-base, 1,024 tokens). The MLX port is [mizorewww/laya-mlx](https://github.com/mizorewww/laya-mlx) (`pip install laya-mlx`, mlx 0.32.x, no torch). It runs as a Python API or CLI with no HTTP server, and its question types are `choice`, `score` and `noul` (yes/no). Port numbers, measured on an M3 Max in FP16: 13.42 ms p50 for 421M and 7.39 ms for 322M, with peak memory 944 and 688 MiB. Upstream's own comparison with Jev, 0.766 against 0.727 on typed-decisions, was made by Laya's own authors. Laya is weak on many labels (Banking77: 0.425 against 0.870) and on `score`.

**Sizes** (HF metadata, 2026-09-26; free disk 1.1 TiB, so disk is not the limit):

| Download | Size |
|---|---|
| `jaredpalmer/kev-4b` (adapter, head, tokenizer) | 0.16 GB |
| `Qwen/Qwen3.5-4B-Base` (bf16, needed to merge the adapter) | 9.3 GB |
| or [`RoderickQiu/kev-4b-mlx-8bit`](https://huggingface.co/RoderickQiu/kev-4b-mlx-8bit) (merged, 8-bit, unofficial) | 4.5 GB, plus the 0.16 GB above for the head |
| `aac6fef/laya-multilingual-mlx` (FP16) | 0.68 GB |
| `aac6fef/laya-mlx` (English, FP16) | 0.85 GB |

Take the 8-bit Kev: its README reports the same answer on 119/119 pages as bf16, with probabilities within 0.012–0.053. The GGUF ([mys/kev-4b-GGUF](https://huggingface.co/mys/kev-4b-GGUF)) and ONNX ports don't come with the pointer head, and llama.cpp could not use it anyway, so they are ruled out (not verified further).

**Harness.** A `MODELS` entry with `profile: None` is not enough: that entry only helps a model that mlx-lm serves as a chat model. Instead, add one small adapter, `.mise/tasks/_decide_s1.py`. It reads the same JSONL (`{question, options, evidence, expect}`) and maps each case to `{state: evidence, questions: {q: {type: "choice", instructions: question, criteria: options}}}`. It takes the argmax and p from the returned distribution and writes the same per-case JSON as `_decide_limits`, reusing its `wilson`/`pct`/`cell`, so the existing summaries can compare the models. There are two backends. Kev goes over HTTP to `kev.serve` on a local port (the port is an assumption: the Kev docs use both 8008 and 8009), and Laya runs in-process through `laya_mlx.load(...).predict`. Install each in its own `uv` venv under `.bench-logs/`, not in the repo's environment, because the mlx pins differ. Record the checkpoint revision and the served temperature with each run. Kev's default temperature is calibrated; `KEV_TEMPERATURE=1.0` gives raw values.

**Sets.** Run commit-explains-why EN (48) and NO (48), issue-type (105), aksel-kind (65), pr-motivation (48), and all nine `bench/decide-limits/` sets (974 cases). Expect these results before reading them:

- Kev is English-only, so `why-no` and `lang-no` measure how it degrades, not what it can do.
- Laya should use `laya-multilingual-mlx` for the Norwegian sets. Upstream publishes no Norwegian numbers.
- Both context windows are far below our 30k-character evidence. `length` and the long issue and PR bodies get truncated, so report truncation per case.
- `options` (up to 14) is where Laya is known to be weak.
- `injection` is a direct comparison with optiq and Qwen3.8 (§8.3).

At the published latencies, a whole pass takes minutes: Laya well under 1 min of compute, Kev around 15 min uncached.

**GO/NO-GO before any download**

1. The user has approved the download explicitly, per repo: about 4.7 GB for Kev (8-bit plus the head) and 0.7–1.5 GB for Laya.
2. The Mac is not tethered to a phone hotspot. The repo has no tether check today: `bench-netcheck` tests reachability only. Check by hand that `route get default` names Wi-Fi or Ethernet and not an iPhone USB or Bluetooth interface, and that `ipconfig getsummary en0` shows the usual SSID.
3. `mise run bench-netcheck -- --for download` passes. Its hf rows show whether Little Snitch allows python/hf_xet → `cas-server.xethub.hf.co`, which is blocked today. Either add a time-limited allow rule, or download with `HF_HUB_DISABLE_XET=1` so the files come over `cdn-lfs.hf.co` / `cas-bridge.xethub.hf.co`. Check which of the two works on one small file (such as `README.md`) first.
4. Get the token from fnox without ever printing it: `fnox exec -- env HF_HUB_DISABLE_XET=1 hf download <repo>`. Never use `echo $(fnox get HF_TOKEN)`, and never put it on a command line.
5. The GPU queue is free (no `.bench-logs/.queue.lock`) and the Mac is on AC power (`_decide_sets.on_battery`). Queue the run with `BENCH_WAIT=1`.
6. The adapter passes a dry run against five cases per set before the full pass.

NO-GO if any of steps 1–4 fails. Steps 5 and 6 only delay the run.

**Status 2026-09-26: downloaded, waiting for the uv cooldown until about 2026-09-29.**

- Downloaded 16:47–16:52 on AC over Wi-Fi (en0, 192.168.x), after `bench-netcheck --for download` passed, through `fnox exec -- env HF_HUB_DISABLE_XET=1 hf download`. Every LFS blob's sha256 matches its name, 5.8 GB in total: `RoderickQiu/kev-4b-mlx-8bit`@e1c35947 (4.2 GB), `jaredpalmer/kev-4b`@139fdd94 (0.16 GB), `aac6fef/laya-mlx`@20aed815 (0.81 GB) and `aac6fef/laya-multilingual-mlx`@f2b4faf5 (0.66 GB). The 8-bit `model.safetensors` also matches its `provenance.json` (sha256 59f136a6…, 4,469,640,165 bytes).
- **The 8-bit Kev is not today's Kev.** It was merged from `jaredpalmer/kev-4b`@485ace87 with Kev's code at 08ab0b87, not from the current main 139fdd94, and its `head.pt` differs (sha256 d8f796da… against dd633435…). Run it with the 8-bit repo's own `head.pt` and tokenizer, and record 485ace87 as the Kev revision. The current main's head does not match the merged weights.
- **Blocked by the 7-day uv cooldown** (`exclude-newer = "7 days"` in `~/.config/uv/uv.toml`). `laya-mlx` 0.2.0, the only version, was published 2026-09-22T06:02Z. Kev's code at 08ab0b87 is dated 2026-09-22 and is not on PyPI, so uv never checks it, but it waits under the same policy. Install neither before about 2026-09-29.
- **Run Kev in-process**, with no HTTP server: `kev.mlx_model.MLXDecisionModel`, `kev.api.to_record`/`to_answers`. It needs `mlx-lm>=0.31.3,<0.32`, `torch<2.9` (for `head.pt` and the pointer head), `transformers>=5.17` and pydantic. Kev trains on 384 state tokens and serving truncates silently at 8,192 (`state_truncated`), so report both counts.
- **uv lesson.** The mise environment exports `VIRTUAL_ENV=<repo>/.venv`, and it wins over a `VIRTUAL_ENV=` prefix on `uv pip install`. On 2026-09-26 that put Kev's dependencies into the main `.venv`, which downgraded mlx-lm from the omlx pin. Always install into a model venv with `env -u VIRTUAL_ENV uv pip install --python .bench-logs/venv-<name>/bin/python …`, and check the "Using Python … environment at" line.

## 8.7 After night 3 (quality frontier, night 1), 2026-09-26

- **Done:** the local part ran 16:53–20:12 on 25 September. The first cloud arm was invalid because cplt scoped every session to the repo root (fixed in #57; results kept under `.bench-logs/night3-20260925-165202/invalid-cloud/`, not in `bench/`). The cloud arm was rerun 08:08–09:53 on 26 September. Total cloud spend: $34.71 of $80. Report: [night-1.md](../2026-09-25-quality-frontier/night-1.md).
- **Replicate `retry2`:** it moved the open frontier on three classes (edit-multi-mechanical 3 → 5, edit-single 0 → 2, create-file 0 → 1), but only with n = 4 per rung. Design §7 needs a second night with n ≥ 8 per arm and a one-sided Fisher p < 0.1 before it becomes a default.
- **Explain read-qa (done):** [read-qa-analysis.md](../2026-09-25-quality-frontier/read-qa-analysis.md). The verifier is right and the gap is a model limit on a stricter task. 16 of optiq's 22 failures list only one extra file, the one that defines the function, against the prompt's "count the defining file only if it also calls the function". 3 more add a misspelt name, and 3 end without an ANSWER line. Cheap-ops R3 only checks that one file name appears, and that file is the defining one. Next: run read-qa under the existing `example` variant, which says "drop the line that defines it" (one queue line, no harness change). Tagging defining-file extras in `verify_answer_set` touches `_frontier.py` and the tasks file (`harness_sha`), so it is held until after the 64 GB nights.
- **"classifier on/off" label (done):** only the System One build `nav-pilot-e72319e0` reads `NAV_PILOT_LOOP_CLASSIFIER`. Every main build since 24 September ignores it, so under those builds the two halves were two passes of one condition. `bench-np-e2e` now runs `classifier-on`/`classifier-off` only when the binary reads the switch and `pass-1`/`pass-2` otherwise, and stores that as `np_pass` on each row (not `arm`: bench-copilot already writes `arm = "local"`). `_night_report` reads old rows too: `classifier on/off` under e72319e0, `pass 1/2` under anything else. The classifier false-positive verdict is only computed for classifier passes. `bench-np-e2e` is not a `harness_sha` input.
- **`/usr/sbin` tools by absolute path (done):** `night-run`, `night-run-2`, `night-preflight`, `bench-np-e2e`, `bench-navpilot-e2e` and `vram-reset` called `lsof` or `sysctl` by name. `pmset` lives in `/usr/bin` and needs no change, and `bench-night` puts `/usr/sbin` on its own PATH. None of the running copies in `.bench-logs/bin` calls a `/usr/sbin` tool by name. But night 64-1's `e2e` steps run `mise run bench-np-e2e` from the main checkout, which still has the bare `sysctl`, and the chain's PATH has no `/usr/sbin`.
- **Preflight now catches a stray `.git`/`.git2` in a workspace (done):** on the night of 25 September, `workspaces/qwen3.6-35b-a3b-optiq/` held empty `.git` and `.git2` directories a model created during a benchmark; `bench-frontier`'s per-step `assert_workspace_is_clean` (borrowed from `bench-cheap-ops`) refused every step in 2 seconds, but neither `night-preflight` nor `night-run-3`'s own `preflight()` checked for it, so the night "passed" preflight and then failed at step 1. Both now call the shared `_night_workspace_clean.check(key)` (new, `.mise/tasks/_night_workspace_clean.py`), which execs the real `assert_workspace_is_clean` out of `bench-cheap-ops` via the same AST-extraction `bench-frontier`'s `harness()` uses, so the rule can't drift out of sync; FAIL names the stray paths and an `rm -rf`, nothing is deleted automatically. Covered by a new case in `night-run-3-selftest`.

## 8.8 The 64 GB tier: a worker directed by a cloud orchestrator (downloaded, profiles in place)

Plan: [2026-09-26-64gb-tier/plan.md](../2026-09-26-64gb-tier/plan.md). The question is which
64 GB model saves the most cloud credits as a directed worker at the same end-to-end pass rate
as cloud-only. The 64 GB fit rows in [hardware-tier-backlog.md](hardware-tier-backlog.md) stay
where they are, and night 64-4 runs them.

- **Shortlist:** Qwen3.8-27B 8-bit at 64k (cached), Qwen3.6-35B-A3B 8-bit, Occamy-1.0 MLX-4bit, Laguna XS 2.1 8-bit. Reserve: Qwen3-Coder-Next mxfp4.
- **Downloads:** 92.7 GB, inside the user's pre-approved 100 GB (plan §6), on AC power and an untethered network, never while a GPU run holds the queue lock. Test xet on one small file first and fall back to `HF_HUB_DISABLE_XET=1`; get the token only through `fnox exec`.
- **Before night 64-1 (a daytime PR):**
  - profiles at 48 GB wired with `machine_min_ram_gb = 64`
  - a frontier queue file for the `decompose` and `retry2` variants
  - a hybrid block with a Sonnet 5 orchestrator
  - the orchestrator-rework count in `bench-hybrid` (plan §5.2)
- **Nights:**
  - 64-1: fit and smoke
  - 64-2: the directed-worker frontier
  - 64-3: the hybrid arm, which re-baselines optiq under Sonnet 5 first
  - 64-4: np-e2e, decide and the backlog's fit rows
  - 64-5: replication
  - All five run after the `retry2` replication night.
- **Day D, 2026-09-26 (done):**
  - Downloaded 92.8 GB in 62 min over plain HTTPS (`HF_HUB_DISABLE_XET=1`): Occamy 19.53 GB, Qwen3.6-35B-A3B 8-bit 37.75 GB, Laguna XS 2.1 8-bit 35.54 GB. File count and sizes match the HF listing, every shard in each safetensors index is present, `model_type` is `qwen3_5_moe`, `qwen3_5_moe` and `laguna`, and Occamy's `SHA256SUMS` passes. The xet test on a 20 MB file succeeded, but the hub's shared blob store may have served it without contacting the xet server, so it does not show that xet works.
  - Profiles `*-64g` (48 wired) and `*-64g-w52` (52 wired, the plan's profile for the Qwen3.6 8-bit and Laguna). There is also `qwen3.6-35b-a3b-optiq-64g` as the control.
  - Queues `night-64-1.queue` and `night-64-2.queue` next to the plan. `night-run-3 --queue` takes a profile per step and has `e2e` and `ops` kinds.
  - The rework count is in `bench-hybrid` (#63).
  - Still to do: the 64-3 hybrid block, and trimming 64-2 (about 13 h with all five) after 64-1.
- **Blocked for Laguna:** nav-pilot's mlx-lm 0.31.3 has no `laguna`, so Laguna cannot enter np-e2e or the hybrid arm until nav-pilot's runtime moves.
- **Occamy is measurable through nav-pilot (2026-09-26):** navikt/copilot #989's bench-only override (`NAV_PILOT_BENCH_MANIFEST`, `NAV_PILOT_BENCH_ALLOW_ORGS`) lets np-e2e, decide and the hybrid arm run Occamy on nav-pilot's own server. The bench tasks use it when the binary has #989 and keep the old cache rewrite otherwise. It needs `BENCH_NAV_PILOT=/Users/hans/mlx-workspace/.bench-logs/bin/nav-pilot-main-dd859ac6` or newer; `nav-pilot-main-2e1e8ee1` (nights 4 and 64-1) still falls back to optiq, as on day 64-0. Steps that need it: an Occamy `e2e` retry, 64-3's hybrid arm with Occamy, 64-4's np-e2e and decide sets (plan §5.3). Shipping Occamy still needs an `ALLOWED_ORGS` decision, or a build in an allowed org.

## 8.9 Decide as a service: measure first

Research: [2026-09-26-decide-as-a-service/research.md](../2026-09-26-decide-as-a-service/research.md).
Nothing is decided; these are the measurements to take before choosing between a CPU encoder and
1+1 G4 GPUs with vLLM.

1. Kev 4B and Laya accuracy on our sets, Norwegian and injection included (§8.6).
2. vLLM against mlx-lm logprob parity on the same model: argmax agreement, calibration bands, top-11 coverage.
3. A G4 load test: p50/p95 at 2k and 8k tokens, 5–20 req/s, prefix caching on the hybrid DeltaNet model.
4. Injection robustness under the served quantization (FP8), not MLX 4-bit.
5. Real volumes: commits and PRs per day across navikt, and candidate runtime flows.

## 8.10 A PRD for a hosted `alpha decide`, once the data is in

Asked for on 26 September: a product requirements document and value proposition for a hosted `nav-pilot alpha decide` service, written once measured demand and quality replace the assumptions in [the hosting research](../2026-09-26-decide-as-a-service/research.md). The gates:

1. **Demand, from telemetry** (#961, `nav_pilot_decide_*`): 2–4 weeks of data on unique devices, calls per day, the caller split (tty, hook, script), latency by evidence size, and the p_choice distribution.
2. **A small model's quality** (§8.6): Kev and Laya on our case sets, including Norwegian and injection. This decides whether a CPU service is viable.
3. **Serving parity and cost** (§8.9): vLLM against mlx logprob parity on the same prompts, and a load test on one G4 in europe-north1.
4. **Volume and owners:** commits and PRs per day at NAV, and one or two runtime flows with a named owning team.

The PRD will cover the problem and users, the jobs `decide` does, value against local-only and against a Jev-style SaaS, the options and cost, privacy (DPIA, prompt logging, cache isolation), success metrics, and the rollout.
