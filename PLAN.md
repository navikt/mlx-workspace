# What we are doing next

> **Living document.** The single tracker for outstanding work. Finished write-ups live in
> [`reports/`](reports/), the design behind individual experiments in [`working/`](working/).
> This file says what to do and why; it does not repeat their reasoning.

Last touched 31 August 2026, the day the alpha shipped.

**Landed since:** the delta-counter fix (#529) and the news figure (#524) are in main;
the Qwen3.8 correction (#532) is queued; and 30 of the 31 dependabot alerts were closed
by someone else (#525), so that stops being ours.

## Where things stand

The release is in brew, the news post is published, the docs carry the local-model section,
and the first field telemetry is arriving. Nothing below is urgent, which is exactly when the
wrong thing gets worked on — so it is ordered by what would be worst to leave.

## 1. Ambiguity we are still shipping

**Add `saw_traffic` to the guard.** Every session recorded before it exists is permanently
ambiguous, and it only reaches developers through a release plus their update lag, so the
clock on useful data starts late.

A session that dispatched nothing is one of three things and we currently report it as one:
opencode never accepted the wiring, there was no dispatchable work, or the orchestrator saw
the worker and declined. Only the third is a finding. The guard already sees the difference
and throws it away — whether it forwarded *any* request, model-list included. Traffic but no
completions means the client saw the provider and declined; no traffic means the wiring never
arrived.

One counter, one attribute on `RecordLocalSession`. Until it ships, no report says "the
orchestrator chose not to dispatch".

**Ask the two alpha users** whether their sessions had local work to hand off. One message,
and it separates "no dispatchable work" from the other two this week without waiting for a
release. Needs a person, not a script.

## 2. Telemetry

Counters were exported delta and **every one was silently dropped, fleet-wide** — not just
local inference. Cumulative since 31 August, verified live.

**The audit is done and everything it found is merged.** A reusable script asks the
questions a panel cannot ask about itself — `scripts/telemetry-audit.py` in `navikt/copilot`
([#548](https://github.com/navikt/copilot/pull/548)). Eight PRs, all in main:

| | |
|---|---|
| [#546](https://github.com/navikt/copilot/pull/546) | the docs claimed minutes; the fleet said under 50s. Also fixed `start` beginning a silent 23 GB download |
| [#547](https://github.com/navikt/copilot/pull/547) | the ready histogram recorded only successful starts, so its slow tail was missing by construction |
| [#548](https://github.com/navikt/copilot/pull/548) | the audit script |
| [#549](https://github.com/navikt/copilot/pull/549) | `DO_NOT_TRACK=1` still shipped the repo name to Nav's collector |
| [#551](https://github.com/navikt/copilot/pull/551) | cut two duplicate instruments; `device_id` on the seventeen that lacked it |
| [#553](https://github.com/navikt/copilot/pull/553) | the dashboard, every query run against Mimir first |
| [#558](https://github.com/navikt/copilot/pull/558) | `launch_error_total` counted Ctrl-C as a launch failure; three labels fell through to their fallback |
| [#559](https://github.com/navikt/copilot/pull/559) | autostart started servers and recorded nothing — the common path was invisible |

**What is left is a release, and it is the whole of what is left.** `saw_traffic` and
`outcome` both shipped after the last one, so three dashboard panels are empty until people
update — including the zero-rate split that decides whether the alpha widens. Nothing more can
be learned from the field until that goes out.

**Two corrections worth keeping.** `sum_over_time` on a cumulative counter is only a count for
an instrument recorded once per process at exit; one recorded at startup is re-exported every
10 seconds by the PeriodicReader, and summing those snapshots means nothing. That makes the
earlier reading of `version_skew_days` — a tail out to 7500 days — an artefact. The largest
single observation is 114 days. And `histogram_quantile` over `sum_over_time` of `_bucket` is
correct for the once-per-process instruments, which is the opposite of what this file said
before the measurement.

## 3. The night of 31 August, and what it left

Three harness faults found in one night, all of which produced numbers that looked like weak
models, none of which raised an error:

- **The default model's Kotlin workspace held a TypeScript repo.** A frontend run reused
  `workspaces/qwen3.6-35b-a3b-optiq/kotlin`. The suite scored the shipped default 0 of 11 on
  tasks it passes 4 to 6 of 8 on, every failure reading "no changes made". The model was right:
  the symbols were not there. `bench-models` now refuses a workspace whose remote is not the
  repo `tasks.json` names.
- **`bench-models` named every result after the first profile in the queue**, because it called
  the suite with `python3` rather than `mise run` and inherited the launch-time profile. Three
  models wrote one filename, each overwriting the last. Recovered from `bench/.previous` only
  because the harness backs up before writing.
- **`MLX_CHAT_TEMPLATE` never worked on the mlx-lm path.** `--chat-template` takes the template
  text; we passed a path. The path became the template, rendered to itself, and every prompt
  became a filename. `profiles/ministral-3-14b.toml` has said `status = "broken"` with
  "hallucinated YAML (fake template file paths), root cause unclear" since June. That was this.

And one in production, worth more than the three: **manifest params never reached the server**
([#563](https://github.com/navikt/copilot/pull/563)). nav-pilot passed them as environment
variables and mlx-lm reads one variable in its whole package. So the fleet has been running
with thinking on and greedy decoding while every benchmark ran with thinking off at
temperature 0.6. The loop guard was built for runs of 203 and 220 identical tool calls measured
in that state, and greedy decoding is the documented cause of exactly that. **Re-examining the
guard against a correctly configured server is now the most interesting open question here.**

**Still open:**

- **Qwen3.8-8bit is unmeasured.** Two runs verified nothing with zero turns per task, under two
  confounds of ours: a `reasoning_effort: medium` pin added the same night, and a 420s task cap
  against the 900s its historical figure used. One run with the pin removed settles it.
- **The variance is the finding, not a nuisance.** Qwen3.8-4bit ran 1 of 8 and then 5 of 8 two
  hours apart on the same machine. n=2 is enough to know it is unstable and not enough to say
  what it is worth. n>=5 on both models is the next measurement that would change advice.

## 4. Beslutning: oMLX som backend for valgfrie modeller

Tatt 1. september. **oMLX legges til som backend for opt-in-modeller, med mindre kveldens
kjøringer sier noe annet.** mlx-lm blir værende for standardmodellen.

Kriteriene skrives ned før tallene foreligger, fordi rekkefølgen er hele poenget — en terskel
satt i etterkant er en beskrivelse, ikke en test.

| Utfall av MTPLX-kjøringene | Hva vi gjør |
|---|---|
| MTPLX slår mlx-lm 8-bit klart, og fordelen **består** med prefiks-cache av | Fordelen er MTP. Prøv [mlx-lm #990](https://github.com/ml-explore/mlx-lm/pull/990) som patch på dagens stack først — timer, ikke dager. oMLX bare hvis patchen ikke bærer. |
| MTPLX slår mlx-lm 8-bit klart, og fordelen **forsvinner** med cachen av | Fordelen er prefiks-cachen, som er oMLX-spesifikk og ikke finnes oppstrøms. **Bygg backend-støtten.** |
| MTPLX slår ikke mlx-lm 8-bit meningsfullt | oMLX kjøper oss ingenting målbart her. Ikke bygg. Noter og gå videre. |
| Kjøringen feiler av harness-grunner igjen | Ingen konklusjon. Fiks harnesset, kjør på nytt. Ikke tolk en feilet kjøring som et resultat. |

«Klart» betyr her: forskjell større enn spennet vi allerede har målt mellom identiske kjøringer
av samme profil. Det spennet er 1 til 7 av 8 for Qwen3.8-4bit, så terskelen er høy med vilje.

### Kjøringene som må gjøres

Fire, i rekkefølge. De to første avgjør; de to siste validerer implementasjonen.

| # | Kjøring | Svarer på |
|---|---|---|
| 1 | `qwen3.8-27b-8bit` (oMLX MTPLX), standard oppsett | Slår MTPLX mlx-lm 8-bit i det hele tatt? |
| 2 | Samme, med prefiks-cache av | Er gevinsten MTP eller cachen? Dette er beslutningen. |
| 3 | Samme modell, samme vekter, gjennom **mlx-lm** | Kontrollen. Uten den sammenligner vi to runtimes *og* to konfigurasjoner samtidig. |
| 4 | `qwen3.8-27b-8bit-nopin` | Var kollapsen 1. september vår `reasoning_effort`-pin eller modellen? |

Kjøring 3 er den lette å hoppe over og den som gjør de andre tolkbare. Vi har allerede
`qwen3.8-27b-8bit-mlx` som profil, så det er ingen ny konfigurasjon — bare disiplin.

Alle fire kjøres med `mise run bench-models`, som nå nekter å måle en feil workspace, en modell
serveren ikke faktisk serverer, eller en server som svarer tull. Alle tre feilene har produsert
publiserte tall før de ble fanget.

Etter implementasjon, før pilot: én kjøring gjennom **nav-pilot selv**, ikke harnesset. Harnesset
og nav-pilot har vist seg å kjøre forskjellige konfigurasjoner én gang allerede
([#563](https://github.com/navikt/copilot/pull/563)), og det er nøyaktig den feilen en ny backend
kan gjenta i det stille.

### Arbeidet, hvis det bygges

`Backend`-feltet finnes i manifestet på hver eneste oppføring, står på `"mlx-lm"`, og **leses
null steder**. Det var ment som nettopp denne kroken.

- **Gjøres uansett:** valider `Backend` mot en lukket allowlist i `Parse`. Manifestet hentes
  over nettet, så feltet velger hvilken binær som startes på 250 maskiner. Ukjent backend skal
  nekte å starte, ikke falle tilbake. Hullet finnes i dag, uavhengig av oMLX.
- Oversett modell-id `/` til `--` fire steder: ready-proben, opencode-provider-blokka,
  modellnøkkelen der, og `COPILOT_MODEL`.
- `Server.Start` forgrener på backend; `serverFlags` får eget vokabular per backend.
- `EnsureEnv`: eget venv, hjul pinnet på sha256. oMLX pinner `mlx==0.32.0` eksakt og kjernene
  er ABI-koblet — en delt venv ødelegger ytelsen stille.
- Provisjonere `~/.omlx/model_settings.json` for default-modell og MTP; det finnes ikke flagg.
- `backend`-attributt på de lokale instrumentene, fra første commit. Uten det blander
  histogrammet to populasjoner igjen, som er feilen vi brukte 31. august på å rette.
- Tving `--host 127.0.0.1` og `--api-key`, og håndter `omlx.ai`-opplastingen.

**Rekkefølge, fire faser.** Hver fase er sendbar for seg og etterlater repoet grønt.

1. **Allowlist først, uten oMLX.** Valider `Backend` i `Parse` mot `{"mlx-lm"}` alene. Da er
   hullet lukket før noe nytt kan gå gjennom det, og manifestet kan ikke velge binær. En halv dag.
2. **Oversettelseslaget.** Modell-id per backend, de fire stedene, med test. Fortsatt bare
   mlx-lm i allowlisten, så ingenting endrer oppførsel ennå. En halv dag.
3. **Backenden.** `EnsureEnv` med eget venv og sha256-pinnet hjul, `Server.Start`-forgrening,
   `serverFlags` per backend, `model_settings.json`, `--host`/`--api-key`. Legg `"omlx"` i
   allowlisten sist, som siste linje i siste commit. En til to dager.
4. **Instrumentering og pilot.** `backend`-attributt fra første commit, ikke etterpå. Så én
   liten ring, med `omlx.ai`-egress blokkert.

Anslag: to til tre dager, dominert av venv-provisjoneringen og settings-filen. Guarden,
loop guard, `saw_traffic`, wired-limit og weights-sjekken er uendret — det er utbyttet av at
alt ligger bak en proxy.

## 5. Measurements that are not finished

**Rerun the scale ladder at n≥10.** Three runs say the pass rate *rises* with size — 124
references across 59 files is the only rung that passes every time — which is the opposite of
what the experiment was built to find. Before writing that anywhere:

- verify the tree really resets between tasks within a run. The two small-task failures
  anti-correlate across runs, which is the signature of shared state rather than chance
- read the two failing transcripts. One declined after 2 tool calls; the other explored for 17
  and still changed nothing. Those are not the same behaviour

**Retest Qwen3.8-27B, but not by repeating the ladder blind.** Three attempts have failed for
three different harness reasons, the last because the server was serving the 6-bit build while
the profile said 8-bit. The published claim is specifically that it *loops*, so test that:
the two or three tasks that looped worst, corrected template, loop guard in observe-only mode
recording the longest identical run rather than aborting the turn. That separates "the model
loops" from "our guard fired", which a pass/fail ladder cannot.

Preconditions, both now met: the template passes all four shapes in
`mise run bench-template-check`, and the runner asserts the server's reported model matches
the profile before measuring.

## 6. Suite hygiene that compounds

- **Move the model-identity assertion into the harness.** It lives in a scratch script and it
  is the only reason we know a run was served the wrong model. A result taken without it is a
  result about an unknown model.
- **Convert the four `manual` tasks** to machine checks. A quarter of capability-ladder
  samples have never been judged and never will be; they already carry `expect_terms`.
- **Next.js target**: not measurable for compile-verified rungs, because the repo has no
  typecheck script and bare `tsc` fails on an untouched tree. Suite-verified rungs work.

## 7. Open questions worth an experiment

From [`working/limits-benchmark-plan.md`](working/limits-benchmark-plan.md), in the order they
would change a decision:

- **Decision-shaped tasks.** The report's spine — applies well, decides badly — rests on two
  task shapes that are *both* creation tasks. It is possible we measured "cannot create" and
  wrote down "cannot decide". This is the experiment that could weaken the central claim,
  which is a reason to run it rather than a reason not to.
- **Long context.** Every sample is a fresh session on a clean tree; real work is neither.
- **A bigger model.** This machine has 128 GB; the 48 GB ceiling was the alpha target's. The
  question is not whether a larger model is better but whether it moves the break-even.

## 8. Bringing your own model

Asked for on 1 September: let people run their own models, and pick up an Ollama or similar
runtime they already have. Both are worth doing and the second is smaller than it sounds,
because of where the seam already sits.

### What the code already gives us

The manifest entry is close to the right shape. `Model` carries `Key`, `Name`, `Model`,
`Backend`, and `Params` as an untyped `map[string]string` — deliberately untyped, so a new
knob is not a nav-pilot release. `Backend` is declared `"mlx-lm"` on every entry and **read
nowhere**: it is a placeholder in the schema, not a mechanism. That is the hook to build on,
and building on it means writing the dispatch that was never there.

The bigger gift is the guard. It is a `httputil.NewSingleHostReverseProxy` in front of
`http://127.0.0.1:<port>`, and opencode is pointed at `guardURL + "/v1"`. It speaks
OpenAI-compatible HTTP and does not care what is behind it. Every instrument we spent
31 August fixing — dispatch counting, the loop guard, `saw_traffic` — lives in the proxy, not
in the backend, so all of it keeps working against a different server for free.

### 6a. Custom profiles

A user-supplied entry merged into the resolved manifest, so `alpha local start`, the model
picker and `Lookup` treat it like any other.

One trap to design around, not discover: `Resolve` writes the fetched manifest to
`~/.nav-pilot/local-models.json` and that file is the cache. User entries cannot live there —
the next successful fetch silently overwrites them, and the developer loses their profile to a
background refresh they never asked for. They need their own path, merged at read time, with
the served manifest winning on `key` collisions so a curated entry cannot be shadowed by an
old local copy of itself.

Worth stating in the CLI, once: our entries carry measured `params` — cache size, context,
`top_k`, chat-template args — and a hand-written entry carries guesses. The 4-bit-versus-OptiQ
choice in the shipped profile exists because the plain build produced a ~200-call runaway tool
loop at the 36 GB cap. A model that loads is not a model that works, and the only way to know
which one you have is `mise run bench` in this repo.

### 6b. Adopting a runtime that is already running

Ollama serves an OpenAI-compatible API on `127.0.0.1:11434`. So this is mostly *not* a new
backend: it is a profile that says "already running, at this URL, do not manage it", and a
guard pointed there instead. `EnsureServerRunning`, `Server.Start`, `CheckWiredLimit`,
`WeightsPresent`, `DownloadWeights` and the readiness probe are all skipped, because none of
them is ours to do.

Skipping them has a cost that has to be paid deliberately, and it is exactly the mistake we
spent the day fixing: `nav_pilot_local_ready_seconds` would acquire a second population with
no start time, no wired-limit gate and no weights gate. Either those sessions carry a
`backend` attribute from the first commit, or the histogram quietly starts mixing two things
again. Add the attribute first; it is cheaper than the correction.

An `import` that lists what `ollama list` already has and writes profiles for them is the
friendly front door, but it is the second commit, not the first. The first is: point the guard
at an arbitrary base URL, prove a dispatch lands, and see the counters move.

### 6c. The warning that is already measured

`mise run bench-template-check` says **ten of eleven cached models break on tool arguments in
the OpenAI wire format**; only `granite-4.1-8b` is clean. It has never affected our results
because mlx-lm normalises arguments before rendering. **Ollama applies its own templates**, so
a model that behaves under nav-pilot today can mangle tool calls the moment it is served by a
different runtime — and the failure looks exactly like a weak model: no turns, no tool calls,
nothing edited. That is not a guess about Ollama; it is the same confound that produced our
own false "Qwen3.8 loops" verdict.

So this belongs in the feature, not in a footnote: run the template check against an imported
model before offering it, and say plainly which shapes it fails. Also the reason to add the
finding to [#521](https://github.com/navikt/copilot/issues/521), which proposes Ollama for
Linux and would hit it first.

## 9. Filed, owned elsewhere, not ours today

- [#521](https://github.com/navikt/copilot/issues/521) Linux support. Needs the requester's
  hardware first. **Add the template finding to it**: ten of eleven model templates break on
  tool arguments in the OpenAI wire format, and only mlx-lm's normalisation hides it — anyone
  pointing Ollama at these weights hits it directly.
- ~~[#523](https://github.com/navikt/copilot/issues/523) dependabot~~ — 30 of 31 closed by
  #525. None were ever in the Go CLI.
- Eight review threads from #483: `os.Rename` EXDEV, `startProcess` ignoring its context, a
  `slices.Clip` allocation, Tailwind-versus-Aksel tokens, two docs threads.
- `chat_templates/deepseek-v4-flash.jinja` breaks on three of four shapes. That model is not a
  candidate, so this is a note rather than a task.

## The rule

**One run is not a measurement.** Every reversal on the night of 31 August came from a second
sample, not from better thinking. n>=5 before a number informs advice, and publish the range
rather than the median whenever the two disagree about what happened.

Two questions decide whether something belongs above the line: **are we telling anyone
something we cannot support**, and **can the evidence be reconstructed by someone else**. The
suite lost a run this week and the table built from it was wrong; that class of problem
outranks any single measurement.
