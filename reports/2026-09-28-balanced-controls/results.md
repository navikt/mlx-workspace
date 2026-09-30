# `balanced` against same-day controls: results

**`balanced` fails navikt/copilot `cli/nav-pilot/docs/local-dispatch.md`'s decision rule, now against
same-day controls.** Its pass rate matched control (15 of 15, and 5 of 5 on the false-positive
cell). But its cloud cost was above control on both large rungs measured: 1.57× on r4 and 1.49×
on r6. The rule needs cost at or below control on at least two of the three large rungs. With two
of three already over, r5 cannot change the outcome. By the rule as written, `balanced` goes back
to prose and the gate stays at `aggressive`. The doc leaves that to the maintainer.

Launcher: [balctl-launcher](balctl-launcher). Result files: [results/](results/). Sonnet 5 orchestrated,
binary `nav-pilot-main-2bcca023`, optiq-64g worker at 48 GB wired, re-probe 7's bench-only
capabilities block. 5 controls, then 5 `balanced` samples per cell. Ran 29 September 23:04–23:34,
$5.70 of the $5.75 cap. Protected config unchanged.

## Results

Cost is the mean cloud cost per sample, as in re-probe 7. Every sample was valid and none timed out.

| Cell | Arm | n | Verified | Dispatched | Gate refusals | Cloud $ mean (× control) | Cloud $ median | Median s (× control) |
|---|---|---|---|---|---|---|---|---|
| r4 (12 files) | control | 5 | 5 | – | – | 0.130 | 0.134 | 33 |
| r4 | balanced | 5 | 5 | **3** | 3 | 0.204 (**1.57×**) | 0.192 | 82 (2.5×) |
| r5 (29 sites, 4 files) | control | 3 | 3 | – | – | 0.136 | 0.137 | 39 |
| r5 | balanced | **0** | – | – | – | – | – | – |
| r6 (60 sites, 3 files) | control | 5 | 5 | – | – | 0.161 | 0.173 | 38 |
| r6 | balanced | 5 | 5 | 0 | 4 | 0.240 (**1.49×**) | 0.228 | 62 (1.6×) |
| small (false positive) | control | 5 | 5 | – | – | 0.135 | 0.135 | 34 |
| small | balanced | 5 | 5 | 0 | 0 | 0.188 (1.39×) | 0.221 | 57 (1.7×) |

- **The difference is not noise.** On r4 and on r6 every `balanced` sample cost more than every
  control sample (exact Mann–Whitney, 5 against 5: p = 0.008 each).
- **Same-day controls barely moved the ratios.** Against probe 4–6's controls re-probe 7 had 1.58× on
  r4 and 1.61× on r6. Today's r4 control ($0.130) is close to the old one ($0.133). Today's r6
  control is dearer ($0.161 against $0.119), which brings r6 down to 1.49×, still well over.
- **r4 dispatched in 3 of 5**, against 1 of 5 in re-probe 7. All 3 verified, and the orchestrator
  accepted the worker's result without rework. The dispatched samples cost $0.192–0.287, the two
  that were not $0.166–0.177, so on this cell delegating costs more cloud credits than doing it.
- **The policy costs even when nothing is refused or sent.** The small cell had no refusal and no
  dispatch, yet took 12.6 cloud steps against control's 7.8, at 1.39× the cost. So the extra cost
  is not only the refusals, as re-probe 7 assumed.

## r5 and the cost cap

The cap stopped the run after r5's third control ($5.70 spent, next sample about $0.14). r5 has 3
controls and no `balanced` sample. The rule wants at least 5 samples per cell, so r5 is not
measured. That does not change the verdict: r4 and r6 each have 5 samples per arm and both are over,
so `balanced` is at or below control on at most one of three large rungs whatever r5 would show.
Measuring r5 would cost about $1.40 more (5 + 5 samples) and cannot move the outcome.

## What follows

- By the rule: drop `balanced` back to prose and keep the gate at `aggressive`. That is a
  maintainer decision in navikt/copilot. `local-dispatch.md`'s paragraph that says "re-run the
  controls before acting" should cite these numbers; this PR does not touch that repo.
- New local setups already get `aggressive`; existing ones keep `balanced`. Nothing here moves an
  existing user.

## Files

- [results/](results/): the eight `hybrid-isoppfolgingstilfelle-*-probe-2bcca023-balanced-caps-*.json`
  and the ledger. They stay out of `bench/`: the bench-only capabilities block must not reach
  `_by_class`, as in probes 6 and 7.
- Log: `.bench-logs/balctl.log`. Sample transcripts, policy and capabilities block:
  `.bench-logs/balanced-controls-20260929-2304/`.
