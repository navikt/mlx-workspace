# 8-bit cheap-ops on the fixed harness

#189 fixed the O1 prompt (`kotlin/.nais/naiserator-dev.yaml`) and changed `harness_sha`, so new runs
form a new generation. The optiq refill ([../2026-10-10-optiq-refill/plan.md](../2026-10-10-optiq-refill/plan.md))
runs 14 cheap-ops passes (all tasks, including the fixed O1 and T1) on optiq after K2.

**Run:** the same 14 passes (`refill.queue`) on `qwen3.6-35b-a3b-8bit-64g`, local only, $0 cloud,
about 4 h GPU. Both profiles then have the same number of passes on the new generation.

**Decision it gates:** local config-deploy (O1), and the small-task verdicts per profile, on the
fixed harness. If 8-bit passes O1 where optiq fails (or the reverse), the manifest verdict for that
profile changes; equal results keep the current verdicts with tighter intervals.

**Launcher:** `8bit-refill-launcher`, same rules as the optiq one (BENCHMARKING.md, "Waiting
launchers"): order by `.bench-logs/optiq-refill.done` (or no optiq-refill launcher alive), then 5
minutes of free GPU; pidfile `8bit-refill.pid`, marker `8bit-refill.done`; a stray `src/` at the
8-bit workspace root is moved to `.bench-logs/` before each pass (#186).
