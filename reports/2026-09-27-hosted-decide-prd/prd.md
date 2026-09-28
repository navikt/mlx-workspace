# PRD: hosted `nav-pilot alpha decide`, 2026-09-27

Status: **draft, no-go today.** None of the four data gates in
[pending-tasks §8.10](../2026-09-23-local-model-evaluation/pending-tasks.md#810-a-prd-for-a-hosted-alpha-decide-once-the-data-is-in)
is met (§9). **This is a plan only.** On 2026-09-27 the user chose "PRD first, no spend" and
then said: "We will not be running any GCP infra at this point, plan only." Nothing here creates
GCP resources, runs a spike or asks for budget. Every pilot below is a future option that needs
the §8.10 gates and the user's explicit go.

Labels, as in [the hosting research](../2026-09-26-decide-as-a-service/research.md):
**[fact]** = a file in this repo or a cited source says it. **[inference]** = our estimate,
usually arithmetic on a cited figure. **[assumption]** = a number chosen to size the problem.
**[proposal]** = a target or threshold this PRD suggests; the user sets the real one.

## 1. Summary

- **What:** `alpha decide` answered by a NAV-run model server in `europe-north1` instead of the
  developer's Mac, for people and machines that cannot run the local model.
- **Recommended option, if the gates pass:** a G4 (RTX PRO 6000) VM running vLLM with the
  35B-A3B model, reachable only through the nav-pilot CLI gateway (navikt/copilot #339, unmerged), which would
  gain a decide-shaped API and nothing else (§5, option B) [proposal]. If the user ever says go, the
  smallest step would be one on-demand G4 in office hours, and 1+1 on a commitment only if
  measured volume reaches scenario S2a.
- **Cost, if ever built [inference]:** about $1.0k a month for a pilot (one G4, office hours) to about
  $3.2–7.2k for 1+1 G4 serving developer hooks for all of NAV; CI is counted only if its route and
  sign-in are solved (Q5). Per 1,000 calls that is about $16 at pilot volume and $2.5–5.7 at NAV
  hook volume (§6). Local stays at $0 marginal.
- **Decisions needed now:** none that commit infrastructure. Open for later (§10): expected
  volumes, a possible owning team, and the budget range that would make hosting worth revisiting.

## 2. Problem

`alpha decide` asks a local model one question with fixed options and returns a probability per
option from a single token ([System One report](../2026-09-25-system-one/report.md)). It shipped
in navikt/copilot #949 on 2026-09-24 [fact] and backs a `commit-msg` hook recipe (#958) [fact].
It only runs where nav-pilot can start an MLX server:

- **[fact]** `alpha local` refuses Linux today (`SupportedPlatform()`, and macOS-only wired-limit
  checks), per [the Linux report §3.4](../2026-09-27-qwen38-linux-ollama/research.md).
- **[fact]** The default local profile is tuned for the 48 GB tier
  ([decision.md](../2026-09-23-local-model-evaluation/decision.md)). Macs below that are not
  served by the tuned profile.
- **[inference]** CI runners have no local model, so a hook recipe that works on a laptop does
  nothing in a pull request.

So a team cannot rely on a decide-based hook: it works for some members and silently does
nothing for the rest (`result=no_server` in telemetry [fact, #961]).

## 3. Users and jobs

| User | Job | Today |
|---|---|---|
| Developer on Linux | Run the same `commit-msg` / `pre-push` decide hooks as colleagues | No local server; `no_server` |
| Developer on a Mac below the 48 GB tier | Same | No tuned profile |
| CI (PR checks, bots) | Ask typed questions about a PR, e.g. "does the description say why?" | Not possible |
| Developer with a capable Mac | Nothing new; keeps local | Works, p50 0.38–2.5 s (§4) |
| Application teams, runtime triage | Classify items inside a running service | **Non-goal** (§5.2) |

The telemetry in #961 carries `caller` (tty, hook, script) on decide metrics, and every
nav-pilot metric carries `os`, `arch`, `device_id` and `execution_context` as resource attributes
[fact, navikt/copilot `cli/nav-pilot/TELEMETRY.md` and `internal/telemetry/telemetry.go`].
`nav_pilot_info` counts devices by `os`, which gives the Linux install base. `no_server` alone is
a poor demand signal: decide never starts the server (System One report §3.2), so a capable Mac
with its server stopped also reports `no_server`. And people whose decide never works tend not
to install the hook, so decide telemetry undercounts the target group [inference]. See gate 1.

## 4. Value proposition

### 4.1 Against local

| | Local (today) | Hosted |
|---|---|---|
| Who can use it | Capable Macs only | Anyone with nav-pilot and a NAV identity; CI if §5.3 is solved |
| Latency | p50 383 / 843 / 2,475 ms at ~1k / 8k / 30k characters, optiq, measured [fact, [decide-limits](../../bench/decide-limits-20260925-014512.md)] | ~0.1 s at 2k tokens, ~0.25 s at 8k on the GPU [inference, research §3], **plus network and gateway hops, unmeasured** |
| Model | Whatever the user's profile loads | One pinned model and quantization for everyone |
| Code leaves the laptop | No | Yes (§7) |
| Marginal cost | $0 | Fixed monthly cost (§6) |
| Failure mode | Server not running | Service down or unreachable; hooks must fail open |

Hosted does not replace local. For Mac users who already run the local model, local is cheaper
and keeps code on the machine; nav-pilot should keep local as the default when it is available
[proposal].

### 4.2 Against a cloud LLM

| | Cloud LLM (frontier model, sampled text) | Jev-style SaaS | Hosted decide |
|---|---|---|---|
| Output | Text, parsed | Probability per option | Probability per option, calibration measured on our sets [fact, decide-limits calibration table] |
| Latency | median 2,266 ms (Opus 5, Banking77) [fact, OpenRouter via [Jev research](../2026-09-24-jev-like-features/research.md)] | median 175 ms, same benchmark [fact, same source] | see §4.1 |
| Price | $2.42 per 1k requests on Banking77's short utterances [fact, same source] | $0.042 per million input tokens [fact, vendor]; ~$0.08 per 1k calls at 2k tokens [inference] | $16–114 per 1k calls at S1, $2.0–5.7 at S2a/S2b (§6) [inference] |
| Where data goes | Vendor region | US; no EU region documented, zero retention only for enterprise [fact, Jev research] | NAV's GCP project, `europe-north1` |
| Accuracy on our sets | not measured | not measured | optiq figures apply only after the FP8 parity check (gate 3) |

The Banking77 prices are for short inputs; our evidence is 2k–8k tokens, so a per-token cloud
price would be several times higher per call [inference]. We have no per-token price for a
frontier model in our reports, so that row is not extrapolated.

**The honest value case:** hosted decide is not the cheapest per call at low volume. It buys
(1) the same decide hooks for Linux, smaller Macs and CI, (2) data residency in `europe-north1`
with no third party, and (3) calibrated probabilities instead of parsed text. If (2) does not
matter to NAV, a Jev-style API is cheaper. This PRD rules it out on the [assumption] that NAV
requires EU processing for source code: the Jev source documents no EU region, and its DPA relies
on standard contractual clauses (Q9).

## 5. Scope and architecture

### 5.1 In scope

- The existing decide contract (question, 2–11+ options, evidence → probability per option), with
  the same model family as the local default: Qwen3.6-35B-A3B, served in FP8 [assumption]. No
  report verifies an FP8 checkpoint of this model or vLLM support for its hybrid DeltaNet layers;
  that belongs to gate 3.
- Callers: the nav-pilot CLI on laptops (Linux, smaller Macs, opt-in on capable Macs), and CI
  once §5.3 is solved.
- Region `europe-north1`. No prompt or evidence retention.
- Telemetry with the #961 content rule: enums and buckets only, plus an `endpoint`
  (local/hosted) attribute [proposal].

### 5.2 Non-goals

- Runtime triage inside applications (research option iii). It needs its own ROS and DPIA and
  4–10 GPUs [inference, research §3 and §7]; it becomes scenario S3 only as a sizing reference.
- A general chat or completions endpoint. The service must not become a free LLM for navikt.
- Serving Copilot or agent sessions (the 64 GB worker work in §8.8).
- The 27B dense model. More accurate on goapi and loop-near, but about 9× the GPUs and less
  robust to injection (103/160 against optiq's 132/160) [fact, research §8].
- Personal data as intended input. Evidence is code, diffs and commit text; secrets and
  fødselsnummer are redacted before sending (§7).
- A 24/7 SLA in the pilot.
- Replacing local for users whose Mac already runs it.

### 5.3 Options

All three need a GCE project outside NAIS for the model, because NAIS clusters have no GPU node
pools [fact, research §6], except the CPU option, which might run as a NAIS app [inference,
unverified: NAIS CPU node sizes and limits are not in our reports].

**Option A: a standalone G4 VM.**

```
nav-pilot (laptop) ──HTTPS + own auth──▶ g4-standard-48, europe-north1
                                         vLLM (OpenAI API), Qwen3.6-35B-A3B FP8
```

- Simplest serving path; vLLM returns up to 20 logprobs by default [fact, research §2], enough
  for the 11 options decide reads.
- A new, separate auth system (IAP or similar) and a second public or naisdevice-only ingress.
- vLLM's raw API is a general completion endpoint. Restricting it to one-token decide calls
  needs a proxy anyway, which is option B.

**Option B (recommended): the shared endpoint behind the CLI gateway (#339).**

```
nav-pilot (laptop, naisdevice) ──GitHub App user token──▶ copilot-cli (NAIS, europe-north1)
my-copilot / in-cluster apps  ──Entra OBO token───────▶        │  POST /api/v1/decide
                                                               │  (decide-shaped, max_tokens=1)
                                                    private link (VPC peering or PSC)
                                                               ▼
                                             g4-standard-48 (own GCP project, europe-north1)
                                             vLLM, Qwen3.6-35B-A3B FP8, request logging off
```

- Reuses #339's sign-in: GitHub App user token checked against the App and navikt membership,
  or Entra OBO via Texas [fact, #339]. One place to enforce the contract: fixed prompt template,
  `max_tokens=1`, an evidence size cap, per-user rate limits, no body logging.
- The same private-network pattern NAV has used before: ao-ki-transkribering ran vLLM outside
  NAIS and reached it over VPC peering [fact, research §6].
- **#339 is not merged** (state OPEN on 2026-09-27), deploys to dev-gcp only, and has no decide
  endpoint; `POST /api/v1/decide` above is [proposal] [fact, #339]. It runs one replica because its
  survey queue is in memory [fact, #339]; decide traffic needs either a second deployment or a
  stateless decide path [inference].
- Its ingress is `.intern.(dev.)nav.no`, naisdevice only [fact, #339]. GitHub-hosted CI runners
  cannot reach it and cannot do a device-flow sign-in [inference]. CI needs either self-hosted
  runners inside NAV's network or a separate external route with GitHub Actions OIDC, which #339
  does not support. Open question Q5.
- Adds one hop; its latency is unmeasured.
- nav-pilot needs a hosted mode for decide. The planned bring-your-own-endpoint work accepts only
  loopback and private addresses in its first version [fact, Linux report §4.5], so the hosted
  client is new work: HTTPS, the token, fail-open on timeout [inference].

**Option C: CPU.**

```
nav-pilot ──▶ copilot-cli ──▶ 2× c4d-standard-32 (GCE) or a NAIS app
                              Laya-322M multilingual (encoder) or Kev 4B
```

- Viable only if a small model passes our sets (gate 2). Qwen3-4B did not: 0.53–0.65 on
  lang-en, lang-no, describes and goapi, and 0.48 on injection [fact, research §8].
- Laya's context is 512–1,024 tokens [fact, §8.6]; our hook evidence is sized at ~2k tokens and
  CI at ~8k [assumption, research §1], so evidence would be truncated.
- A 4B decoder on 16 cores takes ~7 s at 2k tokens and ~30 s at 8k [inference, research §4]:
  acceptable for asynchronous CI only.
- Kev and Laya return a probability per option from their own head, not letter logprobs [fact,
  §8.6], so nav-pilot or the gateway needs a second decide backend.
- The Laya MLX port is Apple-only; a Linux server would run upstream Laya [inference].

## 6. Cost model

### 6.1 Inputs

| Input | Value | Label and source |
|---|---|---|
| G4 prefill, 30B-A3B FP8 on one RTX PRO 6000 | 33–37k tokens/s; TTFT 37 ms at 1k, 0.2 s at 8k | [fact] third-party (Millstone), research §3 |
| Same for Qwen3.6-35B-A3B | ~35k tokens/s | [inference] same active-parameter class, research §3 |
| G4 latency under load | p50 ~0.1 s / p95 ~0.4 s at 2k tokens; ~0.25 / ~0.6 s at 8k | [inference] research §3 |
| Local, optiq on M5 Max | p50 383 / 843 / 2,475 ms at ~1k / 8k / 30k characters; prefill ~3,000 tokens/s at 30k | [fact] decide-limits; Linux report §1.2 |
| CPU, 4B decoder, 16 cores | ~290 tokens/s; ~7 s at 2k tokens | [inference] research §4 |
| `g4-standard-48`, europe-north1 | $4.95/h on-demand (~$3.6k/month); $2,493/month 1-yr CUD; $1,590/month 3-yr CUD | [fact] third-party list price, not verified with Google, research §5 |
| `c4d-standard-32`, europe-north1 | $1.51–1.97/h on-demand; $695–904/month 1-yr CUD | [fact] same caveat |
| Month | 21 working days; office hours 10 h/day | [assumption] |
| Evidence per call | 2k tokens for hooks, 8k for CI | [assumption] research §1 |
| Days | 21 working days for hooks and CI; runtime triage would run 30 days (S3 note) | [assumption] |

A decide call generates one token, so cost is prefill [fact, research §1]. Prices exclude disks,
networking, egress and the people who run it [fact, research Limits].

### 6.2 Volume scenarios

No report has measured decide volumes: telemetry (#961) merged on 2026-09-25 and no report
quotes its data [fact: searched `reports/` on 2026-09-27]. Volumes are therefore **unknown**;
these three scenarios are [assumption].

| Scenario | Who | Calls/day | Calls/month | Prefill tokens/month | GPU busy time/month at 35k tok/s [inference] |
|---|---|---|---|---|---|
| S1 pilot | 100 devices × 30 calls | 3,000 | 63,000 | 126M | ~1 h |
| S2a NAV hooks | research §1 (a): 2,000 developers × 30 | 60,000 | 1.26M | 2.52B | ~20 h |
| S2b S2a + CI, only if Q5 is solved | plus research §1 (b): 3,000 PR events × 5 at 8k tokens | 75,000 | 1.575M | 5.04B | ~40 h |
| S3 S2b + runtime triage (non-goal, sizing only) | plus research §1 (c) at the low end: 100k items × 3 | 375,000 | 7.875M (≈ 10.6M if triage runs 30 days) | 17.6B | ~140 h |

Peak rate, not the monthly average, sizes the hardware [inference, research §1 and §3]. S2a
peaks at ~10 req/s × 2k tokens ≈ 20k tokens/s, about 60 % of one G4. S2b adds ~2 req/s × 8k,
≈ 36k tokens/s at coincident peaks, which saturates one G4: the second G4 in 1+1 is then capacity,
not spare. S3 needs 2–3 G4 plus one for availability.

### 6.3 Cost per scenario [inference]

Arithmetic on the prices in §6.1. "—" means the option cannot carry the scenario.

| Option | Hardware | Monthly | S1: $/1k calls | S2a: $/1k calls | S2b: $/1k calls | S3: $/1k calls |
|---|---|---|---|---|---|---|
| B-pilot | 1× G4 on-demand, office hours (210 h) | ~$1.0k | ~$16 | — (no spare, off-hours gap) | — | — |
| A or B | 1× G4 on-demand, 24/7 | ~$3.6k | ~$57 | ~$2.9 (no spare) | — (saturated at peak) | — |
| A or B | 1+1 G4, 3-yr CUD / 1-yr CUD / on-demand | ~$3.2k / ~$5.0k / ~$7.2k | $50–114 | ~$2.5 / ~$4.0 / ~$5.7 | ~$2.0 / ~$3.2 / ~$4.6 (no spare at peak) | — |
| A or B | 2+1 to 3+1 G4 (3–4 VMs), 3-yr CUD to on-demand | ~$4.8k–14.4k | — | — | — | ~$0.6–1.8 |
| C | 2× c4d-standard-32, 1-yr CUD to on-demand | ~$1.4–2.9k | ~$22–46, encoder only | not sized: encoder truncates 2k evidence | not sized: a 4B decoder is ~7 s/call at 2k | — |
| Local | the developer's Mac | $0 marginal | $0 | $0 | no route from CI | n/a |

Reading the table:

- At pilot volume a dedicated G4 is idle almost all month (~1 busy hour of 210). The cost is the
  price of availability, not of compute.
- Starting and stopping a G4 for office hours assumes the capacity is there each morning;
  that is not verified [inference]. Spot ($2.11/h) can be preempted and does not suit
  interactive hooks [inference].
- Cloud Run with GPUs would scale to zero, but it is not offered in `europe-north1`; the nearest
  is `europe-west4` [fact, research §5]. Using it trades region for cost (Q6). Its prices are not
  in our reports.

## 7. Privacy and security

- **Code leaves the laptop.** Diffs, commit messages and tool output go to NAV's GCP project
  [fact, research §7]. That is the main change against local and needs a ROS and a DPIA:
  diffs and commit text routinely carry names, e-mail addresses in trailers and fixture data, so
  personal data will reach the evidence [inference]. Both are gate 5.
- **Redaction before sending.** nav-pilot's hook redaction already counts `secret` and `fnr`
  hits [fact, #961]. The hosted client must run the same redaction on decide evidence before it
  leaves the machine [proposal]. The Linux report notes that decide bypasses the guard's
  redaction today [fact, §4.5].
- **Residency.** G4 is available in `europe-north1` zones a, b and c [fact, research §5], the
  same region as NAIS [fact, research §6]. Option B keeps both the gateway and the GPU there.
- **No retention.** Request and body logging off in vLLM and the gateway, with a test that sends
  a marker string and asserts it appears in no log line, in the spirit of
  `TestDecideAndHookAttributesAreEnums` [proposal]. The gateway was reviewed for PII and token
  logging [fact, #339]; its ingress access log still needs checking [fact, #339 pre-launch
  item].
- **Shared prefix cache.** vLLM's prefix cache holds evidence in GPU memory across requests
  [fact, research §7]. Either key it per user or accept it explicitly in the ROS.
- **Prompt injection.** Evidence is untrusted. optiq flips on 4–33 % of injected pairs depending
  on the attack, 14/99 = 0.14 pooled [fact, decide-limits; pooled figure inference]; FP8 has not been measured (gate 3). The README advice
  stands: `--threshold 0.9` or higher when the answer blocks something [fact, System One report
  §2]. A hosted hook should warn, not block [proposal].
- **Abuse.** A fixed template with free question, options and evidence is a classifier for any
  text; that is the product. The realistic misuse is pushing non-NAV or personal data through it,
  which the ROS must cover. Generation is capped both in the gateway and in vLLM itself
  (`max_tokens=1`, a `max_logprobs` cap), with evidence size caps and per-user rate limits
  [proposal].
- **The VM.** Access by OS Login only, no SSH keys on the instance; vLLM's metrics endpoint not
  reachable outside the private link; core dumps off, since they would hold evidence [proposal].
- **Failure and timeouts.** Linux developers are the target and naisdevice is often off. A
  `commit-msg` hook waiting on an unreachable `.intern.nav.no` would stall every commit. The client
  needs a hard budget (≤ 2 s total, immediate fail on connection refused), remembers "unreachable"
  for the session, and fails open [proposal]. #339 notes that the GitHub App user token may
  expire [fact, #339 pre-launch item] and a git hook has no terminal for the device flow, so
  token refresh must ship before hosted hooks [inference]. In CI a fail-open check is not a check:
  decide output there is an advisory comment, never a required status [proposal].

## 8. Success metrics [proposal]

| Metric | Target | Source |
|---|---|---|
| Hosted users | ≥ 20 unique devices a week by the end of the pilot | `nav_pilot_decide_result_total` with `endpoint=hosted` |
| Reach | ≥ 50 % of those devices have `os` ≠ `darwin` | same, by resource `os` |
| Latency | p95 end to end (laptop → gateway → GPU) < 1 s at ≤ 8k characters of evidence. For reference, local optiq p95 is 392 ms at ~1k characters and 898 ms at ~8k [fact, decide-limits]; the GPU alone is ~0.4 s p95 at 2k tokens under load [inference], so matching local is not realistic | `nav_pilot_decide_latency_ms` by `evidence_size` (#961 does not state the bucket unit; confirm before use) |
| Availability | `no_server` + `timeout` + `error` < 1 % of hosted calls in office hours | `result` |
| Quality | argmax agreement with mlx ≥ 95 % on the 974 decide-limits cases; calibration bands within 0.05 | gate 3 run |
| Cost | $ per 1k calls reported monthly and within the agreed budget | billing ÷ gateway request count (telemetry is opt-out, so it undercounts) |
| Privacy | zero evidence content in any log | the marker test, plus a log audit before go-live |

## 9. Go/no-go: the §8.10 gates

The §8.10 list has four gates; this PRD adds a fifth for privacy. Gates 1, 2, 4 and 5 can be
met without any GCP resource. Gate 3 cannot. The order is therefore: gates 1, 2, 4 and 5 pass →
the user decides, explicitly, whether to measure gate 3 (the first GCP resource) → gate 3 passes →
the user decides, explicitly, whether to build. Under the current plan-only decision neither step
is requested.

| # | Gate | Pass criterion [proposal] | Status 2026-09-27 |
|---|---|---|---|
| 1 | Demand from telemetry (#961): unique devices, calls/day, caller split, latency by evidence size, p_choice | 2–4 weeks of data; `nav_pilot_info` devices with `os` ≠ `darwin` (the ceiling) and decide `no_server` results by `os`, enough to justify S1 (the user sets the number, Q1) | **Not met.** Telemetry merged 2026-09-25 [fact]; earliest read about 2026-10-09 to 10-23 [inference] |
| 2 | Small-model quality (§8.6): Kev and Laya on our sets, Norwegian and injection included | CPU is a go only if one is within 5 points of optiq on lang-no, describes and injection (Opper calls < 5 points noise [fact, §8.6]), measured on the untruncated subset, with the truncation rate reported per set | **Not met.** Models downloaded; install blocked by the uv cooldown until about 2026-09-29 [fact, §8.6] |
| 3 | Serving parity and cost (§8.9): vLLM against mlx logprobs, G4 load test in `europe-north1`, prefix caching on the DeltaNet model, FP8 injection | An FP8 checkpoint exists and vLLM serves the hybrid layers; ≥ 95 % argmax agreement; p95 ≤ 0.6 s at 8k tokens at 10 req/s; FP8 accuracy on the injection set ≥ 0.76 (the lower bound of optiq's 132/160) | **Not started, and out of scope for now.** It needs a G4; no GCP infrastructure will be run at this point [fact, user 2026-09-27] |
| 4 | Volume and owners: commits and PRs per day across navikt; 1–2 runtime flows with an owning team | Scenario chosen from measured numbers; a named team owns the service and its ROS | **Not met.** Volumes unknown; no owner [fact: none in any report] |
| 5 | Privacy and security (new) | ROS approved; the personvernombud's decision on the DPIA; redaction in the decide path shipped with a test; #339's ingress access-log check done | **Not met.** None started |

If gate 2 passes and gate 3 fails, option C is the fallback. If both fail, or gate 3 is never
measured (today's state), hosted decide stays no-go: stay local-only and ship the Linux
bring-your-own-endpoint route (Linux report §4.5) instead.

### 9.1 NAV DevOps use cases, as input to gate 4

Gate 4 needs real volumes and an owner. These are the concrete uses that would bring both, so
the next step is to ask the teams behind them, not to build anything. None has a named owner or a
measured volume today [fact: none in any report]. Volumes, latency needs and failure modes are
all [assumption]; each volume comes with a way to count it that needs no GCP. Owners are candidates to ask, not commitments.

| Use | What decide answers | Likely volume [assumption] | Candidate owner | Latency need | Failure mode |
|---|---|---|---|---|---|
| CI job selection per change | Which test suites or jobs a diff needs (the jev-ci-pathfinder pattern named in navikt/mlx-workspace#130; no report here describes it) | 3,000 PR events a day × 5 questions (research §1 (b), S2b); job selection alone is 1–3 of those; measure with PR and push counts from the GitHub API | Each repo's team; the platform team if it ships as a shared Action | Seconds; the job waits on it | A wrong "skip" lets a broken change through. Fail open: run everything |
| NAIS log and alert triage | Whether an alert should page, and which team owns an alert when ownership is unclear | Alerts a day across NAIS, unknown; count from Alertmanager and the alert channels | NAIS (platform) with the on-call teams | Under a minute; a page cannot wait | A missed page is worse than a false one. Advisory only; never suppress an alert |
| Canary and rollout gates | Hold, promote or roll back, between deterministic stages, from metrics and logs as evidence | Deploys a day × stages, unknown; count from the deploy history | NAIS (deploy) and the application team | Seconds to minutes | A wrong "promote" ships a bad release. The deterministic checks keep the final say |
| Agent-trace evaluation | Typed checks on Copilot session logs on the developer's machine (`~/.copilot/session-state`), for example "did the worker's change get verified?" (the Datadog-style evaluation named in #130; no report here describes it). The #961 telemetry carries enums and buckets only, no traces [fact, §5.1] | Sessions a day, unknown; count session directories on a few laptops. Batch, not interactive | This project, with the Copilot/nav-pilot team | Minutes to hours; batch | A wrong verdict skews a dashboard, nothing more |

What each would mean for hosting:

- **CI job selection** is the use that most needs hosted decide: GitHub-hosted runners cannot
  reach a laptop's local model [inference, §2]. It is research scenario (b) and PRD scenario S2b,
  and it depends on Q5 (a CI route and sign-in).
- **Alert triage** and **canary gates** run inside the platform, next to the evidence. Both are
  closer to the runtime-triage non-goal (§5.2) than to developer hooks: they need their own ROS,
  and a wrong answer has an operational cost [inference, §5.2]. Only as advisory input, never as the deciding step.
- **Agent-trace evaluation** is batch work on session logs that only exist on the developer's
  machine. It needs no low latency, so it runs on that Mac or as a scheduled local job; it is the
  use that least needs hosting.

Questions for gate 4, to put to the teams: how many of these decisions a day, who would own the
service that answers them, and what latency and failure behaviour they would accept. A use with
an owner and a counted volume moves the PRD toward a scenario in §6.2; without one, it stays an
illustration.

## 10. Open questions for the user

1. **Volumes.** Which scenario is realistic? Should we pull commits and PRs per day across
   navikt from the GitHub API (free, no GCP) to settle gate 4's first half?
2. **Owner.** Which team runs the GPU project, owns the ROS/DPIA and answers when it is down?
   Without one, the answer is no-go regardless of the data.
3. **Budget, for later.** Which range would make hosting worth revisiting: ~$1k a month (pilot),
   ~$3–7k (NAV hooks + CI)? Would a 1- or 3-year commitment ever be acceptable? Not a request
   for budget.
4. **Gate 3, for later.** Gate 3 needs a G4. Under the current plan-only decision it stays
   unmeasured; the PRD cannot move past no-go until the user chooses to measure it.
5. **CI.** Is CI in scope? If so: self-hosted runners inside NAV's network, or an external route
   with GitHub Actions OIDC that #339 does not have.
6. **Region.** Is `europe-north1` a hard requirement, or is another EU region (Cloud Run GPU,
   scale to zero, in `europe-west4`) acceptable for a future pilot?
7. **Gateway.** Should decide go into #339's copilot-cli (after it merges, and with a stateless
   decide path), or into a separate service behind the same sign-in?
8. **Dashboard.** Add `os` to the decide panels in `nav-pilot-local.json` so gate 1 can be read
   directly? The attribute already exists.
9. **Third-party processing.** May NAV source code be processed outside the EU under standard
   contractual clauses? If yes, a Jev-style API becomes a cheaper alternative (§4.2).

## Limits

- Every GPU and CPU throughput figure is third-party or extrapolated; none is ours [fact,
  research Limits].
- Prices are third-party list prices, not verified with Google.
- Volumes are assumptions. The cost per call moves inversely with them.
- Accuracy figures are MLX 4-bit on a Mac. The served FP8 build may differ (gate 3).
- Network latency from naisdevice to `europe-north1` and the gateway hop are unmeasured.
- No report verifies an FP8 Qwen3.6-35B-A3B checkpoint or vLLM support for its hybrid layers.

## Sources

- [Hosting research](../2026-09-26-decide-as-a-service/research.md) (#65)
- [pending-tasks §8.6, §8.9, §8.10](../2026-09-23-local-model-evaluation/pending-tasks.md)
- [`bench/decide-limits-20260925-014512.md`](../../bench/decide-limits-20260925-014512.md)
- [System One report](../2026-09-25-system-one/report.md)
- [Jev research](../2026-09-24-jev-like-features/research.md)
- [Linux and Ollama research](../2026-09-27-qwen38-linux-ollama/research.md)
- navikt/copilot [#961](https://github.com/navikt/copilot/pull/961) (decide telemetry, merged),
  [#339](https://github.com/navikt/copilot/pull/339) (CLI gateway, open)
