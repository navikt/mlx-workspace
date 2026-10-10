# optiq fill re-run (#186)

The small-fill run on 10 October lost 14 of its 20 optiq cheap-ops passes: at about 04:47 a sample
wrote `workspaces/qwen3.6-35b-a3b-optiq-64g/src/`, and the workspace guard refused every later optiq
step (#186). The 8-bit passes ran.

**Run:** the 14 optiq passes again (`refill.queue`), local only, $0 cloud, about 4 h GPU.

**Decision it gates:** the same as the fill: tighter intervals for the optiq small-task verdicts in
the manifest. Without these passes, optiq has 6 fill passes against 20 for the 8-bit.

**#186 workaround:** the launcher runs one pass per `night-run-3` call. Before each pass it moves
a stray `src/` at the optiq workspace root to `.bench-logs/optiq-refill-stray-src-<time>/` and logs
which pass left it. The guard still runs inside each step, so a pass never starts with a dirty
workspace, and one stray directory costs at most one pass, not the rest of the queue. The real fix
(per-task reset) stays with #186.

**Launcher:** `optiq-refill-launcher`, gated on `.bench-logs/k2-ifm.done` for order and on a free GPU
for 5 minutes (BENCHMARKING.md, "Waiting launchers"). Marker: `.bench-logs/optiq-refill.done`.
