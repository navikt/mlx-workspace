# Copilot CLI mixed mode: cloud main agent, local worker (research, 2026-09-24)

Desk research only. No GPU was used, no mlx server was started, and no Copilot or opencode
session ran: tonight's night run matches Copilot session directories by time. Every claim below
comes from `copilot --help` / `copilot help <topic>`, the installed package, GitHub release
notes, docs.github.com, GitHub issues, or files in this repo and navikt/copilot. Anything the
CLI's own documentation does not mention is marked **undocumented**. Anything nobody has run on
this machine is marked **unverified**.

## Summary

1. The documented Copilot CLI (1.0.88 latest, 1.0.89-1 prerelease, 23 Sep) still has one provider per session. `COPILOT_PROVIDER_BASE_URL` covers the whole process, and agent frontmatter has `model:` but no provider field.
2. The runtime underneath can already mix providers. The SDK has an experimental named-provider registry (`providers`/`models`, copilot-sdk#1718, merged 18 June) and a runtime RPC, `session.provider.add`. Both are in the installed 1.0.89-0 package. Neither is in the CLI docs, help or changelog.
3. A Copilot CLI extension (`extension.mjs`, which nav-pilot already installs as an artefact kind since #739) joins the live session and holds `session.rpc`. So it can plausibly register a `local` provider and let a `local-worker` agent with `model: local/<id>` run on the guard. That is **unverified** and our best lead.
4. Our feature request is github/copilot-cli#4703 ("Per-agent provider selection for custom agents"), filed 2 Sep. It is open, labelled `area:agents`/`area:models`, and GitHub has not replied. The one other comment (17 Sep) reports a working two-provider PoC through `provider.add` without saying how.
5. MCP works regardless of provider support. nav-pilot could pass `--additional-mcp-config` with a `local_worker` tool backed by headless opencode on the guard. That route costs more to build and puts the worker's own tool calls outside Copilot's hooks and permission prompts.
6. Hooks cannot route. `preToolUse` can rewrite a `task` call's arguments (1.0.24), but no argument carries an endpoint. Hooks can only guard the other routes, for example by denying a local dispatch when the worker is not registered.
7. Rank: (1) a daytime PoC of the extension route with a recording server, no GPU, about a day; (2) the MCP worker if the PoC fails; (3) opencode-only as today, and it stays the measured reference either way.
8. opencode has no regression arm through nav-pilot. The trusted delegate cell comes from August runs with the old text and Sonnet 4.6. Proposed: a `hybrid` step kind for the night-run driver running `bench-hybrid`, about 4 h and $13 per run, after three small harness fixes.

**Can Copilot CLI do mixed mode today?** Not through anything documented. `copilot help providers`
on 1.0.89-0 says BYOK is activated by `COPILOT_PROVIDER_BASE_URL` and "the CLI uses this provider
instead of GitHub Copilot's model routing". The custom-agent reference on docs.github.com lists
`model` ("Model to use when this custom agent executes. If unset, inherits the default model")
and no provider property. The runtime has an experimental multi-provider surface that says the
opposite: "named providers are additive: they coexist with Copilot API auth so models from CAPI
and one or more BYOK providers can be mixed within a single session and across sub-agents"
(`copilot-sdk/types.d.ts` in the 1.0.89-0 package, marked `@experimental`). Nothing documented
connects that surface to an interactive `copilot` session. An extension might, and nobody here has
tried it.

## 1. Copilot CLI today

### 1.1 Versions and sources

| What | Value | Source |
|---|---|---|
| Installed | `GitHub Copilot CLI 1.0.89-0` (Homebrew cask `copilot-cli@prerelease` 1.0.88-2, auto-updated package in `~/Library/Caches/copilot/pkg/darwin-arm64/1.0.89-0`) | `copilot --version` |
| Latest stable | 1.0.88, 2026-09-22 | `gh release list --repo github/copilot-cli`, npm `@github/copilot` dist-tag `latest` |
| Latest prerelease | 1.0.89-1, 2026-09-23 (GPT-6 Sol/Luna in the picker, two fixes) | release notes v1.0.89-1 |
| Version the README claim was checked on | 1.0.83-3 (2026-09-02) | navikt/copilot c571f773 |

Changelog entries between 1.0.83 and 1.0.89-0 that touch agents, subagents, BYOK or hooks, from
the package's `changelog.json`:

- 1.0.83 (4 Sep): "Custom agents can list several models in `model`, tried in order until one is available to you, and `model-policy: required` keeps model changes on that list."
- 1.0.84-5 / 1.0.85 (16 Sep): "Subagent launches honor explicit model, reasoning effort, and context tier preferences from applicable global and custom instructions."
- 1.0.86 (17 Sep): `include-custom-instructions: true` in agent frontmatter.
- 1.0.88 (22 Sep): a custom agent's `reasoning-effort` applies when selected; subagent start hooks combine additional context.

None of them adds a provider per agent. Older entries that matter here: 1.0.62 "Keep custom agents
on their configured model when using BYOK providers", 1.0.65 "Keep custom-agent subagent model
selections when using BYOK providers", 1.0.24 "preToolUse hooks now respect
modifiedArgs/updatedInput", 1.0.49 "Hooks (preToolUse, postToolUse, subagentStart, subagentStop)
now fire correctly for sub-agent tool calls", 1.0.57 "MCP server timeout configuration is
preserved".

### 1.2 The four questions

| | Question | Documented answer | What the package shows |
|---|---|---|---|
| a | Custom agent or subagent on a different provider than the main session | **No.** `copilot help providers` and `help environment` describe one provider for the whole session. The custom-agent frontmatter reference has `model` only | SDK session options `providers: NamedProviderConfig[]` and `models: ProviderModelConfig[]`, `@experimental`: each model gets a selection id `provider/id`, custom agents can reference it (copilot-sdk#1718: "bind custom agents to provider-qualified model ids (e.g. `alpha/sonnet`)"). Combining them with the singular BYOK `provider` "is rejected", so the main session must stay on Copilot's own models, which is the shape we want. **Undocumented for the CLI** |
| b | Delegate via a tool to a subagent on a local OpenAI-compatible endpoint | **No** for a local endpoint. The `task` tool accepts a model, and the model id reaches the provider (recorded on 1.0.83-3 in #4703), but the endpoint is the session's | `session.provider.add` (`generated/rpc.d.ts`, `schemas/api.schema.json`, stability experimental): "Newly added models become selectable via `model.list` / `model.switchTo` and are inherited by sub-agents spawned afterwards". `app.js` routes it to the native runtime (`provider=this.nativeDomain(b.sessionProviderInvokeJson)(["add","getEndpoint","sync"])`). **Undocumented, unverified from an extension** |
| c | MCP tool that calls a local model | **Yes**, as ordinary MCP. `--additional-mcp-config <json\|@file>` adds servers for one session without touching `~/.copilot/mcp-config.json`; agent frontmatter also takes `mcp-servers` | Nothing special is needed. MCP sampling (1.0.13) goes the other way, from the server to the session's model, so it does not help |
| d | Hooks that route | **No.** Hooks can deny a tool, rewrite its arguments, add context, or answer a user prompt without a model call (`userPromptSubmitted`, 1.0.44). None of these selects an endpoint | Same |

Environment variables in `app.js` (all `COPILOT_PROVIDER_*`): `API_KEY`, `API_KEY_COMMAND`,
`AZURE_API_VERSION`, `BASE_URL`, `BEARER_TOKEN`, `HEADERS`, `MAX_OUTPUT_TOKENS`,
`MAX_PROMPT_TOKENS`, `MODEL_ID`, `TRANSPORT`, `TYPE`, `WIRE_API`, `WIRE_MODEL`, plus
`COPILOT_PROVIDER_GHES_HOST` and `COPILOT_PROVIDER_GHES_TOKEN`. The two GHES variables are the only ones
`copilot help providers` does not list, and neither scopes a provider to an agent. There is no
`providers` key in `copilot help config`. The per-subagent setting that does exist,
`subagents.agents.<agent-name>`, holds model, effort level and context tier, not an endpoint.

### 1.3 The feature request

github/copilot-cli#4703, "Per-agent provider selection for custom agents", opened 2026-09-02
by Starefossen. The README's "Vi har bedt GitHub om ..." refers to it, but the README does not
link it. It asks for a `provider` field in agent frontmatter, or per-agent `env` scoping as in
#2879 (open since April, no response either). It records the 1.0.83-3 recorder experiment: the
subagent's frontmatter model id reaches the provider, but the endpoint does not change. It also records why a routing proxy at
`COPILOT_PROVIDER_BASE_URL` was dropped: main-agent traffic would go through undocumented GitHub
endpoints, and a proxy error silently falls back to the session model.

Status on 2026-09-24: **open**, labels `area:agents`, `area:models`, no assignee, no reply from
GitHub. One comment (rveznaver, 2026-09-17) says "I have confirmed two providers can work in one
session end-to-end (main on a GitHub-hosted model, subagent on a loopback OpenAI-compatible
endpoint) ... a `provider.add` at session start, plus the agent `model:` selecting the resulting
`local/subagent` ID", and does not say how the call was made from the CLI. The SDK half of it
has been public since copilot-sdk#1718 (2026-06-18), which includes end-to-end tests routing a turn to the right
provider with custom agents bound to provider-qualified ids.

**The README is now half wrong.** "Under Copilot CLI finnes ingen slik underagent, og kan ikke
finnes i dag" is true of what a user can configure. It is not true of the runtime. Fix the
wording after the PoC in §2.1, not before, so it states what we have seen run.

## 2. Options for nav-pilot, ranked

| Rank | Option | Value | Effort | Main risk |
|---|---|---|---|---|
| 1 | Extension registers a local provider via `session.provider.add` | Real mixed mode in the default client: the worker is a Copilot subagent with Copilot's tools, permissions, hooks and sandbox | PoC about 1 day with no GPU; product about 1 week | Experimental API may change or go away; silent fallback to the cloud model; unverified that an extension may call it |
| 2 | MCP `local_worker` tool served by nav-pilot | Works whatever GitHub does | 1–2 weeks | Worker's tool calls bypass Copilot's hooks and prompts; opencode becomes a dependency for Copilot users; new condition to measure from zero |
| 3 | opencode-only for mixed mode (today) | Zero cost; the only measured route | 0 | Most users run the default client and never get it |
| – | Wait for #4703 | Clean, supported | 0 | No signal from GitHub in three weeks |
| – | Routing proxy at `COPILOT_PROVIDER_BASE_URL`, hooks | none | | Rejected in #4703; hooks cannot route (§1.2 d) |

### 2.1 Option 1: an extension that adds the local provider

**How it would work.** nav-pilot already installs Copilot CLI extensions (artefact kind
`extension`, marker `extension.mjs`, `internal/source/resolver.go:49`, #739). A `nav-pilot-local`
extension would:

1. `joinSession()` at startup and do nothing unless nav-pilot set `NAV_PILOT_LOCAL_GUARD_URL` for
   this launch (a user-level extension loads in every session).
2. Call `session.rpc.provider.add({providers: [{name: "local", type: "openai", wireApi:
   "completions", baseUrl: <guard>/v1}], models: [{id: <model>, provider: "local",
   maxPromptTokens, maxOutputTokens}]})` with the values `copilotLocalEnv` sets today.
3. The `local-worker` agent file then carries `model: local/<model>`, and the dispatch text is the
   same `LocalDispatchPolicy` output opencode gets, delivered as the agent description or an
   instruction.

On the launch side, a cloud session with local enabled would start the guard and pass
`withCpltAllowLocalhost` exactly as a local session does now (`copilot_launch.go:208–213`), and
set the env var instead of the `COPILOT_PROVIDER_*` block. The main session stays on Copilot's
own models, since named providers cannot be combined with whole-session BYOK.

**What to check in the PoC (no GPU, daytime, not while a night run is live):** use a recording HTTP
server as the "local" endpoint, as in the 1.0.83-3 experiment, with `copilot -p` and a prompt that
dispatches to `local-worker`. The PoC passes when the recorder sees the subagent's request with
`model=<id>` and the main agent's requests do not reach it. Four things are unknown:

- Can an extension connection call `session.provider.add`? Types and schema allow it. `runtime.node` has the string "Extension connections cannot replace SDK external tools" for tools, and no such string for providers. Unverified.
- Timing. Agents are loaded before the extension joins. The RPC says added models are "inherited by sub-agents spawned afterwards", so the first dispatch must come after the add.
- Whether `model: local/<id>` in a `.agent.md` resolves the same way as an SDK-defined agent's.
- **Silent fallback.** Per the agent docs quoted in #4703, "a declared model or effort that can't be honored falls back to the session's value instead of failing the dispatch". If the extension did not load, the worker quietly runs on the cloud model. Try `model-policy: required` (1.0.83), and add a `preToolUse` hook that denies a `task` call to `local-worker` unless the extension wrote a "registered" marker for this session.

**Trust boundary.** Unchanged from local mode: every local completion goes through the guard (loop
guard, sampling, `checkProse`), and the worker is a Copilot subagent, so the cplt sandbox, the
permission prompts and hooks #939/#940 apply to its tool calls (hooks fire in subagents since
1.0.49). The extension process gets the guard URL and nothing sensitive: the CLI strips sensitive
variables from extensions unless it asks for them by name.

**Risk.** The surface is `@experimental`: "may change or be removed in future SDK or CLI
releases". Pin the tested client version in the condition key (design §4.2), and have
`nav-pilot doctor` check that the RPC is there.

**Measure.** Add an arm `mixed` to `bench-copilot` next to `local` and `cloud`: same rungs, the
local server's request count as proof that the worker was used (the check bench-copilot already
uses for the local arm), and the Copilot credit total from the session summary as the cost.
`_by_class.py` gets a condition "copilot delegate orchestrator=<model> policy=<sha>", and
`bench-capabilities` applies the delegate bar to it unchanged.

### 2.2 Option 2: an MCP `local_worker` tool

nav-pilot would add a stdio server (`nav-pilot mcp local-worker`) through `--additional-mcp-config`
at launch, so nothing persists in `~/.copilot`. Copilot spawns it inside cplt, so its file access
has the same sandbox as the session. The tool takes `task` (full description), `files` (the paths
it may touch) and returns a summary plus the diff.

The local model has to edit files, and a patch-returning tool gives up the saving. The saving comes from the worker doing the
reading and editing steps, and a patch the cloud agent re-applies costs cloud output tokens
roughly the size of the edit. So the tool needs an inner agent loop with file tools:

- **Headless opencode** (`opencode run` with the worker agent bound to the guard, which
  `bindLocalWorker` and `bench-cheap-ops` already do). Least new code, and the model's measured
  behaviour was measured under opencode's tools. It makes opencode a dependency of the
  Copilot path. It needs its own config dir, so it doesn't fight the user's opencode config, and it runs a second agent loop
  with its own permission model inside the MCP call.
- **A mini loop in nav-pilot** (Go: read, list, grep, write limited to `files`, no shell). Smallest
  trust surface, but it is a new tool harness, so every delegate number starts at zero, and it is
  the most code.

Risks: the inner tool calls are invisible to Copilot's permission prompts and hooks. The user
approves `local_worker` once, not each write. So the tool must refuse paths outside `files` and
the repo root, and must never run a shell. The MCP call blocks for as long as the local task
runs (measured D2 medians are 146–156 s, up to 458 s), so set the server `timeout` explicitly. The orchestrator
would learn about the worker from a tool description instead of a subagent, which changes the
dispatch behaviour we measured, and the 0/16 "never delegates QA" result would have to be
re-established.

Measure: the same `bench-copilot --arm mixed`. The proof is the MCP call in the session log plus
local server requests.

### 2.3 Option 3: opencode stays the only mixed-mode client

That is today's position, and the only one with numbers behind it. Keep it as the documented
route until option 1 or 2 has its own delegate cell above the bar. Whatever happens, the opencode
arm in §3 is also the reference that a Copilot mixed arm is compared against.

## 3. opencode + nav-pilot + local-worker: what is tested

### 3.1 Today

| Covered | How | Last run |
|---|---|---|
| Policy text generation, byte stability, capabilities → send/keep lines, unknown classes ignored | Go unit tests, `internal/provider/local_policy_test.go` (`TestLocalDispatchPolicyFromCapabilities`, `...IsByteIdenticalAcrossGenerations`, `...IgnoresWhatItDoesNotKnow`) | every nav-pilot CI run |
| Worker binding and policy written together, removed by `alpha local off` | `TestDispatchPolicyAndBindingArriveTogether`, `TestLocalOffTakesTheDispatchPolicyOutOfOpenCode` | every CI run |
| One end-to-end launch: cloud main + local-worker through nav-pilot | `bench-navpilot-e2e` scenario b: one R2 task, `local_calls=2`, verified, $0.024 ([nav-pilot-e2e.md](../2026-09-23-local-model-evaluation/nav-pilot-e2e.md)) | 2026-09-23, once |
| Delegate quality and cost | `bench-hybrid`, 35/35 delegated mechanical edits verified | 2026-08-29 to 08-31 |

| Not covered | Why it matters |
|---|---|
| **The policy text shipping now.** #941 (merged 2026-09-24) generates "Send it: mechanical changes ... Do not send it: questions ..., comments ..., new files ..., debugging" for optiq, and "Send it nothing for now" for the Qwen3.8 builds. All delegate data used the August 1,572-byte text | Design §6: the policy text is the experiment. The one trusted cell is unconfirmed under the text it now drives |
| **The orchestrator shipping now.** nav-pilot's default moved to GPT-6 Sol (#924). All hybrid data is Sonnet 4.6 | Changing the orchestrator is a new condition |
| opencode version. Hybrid data predates opencode 1.18.32 (installed now) | Per-agent model and task tool behaviour are what the route depends on (design §6) |
| Any nav-pilot opencode run in the night run | Night run steps are `bench-np-e2e` (Copilot) and `bench-models`/cheap-ops, which runs `opencode-headless` straight against :8080 with no nav-pilot, guard or policy |
| Hooks in opencode | #709 (open): nav-pilot exports no hooks to opencode on the claim that it cannot deny a call, which the issue measured to be wrong (`tool.execute.before` throws, 1.18.29). The loop hook (#939) and redaction (#940) reach Copilot sessions only |
| Qwen3.8 as the worker | Never run in delegate mode; manifest says `cloud` for every delegate class |
| Hybrid files do not record the condition | `_by_class.py` hard-codes `HYBRID_ORCHESTRATOR = "claude-sonnet-4.6"` and the fragment name. A new run appended to the same files would be scored as the old condition |

### 3.2 The proposed arm: `hybrid` steps in the night-run driver

**Harness fixes first** (one small PR, in a worktree, never while a night run is live; bash
scripts are read by byte offset and `bench-hybrid` is imported by `bench-copilot`):

1. `bench-hybrid`: a `BENCH_HYBRID_TAG` in the output stem (`hybrid[-<target>]-<tag>-<rung>-<arm>.json`). Without it the tool tops up the August files, which already hold 8 samples, and prints "nothing to do".
2. `bench-hybrid` preflight: record `sha256` and byte count of `~/.config/opencode/nav-pilot-local-dispatch.md` after the launch, `opencode --version`, and the worker model from `server.json`. The instruction inventory already captures the files, but not in a form `_by_class` keys on.
3. `_by_class.py`: take orchestrator, worker and policy hash from the file when present. The constants stay as the defaults for the August files.

Then the binary. The night-run default `nav-pilot-main-f1507caa` predates #941 and still writes the
old text, so build one at `7362715c` or later (`nav-pilot/2026.09.24-164311-7362715`, which also has
the #942 source fallback for the clone blips in pending-tasks §8).

**Steps to add to `night-run`'s `QUEUE`** (a new `kind`, not an edit to the script that runs
tonight). The driver needs one more branch next to `e2e`/`ops`:

```bash
elif [ "$kind" = hybrid ]; then
  # mode = "<target>:<rung>:<arms>:<samples>", profile = the local worker profile
  IFS=: read -r tgt rung arms n <<<"$mode"
  cmd=(env BENCH_TARGET="$tgt" BENCH_HYBRID_TAG="$HYBRID_TAG" BENCH_CLOUD_MODEL="$HYBRID_CLOUD_MODEL"
       mise run bench-hybrid -- --rung "$rung" --arm "$arms" --samples "$n")
```

where `HYBRID_TAG` is set once per night from the binary and the orchestrator (for example `np7362715-sonnet46`), the result pattern for the status check is `hybrid*-$HYBRID_TAG-<rung>-*.json`, and the queue lines are:

```
"hybrid tasks:3:both:8                          qwen3.6-35b-a3b-optiq  45 20"
"hybrid tasks:6:both:8                          qwen3.6-35b-a3b-optiq  90 60"
"hybrid frontend-familie-tilbake:3:both:8       qwen3.6-35b-a3b-optiq  60 35"
"hybrid spring-ia-tjenester-metrikker:6:both:8  qwen3.6-35b-a3b-optiq  90 60"
"hybrid tasks:1:hybrid:6                        qwen3.6-35b-a3b-optiq  30 12"
"hybrid tasks:2:hybrid:6                        qwen3.6-35b-a3b-optiq  30 12"
"hybrid tasks:4:hybrid:6                        qwen3.6-35b-a3b-optiq  40 20"
"hybrid tasks:5:hybrid:6                        qwen3.6-35b-a3b-optiq  30 15"
```

The first four re-measure the trusted cell (M1 Ktor, D2 Ktor, M1 frontend, D2 Spring) with a
fresh control arm, because the cost ratio needs both arms under the same orchestrator. Rungs 1,
2 and 4 are guard rails: under the new text QA, doc comments and test files should stay on
cloud, and a delegation there is a regression in the text, not a win. Rung 5 (M2) is the
opposite case. It is in the trusted class, the August text got 0/6 delegations on it, and the new
text names it, so it measures whether the narrower text sends more of the right work. Its control
arm can come later; without one it adds k/n but no cost ratio. Qwen3.8 steps
come later, and only once a Qwen3.8 build clears a local-only class (design §5 item 5).

**Orchestrator.** Run it pinned to `claude-sonnet-4.6` (`HYBRID_CLOUD_MODEL`) first, so that the
policy text is the only variable against August. Then run the four trusted-cell lines once more
with nav-pilot's default (GPT-6 Sol), which is what users get. Two nights, or one long one.

**Placement.** At the end of the queue, after the GPU sweep: it needs the network and the
cloud, and nav-pilot's own local server (`alpha local start`), not the workspace :8080 server.
The driver's per-step cleanup already stops both.

**Feeding `bench-capabilities`.** With fix 3, the new files form their own condition
("opencode delegate orchestrator=<model> policy=<sha8>"), which `bench-capabilities` scores
without other changes. The existing verdict stays the best single condition, so the August cell
keeps optiq `trusted` until the new condition has its own numbers. If the new condition comes in
below the bar, `bench-capabilities` does not demote the cell by itself (best-of-conditions,
flagged `ponytail:` in the script). Demoting it takes a human decision, recorded in the manifest
PR. That is the gap to watch.

**Time and cost per run**, from the August medians (`bench/hybrid-*.json`, seconds and opencode's
reported `cloud_cost_usd` at Sonnet 4.6), plus about 90 s per sample for reset, `alpha local`
toggling and verification (a guess: Gradle offline builds on the Kotlin targets, typecheck and
vitest on the frontend):

| Block | Samples | Model time | With overhead | Cloud cost |
|---|---|---|---|---|
| Trusted cell, 4 pairs × 2 arms × 8 | 64 | ≈ 92 min | ≈ 3.2 h | ≈ $10.1 |
| Rungs 1, 2, 4, 5 hybrid × 6 | 24 | ≈ 9 min | ≈ 45 min | ≈ $3.3 |
| **Total** | 88 | ≈ 1.7 h | **≈ 4 h** | **≈ $13** |

The August files' tails (1,049 s on one rung-1 sample, 431–458 s on D2) are why the timeouts above
are two to three times the expected minutes. With GPT-6 Sol as the orchestrator the dollar figure
is unknown until the first run. opencode reports a list-price estimate, not Copilot credits.

## 4. Next steps

1. Daytime, no GPU: the option 1 PoC with a recording server (§2.1). One day. It decides between options 1 and 2.
2. Harness PR: the three fixes in §3.2 and the `hybrid` kind in `night-run`, with a `night-run-selftest` case. Do not merge it while a night run is live.
3. The next night run after that: the eight `hybrid` lines, Sonnet-pinned.
4. Then, if the PoC passed: `bench-copilot --arm mixed` on the same rungs, and a README correction that links #4703.
5. Add a comment on #4703 with the PoC result either way. Whether it works from an extension is what the issue's readers need to know.

## Sources

- Copilot CLI 1.0.89-0: `copilot --version`, `copilot help providers`, `copilot help environment`, `copilot help config`, `copilot --help`; package at `~/Library/Caches/copilot/pkg/darwin-arm64/1.0.89-0/` (`changelog.json`, `app.js`, `copilot-sdk/types.d.ts` lines 2052–2085 and 2643–2760, `copilot-sdk/generated/rpc.d.ts` ~27910–27930, `copilot-sdk/docs/extensions.md`, `schemas/api.schema.json`, `prebuilds/darwin-arm64/runtime.node` strings).
- Releases: `gh release list --repo github/copilot-cli` (1.0.88, 2026-09-22; 1.0.89-1, 2026-09-23); npm `@github/copilot` publish times.
- docs.github.com: [Custom agents configuration](https://docs.github.com/en/copilot/reference/custom-agents-configuration); [Using BYOK models in Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-byok-models) (neither mentions a per-agent provider; fetched 2026-09-24).
- [github/copilot-cli#4703](https://github.com/github/copilot-cli/issues/4703), [#2879](https://github.com/github/copilot-cli/issues/2879), [github/copilot-sdk#1718](https://github.com/github/copilot-sdk/pull/1718).
- navikt/copilot at `7362715c`: `docs/README.nav-pilot.md` §"Utsending til en lokal underagent krever opencode"; `cli/nav-pilot/internal/provider/copilot_launch.go` (`copilotLocalWorker`, `copilotLocalEnv`); `opencode_launch.go` (`LocalDispatchPolicy`, `writeDispatchClasses`); `internal/source/resolver.go:49`; PRs #483, #739, #924, #939, #940, #941, #942; issue #709.
- This repo: [routing design](../2026-09-24-local-vs-cloud-routing/design.md), [nav-pilot-e2e.md](../2026-09-23-local-model-evaluation/nav-pilot-e2e.md), `bench/hybrid-*.json`, `.mise/tasks/{bench-hybrid,bench-copilot,night-run,bench-capabilities,_by_class.py}`, `manifest/models.json`.
