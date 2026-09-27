# Selective rule loading for nav-pilot, 2026-09-28

Desk research and a re-read of data already on this machine. No GPU runs and no downloads. Token
counts use the cached Qwen3.6 tokenizer (optiq). Session figures come from Copilot CLI's own
`session.start`, `system.message` and `session.shutdown` events and from opencode's `opencode.db`.

## Question

Should nav-pilot load project rules selectively, per prompt and per file, with its local
`alpha decide` as the classifier, like jev-rules does with TypeSafe's hosted Jev? If yes, nav-pilot
gets a new hook path, a rule format and a benchmark arm. If no, the rules stay as they are, and
anything worth fixing in how they load is fixed without a classifier.

## What shipped

Nothing. The user approved research and measurement first, and asked for the feature not to be
built yet.

## Method

- **Load.** I split the first `system.message` of three Copilot CLI 1.0.89 sessions into the parts
  nav-pilot controls and counted each part with the Qwen3.6 tokenizer: `rule_load.py session`. I
  inventoried fresh clones of navikt/copilot (d24cac4, 2026-09-27) and nais/pilot (depth 1, same
  day) with `rule_load.py pakke`. Tool definitions are not in the event log, so for those I use
  Copilot's own estimate (`toolDefinitionsTokens`).
- **Prefill.** Cold and warm TTFT at about 2k, 30k and 49–57k prompt tokens, from the np-e2e
  latency probes on an Apple M5 Max (wired limit 49,152 MB for the 64 GB profiles, 36,864 MB for
  Qwen3.8-27B-OptiQ). I interpolate linearly between the 2k and 30k points. Decide latency is the
  np-e2e `classifier_latency` probe (n = 21 per model).
- **Rule recall today.** For every Copilot session whose prompt carried the `applyTo` table (986
  sessions, 29 Aug – 27 Sep), I checked whether a session that edited a `.kt` file (edit, create or
  apply_patch; writes through `bash` are not counted) ever opened a
  `kotlin*.instructions.md` file, and whether a session that edited Kotlin, Go, Java or TypeScript
  opened `security-owasp.instructions.md`: `rule_load.py recall` (per model; the per-agent and
  per-workspace splits below were read from the same events). All of these are benchmark or
  golden-test sessions. Sessions without a tracked edit are left out: 75 local and 630 cloud. The labels are mechanical (a tool call names the file), not a judgement of whether the
  rule mattered.
- **Client capabilities and prior art.** Read from current docs, the bundled Copilot CLI and the
  opencode source, the nav-pilot source (navikt/copilot d24cac4), and the jev-rules (a2b0dd3),
  live-rules (Eigenwise toolshed 2e0f2bb) and jev-router (38da6b8) repos.

## Results

### 1. The current load

**Copilot CLI, local session** (occamy, `nais-platform` agent, nais/pilot on top of navikt/copilot,
session `54a42fc6`, 27 Sep). Copilot's estimate: 13,340 system + 8,494 tools = 21,834, the "21.7k"
from #932. In Qwen tokens:

| Part | Qwen tokens | Loaded | Who controls it |
|---|---:|---|---|
| Copilot base prompt (tone, tools prose, environment, autopilot) | 6,003 | always | Copilot |
| Tool definitions, including the custom-agent list | ≈ 8,970 (8,494 Copilot estimate × 1.056) | always | Copilot; nav-pilot adds agents and MCP servers |
| Skill listing, 45 skills, name + description | 3,494 | always; bodies on demand (100.5k in the clones) | agentpakke |
| Always-on instructions (`applyTo: "**"`), 4 files | 3,006 | always, inlined | agentpakke |
| ↳ `deliberate-ai-use` (Bevisst AI-bruk) | 1,337 | | navikt/copilot |
| ↳ `code-review` | 617 | | stale local file: no longer in navikt/copilot |
| ↳ `nais-platform` | 521 | | nais/pilot |
| ↳ `output-style` (nais/pilot's, overrides navikt's) | 513 | | nais/pilot |
| `applyTo` table, 14 file-scoped instructions | 692 | always; bodies on demand (26.5k in the clone) | agentpakke |
| Selected agent body (`nais-platform`) | 888 | always | agentpakke |
| `copilot-instructions.md` | 0 | `~/.copilot/copilot-instructions.md` is empty; a repo's own file is inlined (5,430 in navikt/copilot's repo, session `d4606fd7`) | repo |
| **Total** | **≈ 23,050** | | |

The custom-agent list sits inside the tool definitions. From the clones, the 13 agents' names and
descriptions are 410 tokens (359 navikt/copilot, 51 nais/pilot); Copilot's wrapping comes on top.

**Copilot CLI, cloud sessions.** `gpt-5-mini` with the same install and agent (`f16dc902`, 25 Sep):
base prompt 6,704 (701 more than local), every agentpakke part identical, tools 8,590. A cloud
session with the `nav-pilot` agent and only navikt/copilot's instructions (`833d6063`, golden test,
27 Sep): base 5,283, skills 3,494, always-on 2,513 (`deliberate-ai-use` 1,337, navikt's
`output-style` 1,162), table 543 (13 rows), agent body 4,887. That makes 16,720 system tokens;
Copilot's estimate is 18,971 system + 10,691 tools on Claude's tokenizer. The `nav-pilot` agent body
is 5.5× the `nais-platform` one.

**Per package**, from the clones (`rule_load.py pakke`):

| | navikt/copilot | nais/pilot adds |
|---|---:|---:|
| Always-on instructions | 2 files, 2,503 | 2 files, 1,038 (its `output-style` replaces navikt's) |
| File-scoped instructions | 13 files, 26,454 (table row each) | 0 |
| Agents: list / bodies | 11: 359 / 33,260 | 2: 51 / 1,127 |
| Skills: listing / bodies | 33: 2,529 / 89,593 | 10: 746 / 10,953 |

**opencode.** `nav-pilot export opencode` inlines the always-on instructions into `AGENTS.md`,
copies each file-scoped instruction to `instructions/<name>.md`, and ends `AGENTS.md` with a
"Context Loading" list of glob → file that asks the model to read a file only when it matches
(`internal/artifacts/export.go`, `buildLeanAGENTSmd`). That is the same lazy pattern as Copilot's
table. This machine's global export (nais/pilot) is 967 tokens of `AGENTS.md` plus 475 for the
local-dispatch note. First-request sizes from `opencode.db` (opencode's count, which includes tools
and the first user message; cloud rows use the provider's tokenizer):

| Agent | Model | n | Median first request |
|---|---|---:|---:|
| `build`, bench config with no agentpakke | optiq (local) | 976 | 7,872 |
| `local-worker` | optiq (local) | 24 | 14,330 |
| `nav-pilot` | optiq (local), 29–30 Aug | 8 | 17,272 |
| `nais-platform` | Claude Sonnet 5 (cloud) | 374 | 14,128 |
| `nav-pilot` | Claude Sonnet 5 (cloud), 27 Sep | 36 | 26,160 |

opencode starts lighter than Copilot (about 7.9k bare against Copilot's ≈ 15k of base prompt and
tools). The `nav-pilot` agent session is 9.4k above the bare bench config on the same local model.

**Always, sometimes, file-scoped.** Only about 3k tokens are "always" rules at all. The rest of the
~8–12k nav-pilot controls is either already lazy (skills, file-scoped instructions) or the agent
body.

| Kind | What | Tokens | Already selective? |
|---|---|---:|---|
| Always, and should be | `output-style`, `nais-platform` (for the people who install nais/pilot) | 513–1,162 + 521 | no, and no need |
| Always, but only sometimes relevant | `deliberate-ai-use` (when to hand work to AI; long cited sources), the stale `code-review` | 1,337 + 617 | **the only classifier candidates** |
| Should be always, is file-scoped today | the six "Critical Rules" in `security-owasp` (parameterised queries, no PII or tokens in logs, secrets from env, ownership, `azp`, TLS) | ≈ 150 of 238 | yes, and that is a bug (§1 recall) |
| File-scoped (`applyTo` glob) | 13 files: kotlin, golang, nextjs-aksel, performance, database, docker, … | 26,454 behind a 543–692 table | yes: model-driven |
| Skills | 43–45 | 3.3–3.5k listing, 100k bodies | yes: model-driven |

**Model-driven recall of file-scoped rules today** (`rule_load.py recall`, Wilson 95 %):

| Sessions that edited a `.kt` file | Opened a `kotlin*.instructions.md` |
|---|---|
| Cloud, `nav-pilot` agent, nav-pilot golden tests, Norwegian prompts (42 "rename variabelen maksAntall i tre filer", 40 "legg til et nytt REST-endepunkt …", 8 others) | 77/90 (0.77–0.92) |
| Cloud (Sonnet 4.6), `nav-pilot` agent, hybrid-bench `kotlin` workspace, English autopilot prompts ("… Change nothing else.") | 0/24 (0.00–0.14) |
| Local, same workspace and agent (optiq) | 0/18 (0.00–0.18) |
| Local, `nais-platform` agent, hybrid-bench tasks (six local models) | 0/49 (0.00–0.07) |
| **All local** | **0/67 runs of 4 task prompts** |

| Sessions that edited Kotlin, Go, Java or TypeScript | Opened `security-owasp.instructions.md` |
|---|---|
| Cloud, `nav-pilot` agent | 37/117 (0.24–0.41) |
| Cloud, `accessibility` agent (golden `.tsx` tasks; 78 of 93 opened `accessibility.instructions.md` instead) | 0/93 |
| Cloud, other agents (`code-review`, `rubber-duck`, `forfatter`) | 4/4 |
| Cloud, all agents (what `rule_load.py recall` prints) | 41/214 (0.14–0.25) |
| Local | 0/67 runs of 4 task prompts |

The Wilson intervals overstate the evidence: the 67 local runs use only four first prompts ("Add a
KDoc comment …" 29, "Rename dagerMellomDatoer …" 26, "Add a nullable field kilde …" 9,
"gradertAtTilfelleEnd …" 3), so the honest reading is "not observed in four bench tasks". The one
matched comparison (same workspace, same agent) is 0/24 cloud against 0/18 local, so this does not
show that local models are worse at fetching rules. The golden-test cloud sessions differ in more
than the prompt: their `applyTo` table has 53 rows from four directories, `kotlin.instructions.md`
listed three times, against 14 rows in the bench. Within the golden tests models also differ
(GPT-5.6 44/44, Sonnet 4.6 26/32, kimi-k3 3/7). What the data do show: the security rules nav-pilot
calls critical reached a `nav-pilot` session in about a third of the sessions that edited code. Their
table row has no description, while the Kotlin rows have one.

### 2. What it costs the local model

TTFT from `bench/np-e2e-qwen3.6-35b-a3b-optiq-64g-20260926-234608.json`,
`np-e2e-qwen3.8-27b-optiq-4bit-20260924-181038.json` and `np-e2e-qwen3.8-27b-8bit-64g-20260926-234818.json`:

| Model | Cold prefill rate, 2k→30k | Cold, the ≈ 23.1k Copilot start | Warm at ~30k | 23.1k of the window |
|---|---:|---:|---:|---|
| optiq (Qwen3.6-35B-A3B-OptiQ-4bit) | ≈ 3,030 tok/s | ≈ 7.6 s | 0.38 s | 35 % of 64k |
| Qwen3.8-27B-OptiQ-4bit | ≈ 580 tok/s | ≈ 38.9 s | 0.60 s | 35 % of 64k |
| Qwen3.8-27B 8-bit | ≈ 580 tok/s | ≈ 39.0 s | 0.59 s | 48 % of the 48k opt-in |

The cold cost is paid once per session and again after a compaction. The prompt cache covers the
rest: across the 12 e2e sessions of the occamy np-e2e run, 86.5 % of input tokens were cached
(0.80–0.93 per session, `np-e2e-occamy-1.0-4bit-64g-20260927-162612.json`).

What selective loading could take off:

| Removed from the start | Tokens | optiq, cold | Qwen3.8-27B, cold | Warm | Share of 64k |
|---|---:|---:|---:|---:|---:|
| `deliberate-ai-use` | 1,337 | 0.44 s | 2.3 s | 0 | 2.0 % |
| + the stale `code-review` | 1,954 | 0.65 s | 3.4 s | 0 | 3.0 % |
| All always-on instructions (upper bound, not advisable) | 3,006 | 1.0 s | 5.2 s | 0 | 4.6 % |

What a per-file injection would add, if it pushed a file-scoped rule into context:
`kotlin.instructions.md` is 5,254 tokens, 1.7 s of prefill on optiq and 9.1 s on Qwen3.8-27B, once per
session if deduplicated, appended at the end so the cached prefix survives.

### 3. Client capabilities

Read from the Copilot CLI 1.0.89-5 bundle (`changelog.json`, `copilot-sdk/*.d.ts`, the strings of the
native runtime), GitHub's hooks reference, the opencode source (b471c2b; installed 1.18.32), and
nav-pilot (d24cac4). "Probe" means the docs or changelog say so but no session here has exercised it:
the 10,756 hook starts in this machine's Copilot logs are preToolUse (10,203), postToolUse (551),
sessionStart (1) and sessionEnd (1).

| Client, event | Sees prompt | Sees file path | Can add context | Can remove or replace | Timeout, failure |
|---|---|---|---|---|---|
| Copilot `sessionStart` (command hook) | initial prompt only | no | **yes**, `additionalContext` (changelog 1.0.11) | no | 30 s default, fail-open |
| Copilot `userPromptSubmitted` (command hook) | yes | no | **unclear**: the reference says command and HTTP hooks "have their output dropped", changelog 1.0.65 says its `additionalContext` reaches the model. Probe | no | 30 s |
| Copilot `userPromptTransformed` (command hook) | yes | no | may rewrite the model-facing prompt (`modifiedTransformedPrompt`). Probe | the prompt only | 30 s |
| Copilot `preToolUse` (command hook) | no | yes | changelog 1.0.24 says `additionalContext` is respected; the reference's table omits it. Probe | tool args only | crash denies, timeout allows |
| Copilot `postToolUse` | no | yes | **yes**, `additionalContext`: "as a system message" (changelog 1.0.49), "into successful tool results" (1.0.51); joined output capped at 10 KB (docs) | the tool result (`modifiedResult`) | 30 s, fail-open |
| Copilot `subagentStart` | no | no | **yes**, prepended to the sub-agent's prompt | no | 30 s |
| Copilot SDK extension (`onUserPromptSubmitted`) | yes | no | **yes**, documented "silently append instructions" | `modifiedPrompt` | n/a |
| Copilot SDK `systemMessage` customize, `disabledInstructionSources`, `skipCustomInstructions` | n/a | n/a | yes | **yes**, `custom_instructions` remove or replace (`types.d.ts:853-918`). From a joined extension: probe | n/a |
| opencode `chat.message` | yes | no | **yes**, push a text part | edits the message parts | no timeout; a throw may fail the turn |
| opencode `experimental.chat.system.transform` | no (cache it from `chat.message`) | no | yes | **yes**, string edit of the `Instructions from: <path>` blocks | runs on every request |
| opencode `tool.execute.before` | no | yes | only as a thrown deny text | tool args | none (nav-pilot's gate uses 2 s) |
| opencode `tool.execute.after` | no | yes | **yes**, append to the tool output | the output | none |

**Removal.** Copilot command hooks can only add. The default load can be cut three ways:
`--no-custom-instructions` (all or nothing), the SDK fields above (per source, untested from an
extension), or not installing a file as always-on in the first place. `excludeAgent` targets only
`code-review` and `cloud-agent`, not the CLI. opencode's `system.transform` can remove text, but the
system prompt is rebuilt on every request (`session/llm/request.ts:56-78`), so a per-turn edit
changes the prefix and the prompt cache misses from that point: a full re-prefill of ≈ 23k tokens is
7.6 s on optiq and 39 s on Qwen3.8-27B.

So the install is the lever, not the hook: a rule that should not always be loaded should not be
shipped as `applyTo: "**"`. It should be a file-scoped instruction, a skill, or an unlisted file that a
hook points to.

**What nav-pilot does today** (`internal/cli/hook_cmd.go`, `internal/source/hooks.go`,
`internal/provider/dispatch-gate.js` from #999):

- Copilot: two built-in `postToolUse` hooks written at launch, loop guard and redaction. Both return
  `modifiedResult`, time out at 5 s, and print `{}` on any error. Three Python `preToolUse` gates
  (`ask-first-aria`, `gh-poll-gate`, `klarsprak-gate`) are killed a second before their 5 s deadline
  and exit 0, so they fail open even though Copilot fails a crashed `preToolUse` closed. No hook
  returns `additionalContext`, and none runs on `sessionStart` or `userPromptSubmitted`.
- opencode: the dispatch gate plugin, inert unless `NAV_PILOT_DISPATCH_GATE` is set. `chat.message`
  counts turns, `tool.execute.before` posts the call to the gate with a 2 s timeout and throws its
  deny text. Every error lets the call through. It injects no context.
- `local_dispatch` (off, conservative, balanced, aggressive) only matters to opencode, where it sets
  how hard a cloud orchestrator is pushed to hand work to `local-worker`. Its policy is written to
  `nav-pilot-local-dispatch.md` and added to opencode's `instructions`. `local_endpoint` and
  `local_endpoint_model` point nav-pilot at your own OpenAI-compatible server; `alpha decide` then
  needs that server to return logprobs.

A latent bug found on the way (inferred from the code, not reproduced): the opencode `AGENTS.md`
"Context Loading" list points at `@.opencode/instructions/<name>.md`, relative to the project, but the
global sync writes those files to `~/.config/opencode/instructions/`. It is invisible on this machine
only because that directory is empty.

### 4. How others do it

| | jev-rules | live-rules (Eigenwise) | jev-router (Pratyush Garg) |
|---|---|---|---|
| What | injects project rules | injects project rules | picks the model tier per turn |
| Classifier | hosted Jev (TypeSafe), one batched request per event, one yes/no per rule | none: globs on the edited path, directories, prompt substrings or regexes | hosted Jev, three 10-level scores |
| Events | `UserPromptSubmit`; `PreToolUse` on Edit/Write/MultiEdit; `SessionStart` on clear/compact resets | SessionStart, SubagentStart (global rules), UserPromptSubmit, PreToolUse on Edit/Write | each new user turn, in a loopback proxy |
| Threshold | p ≥ 0.6 (`JEV_RULES_THRESHOLD`); the README says scores sit near 0 or 1 | n/a | `minConfidence` 0.3 |
| Injected | rule body verbatim as `additionalContext`, sorted by p, 9,000-char budget; once per session per rule | rule body; once per session unless it changes | nothing; switches the model |
| Always-on | `always: true`, or no description | a rule with no scope | n/a |
| Latency | claimed 260–520 ms per call, 2 s budget | milliseconds (inferred, no claim) | measured by the author at 300–350 ms warm, 900–1,000 ms cold |
| Failure | fails open: every rule injected, with a note | fails closed: no output on error | keeps the current model |
| Evidence | no recall or precision figures; 131 tests against a mocked Jev | none | notes a 23.6k-token cache rebuild on a model switch, so it refuses to downgrade past 20k context |
| Data | prompt text and file paths go to TypeSafe (US) | nothing leaves the machine | prompt text goes to TypeSafe |

jev-rules' own demo: an 8-prompt session used about 330 rule tokens instead of about 1,390, and a
12-prompt session that touched most topics used about 1,400, breaking even with loading everything.
The saving depends on the rule set being much larger than what any one session needs.

**The model-driven kind** needs no classifier. The model sees a short index and fetches a body when it
judges it needs one:

- **Cursor** rules come in four types: Always Apply, Apply Intelligently (the agent reads the
  description and pulls the rule in), Apply to Specific Files (`globs`), and Apply Manually
  (@-mention).
- **Claude Code** skills: descriptions are in context, the body loads when the skill is invoked.
  `.claude/rules/` files with `paths:` load when Claude reads a matching file, not at launch.
  Hook `additionalContext` is capped at 10,000 characters and inserted where the hook fired.
- **GitHub Copilot**: VS Code attaches an `*.instructions.md` when its `applyTo` matches a file the
  agent creates or changes. Copilot CLI lists every scoped file in a table and tells the model to
  `view` it before changing code (confirmed in the runtime strings, and in every session here).
  Skills load "when relevant".
- **opencode**: global and project `AGENTS.md` and every `instructions` glob are loaded up front. The
  `read` tool attaches a nested `AGENTS.md` when it opens a file below it. There are no conditional
  rules; the docs suggest telling the model to read `@rules/x.md` on a need-to-know basis, which is
  what nav-pilot's export does.

**Compared honestly.**

- *Recall.* Model-driven loading fails silently: the model never opens the file. §1 measures that
  here: 0/67 local sessions, and 41/214 cloud sessions for the security rules. A classifier or a glob
  hook decides independently of the agent's attention, so it cannot forget. But a classifier can still
  miss a paraphrase or be argued out of a rule, and nobody has published a recall figure for one.
- *Latency.* Model-driven: nothing up front, one tool round-trip per fetch. Classifier: 0.3–0.5 s per
  prompt and per new file, every turn. Glob: milliseconds.
- *Prompt cache.* Every approach that appends (hook context, tool results) keeps the cached prefix.
  Anything that rewrites the system prompt per turn, or switches the model, loses it.
- *Tokens.* Model-driven pays for the index on every request (3.5k for 45 skills, 0.7k for the table)
  and a body only when used. A classifier pays nothing when nothing applies. But the budget it can
  save is only the always-on part, which is 2.5–3.0k here.
- *Failure.* A classifier needs a model to be up. jev-rules fails open to "everything", which is
  today's load, so a failure costs nothing it doesn't cost now.

### 5. A design sketch for nav-pilot

**The arithmetic first.** The rules a classifier could leave out add up to 1.3–2.0k tokens:
`deliberate-ai-use`, plus the stale `code-review` on machines that still have it. Leaving them out saves
0.44–0.65 s of cold prefill on optiq and 2.3–3.4 s on Qwen3.8-27B, once per session, and nothing on
warm turns, which carry 80–93 % of input tokens. One warm `alpha decide` call costs 0.22 s on optiq
and 0.40 s on Qwen3.8-27B-OptiQ (p50, n = 21), and the first call of a session took 2.5 s and 4.6 s.
It runs on every prompt. With one question per prompt, the cost passes the saving after 2–3 turns on
optiq and about 6–8 on the 27B, and the first cold call alone costs more than the saving on both. In
cloud sessions, Copilot and opencode's `github-copilot` provider (every cloud row in §1) bill per
premium request, not per token, so fewer tokens save no money there; an API-billed provider would
change that. What is left is about 2–3 % of a 64k window, and whatever attention a model spends on an
irrelevant rule. Nobody has measured that attention cost.

The measured gap is the other way round. Rules that should reach the model do not: the Kotlin rules
on local sessions, and the security rules everywhere. That gap is closed by a glob, not a classifier.

**Design, in the order worth doing:**

1. **Fix the install. No hook, no classifier.**
   - Move the six "Critical Rules" out of `security-owasp.instructions.md` into an always-on file,
     about 150 tokens. The request says these are never filtered; today they are filtered by
     default, by the model.
   - Give every file-scoped instruction a `description`. The table rows for `security-owasp`,
     `golang`, `docker`, `accessibility` and others are empty today, so the model has only a glob to
     go on. This is the cheapest recall fix, and it should be measured (step 3, arm b) before glob
     injection is built.
   - Make `deliberate-ai-use` a skill, or cut it to its rules and drop the sources and the study
     figures, which a model does not need on every request.
   - Make nav-pilot's sync delete agentpakke files that upstream removed (the stale `code-review`).
   - Fix the opencode `instructions/` path.
2. **Glob injection on the first touch of a matching file** (live-rules' pattern, using the `applyTo`
   globs the agentpakke already has). Inject the rule body once per session per rule, and append it,
   never rewrite:
   - Copilot: `postToolUse` on `view`, `edit` and `create` returns `additionalContext`. This is the
     only confirmed add-context point that sees a path. A `postToolUse` on `view` injects before
     the first edit.
   - opencode: `tool.execute.after` appends to the tool output.
   - Dedup state goes next to the loop guard's per-session file (`nav-pilot-loop-guard.json` lives in
     the session folder today).
   - Budget: at most one rule body per event, capped at 10 KB. `kotlin.instructions.md` alone is
     5.3k tokens, 1.7 s of prefill on optiq and 9.1 s on Qwen3.8-27B. Trimming the file-scoped
     instructions is worth doing before injecting them.
   - Fails open to today's behaviour: the table is still there.
3. **`alpha decide` only for rules without a glob, and only if step 6's recall check earns it.**
   - Events: Copilot `sessionStart` is confirmed but sees only the first prompt. `userPromptSubmitted`
     and `userPromptTransformed` need a probe first (§3). opencode: `chat.message`, pushing a text
     part.
   - Batch the questions: evidence first, then one yes/no question per rule. nav-pilot already
     orders decide prompts evidence first, so the second question onwards hits the prompt cache.
     A pre-filter (glob, keyword, later Laya's 7–13 ms encoders) leaves decide only the ambiguous
     rules.
   - Threshold: start at jev-rules' 0.6, then set it from the `--eval` calibration. Missing a rule
     costs more than injecting one, so tune for recall.
   - Fail open to "inject": no server, `local_endpoint` without logprobs, a timeout (1 s), or a
     busy server. `alpha decide` does not start the server. A cloud-only developer, which is most of
     them, would always get every rule, so this step helps only people who already run a local model.
4. **Never filtered:** the security critical rules, output style, and anything a gate enforces.

**Interaction with local sessions.**

- `alpha decide` and a local session share one server that answers one request at a time. A decide
  call on `userPromptSubmitted` runs while the model is idle, so it does not queue. On a tool event
  it waits for nothing, because the model has just finished its turn.
- They also share the prompt cache (`MLX_CACHE_BYTES`: 12 GiB for optiq, 3.25 GiB for the
  Qwen3.8-27B 8-bit opt-in, whose static context alone is about 1.33 GiB). The evidence cap of
  32 KiB keeps a decide prompt small, but on the 8-bit a decide entry could evict a session prefix
  and cost a 39 s re-prefill. Measure this before enabling decide there.
- `local_dispatch`: rules injected into tool results reach whichever agent made the call, so an
  opencode `local-worker` would get them too. That is where recall is 0 today. The dispatch policy
  itself stays an always-on instruction.
- `local_endpoint`: decide works only if the endpoint returns `top_logprobs` (Ollama since v0.12.11,
  capped at 20; llama.cpp yes, per the [Linux report](../2026-09-27-qwen38-linux-ollama/research.md)).
  Fail open otherwise.

**Telemetry**, enums and counts only, in nav-pilot's existing event shape:

- `event`: `prompt` or `file`
- `rule`: the rule's name from the agentpakke (a fixed, public list)
- `outcome`: `injected`, `skipped` or `already_delivered`
- `reason`: `glob`, `decide_yes`, `decide_no`, `always`, or a fail-open code: `no_server`, `timeout`,
  `no_logprobs`, `error`
- `ms_bucket`, and the injected size in 1k buckets

No prompt text, no paths, no probabilities per prompt.

**Opt-in or default.** Step 1 ships as a normal agentpakke change. Step 2 goes behind a config key,
off by default, until step 6 shows no loss in pass rate. Step 3 stays an `alpha` opt-in, like decide
itself.

### 6. Measurement plan

Ordered so that each step can stop the next.

| # | What | Measures | Cost |
|---|---|---|---|
| 0 | **Probes** (no benchmark): a Copilot command hook on `userPromptSubmitted`, `userPromptTransformed` and `preToolUse` returning a marker in `additionalContext`, and a `postToolUse` on `view`; check whether the marker reaches the model's `system.message` or the next request | which Copilot events can inject | ≈ 10 min, a handful of premium requests or one local session |
| 1 | **Rule recall, offline.** A labelled set: 200 prompts (real first prompts from the golden and hybrid sessions, plus hand-written ones in Norwegian and English) × the 4 always-on and 13 file-scoped rules, labelled "applies" by two people before any model run. Run `alpha decide --eval` with the question built from each rule's description, on optiq, Qwen3.8-27B OptiQ and one 64 GB candidate. Score the glob and keyword baseline on the same set, which costs no GPU | recall and precision per rule and model, p-calibration, latency. Bar: pooled recall over the glob-less rules ≥ 0.95 as a Wilson lower bound, which needs at least 73 positives with no miss, so the set must be built with ≥ 100 positives for those rules | 200 × 17 = 3,400 calls: ≈ 13 min on optiq, ≈ 25 min on the 27B, ≈ 45 min GPU for three. Warm server, no agent |
| 2 | **Start cost.** `session.shutdown` `systemTokens` and cold TTFT for four installs: today; step 1 of §5 (security rules always on, `deliberate-ai-use` as a skill, no stale file); no "sometimes" rules; and today with glob injection | tokens and cold prefill saved, per model | ≈ 15 min: np-e2e's latency probe per install on optiq and Qwen3.8-27B |
| 3 | **Quality arms**, frontier ladders and cheap-ops, local (optiq) and cloud (Sonnet 5): (0) no agentpakke rules at all, (a) all rules as today, (a+) every file-scoped rule inlined always-on (the recall ceiling), (b) step 1 install, (c) (b) + glob injection, (d) (c) + decide for rules without globs, only if step 1 clears its bar | pass rate k/n per rung, Wilson 95 %; rules injected or opened per session; decide ms per turn | Local: the base frontier took 145 min per arm on night 1, so six arms ≈ 14.5 h (two nights), plus cheap-ops at about 4 runs per arm (estimate ≈ 2 h per arm, not measured here). Cloud: the base frontier took 104 min and ≈ $14 per arm (night 1 spent $34.71 over 258 min including an invalid pass), so ≈ $84 and 10.4 h for six arms |

**What step 3 can show.** It measures delivery, not quality. At n = 4 per rung, the frontier
cannot tell the arms apart on pass rate, and arms (0) and (a+) are there to bound the effect, not to
detect it. Read
arm (b) and (c) against (a) as non-inferiority on the routing bar, not as a gain. What these runs can
show clearly is rule delivery: the share of Kotlin-editing sessions that got the Kotlin rules (0/67
local today). A quality effect of the rules themselves needs a task where a rule changes the right
answer. An example is a cheap-ops cell that logs a token, where the security rule decides pass or
fail. That cell does not exist yet and is the first one to write.

Nothing in this plan measures the attention cost of irrelevant rules either; that needs the rule
cell above run with and without unrelated always-on text.

Total: about 45 min of GPU for the offline recall, 15–17 h of local GPU (two nights), and about $85
of cloud credits for the arms.

## Verdict

Not now, and not in the jev-rules shape. The data support three statements.

- A nav-pilot session starts at ≈ 23k Qwen tokens in Copilot, and nav-pilot's agentpakke controls
  only ≈ 8k of them. Of those 8k, ≈ 4.2k are already selective (skills, the `applyTo` table). About
  3k are always-on rules, and of those only 1.3–2.0k are candidates for filtering.
- Filtering them saves 0.4–0.7 s of cold prefill on optiq and 2–3.5 s on Qwen3.8-27B, once per
  session. That is less than a per-prompt decide call costs within a couple of turns, and cloud
  sessions save no money, because Copilot bills per request.
- The problem worth fixing is recall of the rules nav-pilot already scopes. No local model opened a
  file-scoped rule in the four bench tasks (67 runs), and `nav-pilot` cloud sessions opened the
  security rules in about a third of the sessions that edited code (37/117). The fixes are an
  install change (security rules always on, descriptions on every scoped rule, `deliberate-ai-use`
  as a skill, prune stale files) and, if descriptions are not enough, a glob-triggered,
  append-only injection on the first touch of a matching file. Neither needs a classifier.

`alpha decide` (or Laya after 29 Sep) only earns a place for rules that have no glob, and only if the
offline recall check reaches ≥ 0.95. Nothing here shows that injecting the rules improves pass
rates. That is what arms (b) and (c) are for, and they need a cell where a rule decides the answer.

## Limits

- **Tool definitions and the agent list** are Copilot's estimate, scaled by the system prompt's
  Qwen/Copilot ratio (1.056). They are not in the event log, so they are not tokenized here.
- **One install.** The Copilot figures come from this machine's `~/.copilot`, which has nais/pilot
  on top of navikt/copilot and a stale `code-review` file. A navikt/copilot-only install is inferred
  from the golden-test session (`833d6063`) and the clone inventory. opencode's first-request sizes
  are opencode's own count, including tools and the first prompt, in the provider's tokenizer for
  cloud rows.
- **Recall is mechanical.** "Opened the rule" is any tool call that names the file. A model that
  already knows Kotlin idioms may not need the file. All sessions are benchmark or golden-test
  sessions, not real work, and they cluster on a few prompts (four for all 67 local runs), so the
  intervals are too narrow. The one matched comparison is 0/24 cloud against 0/18 local. What drives
  the 77/90 in the golden tests (prompts, a 53-row table with duplicates, model) is not separated.
- **`rule_load.py session`** files everything inside `<custom_instruction>` under "always-on". For
  the three sessions cited that block holds only agentpakke files, but in a repo with its own
  `copilot-instructions.md` the script would fold that into the same line.
- **Prefill** is linear interpolation between two cold probes per model, on one M-series machine.
  The optiq figure comes from the 64 GB profile.
- **Unverified client behaviour**: `userPromptSubmitted`/`userPromptTransformed` command-hook
  injection, `preToolUse` `additionalContext`, SDK instruction removal from a joined extension, and
  whether mutating opencode's `config` hook sticks. Step 0 of the plan settles them. The opencode
  `instructions/` path bug is read from the code, not reproduced.
- **jev-rules, live-rules and jev-router** latency figures are the authors' own. None publishes
  recall.
- **What would change the verdict:** a rule set much larger than 3k always-on tokens (a team pakke
  with many always-on files), a measured quality loss from irrelevant rules, or a decide/Laya recall
  ≥ 0.95 at under 50 ms, which would make per-prompt classification cheap enough to be worth it for
  the long tail.

## Reproduce

```bash
# From this folder, with the workspace venv (read-only, offline tokenizer):
../../.venv/bin/python rule_load.py session ~/.copilot/session-state/54a42fc6-* ~/.copilot/session-state/f16dc902-* ~/.copilot/session-state/833d6063-*
../../.venv/bin/python rule_load.py pakke ~/tmp/selective-rules/copilot ~/tmp/selective-rules/pilot
../../.venv/bin/python rule_load.py recall
# opencode first-request sizes:
sqlite3 -json ~/.local/share/opencode/opencode.db "select m.data from message m join (select session_id, min(time_created) t from message where json_extract(data,'$.role')='assistant' group by session_id) f on f.session_id=m.session_id and f.t=m.time_created"
```

The session-state and opencode data are local to this machine and are not committed. The session
IDs above name the files.

## Sources

- Result files: [`bench/np-e2e-qwen3.6-35b-a3b-optiq-64g-20260926-234608.json`](../../bench/np-e2e-qwen3.6-35b-a3b-optiq-64g-20260926-234608.json),
  [`bench/np-e2e-qwen3.8-27b-optiq-4bit-20260924-181038.json`](../../bench/np-e2e-qwen3.8-27b-optiq-4bit-20260924-181038.json),
  [`bench/np-e2e-qwen3.8-27b-8bit-64g-20260926-234818.json`](../../bench/np-e2e-qwen3.8-27b-8bit-64g-20260926-234818.json),
  `bench/np-e2e-occamy-1.0-4bit-64g-20260927-162612.json` (uncommitted when written: in the main
  checkout from the running night)
- Earlier reports: [decision.md §3.4](../2026-09-23-local-model-evaluation/decision.md) (static
  context 45.1k → 21.7k, #932), [evaluation-log.md](../2026-09-23-local-model-evaluation/evaluation-log.md)
  (the 80 % gate), [quality frontier night 1](../2026-09-25-quality-frontier/night-1.md) (arm
  durations and cloud spend), [Jev-like features](../2026-09-24-jev-like-features/research.md),
  [decide as a service](../2026-09-26-decide-as-a-service/research.md),
  [Qwen3.8 and Linux](../2026-09-27-qwen38-linux-ollama/research.md) (logprobs per engine)
- navikt/copilot d24cac4: `cli/nav-pilot/internal/cli/hook_cmd.go`, `internal/cli/alpha_decide.go`,
  `internal/source/hooks.go`, `internal/provider/dispatch-gate.js` (#999),
  `internal/provider/copilot_launch.go`, `internal/artifacts/export.go` (`buildLeanAGENTSmd`),
  `internal/cli/config_cmd.go`
- nais/pilot, main on 2026-09-27
- jev-rules: https://github.com/EliaAlberti/jev-rules (a2b0dd3, v0.5.0): `plugins/jev-rules/hooks/hooks.json`, `lib/jev.mjs`, `run.mjs`
- live-rules: Eigenwise toolshed `plugins/live-rules` (2e0f2bb): `hooks/lib/rules.js`, `WHY.md`
- jev-router (Pratyush Garg, 38da6b8): `src/config.mjs`
- Copilot CLI 1.0.89-5 bundle: `changelog.json` (entries for 1.0.11, 1.0.24, 1.0.49, 1.0.51, 1.0.65),
  `copilot-sdk/types.d.ts:853-918, 1113, 1222-1250`
- GitHub docs: https://docs.github.com/en/copilot/reference/hooks-configuration,
  https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions,
  https://docs.github.com/en/copilot/concepts/agents/about-agent-skills
- VS Code: https://code.visualstudio.com/docs/copilot/customization/custom-instructions
- Cursor: https://cursor.com/docs/context/rules
- Claude Code: https://code.claude.com/docs/en/skills, https://code.claude.com/docs/en/memory,
  https://code.claude.com/docs/en/hooks
- opencode b471c2b: `packages/plugin/src/index.ts:222-335`, `packages/opencode/src/session/instruction.ts`,
  `session/llm/request.ts:56-78`, `tool/read.ts:300`, `packages/web/src/content/docs/rules.mdx`
