# Model evaluation notes

> **Append-only run log.** Entries record what happened on a date and are corrected by
> appending, never by editing: a result that changed silently is worse than a wrong one.
> Finished analyses built on this live in [`reports/`](reports/); superseded eras move to
> [`archive/`](archive/). This file is neither finished nor a draft, so it does not migrate.


Observations from running models locally on Apple Silicon and driving them from `opencode` /
`aider`. Every measurement is tagged with the rig it was taken on. Numbers do not transfer between
rigs. How the benchmarks are run, verified and quarantined is in
[`BENCHMARKING.md`](BENCHMARKING.md); this file records what they produced.

> **Note on sizes:** *disk size* (from `mise run model-list`) and *VRAM footprint* are different.
> Disk includes tokenizer, configs and safetensors. VRAM is the loaded inference footprint.

## Verdict

Run **`mlx-community/Qwen3.6-35B-A3B-OptiQ-4bit`** under mlx-lm with thinking disabled. The plain
4-bit build of the same weights is equally fast and produced a roughly 200-call runaway tool loop in
both full passes at the 36 GB cap; OptiQ produced none in either. It is the default
and only model in the nav-pilot alpha. The reasoning and the rejected alternatives are in
[`reports/alpha-model-decision.md`](reports/alpha-model-decision.md).

- Under a real 36 GB wired limit, the 48 GB target: **21.2s median**, 3 of 8 verified, no timeouts,
  18.6 GB resident. It is the only model that completes the set at that cap. See
  [`reports/48gb-question.md`](reports/48gb-question.md).
- On rig B at a 115 GB limit, which is where every other number in this file was taken: **12.7s
  median**, 4 of 8
  checkable tasks verified, no timeouts, and no task with a repeated identical tool call. 18.6 GB
  resident.
> **Does the template problem invalidate the other models?** Checked 31 August 2026 with
> `mise run bench-template-check`, which renders every cached model's chat template against
> the four shapes a coding agent produces. **No, with one exception.**
>
> Ten of eleven cached models fail identically on tool arguments sent as a JSON string, which
> is what the OpenAI API puts on the wire: `TypeError: Can only get item pairs from a
> mapping`. Only `granite-4.1-8b-4bit` is clean on all four shapes. Every Qwen-family
> template, and KAT-Coder's, also refuses a mid-dialogue system message — deliberately, via
> `raise_exception`, which is a guard rather than a bug.
>
> Neither differentially invalidates a comparison, for two reasons. The breakage is uniform,
> so no model was advantaged. And mlx-lm parses `arguments` into a mapping before it renders
> the template, so through our serving path the string case never arises: verified against
> the running server, which answers 200 and passes the arguments through intact.
>
> The exception is the one already recorded below. `chat_templates/qwen3.8-27b.jinja` was
> **ours**, not the model's, and it re-encoded arguments with `tojson` instead of raising.
> That is the one template in this table that differed from what every other model got, and
> it differed silently.
>
> What this does establish: every one of these templates is only safe behind a server that
> normalises before rendering. Any client or serving path that passes the OpenAI shape
> through untouched gets an exception, not a degraded answer.

> **Correction, 31 August 2026: the Qwen3.8-27B verdict stands.** An earlier caveat here said
> it rested on a template we had reason to doubt. That was wrong, and it was wrong because I
> read a profile name and inferred the rest.
>
> `qwen3.8-27b-8bit` and `qwen3.8-27b-8bit-mlx` are different models. The first is
> `mvid/Huihui-Qwen3.8-27B-abliterated-MTPLX-Q8` served by oMLX through our own
> `chat_templates/qwen3.8-27b.jinja`; the second is `mlx-community/Qwen3.8-27B-8bit` served by
> mlx-lm through the model's own template. **The published verdict comes from the second**,
> whose profile matches the shipped model's in every respect that matters: same server, no
> template override, and `enable_thinking` honoured — verified by rendering all three
> templates rather than by reading the profiles.
>
> The `tojson` fault was real, and it is fixed, but it only ever touched the abliterated build,
> which this table already records as never run on the fixed harness. So the three Qwen3.8 rows
> that carry the verdict were measured under the same conditions as the winner.
>
> What the episode did establish, and what is worth keeping: every template we hold breaks on
> tool arguments in the OpenAI wire format, and only mlx-lm's normalisation hides it. See
> `mise run bench-template-check`.

- **Qwen3.8-27B is held back because it loops, not because it is slow.** The 4-bit build, the same
  build with `repetition_penalty`, and the 8-bit build each timed out on 3 to 4 of 11 tasks and each
  looped. A model that hangs after editing a file is worse for a first alpha user than no local
  model, and these users are the ones whose Copilot allowance already ran out.
- It stays the better writer: 29 of 29 tests passing on the from-scratch build, where the chosen
  model's own test script fails. That is the case for revisiting it once the loop is understood.
- Eight other configurations ran against it in one night and none displaced it. See
  [What the night ruled out](#what-the-night-ruled-out).
- Nothing here was measured on the 48 GB Pro target. Capacity claims transfer, speed claims do not.
- Superseded numbers are deleted rather than kept beside the current ones. The files are in
  `bench/quarantine/`.

## Table of contents

- [Hardware](#hardware)
- [Current results](#current-results)
- [Superseded results](#superseded-results)
- [Mechanisms](#mechanisms)
- [Harness findings](#harness-findings)
- [What others report](#what-others-report)
- [Open questions and what to test next](#open-questions-and-what-to-test-next)
- [Archive: pre-2026 models](#archive-pre-2026-models)
- [Standard benchmark prompts](#standard-benchmark-prompts)
- [Code review rubric](#code-review-rubric)
- [Scheduled re-tests](#scheduled-re-tests)
- [Testing checklist](#testing-checklist)

---

## Hardware

| Rig | Machine | RAM | GPU wired cap | Backends | Models tested |
|---|---|---|---|---|---|
| **A** | M1 Max | 32 GB | 26 GB (`mise run vram-set`) | mlx-lm, mlx-vlm | 7B-35B, 4-bit (Jun 2026) |
| **B** | M5 Max | 128 GB | 96-115 GB (per profile `gpu_wired_limit_gb`) | mlx-lm, mlx-vlm, **oMLX** | 27B-284B, 8-bit / 3-bit mixed (Aug 2026) |

**Target hardware: 48 GB, Pro-class chip.** That is what most developers here run, and neither rig
represents it. Rig A is too small, rig B is both larger and much faster in memory bandwidth. Rig B
runs the 36 GB wired cap (`mise run vram-set 36`) when it stands in for the target, which reproduces
the memory ceiling and not the halved bandwidth.

| Constraint | 48 GB Pro | Rig B (128 GB Max) |
|---|---|---|
| Wired ceiling (~75%) | ~36 GB | 96-115 GB |
| Memory bandwidth | roughly half of Max-class | baseline for all measurements here |
| Qwen3.8-27B 8-bit | **27.0 GB resident measured**, fits with ~9 GB for KV growth | comfortable |
| Qwen3.8-27B 4-bit (~14 GB weights) | fits with room for a 12 GB KV cache | trivial |

`profiles/qwen3.8-27b-4bit.toml` (`mlx-community/Qwen3.8-27B-4bit`) runs **without MTP**: the drafter
head is published as `model_type: qwen3_5_mtp`, which only oMLX can load, and oMLX cannot serve this
4-bit build. Expect the plain mlx-lm decode rate, not the 8-bit MTPLX numbers.

**Untested on the target.** Every number here comes from rig A or rig B. Capacity arithmetic
transfers; bandwidth-bound throughput does not. Nothing from rig A was re-measured on rig B: rig A
numbers are the reference for what fits in 32 GB, rig B numbers are the current daily-driver data.
Model switching, downloading and server control are `mise` tasks documented in
[`README.md`](README.md).

---

## Current results

Measured on rig B in one pass over the night of 28-29 August 2026: nine configurations, the same
eleven tasks each, a 900s per-task cap, a fresh server before every task. Machine state was recorded
before and after each run, swap flat at ~9.3 GB and memory 95% free throughout, so no run was
contended.

Two benchmarks, and they disagree, so both are kept.
[**Cheap operations**](#cheap-operations) runs eleven short routine tasks against an existing
codebase, which is the workload we intend to route to a local model.
[**weather-cli**](#weather-cli) builds a whole application from a spec, which is the workload we
never would. A model can be good at one and poor at the other, and most are. Task definitions,
verification rules and the quarantine convention are in [`BENCHMARKING.md`](BENCHMARKING.md).

| Model | Released | Rig | Backend | Architecture | VRAM | Status |
|---|---|---|---|---|---|---|
| **Qwen3.6-35B-A3B-4bit** | Apr 2026 | A, B | mlx-lm | MoE 35B, 256 experts, 8 active, MQA | 18.6 GB (B), ~21 GB (A) | ✅ **alpha model** |
| Qwen3.6-35B-A3B-OptiQ-4bit | Apr 2026 | B | mlx-lm | MoE 35B, OptiQ quantization | 24.7 GB disk | ⚠️ ties the alpha model, no reason to switch |
| KAT-Coder-V2.5-Dev-OptiQ-4bit | 2026 | B | mlx-lm | MoE, `qwen3_5_moe`, coder-tuned | 22 GB (profile) | ⚠️ 17.5s, loses on speed |
| Qwen3.6-27B-4bit | Apr 2026 | B | mlx-lm | Dense 27B | 16.1 GB disk | ❌ 112.8s, nine times its MoE sibling |
| Qwen3.6-35B-A3B-4bit-DWQ | Apr 2026 | B | mlx-lm | MoE 35B, DWQ quantization | 18.9 GB | ❌ worse than the plain build |
| Qwen3.8-27B-4bit | Jul 2026 | B | mlx-lm | Dense 27B, no drafter | 14.6 GB | ❌ held back, loops and times out |
| Qwen3.8-27B-4bit + `repetition_penalty` | Jul 2026 | B | mlx-lm | Dense 27B, penalty 1.05 | 14.6 GB | ❌ faster, loops worse |
| Qwen3.8-27B-8bit (MLX) | Jul 2026 | B | mlx-lm | Dense 27B | **27.0 GB** | ❌ fits 36 GB, 194.5s, loops on two tasks |
| Qwen3.8-27B-6bit | Jul 2026 | B | mlx-lm | Dense 27B, thinking left on | — | ❌ 284.2s |
| Qwen3.8-27B-8bit (MTPLX Q8) | Jul 2026 | B | **oMLX** | Dense 27B + MTP drafter | 28.9 GB | ⚠️ best weather-cli code, never run on the fixed harness |
| granite-4.1-8b-4bit | May 2026 | A, B | mlx-lm | Dense 8B | 5.1 GB (B), ~4.5 GB (A) | ❌ reads, never writes³ |
| DeepSeek-V4-Flash-0731-2.4bit-mixed | May 2026 | B | **oMLX** | MoE 284B, 256 experts, 6 active, MLA | 79 GB | ✅ rig B only |
| gemma-4-31b-it-8bit | 2026 | B | mlx-lm | Dense 31B, hybrid attention | 30.9 GB | ⚠️ 865 KB/token KV rules out 48 GB |
| Qwen3.5-9B-MLX-4bit | Feb 2026 | A, B | mlx-lm | Dense 9B, MLA | ~6 GB | ⭐ rig A daily driver, ❌ fails the rig B benchmark |
| gemma-4-12B-it-4bit | May 2026 | A | **mlx-vlm** ⚠️ | Dense 12B, hybrid attention | ~7 GB | ⚠️ too slow |
| gemma-4-26b-a4b-it-4bit | Mar 2026 | — | **mlx-vlm** ⚠️ | MoE 26B, ~4B active, shared KV | ~14 GB | 🔲 untested, highest priority of the untested |
| GLM-4.7-Flash-4bit | Jan 2026 | A | mlx-lm | MoE 30B, ~3-3.6B active, full MHA | ~16 GB | ❌ not viable |
| Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit | Mar 2026 | A | mlx-lm | Dense 27B | ~14 GB | 💥 OOM |

³ Gated model: accept the terms at huggingface.co/ibm-granite/granite-4.1-8b-instruct before
downloading. The mlx-community repo is `mlx-community/granite-4.1-8b-4bit`, not
`mlx-community/granite-4.1-8b-instruct-4bit`.

`Qwen3.6-35B-A3B-8bit` was never queued: 37.7 GB does not fit the target. Models released in 2025 or
earlier are in [the archive](#archive-pre-2026-models) and are not candidates. Rig A headroom is
`32 GB − VRAM − ~7 GB OS reserve`.

### Cheap operations

Target is `navikt/isoppfolgingstilfelle`, a real Nav Kotlin service. Ktor, Kafka, Postgres, 5,661
lines of main Kotlin, 151 tests that pass on a clean machine with no Nav-internal dependencies.
Every task is pinned to a symbol verified to exist in that repository. Spec in `bench/specs/cheap-ops.md`,
tasks in `bench/tasks.json`, run with `mise run bench-cheap-ops`.

| Model | Median | Verified | Timeouts | Tasks with a loop |
|---|---|---|---|---|
| granite-4.1-8b | 11.4s | 1 of 8 | 2 | 0 |
| **qwen3.6-35b-a3b** | **12.7s** | **4 of 8** | **0** | **0** |
| qwen3.6-35b-a3b-optiq | 12.8s | 4 of 8 | 0 | 0 |
| kat-coder-v2.5 | 17.5s | 4 of 8 | 0 | 0 |
| qwen3.8-27b-4bit-reppen | 67.0s | 3 of 8 | 3 | 1 |
| qwen3.8-27b-4bit | 88.4s | 3 of 8 | 4 | 1 |
| qwen3.6-27b-4bit | 112.8s | 4 of 8 | 1 | 0 |
| qwen3.8-27b-8bit-mlx | 194.5s | 2 of 8 | 4 | 2 |

> **Both Qwen3.8 rows are one run of two, and the other run is much worse.** Corrected
> 1 September 2026, on the way to offering these models in the manifest.
>
> | profile | quoted above | the other run |
> |---|---|---|
> | qwen3.8-27b-4bit | 3 of 8, median 88.4s | 2 of 8, median **906.3s** |
> | qwen3.8-27b-8bit-mlx | 2 of 8, median 194.5s | 1 of 10, median **900.1s** |
>
> A tenfold difference in median between two runs of one profile on one machine is not
> noise, and it is the most useful thing we know about these builds: they are unstable in
> a way `qwen3.6-35b-a3b-optiq` is not, which holds 4 to 6 of 8 to 10 with no timeouts
> across eight runs. Every run is in `bench/` and `bench/.previous/`; `mise run
> bench-loop-analysis` reads them.
>
> The table quotes a single run per profile because that is how it was built. For a model
> this variable, one run is a sample, not a result, and the manifest text says so rather
> than repeating a median.

### Notat: MTP-kvantisering og oMLX, 1. september 2026

Stefan Prodan (Flux) publiserte et oppsett som overlapper vårt på tre punkter, og som er verdt
å kjenne til. Han kjører agentisk GitOps lokalt på en M2 Max 96 GB, valgte `Apodex-1.1-mini`
etter egen benchmarking, **kvantiserte den selv med Lightning MTP speculative decoding**, og
måtte patche Qwen3-Coder sin tool-call-parser i både oMLX og Apples mlx-lm (PR-er underveis).
Kvantet ligger på [huggingface.co/stefanprodan/Apodex-1.1-mini-oQ4e-mtp](https://huggingface.co/stefanprodan/Apodex-1.1-mini-oQ4e-mtp).

Tre grunner til at dette treffer oss:

1. **MTP er den ene tingen vi har målt som gjør en lokal modell rask.** Vår egen
   `qwen3.8-27b-8bit` (MTPLX Q8, oMLX) er notert som "astoundingly fast … response times under
   10 seconds", og er den eneste 3.8-varianten som har levert best-i-test kode (8.1/10 på
   weather-cli). Vi bruker den ikke, fordi drafter-hodet publiseres som `model_type:
   qwen3_5_mtp` som bare oMLX kan laste — og nav-pilot kjører mlx-lm.
2. **Han patcher nøyaktig det laget vi fant en feil i.** `mlx_lm/server.py:150` gjør
   `json.loads(args)` uten guard, så en klient som sender `arguments` som dict gir 500. Vi har
   den feilen dokumentert og ikke sendt oppstrøms ennå.
3. **Han sier det samme som oss om hastighet**: etter skymodeller føltes lokale modeller
   "excruciatingly slow". Det er vår §7-konklusjon med andre ord.

**Er egen kvantisering noe for oss?** Sannsynligvis ikke som førstevalg — se vurderingen i
[PLAN.md](PLAN.md). Kort: kvantiseringsnivået er ikke flaskehalsen vår (4-bit er allerede den
raskeste varianten vi har), mens MTP er det, og MTP er et *runtime*-valg (oMLX vs mlx-lm), ikke
et kvantiseringsvalg. Å lage egne kvanter betyr også at vi eier artefakten: ingen
oppstrømsfikser, ny kvantisering per modelloppdatering, og vekter vi selv distribuerer til 250
maskiner.

### Kjøringer på reparert harness, 2. september 2026 — forskjellen forsvinner

Alt under denne overskriften erstatter tallene fra 1. september. De gamle er ikke slettet, men
de er ikke lenger dekkende, og forskjellen mellom de to settene er verdt mer enn noen av dem.

| modell | verifisert av 8 | snitt | median | timeouts |
|---|---|---|---|---|
| `qwen3.6-35b-a3b-optiq` | 3, 2, 4, 4 | **3,25** | 9,7–11,9s | 1 |
| `qwen3.8-27b-4bit` | 4, 4, 3, 4 | **3,75** | 58,4–104,2s | 10 |

Eksakt tosidig Mann-Whitney: **p = 0,71**. Spennene overlapper helt (3.6 er 2–4, 3.8 er 3–4).
Det er ingen målbar forskjell i hvor mange oppgaver de løser.

**Hva som endret seg mellom settene:** modellene fikk en kompilator. Sandkassen hadde aldri gitt
tilgang til byggverktøyene, så `./gradlew` traff en mise-shim som leste konfigurasjon utenfor
sandkassen og fikk «Operation not permitted» — 2 672 slike i transkriptene mot 2 176 nevnelser av
gradlew. Målet var heller ikke pinnet: arbeidskopiene lå på tre forskjellige commits, fire dager
fra hverandre. Og `rename` sjekket aldri at det nye symbolet fantes.

**Så det publiserte funnet holdt ikke.** 1. september sto det at Qwen3.8 løser mer enn
standardmodellen — snitt 5,75 mot 3,40. På et harness som faktisk måler det den påstår, er det
3,75 mot 3,25 og p = 0,71. Forspranget var i hovedsak en artefakt av at ingen av modellene kunne
kompilere: en modell som skriver Kotlin blindt ble sammenlignet med en annen som gjorde det
samme, på to forskjellige kodebaser.

**Det som står igjen, og som er det eneste tallet som ikke flyttet seg:** 3.8 bruker omtrent sju
ganger så lang tid, median 58–104 sekunder mot 10–12, og traff taket 10 ganger mot 1. Den er
altså ikke bedre, og den er mye tregere. Standardmodellen er fortsatt riktig standard, nå av en
enklere grunn enn før.

### Fresh runs, 1 September 2026

Re-measured after three harness faults were fixed the same night: the default model's Kotlin
workspace held a **TypeScript repo** (a frontend run had reused the directory), `bench-models`
named every result file after the first profile in the queue so runs overwrote each other, and
`MLX_CHAT_TEMPLATE` was passed to `mlx_lm.server` as a path where the flag takes the template
text. All three produced numbers that looked like weak models.

| model | verified (of 8) | gjennomsnitt | median | timeouts |
|---|---|---|---|---|
| `qwen3.6-35b-a3b-optiq` | 3, 3, 3, 4, 4 | **3,40** | 8,3–11,0s | 2 |
| `qwen3.8-27b-4bit` | 5, 5, 6, 7 | **5,75** | 58,7–96,0s | 9 |

En femte 3.8-kjøring er satt i karantene og ikke med i snittet: den løste 1 av 8 og endret ingen
fil på noen av de sju redigeringsoppgavene, der alle de andre endrer fil på seks av sju.
Kriteriet og begrunnelsen står i
[`bench/results-qwen3.8-27b-4bit-20260901-QUARANTINED.md`](bench/results-qwen3.8-27b-4bit-20260901-QUARANTINED.md).
Med den inkludert er snittet 4,80.

**Konklusjonen snur, og denne gangen tåler den en test.** `Qwen3.8-27B-4bit` løser i snitt
**5,75 av 8** mot standardmodellens **3,40**. De fire rene kjøringene overlapper ikke med
standardens fem i det hele tatt — 5, 5, 6, 7 mot 3, 3, 3, 4, 4 — og eksakt tosidig Mann-Whitney
gir **p = 0,016**. Med karantenekjøringen inkludert er p = 0,175.

**Korrigert 2. september:** vi publiserte først p = 0,008 her. Det var feil — utregningen talte
den samme ekstremordningen i begge haler. Med fire mot fem kjøringer finnes det 126 mulige
ordninger, så den minste tosidige p-verdien dette designet *kan* produsere er 2/126 = 0,016.
Vi rapporterer altså gulvet, ikke en effektstørrelse: det sier at settene ikke overlapper, og
ingenting mer presist enn det. Å skille en forskjell på én oppgave av åtte med rimelig styrke
krever i størrelsesorden 30 kjøringer per modell, ikke fem.

Standardmodellen er ikke den sterkeste. Den er den raskeste og den mest forutsigbare: median 9
sekunder mot 65, og 2 timeouts mot 9. 3.8 løser mer og bruker sju ganger så lang tid på det.

Valget er altså ikke bedre eller dårligere, men **sterkere og tregere, eller raskere og mer
forutsigbar** — og hvilken du vil ha avhenger av om du leser gjennom det modellen produserer.

**`qwen3.8-27b-8bit` is not in this table on purpose.** Two runs verified nothing, with every
task timing out having completed **zero turns**, including a read task the 4-bit answers in
seconds. Two confounds sit on that result and both are ours: a `reasoning_effort: medium` pin
added to the profile hours earlier and absent from every historical run, and a 420s task cap
where the historical figure of 2 of 8 came from a 900s cap. Recording it as a property of the
model would be the exact error this file keeps catching elsewhere. The test that settles it is
one run with the pin removed.
| qwen3.8-27b-6bit | 284.2s | 2 of 8 | 2 | 0 |

A loop is identical consecutive tool calls within one task, and the detector flags five or more. A
model can be slow without looping and can loop without being slow, so both columns are needed.

#### Per task: `mlx-community/Qwen3.6-35B-A3B-4bit`

| Task | Time | Turns | Tools | Files | Longest identical run | Result |
|---|---|---|---|---|---|---|
| R1 explain a domain function | 8.7s | 4 | 3 | 0 | 1 | needs a human |
| R2 find where a config value is read | 4.4s | 2 | 1 | 0 | 1 | 2 of 2 expected terms in the answer |
| R3 list call sites | 12.7s | 2 | 1 | 0 | 1 | needs a human |
| E1 add a KDoc block | 9.7s | 5 | 4 | 1 | 1 | compiles |
| E3 add a log line with context | 18.5s | 9 | 8 | 1 | 1 | compiles |
| M1 rename across call sites | 10.6s | 4 | 4 | 2 | 1 | renamed and compiles |
| M2 add a field to a DTO and map it | 18.3s | 5 | 6 | 2 | 1 | suite failed |
| G2 write a test for an untested util | 28.8s | 8 | 10 | 1 | 1 | suite failed |
| D1 explain PDL ident selection | 7.7s | 4 | 3 | 0 | 1 | needs a human |
| D2 thread a field through a row mapper | 104.2s | 28 | 37 | 5 | 1 | suite failed |
| D3 map a response field | 33.5s | 13 | 20 | 1 | 1 | suite failed |

It renames symbols across call sites, adds fields, adds log lines in the codebase's own style and
locates config values correctly. Every failure is a broken test suite on data-threading work, and D2
is the clearest case: five files over 37 tool calls in 104.2s, no loop, no timeout, and a red suite.
That is a capability limit, not a harness limit.

#### Per task: `mlx-community/Qwen3.8-27B-4bit` with `repetition_penalty` 1.05

| Task | Time | Turns | Tools | Files | Longest identical run | Result |
|---|---|---|---|---|---|---|
| R1 explain a domain function | 52.0s | 3 | 2 | 0 | 1 | needs a human |
| R2 find where a config value is read | 27.9s | 2 | 1 | 0 | 1 | 2 of 2 expected terms in the answer |
| R3 list call sites | 44.5s | 2 | 1 | 0 | 1 | needs a human |
| E1 add a KDoc block | 69.7s | 7 | 6 | 1 | 1 | compiles |
| E3 add a log line with context | 42.3s | 2 | 3 | 0 | 1 | no changes made |
| M1 rename across call sites | 67.0s | 4 | 5 | 2 | 1 | renamed and compiles |
| M2 add a field to a DTO and map it | 333.8s | 13 | 15 | 2 | 1 | suite failed |
| G2 write a test for an untested util | 900.1s | ? | ? | 0 | 40 | timed out after 900s |
| D1 explain PDL ident selection | 53.0s | 4 | 3 | 0 | 1 | needs a human |
| D2 thread a field through a row mapper | 900.1s | ? | ? | 1 | 1 | timed out after 900s |
| D3 map a response field | 900.1s | ? | ? | 0 | 1 | timed out after 900s |

Qwen publishes `repetition_penalty` 1.05 for this family, and `AGENTS.md` rule 8 already forbids
repeating a call that did not help, so this run tested the sampling lever against the instruction the
model ignores. It cut the median from 88.4s to 67.0s and made the worst loop worse: G2 went from 15
identical consecutive calls to 40, burning the full cap. Three of the four failures are timeouts, and
the `?` cells are the killed-task artifact described under [Harness findings](#harness-findings), not
zero activity.

### Prompt cache reuse

Measured per model as the wall-clock cost of the first turn against the last turn of the same
session (`bench/cache-<key>.json`).

| Model | Turn 0 | Last turn | Cache hit |
|---|---|---|---|
| kat-coder-v2.5 | 1.32s | 0.37s | 99.5% |
| qwen3.6-27b-4bit | 5.13s | 0.47s | 99.4% |
| qwen3.6-35b-a3b-optiq | 1.28s | 0.26s | 99.4% |
| qwen3.6-35b-a3b | 1.2s | 0.27s | 99.4% |
| qwen3.8-27b-4bit-reppen | 5.08s | 0.48s | 99.5% |
| qwen3.8-27b-4bit | 8.11s | 0.44s | 99.5% |
| qwen3.8-27b-6bit | 6.06s | 0.82s | 99.4% |
| qwen3.8-27b-8bit-mlx | 5.53s | 0.54s | 99.3% |

Prompt caching works here, 99.3 to 99.5% on every model tested. [mlx-lm
issue #980](https://github.com/ml-explore/mlx-lm/issues/980) reports the opposite for the Qwen3.5
family, and it does not reproduce on our version. The result is therefore version-dependent: it says
what our mlx-lm does, not what mlx-lm does. Re-measure after every upgrade, it is one script.

### Memory

`mlx-community/Qwen3.8-27B-8bit` measured at **27.0 GB resident** after three agent turns. That fits
a 36 GB wired limit with 9 GB left for KV growth, and it matches the 28 to 30 GB another Nav team
measures for a llama.cpp Q6 of the same model on an M4 Pro 48 GB.

The earlier claim that 8-bit was out of reach for a 48 GB machine was an assumption, never measured
until now, and it was wrong. It fits. It is still unusable: 194.5s median, four timeouts, and two
tasks looping, 25 identical consecutive calls on E3 and 12 on M2.

### weather-cli

Every model builds the same Node.js CLI from `bench/specs/weather-cli.md` (live Met.no + Geonorge APIs,
spec-named test files) in its own `workspaces/<key>/weather-cli/`, driven by the two prompts in
[Standard benchmark prompts](#standard-benchmark-prompts). Headless, rig B.

| Model | Total | Plan | Implement | Files | Tests |
|---|---|---|---|---|---|
| granite-4.1-8b | 74.5s | 25.1s / 2 turns | 49.4s / 5 turns | 1 | exit None, None pass, None fail |
| qwen3.6-35b-a3b | 438.8s | 67.5s / 13 turns | 371.3s / 58 turns | 13 | exit 1, None pass, None fail |
| qwen3.8-27b-4bit | 1218.1s | 195.5s / 6 turns | 1022.6s / 27 turns | 13 | exit 0, 29 pass, 0 fail |
| qwen3.8-27b-6bit | 2599.7s | 247.7s / 5 turns | 2352.0s / 20 turns | 13 | exit 0, 26 pass, 0 fail |

This is the benchmark where the alpha model looks worst and the held-back model looks best. The two
Qwen3.8 builds are the only ones that finished with a green suite; the alpha model wrote the same
thirteen files three times faster and left its own test script failing. Granite produced one file,
consistent with its cheap-operations result. None of these runs is graded against the
[code review rubric](#code-review-rubric).

### What the night ruled out

| Candidate | Verdict |
|---|---|
| OptiQ quantization of the chosen model | Tie. 12.8s and 4 of 8 against 12.7s and 4 of 8 |
| KAT-Coder V2.5, coder-tuned, same architecture | 17.5s against 12.7s, same 4 of 8. Loses on speed |
| Qwen3.6-27B dense, same family | 112.8s. Nine times slower than its own MoE sibling |
| Granite 4.1 8B | Reads and answers, never writes. 1 of 8, zero files changed in 11 tasks |
| Qwen3.8-27B at 8-bit | Fits at 27.0 GB. 194.5s, four timeouts, loops on two tasks |
| Qwen3.8-27B at 6-bit | 284.2s and two timeouts. Slow, and the only one of the three that does not loop |

Coder tuning, a newer quantizer and more bits each cost more than they returned. The one lever that
moved the dense 27B, `repetition_penalty`, moved speed and not reliability.

---

## Superseded results

> **Read this once and apply it to everything below.** Nothing in this section was measured on the
> harness we now trust. Most of it came through the polluted system prompt, before commit
> `9a2b324`: 37,807 characters of instructions the benchmark never chose, and an unclosed think tag
> that routed model output into the `reasoning` field. Absolute numbers here are wrong, the one task
> set re-measured moved from a 32.4s median to 12.7s. Ranking between models may survive, because
> every model carried the same overhead. Anything the overnight run measured again has been deleted
> from here rather than kept beside it; the run files are in `bench/quarantine/`, and
> `bench/quarantine/README.md` says what each suffix means. What is left is the material nothing has
> replaced.

### Findings that outlived their numbers

**Thinking costs about 2.3x, architecture about 4.1x.** Re-running four tasks on Qwen3.8-27B-4bit
with thinking off moved the median from 138.6s to 61.2s while output tokens fell about 3x. The
remaining 4.1x against the MoE is the dense-versus-sparse decode gap, 4.7 against 22.4 tokens per
second. The two factors multiply to about 9.4x. Both ratios are between two runs carrying the same
overhead, so they survive the pollution; the seconds do not.

**`Qwen3.6-35B-A3B-4bit-DWQ` is worse than the plain build.** Controlled A/B, same eleven tasks,
same sampling, same 18.9 GB resident, quantization the only variable: 2 of 7 verified against 5 of
7, and a lower median (23.8s against 32.4s) only because it failed faster. Its failures include a
timeout, so its mean is worse. Testing elsewhere reports flat 4-bit losing tool-call formatting over
a long context while DWQ stays clean; that does not reproduce here.

**Run-to-run variance is large.** Across three runs of the same task set, individual tasks swung up
to 1.7x in both directions. Single runs cannot separate models within about 1.5x of each other,
which is why the overnight table is read as bands and not as a ranking.

### weather-cli, polluted prompt

| Model | Rig | Plan | Implement | Total | Tests | Behaviour |
|---|---|---|---|---|---|---|
| Gemma-4-31B 8-bit | B | 4m 2s | 16m 21s | **20m 23s** | 16/16 | Code **6.0/10**. Twice the wall clock of Qwen3.8/DeepSeek; 31 turns at a 35s median. Pulled in **jest** instead of `node:test` |
| Gemma-4-31B 8-bit | B | 6m 7s | abandoned | — | — | Served by mlx-vlm by mistake, cache cleared per request; 43s median turn, 197s worst |
| DeepSeek-V4-Flash 2.4-bit | B | 4m 43s | 5m 26s | **10m 09s** | 17/17¹ | Planned properly, dispatched a sub-agent, wrote its plan to a file |
| Qwen3.8-27B MTPLX Q8 | B | **1m 23s** | 8m 47s | **10m 10s** | 16/16 | Best run. Code **8.1/10**. Rule 7 + corrected spec UA warning |
| Qwen3.5-9B 4-bit | B (36 GB cap) | — | — | ❌ **4 attempts, no plan delivered** | — | Four distinct failures across four configs |
| Qwen3.8-27B MTPLX Q8 | B | 7m 58s | abandoned | — | — | Plan phase lost ~5 min to a self-inflicted `example.com` 403 read as rate limiting |
| Qwen3.8-27B MTPLX Q8 | B | 2m 43s | 11m 22s | **14m 05s** | 17/17 | First run with `request_max_tokens=16384` in effect; no truncation |
| Qwen3.8-27B MTPLX Q8 | B | 2m 52s / 2m 40s | aborted | — | — | Two runs died on `finish_reason=length`; the raised output cap had not reached `opencode.json` |
| Qwen3.8-27B MTPLX Q8 | B | 3m 12s | 4m 21s | **7m 33s** | 22/22 | Probed both APIs during planning, then wrote correct code first try |
| DeepSeek-V4-Flash 2.4-bit | B | — | — | 11m 58s | 13/13 | Assumed the API shapes, then debugged against failing tests |
| Qwen3.8-27B 8-bit (pre-MTP) | B | — | — | ~34 min | 18/18 | Unattended; found and fixed 3 errors in the spec by probing the live APIs |
| Qwen2.5-72B 8-bit | B | — | — | — | — | Never wrote a file, printed code into chat instead of calling tools |

¹ Self-reported; DeepSeek's workspace was deleted before the check. Test counts are not comparable
across models, each chooses how finely to split its suite, and one 20/20 was really 19 that could
fail plus one wrapped in a `try`/`catch` that swallowed `AssertionError`.

Two levers dominated these runs. Naming the Met.no 403/429 distinction in the spec cut the plan
phase to **1m 23s**, against a 7m 58s worst case when the model had to work the ambiguity out
itself. Adding *"Check the external apis do not assume the data model"* to the plan prompt cut
Qwen3.8's total time by roughly 4x. Plan time measures what the model ran into, so treat a long plan
phase as a signal.

**Not a spec error, a model-invented one.** A run reported that the spec's example User-Agent
returns 403. It does not. Verified directly, 2026-08-26:

| User-Agent | Result |
|---|---|
| `weather-cli/1.0 github.com/yourname` (the spec's example) | 200 |
| `weather-cli/1.0` / `curl/8` / `test/1.0 someone@example.org` | 200 |
| `weather-cli/1.0 contact@example.com` | **403** |
| `weather-cli/1.0 (contact@example.com)` | **403**, parentheses are irrelevant |

Met.no blocks the literal placeholder domain `example.com`. The 403 is a 162-byte nginx page with no
`Retry-After` and no `RateLimit-*` headers; real throttling returns 429. Three failures worth
tracking per model: substituting a placeholder into a working spec, blaming the spec for it, then
diagnosing a hard block as throttling.

### Model notes from the polluted era

**`Qwen3.8-27B MTPLX Q8` (`mvid/Huihui-Qwen3.8-27B-abliterated-MTPLX-Q8`), oMLX.** Dense 27B plus
MTP drafter, ~27-28 GB RSS, 131,072 declared context, `qwen_template.jinja` bound explicitly. 11.3
to 14.3 t/s without MTP, 18 to 38 with it; tool-call turns land 25-33 t/s at 20-35k context, falling
to 18.0 at 34.9k while MTP acceptance holds at 80-95%, so that is backbone prefill cost and not
drafter decay. The only model tested that reliably researches external APIs before writing code.
Code **8.1/10**, six traps avoided, one hit: `format.js` guards no field, so a night payload without
`ultraviolet_index_clear_sky` prints `UV Index: undefined` and exits 0. Two bugs were fixed getting
here: the HF tokenizer shipped no `chat_template`, which produced 4-minute prefills and a 44 GB KV
spike on trivial prompts, and at `MLX_OPENCODE_OUTPUT = 4096` the model spent its whole budget
inside a `<think>` block and returned no tool call. The abliterated build follows instructions worse
than the base instruct model.

**`DeepSeek-V4-Flash-0731-2.4bit-mixed`, oMLX.** MoE 284B total / ~13B active, MLA attention, 82.8
GB RSS at `gpu_wired_limit_gb = 115`. 25-31 t/s decode, holding 25-26 t/s at 35,230 tokens; TTFT on
an 18k prompt ~3.3s thanks to oMLX's paged cache.

| Metric | DeepSeek V4 Flash | Qwen3.8 MTPLX |
|---|---|---|
| Total | **10m 09s** | 10m 10s |
| Plan / implement | 4m 43s / 5m 26s | 1m 23s / 8m 47s |
| Turns | **30** (26 `tool_calls`, 4 `stop`) | 16 (13 / 3) |
| Median / mean / max turn | **166** / 365 / 2,038 tok | 338 / 750 / 3,299 tok |
| Throughput | 19.1 t/s | 19.2 t/s |
| RSS | 79 GB | 28.9 GB |

Two opposite routes to the same wall clock: DeepSeek runs twice as many turns at half the size,
front-loading a written plan and delegating to a sub-agent, visible as the parent context dropping
from 18.6k to 11.0k. Persisting a plan as a file survives compaction and costs one cheap re-read
instead of riding in every later prompt. Its "code first, debug later" habit was promptable. Cost:
79 GB resident for the same wall clock. The earlier ~20% second-run speedup was **not** custom
kernels, which never compiled on this machine; it came from `MLX_OPENCODE_CONTEXT` 16k → 131k
ending a compaction loop, and temperature locked to 0.6 stopping repeated tool calls.

**`gemma-4-31b-it-8bit`, mlx-lm.** Dense 31B with hybrid sliding-window attention, 30.9 GB RSS,
`model_type: gemma4` so mlx-lm serves it. 20m 23s total for what Qwen3.8 and DeepSeek did in half
that; the turn count matches DeepSeek's almost exactly and every turn costs ~4x as long, with no
drafter. **KV cache is expensive**: 1.65 GB for 1,907 tokens ≈ **865 KB/token**, against 64 KB for
Qwen3.5-9B and 20 KB for Qwen3.6-35B-A3B. At 30k context that is ~26 GB of cache on top of 31 GB of
weights, so it cannot fit the 48 GB target, and quantizing the weights does not help because the
cache does not shrink with them. Code **6.0/10**. The real bug is the argument parser: `parser.js:2`
reads `args[0]` only, so unquoted `weather 59.91 10.75` is sent to Geonorge as a place name. It
silently added **jest** where the spec names only `axios`.

**`Qwen3.8-27B-4bit`, mlx-lm, weather-cli.** Peak RSS **14.57 GB**, KV cache 3.28 GB over 3
sequences, 32m 21s, 22 turns, 25/25 verified by hand, code **8.5/10**. 3.2x the Q8 on identical work
because the Q8 had MTP and this build has none: on this rig the drafter is worth more than the
bandwidth saved by smaller weights. Quantization degraded instruction-following rather than output
quality. It ignored `AGENTS.md` rule 7 and drafted entire file contents inside `<think>`, with the
workspace copy of AGENTS.md verified byte-identical to the root. It is the first model whose
self-report survived a hand check unchanged.

**`Qwen3.6-35B-A3B-4bit` on rig B, weather-cli.** Peak RSS 18.64 GB, KV cache 4.70 GB, 6m 45s, 27
turns, 20/20 tests, code **6.8/10**. Speed comes from cheap turns, not fewer of them: more turns
than the dense 4-bit's 22, finished in a fifth of the time. Two effects compound and should not both
be credited to architecture, ~3B active parameters and no reasoning tokens at all. The cache figure
isolates the architectural half, **0.30 GB across 4 sequences after warm-up**, against the dense
4-bit's 1.10 GB. It hit missing fields harder than the dense 4-bit, with no per-field checks at all,
and it knowingly broke the dependency spec: *"spec says only axios. However, tests need mocking."*

**`Qwen3.5-9B-MLX-4bit` on rig B: does not complete the benchmark.** Four attempts under the 36 GB
cap, each fixing the previous failure, never a plan delivered.

| Attempt | Config change | Failure |
|---|---|---|
| 1 | profile defaults (`top_k` disabled) | A truncated `webfetch` payload, then an **8m 18s** thought block collapsing into `DIDIDIDI…` |
| 2 | `MLX_TOP_K = 20` | Plan in **23.4s**, then wrote `index.js` to shell out to a `geonorge` CLI that does not exist and tried to `brew install` it |
| 3 | + cplt sandbox | Diagnosed the Met.no 403 correctly and immediately, then a **9m 51s** turn that never completed |
| 4 | + `top_p = 0.95`, thinking **disabled** | POSTed header fields to a **GET** endpoint → `405`. **8m 35s**, no plan |

The levers worked and only moved the failure. `top_k=20` ended the repetition loop; the sandbox
stopped the install flailing; disabling thinking cut a one-word answer from **159 output tokens to
2**, and also deleted the reasoning that had diagnosed the 403, so attempt 4 reused the placeholder
contact. Sending headers as form fields to a GET endpoint is a broken model of HTTP, not a sampling
artifact. Read it as a verdict on this build, not on 9B-class models. **The 6 GB rung stays
unmeasured.**

### Rig A, June 2026

The only data for a 32 GB machine. Different harness, different month; kept as the capacity
reference.

**`Qwen3.5-9B-MLX-4bit`, the rig A daily driver.** Dense 9B, ~6 GB VRAM, 262k native context,
practically ~128k, MLA giving a 64 KB/token KV cache. Prefill ~245 t/s peak, ~205 t/s average over a
44k prompt, degrading 258 → 181 t/s from 4k to 44k in one run. **Generation degrades at large
context**: beyond ~80k it slows sharply, and at ~96k a single token took **3 min 28 s**, which made
opencode stop silently when the SSE chunk timeout fired mid-generation.
`MLX_OPENCODE_CHUNK_TIMEOUT = 600000` covers it. Comfortable range is ~50-70k tokens. Diagnose
silent stops by grepping `~/.local/share/opencode/log/opencode.log` for `"exiting loop"`.

**`Qwen3.6-35B-A3B-4bit` on rig A.** 35B total / ~3B active, 256 experts with 8 active, 2 KV heads,
40 layers, ~21 GB VRAM, 96k declared. mlx-lm uses 8-bit KV compression: **18.3 KB/token measured**
against 40 KB/token float16 theoretical, so wired ≈ 22.7 GB at 96k and ≈ 23.3 GB at 128k. Prefill
**~386 t/s at 26k tokens**, 1.5 to 1.7x Qwen3.5-9B's peak. Cache slots must be ≥5: with 3 slots,
system(2) + user(1) fills capacity and nothing is cached for the assistant.

**`gemma-4-12B-it-4bit`: too slow.** Dense 12B, ~7 GB VRAM, requires mlx-vlm
(`model_type: gemma4_unified`), which re-prefills the whole conversation on every tool call. Ten
turns averaged **~136s each for 141 output tokens**, at 16.9k to 19.1k input tokens per turn, so 24
minutes bought 0 implemented files. At similar context Qwen3.5-9B takes ~5-10 seconds per turn. Not
gradeable: all ten source and test files are **0 bytes**. Re-evaluate if mlx-vlm adds persistent KV
caching.

**`Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit`: OOM.** Dense 27B, ~14 GB VRAM, crashed 3x with
`kIOGPUCommandBufferCallbackErrorOutOfMemory`, always at ~6144 tokens into prefill, plus an infinite
tool loop where it detected "path is wrong" in `<think>` each iteration and re-issued the identical
broken call 8+ times. Opus distillation preserves error *detection* but not error *correction*.
Prefill ~68-71 t/s against ~350-386 for Qwen3.6-35B-A3B. Root cause is architectural, see
[Dense vs MoE](#dense-vs-moe). Its artifact scores **4.6/10** and **cannot succeed once against the
live APIs**, four invented response shapes, any one fatal:

| Location | Reads | Actual |
|---|---|---|
| `geocode.js:23` | `data.features` | `/stedsnavn/v1/sted` returns `{ navn: [...] }` |
| `weather.js:27` | `data.timeseries` | `data.properties.timeseries` |
| `weather.js:48` | `closestEntry.instant` | `entry.data.instant` |
| `weather.js:62` | `instant.pressure` | `instant.air_pressure_at_sea_level` |

Its 32 green tests are the reason: every assertion is real, thresholds pinned at exactly 25/50/75,
mocks at the HTTP layer via `nock`, the strictest boundary any submission chose, and all of it
confirms the model's own guesses. This is the clearest case of a suite locking in an assumption
instead of checking an API, and the strongest evidence for the plan-prompt rule.

**`GLM-4.7-Flash-4bit`: not viable.** MoE 30B total / ~3-3.6B active, ~16 GB VRAM. **Full MHA, 20 KV
heads for 20 attention heads, no GQA**: KV ≈ 374 KB/token f16, 187 KB at 8-bit, so ~8.5 GB of cache
at 48k, which made the OOM inevitable. Four failures were fixed by config (`MLX_TEMP=0.7` for a
greedy repetition loop, `enable_thinking=false` for 3m35s stalls, 48k context for the prefill OOM);
two were not, a tool-call loop calling `ls` on the same directory and generated code with typos.
`weather-cli/index.js` does not parse: 411 lines of one `try` block repeated, `const { lat, lon }`
redeclared in the same scope, and `lon3` read against a name that does not exist.

---

## Mechanisms

Properties of the runtimes and the architectures, not results, so the prompt pollution does not
touch them.

### Server backends: mlx-lm vs mlx-vlm vs oMLX

`mise run server` selects the backend from `MLX_SERVER_TYPE` in the active profile's `[params]`
(`mlx-lm`, `mlx-vlm`, or `omlx`).

| Feature | mlx-lm | mlx-vlm |
|---|---|---|
| **KV cache** | Persistent across requests, bounded in slots by `MLX_CACHE_SIZE` | **Cleared after every request** (`Stream finished, cleared cache`) |
| **Prompt caching** | `--prompt-cache-size` (slots); `--prompt-cache-bytes` is parsed and never applied | Not supported, no equivalent flags |
| **Per-turn cost** | Re-uses prior context; only new tokens prefilled | **Full conversation re-prefilled every tool call** |
| **Agentic impact** | Fast at steady state; grows slowly | Grows linearly, each tool call costs O(session_length) prefill |
| **Multimodal** | Text only (even for VLM model weights) | Text + images + audio/video |

opencode and aider send the full conversation with every tool call. On mlx-lm a 30k-token session
costs ~30k prefill once, then ~500-2k per tool call. On mlx-vlm it costs ~30k prefill **on every
tool call**, which at 200 t/s is 150 seconds before generation starts. Use mlx-vlm models for short
focused tasks only.

A model requires mlx-vlm when its `model_type` is implemented only there: `gemma4_unified` (Gemma 4
unified-architecture builds), `glm4v` and `glm4v_moe` (Z.AI vision models). In our workspace that is
`gemma-4-12b`, `gemma-4-26b-a4b` and `glm-4.6v-flash-9b`. Everything else is `qwen3_5`,
`qwen3_5_moe`, `gemma4`, `glm4_moe_lite`, `qwen3_moe`, `qwen2`, `granite` or `mistral3` on mlx-lm.

> ⚠️ **Check `model_type` exactly, not by prefix.** `gemma4` and `gemma4_unified` are different
> architectures with different backends. Assuming every Gemma 4 needs mlx-vlm cost a full benchmark
> run: `gemma-4-31b-8bit` was served by mlx-vlm, which clears the KV cache after every request, and
> its turn times climbed to a 43s median and 197s worst against ~12s for oMLX models. Models with
> dual support (`qwen3_vl`) run via mlx-lm in text-only mode: no image input, full KV persistence.

`oMLX` is a third backend, added because mlx-lm has no support for DeepSeek V4 and no MTP
speculative decoding. Its KV cache is paged and persisted to SSD, with prompt boundary snapshots
reused across requests. HF repo slashes are rewritten to double dashes; `opencode-init` and
`aider-init` translate this automatically. Three gotchas found on rig B: `~/.omlx/settings.json`
ships `max_context_window: 32768` and silently truncates anything larger, raised to `131072`; a
default sampling temperature of `1.0` made DeepSeek emit repeating tool calls, locked to `0.6`; and
oMLX pins `mlx==0.32.0`, so `mise run setup` installs both mlx packages in one pip invocation.

> ⚠️ **oMLX ignores most profile params.** `omlx serve` takes no model, sampling or template flags,
> so `MLX_MAX_TOKENS`, `MLX_TEMP`, `MLX_CHAT_TEMPLATE`, `MLX_CACHE_BYTES` and `MLX_CACHE_SIZE` have
> no effect for oMLX profiles; it reads `~/.omlx/settings.json` instead. `mise run server` prints
> which params it cannot apply. **The custom Metal kernels have never been built on rig B**:
> `OMLX_WITH_CUSTOM_KERNEL=1` needs `xcrun metal` from full Xcode, so every oMLX number here is the
> un-accelerated baseline.

### Dense vs MoE

Decode is bandwidth-bound: what matters is bytes streamed per token, not parameter count on disk.
Dense models load every parameter into every forward pass, and during prefill the activation tensors
for the whole input must coexist with the weights. That spike is what breaches the wired-memory cap.
MoE routes each token through a few experts only, so activation memory stays low regardless of total
size.

| | Qwen3.5-27B-Opus (rig A) | Qwen3.6-35B-A3B (rig A) |
|---|---|---|
| Params, total / active | 27B dense / 27B | 35B MoE / **~3B** |
| VRAM | 14 GB | 21 GB |
| Prefill | 68-71 t/s | 350-386 t/s |
| Result | 💥 OOM at 6-17k tokens | ✅ 96k context, stable |

The MoE is 3x larger by total params, 5x faster at prefill, and peaks lower. **On 32 GB: prefer MoE
above ~14B total params.** Total parameter count sets capacity; active count sets speed.

| | Qwen3.8-27B (dense, 4-bit) | Qwen3.6-35B-A3B (MoE, 4-bit) |
|---|---|---|
| Weights read per token | ~16 GB | ~2 GB |
| KV cache | ~60-80 KB/token (estimated) | **20 KB/token** (measured, rig A) |
| Download | 16.3 GB | 20.4 GB |

On a 128 GB Max there is bandwidth to spare. On a 48 GB Pro, where bandwidth is roughly halved, the
dense model reads ~16 GB per token and is throughput-bound long before it is capacity-bound. The
cheap-operations table is that gap measured end to end: 112.8s for the dense Qwen3.6-27B against
12.7s for its own MoE sibling, on the same rig, same tasks, same night.

**The 3.8 line has no small MoE to sidestep the trade with.** Qwen ships `Qwen3.8-27B` dense and
`Qwen3.8-2.4T-A95B`, a frontier-scale MoE. MLX has only `Qwen3.8-27B-4bit` and its drafter; the one
MoE build, `Qwen3.8-Whittle-MoE-27B-A17.8B`, is an unofficial merge with 17.8B active, nearly dense
in bandwidth terms. Qwen3.6 shipped both a dense 27B and a small MoE, 3.8 did not, and there is no
Qwen3.7 at all. For local hardware, whether the family shipped a small MoE matters more than the
version number.

### Thinking mode

Several models generate `<think>…</think>` blocks before answering, controlled via
`MLX_CHAT_TEMPLATE_ARGS` in the profile. `enable_thinking=false` works differently per family: the
Qwen3 template emits an empty think pair, GLM-4.7-Flash injects a closing tag so the block costs one
token, and GLM-4.5 appends a `/nothink` text token.

| Task type | Thinking helps? | Evidence |
|---|---|---|
| Competition math (AIME, MATH-500) | ✅ Strongly | DeepSeek-R1: 79.8% vs V3: 39.2% on AIME 2024 |
| Competitive programming (Codeforces) | ✅ Strongly | R1 rating 2029 vs V3 1134 |
| PhD science (GPQA Diamond) | ✅ Moderately | R1: 71.5% vs V3: 59.1% |
| **Multi-turn tool calling (BFCL)** | ❌ Harmful | R1: **12.4%** vs V3: **35.8%**, thinking is 3x worse |
| **Agentic simulation (TAU-Bench)** | ❌ Harmful | R1: 33.0% vs V3: 60.7% |
| Instruction following / format | ❌ Slightly worse | Thinking models score ~3pp below on IF-Eval |

Sources: arxiv 2412.21187, GLM-4 repo benchmarks, Qwen3 technical report. Thinking models generate
exhaustive reasoning for trivial decisions because they have no calibration for task difficulty
("Do NOT Think That Much for 2+3=?"). In an agentic session *"src/ is empty, what do I do?"* triggers
the same loop as a hard math problem, observed as a 3m 35s `<think>` block on GLM-4.7-Flash.

`model-use` resets `MLX_CHAT_TEMPLATE_ARGS` to empty for profiles that do not set it, which is
**not** the same as disabling thinking. A profile only suppresses thinking if it sets
`MLX_CHAT_TEMPLATE_ARGS = '{"enable_thinking": false}'` *and* its chat template honours the flag.
`qwen_template.jinja` has no `enable_thinking` branch, so `qwen3.8-27b-8bit` thinks on every turn
regardless of configuration. Cost measured on rig B: a 2,488-token thinking turn raised the next
turn's prompt from 19,897 to 22,417 tokens, so each reasoning token is paid once at decode and again
as prefill on every later turn.

Front-loading reasoning into the *plan* phase is worth it, one block paid once. Reasoning inside the
*implement* phase is not, it recurs per tool call and matches the BFCL collapse. Every profile in
the overnight run disables thinking except `qwen3.8-27b-6bit`.

### KV cache and context limits

`opencode-init` writes a `limit.context` per model into `opencode.json`. Without it the model is
"unknown" and compaction never auto-triggers. Values are set **lower than native** so compaction
fires before the session grows unmanageable, and live in `profiles/<key>.toml` as
`MLX_OPENCODE_CONTEXT`.

| Profile | Native context | Declared | KV/token (8-bit) |
|---|---|---|---|
| qwen3.5-9b | **262k** | 128k | 64 KB |
| granite-4.1-8b | 128k | 128k | — |
| gemma-4-12b | **256k** | 64k¹ | 180 KB (hybrid window) |
| gemma-4-26b-a4b | **256k** | 64k | — |
| qwen3.5-27b-opus-distilled | **262k** | 32k | — |
| glm-4.7-flash | 128-200k | 48k⁴ | 187 KB (no GQA) |
| qwen3.6-35b-a3b | **262k** | 96k | **20 KB** (measured 18.3 KB) |
| kat-coder-v2.5 | — | 64k | — |
| qwen3.8-27b-8bit | 262k | 131k | — |
| deepseek-v4-flash-3bit | 128k+ | 131k | — |

¹ Declared below native because 14B+ models have a larger KV footprint per token. Declared context
*can* exceed native, because the KV cache is the real constraint and `MLX_CACHE_SIZE` is the only
setting that bounds it.
⁴ GLM-4.7-Flash OOM confirmed at 64k: Metal `kIOGPUCommandBufferCallbackErrorOutOfMemory` during
prefill of a ~9k token prompt at ~27k session context, 41% of 65k. 128k is not reachable with a 16
GB model footprint.

> **`MLX_OPENCODE_OUTPUT` is a hard client-side cap**, not just compaction math. opencode sends it
> as `max_tokens`. 4096 is too small for a thinking model: it truncates mid-`<think>` and the turn
> ends with no tool call. Budget reasoning tokens *plus* the tool call.

> **Editing a profile is not enough.** `mise.local.toml` is written only by `mise run model-use`, so
> a profile edit stays inert until the profile is re-activated. `opencode-init` reads
> `profiles/<active-key>.toml` directly for this reason; `aider-init` still reads the mise env.

> **Compaction loops:** declaring a context *too small* is as bad as too large. DeepSeek at 16k
> spent the session compacting instead of working.

> **GPU memory budget:** `cap = weights + KV held + ~5-6 GB activation buffer`. For Qwen3.5-9B on
> rig A that is 26 GB = ~6 + 14 + 6. The KV term is what the cached sessions actually hold, so the
> only lever is `MLX_CACHE_SIZE`, in slots. `MLX_CACHE_BYTES` is a no-op, see
> [Harness findings](#harness-findings).

### Speculative decoding (MTP)

Qwen 3.8 ships an MTP drafter head as a separate `mtp.safetensors`. When oMLX absorbs those weights
into the model index it drafts several tokens per forward pass and verifies them in one go.

| | Without MTP | With MTP |
|---|---|---|
| Decode speed | 11.3-14.3 t/s | 18-38 t/s (37.7 peak on short prompts) |
| Tokens per forward cycle | 1.0 | 2.8-3.5 |
| Draft acceptance rate | — | 80-95% (depth 1-3) |

Short tool-call turns land at the top of the range; long `<think>` blocks at 21k+ context drop back
to ~11-18 t/s. The drafter is worth roughly 2-3x on the same weights, which is what makes a dense
27B competitive with a 284B MoE. mlx-lm cannot load it: the head is published as `qwen3_5_mtp`.

### Dynamic model switching

`mlx_lm.server` switches models per request natively: every request carries a `"model"` field, and
`ModelProvider.load()` reloads when `(model_path, adapter_path, draft_model_path)` changes, clearing
the old weights first so Metal buffers are released. One server on port 8080 can serve models
sequentially, at a ~30-60s reload each time.

The prompt cache is owned by `ResponseGenerator`, not `ModelProvider`, and is never cleared on
switch. Entries keyed by another model stay in the LRU, so a round trip is a warm restart if they
have not been evicted, and peak VRAM during a switch is `old model's KV cache + new model's weights`.
With `MLX_CACHE_SIZE = "3"` a round trip will usually evict them anyway. Toggling `enable_thinking`
does not change the model key but does change the prompt prefix, so thinking mode is always a cold
cache. **Not implemented here**: `opencode-init` writes a single model entry.

### Which levers actually matter

Ranked by measured effect, largest first. The first three all beat changing model.

1. **Prompt hygiene.** Removing the client's own instructions from the system prompt, harness rule
   3 below. Nothing else here is that large.
2. **Spec precision.** Two sentences naming the Met.no 403/429 distinction, roughly 6x on the plan
   phase.
3. **Output cap.** `MLX_OPENCODE_OUTPUT` at 4096 truncates runs mid-file with
   `finish_reason=length`. 16384 fixed it. A profile that still carries 4096 is a run waiting to die.
4. **Backend choice.** mlx-vlm's per-request cache clear roughly doubled Gemma's median turn. Check
   `model_type` exactly, never by prefix.
5. **Sampling.** Follow the model card: `top_k = 20` ended a repetition loop that had swallowed a
   whole run. `repetition_penalty` is the exception, it bought speed and cost reliability.
6. **Thinking on/off.** About 2.3x on the Qwen3.8-27B task set, and far more on trivial answers. It
   also deletes reasoning the model needed: one run reused a placeholder contact it had itself
   diagnosed as causing a 403.
7. **`AGENTS.md` rule 7.** Cut the median turn ~28% on the models that obey it. Qwen3.8-27B 4-bit
   ignores it; the Q8 of the same model does not.
8. **Model choice.** Real, but smaller than the above and rarely the first thing to change.

---

## Harness findings

The benchmark has found more bugs in itself than in any model. Every rule below exists because its
absence produced a wrong number, in this order. How the harness runs, verifies and quarantines is in
[`BENCHMARKING.md`](BENCHMARKING.md).

1. **Verify by compiling and running the suite, never by asking the model.** An untouched checkout
   compiles and its tests pass, so a compile check certifies the repository and not the work.
   Granite scored four false passes before every edit task was made to require a non-empty
   `git status` first.
2. **The prompt is part of the measurement.** Our own `AGENTS.md` contained an unclosed think tag,
   and `mlx_lm/server.py:568-574` starts generation in reasoning state when the last think-start
   follows the last think-end, so everything the model emits lands in `delta.reasoning` and opencode
   renders nothing. Two models looked broken for a day. `check_prompt()` now refuses to launch on
   it. [Issue #10](https://github.com/navikt/mlx-workspace/issues/10).
3. **The client brings its own prompt.** opencode was adding 37,807 characters of personal config
   and global skills. `--pure` plus a benchmark-only `XDG_CONFIG_HOME` cut it to 11,191, and one
   task's input from 14,224 tokens to 5,687. Every number measured before that is quarantined.
   [Issue #12](https://github.com/navikt/mlx-workspace/issues/12).
4. **Nothing else may touch disk or network during a run.** Each task restarts the server, which
   re-reads the weights. A run overlapping a 22 GB download timed out six times.
5. **Record machine state per run.** Swap at 15 of 16 GB with six orphaned clients made the same
   three tasks twelve times slower than an hour earlier. Without the state log that looked like a
   model result, and it was reported as one.
6. **Kill the client when a task times out.** `subprocess` kills `mise run`, not the process it
   launched. Six orphans accumulated over one day.
7. **A failed model switch must abort.** Results are keyed by the active profile, so a refused
   `model-use` merges into the previous model's file. Three tasks of a finished run were
   overwritten. Existing results are now backed up before the first write.
8. **Distinguish a loop from slowness.** Identical consecutive tool calls are counted per task.
   Qwen3.8-27B ran the same `rg` command 113 times after a successful edit. Before the detector that
   was indistinguishable from a slow model, and it was misdiagnosed twice.
9. **Unknown is not zero.** A killed task never prints the summary line the parser reads, so turns
   and tool calls were recorded as 0, which reads as "the model did nothing".

### Server findings

- **The server crashes rather than degrades.** `EXC_BAD_ACCESS` on a stack guard page inside MLX's
  recursive graph walk, on the generation thread. The socket dies with it and every later task gets
  connection refused, so the failure looks like a slow model until the logs are read. The likely
  accumulator is unevaluated prompt-cache entries deepening the graph, at medium confidence, because
  the backtrace is truncated. Restarting the server before every task is what removed this from the
  results, at the cost of a cold cache each time.
  [Issue #11](https://github.com/navikt/mlx-workspace/issues/11), open.
- **`--prompt-cache-bytes` is parsed and never applied.** `LRUPromptCache` is constructed without
  `max_bytes` at `server.py:1743`, so byte eviction never fires, `MLX_CACHE_BYTES` does nothing and
  `MLX_CACHE_SIZE` in slots is the only real bound.
- **`mlx_lm.server` does not expose `--kv-bits`, `--quantized-kv-start` or `--max-kv-size`**, though
  the library supports all three and `stream_generate` takes them as keyword arguments. Three
  upstream issues, open since November, no PR. This is a contained patch, not a missing feature.
- **Closed:** [issue #4](https://github.com/navikt/mlx-workspace/issues/4), sampling penalties reach
  the model through the generated `opencode.json` because `mlx_lm` has no CLI flag for them;
  [issue #5](https://github.com/navikt/mlx-workspace/issues/5), three submissions graded and three
  found ungradeable.

---

## What others report

External claims, labelled by what kind of evidence they are. None of it was measured by us.

| Claim | Kind | Source |
|---|---|---|
| MLX about 1.8x llama.cpp at 4-bit on an M4 Max | measurement, single user | [antekapetanovic.com](https://antekapetanovic.com/blog/qwen3.5-apple-silicon-benchmark/) |
| At matched 8-bit on an M5 Max, llama.cpp 93 against MLX 85 tok/s on 35B-A3B | measurement, single user | [github.com/stared/benching-local-llms-on-apple-silicon](https://github.com/stared/benching-local-llms-on-apple-silicon) |
| MTP is worth about +12% on a 35B MoE, +75% on the dense 27B | measurement, single user | same |
| Ollama switched to MLX on Apple Silicon in 0.19, March 2026, and cannot have auto-update disabled | vendor and open issues | [ollama.com/blog/mlx](https://ollama.com/blog/mlx), ollama#4498 |
| An M5 Pro 48 GB user hit Metal OOM crashes under mlx-lm, attributed to unbounded KV growth | first-hand account | [blog.kulman.sk](https://blog.kulman.sk/running-local-llm-coding-server/) |
| Focused agent rosters cut input tokens 41.3% in OpenCode; permission filtering alone does not, because a denied skill still burns discovery context | measurement | navikt/grillmester, ADR 0005 |

No trustworthy public tok/s figure exists for M4 Pro or M5 Pro on our models. The aggregator sites
carrying such numbers are AI-generated with no reproducible method.

### What another Nav team runs, and what it is not

Audun Sorheim's team: llama.cpp, Unsloth GGUF Q6_K_XL of Qwen3.8-27B, M4 Pro 48 GB, about 10 tok/s,
28 to 30 GB resident, 65k context split 57k input and 8k output, medium reasoning preserved. Good
code quality, long task times, run as background work. They hit cplt sandbox limits and fixed it
with hints in the agent instructions, and they built a focused mode that loads only essential skills
because the context budget is far below cloud Copilot.

Our `qwen3.8-27b-6bit` profile does not reproduce that: different runtime, different quantization,
different hardware. Their resident figure is the independent check on our own 27.0 GB measurement
for the 8-bit build, and the two agree.

### Where this work goes

`navikt/grillmester` ships the agent payloads through a Tier 2 agentpakke contract already wired to
nav-pilot, and deliberately does not own model selection: `defaultModel: "inherit"`, no catalog.
`mise run model-manifest` generates `manifest/models.json` from `profiles/`, which fills exactly that
gap. We should not rebuild `grillmester local setup|doctor|launch`.
[Issue #14](https://github.com/navikt/mlx-workspace/issues/14).

---

## Open questions and what to test next

### The loop that `AGENTS.md` rule 8 does not prevent

Rule 8 forbids repeating a tool call that did not help. The dense 27B repeats calls that *did* help:
113 identical `rg` invocations after a successful edit, and 40 identical calls on G2 under
`repetition_penalty`, which is where its cap goes. So it is not an instruction failure the model
could follow its way out of, and the sampling lever made it worse rather than better. The remaining
candidate is harness-side, a debounce that blocks an identical consecutive call and returns an error
to the model. That changes a benchmark input, so it costs a re-run of the baseline for
comparability. Nothing else on the list would change the alpha decision, and this would.

### The KV flags patch

`mlx_lm.server` exposes none of `--kv-bits`, `--quantized-kv-start`, `--max-kv-size`, while the
library implements all three and `stream_generate` already accepts them. `MLX_CACHE_BYTES` is a
no-op, so today the only bound on cache growth is slot count. The one first-hand external report of
Metal OOM under mlx-lm attributes it to exactly this unbounded growth. Three upstream issues have
been open since November with no PR; wiring the arguments through is a contained change and would
give the 48 GB target a real memory ceiling instead of a slot count.

### What we have never measured

- **The target hardware.** No number here comes from a Pro-class 48 GB machine. The 36 GB wired cap
  reproduces the ceiling, not the halved bandwidth. Expect roughly half these speeds.
- **The decode curve at long context.** Every cheap-operations task runs under 12k input tokens. The
  only decode-versus-context data we have is rig A's 9B, which fell off a cliff past ~80k, and one
  external report of MLX losing about half its throughput at 30k and beyond. A local model that is
  fast on eleven short tasks may not be fast in a long session.
- **More than two runs of anything.** The alpha model has two clean eleven-task runs; every other
  configuration has one. At temperature 0.6 with individual tasks swinging up to 1.7x, that
  separates 12.7s from 194.5s and separates nothing inside 1.5x.

### Queued

The MLX 6-bit anomaly is closed: the 50x slowdown was measured on a machine in swap and does not
reproduce, and the clean number is 284.2s with thinking left on, the only profile that still enables
it. A thinking-off control on those weights would separate the quantization from the reasoning
tokens, and is now cheap curiosity rather than a blocker.

`mlx-community/gemma-4-26b-a4b-it-4bit` has a profile and has never been run, and it is the highest
priority of the untested: 26B total / ~3.8-4B active, ~14 GB VRAM, a **shared KV cache** where late
attention layers reuse KV from earlier ones, paired with **dual RoPE**. Published MMLU Pro 82.6%,
AIME 2026 88.3%, LiveCodeBench v6 77.1%. It needs mlx-vlm, so its per-request cache clear has to be
measured before any turn time from it is comparable. The config backlog is in
[Scheduled re-tests](#scheduled-re-tests).

### How far these results can be trusted

The readable version, with per-claim confidence written out, is
[`reports/48gb-question.md`](reports/48gb-question.md).

| Claim | Confidence | Why |
|---|---|---|
| Both 4-bit builds and the 8-bit fit a 48 GB Pro | **high** | Measured peak RSS across full runs under the cap: 14.6, 18.6 and 27.0 GB against a ~36 GB ceiling. Capacity transfers between machines |
| Attention architecture, not size, drives KV cost | **high** | Consistent across four architectures from 9B to 284B, with a mechanistic explanation |
| Harness levers beat model choice | **high** | Six independent levers, large effects; the largest single change was to our own prompt |
| Qwen3.6-35B-A3B is the right alpha model | **high** | Two clean eleven-task runs, and eight challengers in one uncontended night, none of which displaced it |
| Qwen3.8-27B loops | **high** | Three configurations, a loop detector counting identical consecutive calls, and 3 to 4 timeouts each |
| Qwen3.6-35B-A3B is ~9x faster than the dense Qwen3.6-27B | **high** | 12.7s against 112.8s, same night, same tasks, same sampling, thinking off on both |
| Qwen3.8-27B writes better code | **medium** | 29 of 29 tests green where the alpha model's own suite fails, but one run each, on the benchmark we do not intend to route locally |
| Anything about a real 48 GB Pro's speed | **untested** | The wired cap reproduces the ceiling, not the halved bandwidth |
| Any number under [Superseded results](#superseded-results) | **superseded** | Measured through instructions the benchmark did not choose |

**Two workloads, and only one of them is the target.** Cheap operations is eleven short tasks in one
Kotlin repository; weather-cli is one CLI against two HTTP APIs. Nothing here licenses a claim about
refactoring at scale, debugging, or anything stateful.

---

## Archive: pre-2026 models

Models released in 2025 or earlier, kept for provenance and not candidates. The field moves faster
than a run costs, so the runs go to current weights.

| Model | Released | What happened | Why it is out |
|---|---|---|---|
| `Qwen3-Coder-30B-A3B-Instruct-4bit` | Jul 2025 | MoE 30.5B / ~3.3B active, ~16 GB VRAM, 24 KB/token KV. Slow on rig A with inconsistent tool calling; on rig B opencode surfaced nothing at all | Dropped on age, not capability. **Its empty output was our own prompt bug**: it returns correct tool calls directly and works through opencode since `9a2b324` |
| `Ministral-3-14B-Instruct-2512-4bit` | Dec 2025 | Dense 14B, ~8.5 GB VRAM, 100 KB/token KV. Cold prefill ~150 t/s, 2.83 GB cache after turn 1, then failed after 2 turns | Two fundamental faults, neither config-tunable |
| `GLM-4.6V-Flash-9B-4bit` | Dec 2025 | MoE hybrid, 9B active, ~5.5 GB VRAM plus vision encoder. Never run | `glm4v` forces mlx-vlm and its per-request cache clear |
| `Qwen2.5-Coder-14B-Instruct-4bit` | Nov 2024 | Dense 14B, ~9 GB VRAM on rig A, 96 KB/token KV. Frequent malformed tool-call JSON | Superseded by Qwen3.5-9B on every dimension |
| `Qwen2.5-Coder-32B-Instruct-4bit` | Nov 2024 | Dense 32B, ~19 GB VRAM, 128 KB/token KV. Crashed with `kIOGPUCommandBufferCallbackErrorOutOfMemory`: after model plus a 4 GB KV cache only ~3 GB was left for activations | Inconclusive, never evaluated for quality. May work on 64 GB |
| `Qwen2.5-Coder-7B-Instruct-4bit` | Nov 2024 | Dense 7B, ~4.5 GB VRAM. Never tested | Known Qwen2.5-7B tool calling issues |
| `Qwen2.5-72B-Instruct-8bit` | Sep 2024 | Dense 72B, ~72 GB. Answers well in chat; in opencode and aider it prints markdown code blocks instead of emitting tool calls, and left six 0-byte files | Broken for tool calling. Strict-JSON prompting did not fix it |
| `Mistral-Large-2-4bit` | Jul 2024 | Dense 123B, ~69 GB. Downloaded, never run | Age |

Ministral's chat template is the one finding worth carrying: its `chat_template.jinja` raises an
exception when roles do not follow strict `user→assistant` alternation, because the parity counter
does not reset after tool-call rounds, and mlx-lm returns HTTP 404 for any exception during
generation. `chat_templates/ministral-3-14b-patched.jinja` removes the one-line `raise_exception`,
which is safe because `ns.index` is provably unused after the check block. Patched, the model then
generated fake YAML listing invented chat template paths, most likely because the template's default
system message contains a literal `{today}` rather than a Jinja2 `{{ today }}`.

---

## Standard benchmark prompts

Use these two prompts verbatim for every weather-cli run so runs are comparable. Both are issued
inside `workspaces/<model-key>/` (see `mise run opencode`), where `weather-cli/WEATHER_CLI_SPEC.md`
and `AGENTS.md` are provisioned.

**1. Plan prompt**

> Read the weather-cli/WEATHER_CLI_SPEC.md and make a short and concrete implementation plan make
> sure you have a good understanding about the external services and their data strucure for input /
> output data. Check the external apis do not assume the data model

**2. Implementation prompt**

> Lets start implementing, check your work and ensure tests and the final cli works according to the
> supplied specification

The "check the external apis do not assume the data model" clause was added after models invented
the Met.no and Geonorge response shapes and then spent the majority of the run repairing that guess.
It moves the cost into the plan phase and makes implementation more direct.

---

## Code review rubric

Wall-clock and a passing test count say nothing about what the model wrote. A model can pass every
test with code that silently prints `undefined°C` on a partial API payload.

**Process.** Functional verification comes first and is done by hand, not by the model's self-report:
run `npm test`, run the live suite, check the output line count, check every exit code without a pipe
(`$?` after a pipeline is the last command's status, not the program's). Only then hand the workspace
to a read-only review agent along with this rubric. The reviewer never runs the tests.

| Dimension | Weight | The question |
|---|---|---|
| Correctness risks | 30% | What breaks that the tests do not cover? Every finding must name the input that triggers it |
| Error handling | 20% | Are network errors, non-2xx, malformed payloads and empty data explicit and actionable, or do they reach a stack trace, or worse, exit 0 with garbage? |
| Structure | 20% | Is the module split meaningful or cosmetic? Is the entry point thin? Is anything abstracted with one caller? |
| Test quality | 20% | Real assertions at a sensible mock boundary, or trivia that cannot fail? Are the spec's exact boundary values pinned? |
| Idiom and readability | 10% | Naming, dead code, copy-paste; do comments explain *why* or restate the code? |

**Fixed trap checklist.** Report each as avoided or hit, because this is where one-shot code fails
on this spec:

1. Timezone: Met.no timestamps carry `Z`; is "closest to now" compared in UTC?
2. Sorted-input assumption: is the timeseries scanned, or is `series[0]` trusted?
3. Cloud-cover thresholds: the spec uses strict `>`. Check the exact values 25 / 50 / 75, not
   values near them
4. Coordinate order: Geonorge GeoJSON is `[lon, lat]`; `representasjonspunkt` is `nord`/`øst`
5. Missing fields: does `?? 0` / `?? {}` fabricate a confident answer from an incomplete payload?
6. Injection: is user input validated before URL interpolation, and are place names encoded?
7. Latitude and longitude range validation at the exact bounds (±90 / ±180)

**Grading discipline.** Judge the submission as a one-shot from a local quantized model. Separate
"real bug" from "stylistic preference" explicitly, and state plainly where the code is genuinely
good. If there are no real bugs, say so rather than inventing some. `axios` is required by
`WEATHER_CLI_SPEC.md`, so its presence is compliance; anything *beyond* the spec's dependency list
is a genuine finding.

---

## Scheduled re-tests

Config capability added after these models were measured. Each is a plausible gain the recorded
numbers do **not** include. Nothing here invalidates a recorded result: every number stands for the
config it was measured with.

| Model | Change to test | Expected effect | Priority |
|---|---|---|---|
| `qwen3.8-27b-4bit` | harness-side debounce on identical consecutive tool calls | The one intervention not yet tried against the loop. Costs a baseline re-run because it changes a benchmark input | **high**, it is what holds the model back |
| `qwen3.6-35b-a3b` | thinking **enabled** (drop `enable_thinking: false`) | The only way to separate "MoE is fast" from "no reasoning tokens is fast" | **high**, the headline result rests on this being config, not model |
| `glm-4.7-flash`, `qwen3.5-27b-opus-distilled` | `MLX_PREFILL_STEP_SIZE` (lower) | Both failed as **OOM during prefill**. A smaller prefill batch shrinks exactly that spike | **high**, could overturn two ❌ verdicts |
| `gemma-4-31b-8bit` | `MLX_DRAFT_MODEL` (mlx-lm speculative decoding) with a small Gemma 4 | 1.5-3x decode, the lever MTP gives Qwen3.8 | medium, the slowest model with no drafter |
| `qwen3.8-27b-6bit` | thinking **disabled** on the same weights | Separates quantization from the one variable the profile changes alongside it | medium, no longer blocking anything |
| `qwen3.6-35b-a3b`, `qwen3.5-9b` | raise `MLX_CACHE_SIZE` above the rig-A slot count | Both are rig-A tuned for a 26 GB cap and Qwen3.6 overshot to 4.70 GB at 36 GB with no visible thrash, so there is headroom the profiles never knew about. Slots are the only knob that reaches it, `MLX_CACHE_BYTES` cannot | medium |
| `qwen3.8-27b-8bit`, `deepseek-v4-flash-3bit` | oMLX `--memory-guard`, `--hot-cache-max-size` | Cache and OOM behaviour; both ran entirely on defaults | low |

---

## Testing checklist

Standing rules first, because they are what the benchmark learned the hard way:

- **Verify the model's claims before clearing anything.** Run `npm test` yourself. Check exit codes
  without a pipe.
- **A passing test count is only as good as its weakest test.** One submission wrapped eight
  assertions in a `try`/`catch` meant for network errors; Node's `assert` throws, so the catch
  swallowed them. 20/20 was really 19 that could fail and one that could not.
- **Check the workspace is empty before a run.** A model that finds working code in place is not
  being measured.
- **Sandbox the run.** Models escape: one listed every sibling workspace's solution, another tried
  to `npm install -g` and `brew tap` a package it had invented. `mise run opencode` launches under
  `cplt`.
- **Grade code against the [rubric](#code-review-rubric), not impressions.** Speed and quality came
  apart in both directions: the slowest model wrote the best code, the fastest wrote the worst.
- **A zero-tool-call result is a harness result** until the model has been checked directly against
  the server.

When evaluating a new model (`mise run model-download <key>`, `mise run model-use <key>`, then
`mise run server`):

- [ ] `mise run chat`: basic back-and-forth, instruction following
- [ ] `mise run aider`: can it edit files correctly and commit?
- [ ] `mise run opencode`: tool calling (read/write/run), multi-step tasks
- [ ] **Cheap operations**: `mise run bench-cheap-ops`, record median, verified count, timeouts, loops
- [ ] **weather-cli**: both [standard prompts](#standard-benchmark-prompts), record plan time,
      implement time and tests passing
- [ ] Does it actually write files, or only print code into the chat?
- [ ] Tool calling stability: completes tool calls without looping or malformed JSON?
- [ ] OOM check: monitor server logs for Metal OOM errors at larger context lengths
