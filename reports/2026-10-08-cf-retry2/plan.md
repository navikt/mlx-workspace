# create-file retry2 ladders, 2026-10-08

## Decision this run gates
Keep or drop `retry2` for local create-file in the shipped setting (navikt/copilot#1156).
retry2 was shipped for this class but has never been measured on harness `9db581bed642`,
the one with the #165 sandbox fix. The base numbers on that harness are in
[2026-10-01-create-file-rerun/report.md](../2026-10-01-create-file-rerun/report.md):
optiq 19/40, 8-bit 24/40, trusted at no rung.

- **Keep** if retry2 is at least as good as base on both models: total k/40 not lower, and no
  rung worse by more than 2/10.
- **Drop** if retry2 is lower than base on both models by 4/40 or more in total. The retry then
  costs time and gains nothing.
- Anything in between: keep it as shipped, and say in the report that n = 10 a rung cannot
  tell them apart.

A trusted rung for retry2 would also reopen the create-file stop rule (BENCHMARKING.md, «Queued
runs») for that profile.

## Run
- `cf-retry2.queue`: create-file, variant `retry2`, rungs r1–r4, 5 runs (10 samples a rung),
  on `qwen3.6-35b-a3b-optiq` and `qwen3.6-35b-a3b-8bit-64g`. Same harness and queue shape as
  the base re-run; only the variant differs. Local only, $0 cloud.
- `cf-retry2-launcher` follows BENCHMARKING.md «Waiting launchers» and starts no earlier than
  2026-10-08 20:00. Results go to `cf-retry2.md`.
- Check before scoring, as for base: no sample contains "Could not connect to the Gradle daemon".

## Arm
    cp reports/2026-10-08-cf-retry2/cf-retry2-launcher ~/tmp/ && nohup bash ~/tmp/cf-retry2-launcher >/dev/null 2>&1 &
