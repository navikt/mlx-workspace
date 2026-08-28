# Benchmarking

How this workspace measures local models. Read it before running anything, and before trusting a
number someone else produced. Results land in `bench/results-<profile-key>.json`, which is
gitignored; published tables and verdicts live in `MODELS.md`. The two designs are
`WEATHER_CLI_SPEC.md` and `CHEAP_OPS_SPEC.md`. Do not edit either spec once a model has been
measured against it, because every recorded number assumes the version in the workspace at the
time.

## The two benchmarks

**weather-cli** builds a complete Node CLI from scratch against `WEATHER_CLI_SPEC.md`: argument
parsing, Geonorge geocoding, the Met.no forecast API, output formatting, and five named test files.
It is the hardest task shape available and the one we would never route to a local model in
practice. It stays because it separates models that hold a multi-step build together from those
that do not.

**cheap-ops** measures the opposite, and it is the shape we intend to route locally. Eleven short
operations inside `navikt/isoppfolgingstilfelle`, a real Kotlin service the model did not write:
read-only questions, single-file edits, multi-file edits, and generated tests. Each costs a Copilot
premium request at the same rate as a hard architectural question, so absorbing them locally is
where a heavy user's allowance stretches. `bench/tasks.json` is the source of truth for prompts,
target files, symbols, and verification mode, with paths and symbols pinned so every model gets the
identical set. The two benchmarks disagree, which is why both exist: a model that wins the
from-scratch build can lose on routine edits inside code it did not write.

## Running cheap-ops

```bash
mise run model-use qwen3.6-35b-a3b   # writes profile params into mise.local.toml
mise run vram-set <gb>               # only if model-use warns the wired limit is wrong
mise run server                      # in a second terminal
mise run server-wait                 # blocks until the model answers, not just until the port binds
mise run bench-cheap-ops             # all tasks
mise run bench-cheap-ops M1 D2       # named tasks only
```

`bench-cheap-ops` clones the target repo into `workspaces/<profile-key>/kotlin/` on first run and
reuses it afterwards. It writes results after every task, so an interrupted run keeps what it
already measured. Environment variables it reads:

| Variable | Default | Effect |
|---|---|---|
| `MLX_ACTIVE_PROFILE` | none, required | Profile key. Set by `mise run model-use`. The runner exits without it |
| `BENCH_TASK_TIMEOUT` | `420` | Per-task wall clock cap in seconds. Exceeding it records a failure |
| `BENCH_RESTART_SERVER` | `1` | Restart the inference server before each task. Any other value skips it |
| `MLX_SERVER_PORT` | `8080` | Inference port, also the port opened through the sandbox |
| `MLX_SERVER_WAIT_SECONDS` | `900` | How long `server-wait` waits for a bind plus a first token |

A single prompt takes the same path: `mise run opencode-headless "<prompt>"`. Everything after the
task name is passed to `opencode run`, so `--continue`, `--session`, `--model` and `--agent` work.
Every invocation logs JSONL events to `.bench-logs/<key>-<timestamp>.jsonl`.

## Running weather-cli

weather-cli is hand-driven, not scripted. Activate the profile, start the server, then
`mise run workspace-clear` followed by `mise run opencode`.

Both `opencode` and `opencode-headless` provision `WEATHER_CLI_SPEC.md` into
`workspaces/<key>/weather-cli/` and copy the current `AGENTS.md` into the workspace root on every
launch, so rule edits at the repo root reach the model under test. Issue the two prompts from the
"Standard benchmark prompts" section of `MODELS.md` verbatim, plan first, then implementation.
Changing their wording invalidates comparison with earlier runs. Score by running `npm test`
yourself and by the code review rubric in `MODELS.md`.

## Verification rules

Each rule exists because its absence produced a wrong number.

**An edit task that changed no files fails.** `changed_files()` runs `git status --porcelain` and
returns a failure before any Gradle work for `compile`, `test` and `rename` tasks. An untouched
checkout compiles and its suite passes, so a compile check or a test check on its own certifies the
repository, not the model. Granite scored four false passes this way before the check existed.

**The model does not verify itself.** Verification runs in `bench-cheap-ops`, never in the model's
reply. One earlier submission reported "20/20 passing" with eight assertions sitting inside a catch
block that swallowed them. `compile` runs `./gradlew compileKotlin`, `test` runs `./gradlew test`,
and `rename` greps `src` for the old symbol before compiling, so a rename that leaves references
behind fails even when the project builds. Both Gradle targets run `--offline` with `JAVA_HOME` set
to the JDK path in `bench/tasks.json`, because the project pins `jvmToolchain(21)`.

**The workspace is clean before every task.** `reset_repo()` runs `git reset --hard` plus
`git clean -qfd`, keeping only `build` and `.gradle`. Two of three workspaces in an earlier round
held a previous run's code, which would have invalidated every number in that round. For weather-cli
the equivalent is `mise run workspace-clear`, which refuses to delete a workspace that is a running
process's working directory, or one holding git-tracked or staged files.

**The server restarts before every task.** The server degrades across a long session: after some
number of tasks the model stops calling tools and every later task fails with no edits. One task
that produced 0 turns and 0 tool calls passed with 6 turns and 9 tool calls after nothing changed
but a restart. `restart_server()` runs `server-stop`, relaunches `server` detached, then blocks on
`server-wait`, which sends a real completion request rather than checking the socket: mlx-lm loads
weights lazily, so a benchmark that starts on bind alone charges model loading to thinking time.

**Every task is capped.** Task E3 once looped 77 identical tool calls twice and consumed a whole
90-minute budget both times, starving three later tasks. `BENCH_TASK_TIMEOUT` turns a loop into a
recorded failure instead of a lost run.

**Everything runs sandboxed under cplt.** All client launches go through `cplt_argv()` in
`.mise/tasks/_sandbox.py`, so interactive and headless runs cannot drift to different policies. The
sandbox confines the model to `workspaces/<key>/`, opens localhost only on the inference port, and
grants opencode write access to its own state directories plus read access to the repo-root
`opencode.json`. One model walked out of its workspace with an absolute path and listed every other
model's finished solution. Another tried to `npm install -g` a CLI it had invented. If `cplt` is
missing the run continues unsandboxed with a warning, so look for that warning before trusting a
run.

## Result file format

One JSON object per file, keyed by task id, written after each task. Fields:

| Field | Meaning |
|---|---|
| `task`, `kind` | Task id and kind from `bench/tasks.json`, `read` or `edit` |
| `seconds` | Wall clock from launching the client to its exit |
| `turns` | Steps that finished, counted from `step_finish` events |
| `tool_calls` | Count of `tool_use` events |
| `tokens_in`, `tokens_out` | Summed across turns, scraped from the headless summary line |
| `truncated` | True when a turn ended with `reason=length`, meaning output was cut off |
| `exit` | Client exit code, `-1` when it could not be parsed |
| `timed_out` | True when the task hit `BENCH_TASK_TIMEOUT` |
| `files_changed` | Lines of `git status --porcelain` after the run |
| `verified` | `true`, `false`, or `null` when the task needs a human |
| `note` | Why it passed or failed, for example `no changes made`, `compile failed`, `needs a human` |
| `terms_found`, `terms_expected` | Present only for tasks with `expect_terms`, matched against the reply text |

`verified: null` is not a pass. Most read tasks are judged by hand against `terms_expected`. A task
declaring `verify: "grep_answer"` is checked automatically instead, passing only when every expected
term appears in the reply. That mode was declared in `bench/tasks.json` but unimplemented until
28 August 2026, so R2 carries `verified: null` in every result file recorded before that date.

## Quarantine convention

Results are renamed, never deleted. `bench/results-<key>.json` is the current trusted run. A suffix
before `.json` marks a run kept as evidence but excluded from medians and from MODELS.md tables,
except as evidence for the condition the suffix names:

| Suffix | Meaning |
|---|---|
| `.INVALID` | The harness broke, so the numbers measure the harness. The Granite run recorded zero tool calls on every task because opencode discards that model's output |
| `.CONFOUNDED` | Real numbers under a known confound. The pre-restart Qwen3.6 runs are kept as evidence for the server degradation bug, not as comparable results |
| `.RUN1` | An earlier run superseded by a later one, kept for the comparison |
| `.THINKING` | A variant run with a non-default configuration, here thinking mode enabled |

## Model profiles

A profile is one TOML file in `profiles/<key>.toml` with a `[meta]` block, notes, and a `[params]`
block of `MLX_*` environment variables. `mise run model-use <key>` writes every param into
`mise.local.toml`, sets `MLX_ACTIVE_PROFILE`, regenerates `opencode.json` and `.aider.conf.yml`, and
warns when the GPU wired limit or a running server no longer matches. It changes neither for you.

`.mise/tasks/_profiles.py` validates on load: `REQUIRED_PARAMS` lists what a profile must set,
`OPTIONAL_DEFAULTS` every optional param and its default, and a misspelled param is a hard error
rather than a silent no-op. `IGNORED_BY_BACKEND` warns when a profile declares a param the selected
backend cannot apply.

Sampling comes from the model card, not from the harness defaults, which are `MLX_TEMP=0.6`,
`MLX_TOP_P=1.0`, `MLX_TOP_K=0` (disabled), `MLX_MIN_P=0.0`. Qwen's card specifies `top_k=20`,
`top_p=0.95`, `min_p=0.0`, and both weather-cli runs made before that correction ran with `top_k`
disabled. Running with `top_k` off produced a degenerate repetition loop on Qwen3.5-9B, and
`MLX_TEMP=0.0`, the mlx-lm default, causes repetition loops too. Confirm the flags reached the
process with `ps`, not just the profile loader.

`profiles/qwen3.6-35b-a3b.toml` is the worked example: measured VRAM and KV cache numbers in the
notes, a comment on every param explaining the measurement behind the value, and
`MLX_CHAT_TEMPLATE_ARGS = '{"enable_thinking": false}'` with the reasoning for disabling thinking.

## Known limitations

- **One run per model.** No repeats, so per-task variance is unmeasured. A 20-second difference
  between two models on one task is not a result.
- **One client for most numbers.** Almost everything is measured through opencode. Where a model
  fails, the failure may belong to the pairing.
- **opencode is not a neutral instrument.** It discards all output from some model families.
  Qwen3-Coder-30B-A3B (`qwen3_moe`) and Granite 4.1 8B (`granite`) return correct tool calls
  against the same running server when queried directly, and surface nothing through opencode. Any
  benchmark number for those models measures the pairing, not the model.
- **One codebase, one language.** cheap-ops runs entirely against a single Kotlin service. Nothing
  here says how a model handles Python, TypeScript, or a repo with a different layout.
- **Eleven tasks, some judged by hand.** Read tasks other than R2 return `verified: null` and are
  scored against expected terms by a person, which is not reproducible the way a compile check is.
- **Hardware is not constant across rows.** MODELS.md mixes a 32 GB M1 Max and a 128 GB M5 Max under
  different wired caps. Check the rig before comparing two numbers.
