# Benchmarking

How this workspace measures local models. Read it before running anything, and before trusting a
number someone else produced. Results land in `bench/results-<key>.json`, `bench/weather-<key>.json`
and `bench/cache-<key>.json`, tracked in git as the evidence behind `MODELS.md`; transcripts go to
`.bench-logs/`, untracked. Runs are moved, never deleted: anything excluded from medians and from
MODELS.md tables goes to `bench/quarantine/` under a suffix naming the condition it is evidence for,
listed there. Do not edit `bench/specs/weather-cli.md` or `bench/specs/cheap-ops.md` once a model has been
measured against one: every recorded number assumes the version in the workspace at the time.

## The three benchmarks

**cheap-ops** is the shape we intend to route locally: eleven short operations inside
`navikt/isoppfolgingstilfelle`, a real Kotlin service the model did not write. Read-only questions,
single-file edits, multi-file edits, generated tests. `bench/tasks.json` pins prompts, files,
symbols and verification mode.

**weather-cli** builds a Node CLI from scratch against `bench/specs/weather-cli.md`: argument parsing,
Geonorge geocoding, the Met.no forecast API, output formatting, five named test files. It is harder
than anything we would route locally, and stays because a model that wins it can lose on routine
edits in code it did not write.

**cache-probe** measures prompt cache reuse across turns sharing a growing prefix. mlx-lm issue #980
reports that cache falling back to full recompute for the Qwen3.5 family, our chosen model's
architecture, and an agent re-sends 6 to 15k tokens per tool call, so if it held here it would be
most of our wall clock. It does not: every model measured returns 99.3 to 99.5% hit rates. Run it
for every model, because the failure is silent and would be blamed on the model.

## Running cheap-ops

```bash
mise run model-use qwen3.6-35b-a3b   # writes profile params into mise.local.toml
mise run vram-set <gb>               # only if model-use warns the wired limit is wrong
mise run server                      # in a second terminal
mise run server-wait                 # blocks until the model answers, not just until the port binds
mise run bench-cheap-ops             # all tasks
mise run bench-cheap-ops M1 D2       # named tasks only
```

It clones the target repo into `workspaces/<key>/kotlin/` on first run and writes results after
every task, so an interrupted run keeps what it measured.

| Variable | Default | Effect |
|---|---|---|
| `MLX_ACTIVE_PROFILE` | none, required | Profile key, set by `model-use`. Every benchmark exits without it |
| `BENCH_TASK_TIMEOUT` | `420` | Per-task cap in seconds, recording a failure instead of losing a run. Task E3 once looped 77 identical tool calls twice and burned two 90-minute budgets |
| `BENCH_RESTART_SERVER` | `1` | Restart the server before each task. Any other value skips it |
| `BENCH_WEATHER_TIMEOUT` | `5400` | Per-phase cap for `bench-weather-cli`, in seconds |
| `BENCH_KEEP_WORKSPACE` | unset | `1` stops `bench-weather-cli` clearing the workspace first |
| `MLX_SERVER_PORT` | `8080` | Inference port, also the port opened through the sandbox |
| `MLX_SERVER_WAIT_SECONDS` | `900` | How long `server-wait` waits for a bind plus a first token |

A single prompt takes the same path: `mise run opencode-headless "<prompt>"`. Everything after the
task name goes to `opencode run`, so `--continue`, `--session`, `--model` and `--agent` work, and
every invocation logs JSONL events to `.bench-logs/<key>-<timestamp>.jsonl`.

## Running weather-cli and cache-probe

```bash
mise run bench-weather-cli   # clears the workspace, restarts the server, sends both prompts
mise run cache-probe         # 4 turns; pass a number for more
```

`bench-weather-cli` sends both prompts in one session so the implementation turn sees the plan
turn's output. They are hardcoded and match the "Standard benchmark prompts" section of `MODELS.md`
verbatim; changing either invalidates comparison with earlier runs. It runs `npm install` and
`npm test` itself, reading counts from node:test, jest or mocha output. The test result is not the
grade: score the code against the rubric in `MODELS.md`. To drive it by hand, run
`mise run workspace-clear` then `mise run opencode`; both tasks provision the spec into
`workspaces/<key>/weather-cli/` and copy the current `AGENTS.md` into the workspace root on every
launch, so rule edits at the repo root reach the model.

`cache-probe` needs a running server. It reads `usage.prompt_tokens_details.cached_tokens` per reply
and writes `bench/cache-<key>.json`. Its verdict is mechanical: "reuses the cache" when the last
turn takes under 0.6 times the first, "no reuse, and it got slower" when over 1.1 times, otherwise
"no useful reuse". Read turn 0 against the last turn, not the hit percentages alone.

## The tasks

`mise tasks` lists them all with descriptions. The ones that matter:

| Task | Does |
|---|---|
| `bench-cheap-ops` | The capability ladder: eleven tasks against one target, per model |
| `bench-hybrid` | The cost ladder: a cloud orchestrator dispatching to the local model, against a dispatch-disabled control |
| `bench-copilot` | The same question for the Copilot CLI, where the whole session runs locally |
| `bench-refactor` | Three strategies over one rename, with a differential quality measure |
| `bench-queue` | A day of unattended runs in priority order, writing results as it goes |
| `bench-validate-target` | Proves a target is measurable **before** GPU time is spent: baseline green, every break unique and every break actually failing |
| `secrets` | Scans the whole history for committed credentials |
| `model-use`, `model-status`, `vram-set` | Switch model, check the server, raise the wired-memory limit |

Two of these exist because of specific failures. `bench-validate-target` exists because a
suite that was red for an unrelated reason scored a model 0 of 8, and `secrets` because this
repo has committed a credential before.

## Verification rules

Each rule exists because its absence produced a wrong number.

**An edit task that changed no files fails.** `changed_files()` runs `git status --porcelain` and
fails before any Gradle work for `compile`, `test` and `rename` tasks. An untouched checkout
compiles and its suite passes, so those checks alone certify the repository, not the model, and
Granite scored four false passes this way.

**The model does not verify itself.** One submission reported "20/20 passing" with eight assertions
inside a catch block that swallowed them. `compile` runs `./gradlew compileKotlin`, `test` runs
`./gradlew test`, and `rename` greps `src` for the old symbol first, so a rename leaving references
behind fails even when the project builds. Both Gradle targets run `--offline` with `JAVA_HOME` set
to the JDK path in `bench/tasks.json`, because the project pins `jvmToolchain(21)`.

**The workspace is clean before every task.** `reset_repo()` runs `git reset --hard` plus
`git clean -qfd`, keeping only `build` and `.gradle`; two of three workspaces in an earlier round
held a previous run's code. `mise run workspace-clear` is the weather-cli equivalent.

**The server restarts before every task.** It degrades across a long session: after some number of
tasks the model stops calling tools entirely, and one task that produced 0 turns and 0 tool calls
passed with 6 turns and 9 tool calls after nothing changed but a restart. `restart_server()` stops
it, relaunches it detached, then blocks on `server-wait`, which sends a real completion request
rather than checking the socket, because mlx-lm loads weights lazily and starting on bind alone
charges loading to thinking time. It retries three times: a server launched before the previous one
released the port dies on the bind.

**AGENTS.md is checked before every launch.** `check_prompt()` in `.mise/tasks/_sandbox.py` refuses
to start when the last think-start in `AGENTS.md` comes after the last think-end. mlx_lm picks the
initial generation state by scanning the rendered prompt for exactly that (`server.py:568-574`), so
an unclosed tag sends every model's output to the reasoning field, where opencode discards it. Our
own rules 6 and 7 did this and cost two models and most of a day, so describe reasoning blocks in
words and never write the tags. The warning lives here because `AGENTS.md` is itself a prompt.
Issue #10.

**The client brings its own prompt, so it runs `--pure` with its own config home.** opencode reads
`~/.config/opencode`, which carried an exported AGENTS.md and 38 global skills, 32,754 characters on
the wire the benchmark never chose. `bench_env()` points `XDG_CONFIG_HOME` at
`bench/opencode-home/`; numbers measured before that are quarantined. Issue #12.

**Everything runs sandboxed under cplt.** Client launches go through `cplt_argv()` in `_sandbox.py`,
so interactive and headless runs cannot drift apart. The sandbox confines the model to
`workspaces/<key>/`, opens localhost only on the inference port, and grants opencode write access to
its own state directories plus read access to the repo-root `opencode.json`. One model walked out
with an absolute path and listed every other model's finished solution. Without `cplt` a run
continues unsandboxed with a warning.

## Machine state

The machine is part of the measurement, and these four are done by hand around a run.

- **Nothing else touches disk or network.** Every task restarts the server, which re-reads the
  weights, so a concurrent download competes for the same disk: Qwen3.8-27B timed out on four of
  eight tasks during a run overlapping a 22 GB download, its input tokens per task halved. Run
  `mise run model-download <key>` before the run, never during it.
- **Record machine state before and after every run**, with `sysctl vm.swapusage` and `vm_stat`.
  Swap at 15 of 16 GB with six orphaned clients once made three tasks twelve times slower than an
  hour earlier; without the state log that looked like a model result, and was reported as one.
- **Kill the client when a task times out.** `subprocess` kills `mise run`, not the process it
  launched, so the timeout path also runs `pkill -f "opencode --pure"` and
  `pkill -f "cplt --agent opencode"`. Six orphans accumulated over one day of killed runs, each
  holding session state, and the machine ended up in swap.
- **A failed model switch must abort.** Results are keyed by whatever profile is active, so a
  refused `model-use` merges into the previous model's file, which cost three tasks of a finished
  run. Queue scripts use `mise run model-use <key> || exit 1`, and the runner backs up an existing
  results file to `bench/.previous/` first.

## Loop detection

A looping model and a merely slow one produce the same wall clock, and the difference is the whole
verdict. `loop_check()` reads the task's JSONL log, pairs each `tool_use` event as (tool name,
arguments), and counts the longest run of identical consecutive calls. Five or more sets `looped_on`
and prints a LOOP warning; shorter runs are recorded but not flagged. Qwen3.8-27B-4bit ran the same
`rg` command 113 times after a successful edit, misdiagnosed as slowness twice before this existed.
The log path is scraped from the `log: ...jsonl` line `opencode-headless` prints on exit. A killed
task never prints it, and a killed task is exactly the one that looped, so the check falls back to
the newest `.bench-logs/<key>-*.jsonl` for the active profile.

## Result file format

One JSON object per file, keyed by task id, written after each task.

| Field | Meaning |
|---|---|
| `task`, `kind`, `seconds` | Task id and kind from `bench/tasks.json`, and wall clock to client exit |
| `turns`, `tool_calls` | `step_finish` and `tool_use` events, from the headless summary line |
| `tokens_in`, `tokens_out` | Summed across turns, from the same line |
| `truncated` | True when a turn ended with `reason=length`, meaning output was cut off |
| `exit`, `timed_out` | Client exit code, `-1` when unparsed; whether the task hit the cap |
| `files_changed` | Lines of `git status --porcelain` after the run |
| `tool_calls_logged`, `longest_identical_run`, `looped_on` | From the JSONL log, independent of the summary line: calls counted, longest run of identical consecutive calls, and the tool name when that run reached 5 |
| `verified` | `true`, `false`, or `null` when the task needs a human |
| `note` | Why it passed or failed, for example `no changes made`, `compile failed` |
| `terms_found`, `terms_expected` | Only for `expect_terms` tasks, matched against the reply text |

On a timed-out task `turns`, `tool_calls`, `tokens_in`, `tokens_out` and `exit` are `null`, not
zero: the summary line is printed at the end of a run, so a killed task leaves nothing to parse, and
zero would claim the model did nothing when the truth is that we do not know. That was misread
twice. `seconds`, `files_changed` and the loop fields stay real; `verified` is `false`.

`verified: null` is not a pass. Most read tasks are judged by hand against `terms_expected`; a task
declaring `verify: "grep_answer"` is checked automatically, passing only when every expected term
appears in the reply. That mode was unimplemented until 28 August 2026, so R2 carries
`verified: null` in every earlier file. `bench-weather-cli` writes a different shape: a `phases`
list, `total_seconds`, a `tests` block with `passed`, `exit`, `runner`, `pass_count` and
`fail_count`, and the files produced.

## Model profiles

A profile is `profiles/<key>.toml`: a `[meta]` block, notes, and a `[params]` block of `MLX_*`
variables. `mise run model-use <key>` writes every param into `mise.local.toml`, sets
`MLX_ACTIVE_PROFILE`, regenerates `opencode.json` and `.aider.conf.yml`, and warns when the GPU
wired limit or a running server no longer matches, changing neither for you.
`.mise/tasks/_profiles.py` validates on load, so a misspelled param is a hard error and
`IGNORED_BY_BACKEND` warns when a profile declares a param the backend cannot apply.
`profiles/qwen3.6-35b-a3b.toml` is the worked example, with a comment on every param naming the
measurement behind its value.

Sampling comes from the model card, not the harness defaults `MLX_TEMP=0.6`, `MLX_TOP_P=1.0`,
`MLX_TOP_K=0` (disabled), `MLX_MIN_P=0.0`; `MLX_TEMP=0.0` and `top_k` disabled both produced
repetition loops on Qwen3.5-9B. The four repetition-control params travel in the request body, not
on the server command line, so `opencode-init` writes the non-default ones into `opencode.json`.
Confirm sampling flags with `ps` and penalties in a request body.

`mise run model-manifest` generates `manifest/models.json` from those profiles, the file nav-pilot
fetches at `alpha local init`, so a model cannot be offered to users without being runnable here. It
enforces publishers limited to `mlx-community` and `lmstudio-community`, exactly one model carrying
`default: true`, and only keys listed in its `OFFERED` table published.

## Known limitations

One run per model, so per-task variance is unmeasured and a 20-second difference on one task is not
a result. Almost everything is measured through opencode, which discards all output from some
families: Qwen3-Coder-30B-A3B (`qwen3_moe`) and Granite 4.1 8B (`granite`) answer the same server
correctly when queried directly, so their numbers measure the pairing. cheap-ops covers one Kotlin
service, every read task except R2 is scored by a person, and MODELS.md mixes two rigs under
different wired caps. What survives that is in `MODELS.md`, under "How far these results can be
trusted".
