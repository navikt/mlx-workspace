# Local inference alpha: state and outstanding work

Written 29 August 2026. The tracking file for `navikt/copilot#483` and everything around it.
Update it rather than remembering.

## Verified working, on real hardware

| Thing | Evidence |
|---|---|
| `alpha local init/start/stop/status/off` | Run on this machine. Server ready in ~20s warm, 21.0 GB resident |
| Dispatch through nav-pilot to opencode to the local model | Correct edit in 11 to 13 seconds, cplt audit intact |
| Worker bound to the local model | `opencode debug agent lokal-arbeider` resolves `mlx/mlx-community/Qwen3.6-35B-A3B-OptiQ-4bit` |
| **Copilot CLI against the local server** | `COPILOT_PROVIDER_BASE_URL=http://localhost:8080/v1` plus `COPILOT_PROVIDER_TYPE`, `COPILOT_PROVIDER_API_KEY`, `COPILOT_MODEL`, `COPILOT_OFFLINE=true`. Edit made in 10s |
| **Cloud orchestrator dispatching to the local worker** | Claude Sonnet 5 as main agent dispatched through the task tool to `lokal-arbeider`; the local server served four completions and the edit landed. Sonnet then read the file back to confirm, which is the dispatch fragment working: it tells the main agent to check that the file actually changed, because the local model's commonest failure is announcing an edit it did not make. Also proves opencode's task tool honours a provider-config binding even though it ignores model frontmatter |
| Loop guard | Mutation-tested: neutering the gate forwards a prompt to a server nav-pilot cannot vouch for |
| Server log | Mutation-tested: removing the wiring leaves a crash report with nothing to read |
| Port ownership | Refuses a port it does not own, at `start` and per request behind a 3s cache |
| `stop` identity | Refuses to signal a pid whose recorded start time does not match |

## Blocking the alpha: nothing

Reviewed four times. The final verdict is ship, for five users on opencode. The last blocker,
the worker agent leaking into two generated catalogs where it would have run on the premium
cloud model while claiming to be free, is closed by `593fae43`: excluded through a flag all
three generators already honour, verified in every catalog, with a regression test, and
nav-pilot's own materialisation proven not to route through it.

## Found after the ship call, fixed

**Local setup was gated on the session model, not on dispatch being enabled.** A cloud main
agent with a local worker, which is the entire point, got no binding, no dispatch fragment and
no loop guard. Hand testing missed it because an earlier local-model session had written those
markers and they persisted; the automated harness caught it on its first run by asserting what
appeared after a launch from a clean state. Fixed in `6abd51b0` and re-verified end to end.

**Still open, from the same review:** `LaunchOpenCodeStaged` does no local dispatch setup at
all, and `LaunchCopilotStaged` never hits the refusal the legacy Copilot path has, so a staged
launch with a local model id sends it to GitHub.

## Follow-ups, outside the alpha's blast radius

0. **A crash window in `RemoveOpenCodeLocalPolicy`**: the policy file is removed before the
   instructions entry, so a crash between them leaves opencode's config pointing at a deleted
   file. Same class as the one fixed a level up, harmless in practice, worth closing.

## Outstanding, not blocking

3. **Copilot CLI support in nav-pilot.** The branch refuses the Copilot launch for a local model, on the belief that its endpoint cannot be overridden. That belief is now disproven. Needs the env wiring, and the loop guard has never been exercised from Copilot CLI.
4. **`local_autostart`.** Start the server during an interactive launch, config key plus flag, default off. Must refuse rather than fall back to cloud, must be honest about a cold start taking minutes, must not auto-stop on exit because the prompt cache is worth more warm.
5. **Corrections to the reports from the prior-art research**, listed below.
6. **Telemetry for the orchestration-to-dispatch ratio.** Deliberately out of alpha scope, and it is the number that decides whether any of this saves money.
7. **Spring and TypeScript numbers are one and two samples.** Nothing has three.

## Corrections owed to our own documents

- **"Small models loop" is unvalidated.** Infinite Agentic Loops is an established failure class: 68 confirmed cases, 95.6% causing cost exhaustion, 100% sharing "missing strong bound" as root cause, and the literature does not find that smaller models loop more. The guard is the right fix; the attribution to model size is ours and unsupported.
- **No one has measured a reduction in paid request count under a per-request cap.** Every published result measures tokens or dollars. Nav's cap counts requests, so those numbers do not transfer and our reports must not borrow them.
- **The orchestrator eats about half the saving.** HERA offloads 45.67% of subtasks for a 19 to 30% cost reduction.
- **Copilot CLI reads `AGENTS.md`.** `copilot --help`: "Disable loading of custom instructions from AGENTS.md and related files". Our claim that instructions are strictly per-client was wrong.
- **opencode strips `model:` frontmatter from subagents**, a known bug closed as not planned (opencode#35126), so binding must happen in the provider config. This is why the worker silently ran on the cloud model until `cc9e7d71`.

## Known ceilings, accepted for the alpha

- The manifest is unsigned. Integrity rests on TLS and write access to the generating repo, with the publisher and parameter allow-lists bounding the blast radius. Recorded in the package doc.
- One guard per machine on a fixed port. A second concurrent session is a clean bind failure.
- The ownership check has a 3 second window: the server can die between the proof and the write.
- Two of the four benchmark stacks are single runs.

## Prior art worth knowing

Docker `cagent` binds a model per agent statically. Cline binds Plan and Act separately and documents it for local models. Aider's architect/editor is the same split, cloud to cloud. HERA and AIMS partition subtasks between a local small model and a cloud model with an automatic router. **Goose removed its lead/worker split rather than extending it**, and no system found lets the cloud model choose per task when to offload: routing is pinned to a role or to a trained classifier. Our dispatch fragment asks the cloud model to decide, which is the untested part of the design.
