# Open questions on ki-utvikling.nav.no: local runs and re-probe 7, 2026-10-12

Source: the open-questions sweep of 12 October (group B, 16 local rows at $0 cloud, and row 40,
re-probe 7). The owner approved re-probe 7 at about $20–50. Queue: [oq.queue](oq.queue), launcher:
[oq-launcher](oq-launcher) (copied to `~/tmp`, done marker `.bench-logs/oq.done`). It waits for the
n1012 launcher, so it starts at about 01:35.

## Queued, in order of value to the site

| # | Run | GPU h | Site claim it answers | Decision it gates |
|---|---|---|---|---|
| 0 | **O1 (config-deploy) on the 8-bit, fixed harness.** 16 `local ops` passes (one `bench-models` cheap-ops pass each) on `qwen3.6-35b-a3b-8bit-64g`, the small-delegate settings. The cheap-ops harness changed on 11 October (`7a11c4a406ce`), so these passes are a new generation: they pool neither with fixed-small's 14/14 (`5cdeda213eba`) nor with the 59/60 (`1cb0ea736a5a`). Each pass runs E1, E3b and O1, so the generation has O1 n = 16 and edit-single n = 48. Owner-added, first because it blocks manifest PR #215. | ~8 | /innsikt/lokale-modeller: edit-single on the 8-bit, «Ikke godkjent ennå» | The 8-bit's local edit-single verdict, from this generation alone (one-sided 90 % Wilson, bar 0.90): edit-single needs at least 46/48 (LB 0.904; 45/48 gives 0.877), and O1 needs 16/16 (LB 0.907; 15/16 gives 0.812). Both hold → manifest PR #215 can go ahead; otherwise it waits |
| 1 | **Re-probe 7, edit-single dispatch.** `hybrid` target `tasks`, rungs 2 (E1) and 8 (O1); per rung control n = 3, then hybrid n = 15. Worker `qwen3.6-35b-a3b-optiq-64g`, orchestrator Sonnet 5, nav-pilot release `2026.10.11-201029-b998fab`, `local_dispatch = "balanced"`, bench-only overlay `capabilities-bench-only-64-6c.json`. One ledger, `FRONTIER_COST_CAP=50` (expected $10–20 at probe 7's ~$0.30 a sample). | ~1.8 | /nav-pilot/forklaring/lokal-modell and /innsikt/lokale-modeller: «Endre én fil: Ikke godkjent ennå»; delegate n = 0 for edit-single | #1011 (`retry2` default, needs re-probe 7), #121, the delegate verdict for edit-single. 15/15 dispatched passes on two tasks reach the 0.90 lower bound (LB 0.901; 14/15 gives 0.801); one failed dispatched sample, or a pooled cost ratio above 1× (#166), keeps it `not-yet` or `cloud` |
| 2 | **create-file r3, cap lifted.** `local base create-file retry2+cap900`, rung 3, runs 18 (2 tasks, n = 36), `qwen3.6-35b-a3b-optiq` (declares 36 GB wired, under the launcher's 48 GB gate, as in the earlier optiq frontier runs). | ~3.2 | /innsikt/lokale-modeller: «dit er det ikke ennå», r3 LB 0.90 (cf-r3c: 36/40, all 4 failures 420 s timeouts) | Routing to r3. It is a new condition, so it pools alone (one-sided 90 % Wilson): 36/36 gives LB 0.956, 35/36 gives 0.912, 34/36 gives 0.873. At least 35/36 → propose r3 at cap 900; timeouts again → the cap is not the gap, r2 stays |
| 3 | **edit-multi at 3–8 call sites.** `local base edit-multi-mechanical base`, rungs 2–3, runs 5 (3 tasks a rung, +15 a rung), `qwen3.6-35b-a3b-optiq` (36 GB wired, as above). | ~1.3 | «Det samme i 3–8 kall: Ikke avgjort» (9/10 at 3–4 and at 5–8) | The local verdict for emm rungs 2–3. The 9/10 cells come from an older frontier harness, so this run pools with nothing and reports as its own condition. At n = 15 a rung it can decide: 15/15 gives LB 0.901 and clears 0.90; 14/15 gives 0.801 and leaves it «Ikke avgjort» |

Total about 14 GPU hours: ~8 h for O1 (16 passes at ~30 min), plus ~6.3 h for the rest (night-run-3's estimate). Expected
end about 16:00 on 12 October, worst case the night after. Cloud: re-probe 7 only, hard cap $50.

Passes run in queue order. Consecutive hybrid lines run as one pass, so one ledger caps all of them. A step that fails or skips (also a
skipped hybrid step when the cloud is down) stops the launcher without the done marker.

## Answered without a run

| Row | Answer |
|---|---|
| Gemma 4 26B QAT, fm rerun (newmodels) | Running now: gemmare (edit-multi) then n1012 (create-file run 5). Only the write-up is left; no new GPU time. |
| Memory at 64 000 tokens, ~50 GB, «ikke målt ennå» (line 528) | Measured for the shipped 8-bit Qwen3.6 entry in [night-64-6b](../2026-09-26-64gb-tier/night-64-6b.md): a 64k prompt held at 48 GB wired, peak footprint about 49 GB. Doc fix. The Qwen3.8 8-bit at 52 GB wired row needs a sudo wired-limit change and gates nothing (Qwen3.8 is not offered): drop it. |
| mlx-lm #1623 norm shift (#123) | **Not affected.** See the desk check below. |

## Desk check: #1623 norm shift (#123)

Compared five RMSNorm tensors (layer 0 input and post-attention norms, layer 3 `q_norm` and `k_norm`,
the final norm) in the local `mlx-community/Qwen3.8-27B-8bit` and `-OptiQ-4bit` builds with
`Qwen/Qwen3.8-27B` on Hugging Face. The original tensors were fetched by byte range (a few kB; official
org; safetensors only, nothing executed). Both builds equal the original **+1.000** (standard deviation
0.001–0.004, bf16 rounding) on every tensor: the single +1 that `qwen3_5.sanitize` applies once on
conversion. A double shift (#1623) would read +2. Loading does not add another +1, since
`sanitize` only shifts when the conv1d weights are still unconverted. The Qwen3.8 numbers did not
come from mis-converted norms. Close #123 and remove the row from `UNMEASURED.md`.

## Not queued

**Needs build** (not built here):

| Row | Build scope |
|---|---|
| read-qa ANSWER-line reminder (#114) | A `bench-frontier` variant token adding a one-line «end with ANSWER:» reminder to the `example` prefix; changes `harness_sha`. Then ~3 GPU h. |
| Log triage with `alpha decide` (#97) | A labelled set of ~30 logs (sort before read: yes/no) and a `bench-decide-*` set for it. |
| decide recipes: personal data in logs, incident cause, routing (#125) | Three labelled sets; needs owner time to label. |
| Redaction of secrets and fødselsnummer (#128, #940) | A labelled case set and a runner over the regex and the model. |
| deps-bump by hand | A frontier task family from the PR audit's dependency bumps, with a verifier. |
| Selective rule loading, glob injection arm (#127) | Hook probes, a labelled prompts × rules set and a rule-sensitive cheap-ops cell (owner chose arm B first). |

**Desk work, no GPU** (not done here): cheap-ops R1 and D2 checker analysis (#91); rule recall
with `rule_load.py recall` on a week of sessions (#127); smoke test of nav-pilot on opencode 3.

**Blocked or dropped:**
- Laguna through nav-pilot (#94): nav-pilot's mlx-lm has no `laguna` model yet (checked in
  `~/.nav-pilot/local/venv`). Trigger-only.
- Occamy at presence_penalty 1.5: Occamy is not proposed (64-5), so the run changes no decision
  (BENCHMARKING «Queued runs»). It would also need a new profile. Drop the row.

## Owner decisions

- Re-probe 7 uses the nav-pilot release binary `b998fab` (11 October), not the Homebrew 10.08 one.
  An earlier re-probe 7 on `2bcca023` (28 September, $11.50, all scored samples passed) covered
  edit-multi and create-file cells, not edit-single. This run is the edit-single answer.
