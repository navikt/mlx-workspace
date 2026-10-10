# create-file retry2: more r3–r4 samples

[cf-retry2](../2026-10-08-cf-retry2/report.md) made create-file trusted locally at r1–r2 on both
profiles. r3 went 10/10 on both but stays `not-yet` at n = 10; r4 is open on optiq and broke on
timeouts on the 8-bit.

**Run:** `cf-r34.queue`, retry2, create-file r3–r4, 5 runs per rung (10 more samples per rung) on
`qwen3.6-35b-a3b-optiq` and `qwen3.6-35b-a3b-8bit-64g`, current harness, local only, $0 cloud,
about 6 h GPU. Results pool with cf-retry2 only where the summary keeps the same generation; a new
`harness_sha` starts a new one.

**Decision it gates:** the create-file local frontier per profile. r3 trusted on a profile moves
its create-file routing to r3; a break at r3 keeps it at r2. r4 on the 8-bit: more timeouts keep it
`cloud`.

**Dropped:** K2-Horizon cheap-ops passes. K2 with the ifm parser scored 0/80 and 74 % of its tool
calls went to invalid tools, so more passes cannot change a decision.

**Launcher:** `cf-r34-launcher`, per BENCHMARKING.md "Waiting launchers": order by
`.bench-logs/8bit-refill.done` (or no 8bit-refill launcher alive), then 5 min of free GPU; pidfile
`cf-r34.pid`, marker `cf-r34.done`; one night-run-3 call per queue line; a stray `src/` at either
workspace root is moved to `.bench-logs/` before each (#186); dry-run preflight first.
