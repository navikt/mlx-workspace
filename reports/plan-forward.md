# Plan forward, 29 August 2026

The model question is closed. `mlx-community/Qwen3.6-35B-A3B-4bit` runs the alpha, and Qwen3.8-27B
is held back because it loops on tool calls. The evidence is in
[`alpha-model-decision.md`](alpha-model-decision.md). Everything left is engineering.

## Stop testing models

Nine configurations were measured in one clean pass, and the ranking of what moves the numbers is
recorded in [`../MODELS.md`](../MODELS.md), with model choice near the bottom. Spec precision,
output caps, backend choice and sampling each beat it. The remaining model work is one repeat run of
the chosen model, for a range instead of a single sample.

## Four gates before a user touches this

**The tool-call loop.** Qwen3.8-27B ran the same `rg` command 113 times after a successful edit, and
`repetition_penalty` at 1.05 turned a 15-call loop into a 40-call one while improving the median.
Until the cause is known, the better code writer cannot ship, and we do not know that the chosen
model is immune outside these eleven tasks. Detection is cheap: identical consecutive tool calls are
already counted per task, so the client can cut a session off instead of hanging.

**The server has to survive a working day.** Issue #11. It crashes rather than degrades:
`EXC_BAD_ACCESS` on a stack guard page inside MLX's recursive graph walk, on the generation thread.
The socket dies with it and every later request gets connection refused. The benchmark restarts
between tasks. A developer will not. Either find the cause or ship a supervisor that restarts on a
health check.

**KV growth needs a bound the alpha can set.** `mlx_lm.server` does not expose `--kv-bits`,
`--quantized-kv-start` or `--max-kv-size`, though the library supports all three and
`stream_generate` takes them as keyword arguments. `--prompt-cache-bytes` is parsed and never
applied, because `LRUPromptCache` is constructed without `max_bytes` at `server.py:1743`. Three
upstream issues, open since November, no PR. It is a contained patch and it is ours to write.

**Instructions are per-client.** opencode reads `AGENTS.md`, Copilot CLI reads
`.github/copilot-instructions.md`. Without the file, Copilot CLI found the call sites it needed to
change, announced it would edit them, and changed nothing. Issue #8. Getting this wrong also
corrupts measurement: our own `AGENTS.md` carried an unclosed think tag that made two models look
broken for a day, and opencode was adding 37,807 characters of unrelated config until `--pure` and a
benchmark-only `XDG_CONFIG_HOME` cut it to 11,191.

## Compose with grillmester, do not rebuild it

`navikt/grillmester` already ships the agent payloads through a Tier 2 agentpakke contract wired to
nav-pilot, and deliberately does not own model selection: `defaultModel: "inherit"`, no catalog.
`mise run model-manifest` generates `manifest/models.json` from `profiles/`, which fills exactly that
gap. We contribute the model layer and leave `grillmester local setup|doctor|launch` alone. Issue
#14.

## Sequence

| Phase | Work | Done when |
|---|---|---|
| 1 | The loop (root cause or client-side cutoff), issue #11, three repeat runs of the chosen model | The server survives a day, no session hangs, and the headline numbers have a range |
| 2 | The KV flags patch, and per-client config generation (#8) | Context growth is bounded and both clients get instructions from one source |
| 3 | `manifest/models.json` into the agentpakke contract (#14) | A developer runs grillmester's existing setup and gets a model |
| 4 | Premium request distribution (#2), success metric agreed, then five volunteers (#9) | We know who to invite, what we are counting, and by when we stop |

Phases 3 and 4 need people outside this repo, so start the conversation for #2 now.

## What would kill this

- **The loop is not specific to Qwen3.8-27B.** If the chosen model hangs the same way on a
  repository larger than the benchmark's, the alpha has no model.
- **The crash has no clean fix.** A local assistant that silently stops working is worse than none,
  because the developer keeps prompting into a dead session.
- **The waiting is unacceptable in practice.** A 12.7s median is fine on paper. Nobody has measured
  what it feels like across a working day, and the benchmark cannot tell us.
- **The overage is not concentrated.** If heavy users are not a distinct group, routing their cheap
  operations locally does not move the invoice. Issue #2 is what tells us.

Nothing here addresses the seat price. Nav pays roughly 1.8x Enterprise list, local models do not
touch that, and it is worth more than this project is. Run it in parallel, not behind it.
