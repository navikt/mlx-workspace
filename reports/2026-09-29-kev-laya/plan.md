# Kev 4B and Laya on the decide sets: plan

Pending-tasks §8.6, #95; gate 2 of the [hosted-decide PRD](../2026-09-27-hosted-decide-prd/prd.md).
Background: [research.md](research.md). Queue: [kev-laya.queue](kev-laya.queue). Launcher:
[kev-laya-launcher](kev-laya-launcher). Adapter: `.mise/tasks/_decide_s1.py`.

## Question

Can a small open decision model (Kev 4B, 8-bit, about 5 GB, or Laya at 322–421M, under 1 GB) replace
the chat model behind `nav-pilot alpha decide` on our questions? Specifically:

1. How close does each one come to optiq and Qwen3.8 on the recipe sets (commit why EN/NO, issue type,
   Aksel kind, PR motivation)?
2. Where does each one break: Norwegian, many options, long evidence (and how much of that is
   truncation), position bias, injection?
3. Is its p calibrated well enough for the hooks' abstain-at-t rule (t = 0.9)?
4. How fast is one call in-process on this Mac?

## Method

- **Install** once the uv cooldown is over (a dry-run resolve passes). Kev's code at 08ab0b87 goes in
  `.bench-logs/venv-kev` (`kev[mlx]`: mlx-lm < 0.32, torch < 2.9) and laya-mlx 0.2.0 in
  `.bench-logs/venv-laya` (mlx 0.32.x). Each is installed with `env -u VIRTUAL_ENV uv pip install --python
  <venv>`, and the launcher stops if the main `.venv` changed. The cooldown stays in force. Nothing is
  downloaded from HF (`HF_HUB_OFFLINE=1`); the weights are the cached, checked snapshots.
- **Run** each model in-process through `_decide_s1.py run <model>`: first 5 cases per set as a dry run
  (it fails over 20 % errors), then every case. Each case is one `choice` question (state = evidence,
  instructions = question, criteria = options). Kev runs at its calibrated temperature; Laya in FP16
  with the port's clamped temperatures.
- **Compare** against optiq and Qwen3.8 OptiQ-4bit with the existing summaries (`_decide_limits`,
  `_decide_sets`, `_decide_why`) plus a table of truncated states:
  `bench/decide-{limits,sets,why}-s1-<stamp>.md`.
- **Order:** Kev first (the largest and slowest), then Laya English, then Laya multilingual.

Expected results, written before the run:

- Kev is English-only, so `why-no` and `lang-no` show how it degrades, not what it can do.
- Laya multilingual should beat Laya English on the Norwegian sets. Nobody publishes Norwegian numbers for it.
- Both context windows are far below our 30k-character evidence. Laya cuts the state at its window, so
  `length`, the long issue bodies and the diffs in `why-*` are answered on a prefix. Kev cuts at 8,192
  tokens but then refuses a state that close to the limit (`ContextOverflow`, a 422 from `kev.serve`), so
  the ~9k-token `length/30k` cases and the longest diffs come out as errors and count as wrong, as a
  failed decide call does. The adapter does not pre-cut for Kev: that is how Kev serves. Every case,
  errors included, carries its uncut `state_tokens`, so the report can read the long sets both ways.
- Laya English's `choice:11+` temperature is clamped by the port from 0.10 to 0.5, so its calibration on
  `options` with k ≥ 11 is the port's, not the checkpoint's.
- Laya should be weak on `options` (up to 14), as on Banking77.
- `injection` is the direct comparison with optiq (4–33 % flips) and Qwen3.8 (29–58 %).

## n

| Group | Sets | Cases per model |
|---|---|---|
| why | why-en 48, why-no 48 | 96 |
| sets | issue-type 105, aksel-kind 65, pr-motivation 48 | 218 |
| limits | the nine `bench/decide-limits/` sets | 974 |
| Total | | 1,288 |

3 models × 1,288 = 3,864 calls, plus 3 × 70 dry-run calls. All three models are deterministic, so there are
no repeats. The comparison is paired per case with the chat models' existing runs (same case files).

## Time and cost

| Step | Expected | Cap |
|---|---|---|
| Install both venvs (torch, transformers, mlx-lm, laya-mlx wheels, under 2 GB) | 5–10 min | none (fails or finishes) |
| Kev 4B 8-bit: load about 11 s, ~1 s a call on long states | 25 min | 90 min |
| Laya 421M | 3 min | 20 min |
| Laya multilingual 322M | 3 min | 20 min |
| Dry runs and summaries | 5 min | |
| **Total GPU time** | **about 45 min** | **about 2.5 h** |

Cost: $0. Everything is local and uses cached weights. The only downloads are the Python wheels, well
under the pre-approved 60 GB, on AC and not tethered.

## When it runs

`kev-laya-launcher`, copied to `~/tmp/`, starts it when all of these hold for 5 min: it is 2026-09-29 or
later; `after-64-6.done` exists (or, if after-64-6 was never armed, `tier64-6.done` or the v2 validation
marker exists and no 64-6 launcher has run for 30 min); AC power; the default route is not an iPhone;
no queue lock and no GPU job; and the uv dry-run resolve passes for both packages, with 7 days past Kev's
commit (2026-09-29 21:21 local), because uv checks no dates on a git source. It holds the queue lock for
the whole run, logs to `.bench-logs/kev-laya.log`, touches `.bench-logs/kev-laya.done` and gives up at
2026-10-08 06:00.

**Known blocker (2026-09-28):** `uv` cannot reach `files.pythonhosted.org` from this Mac (connect
timeout), while `curl` can, which looks like a per-process firewall rule, as with hf_xet in §8.6. Until
uv is allowed there, the dry-run resolve fails and the launcher keeps waiting with that reason in its log.
The launcher does not work around it.

## Done means

A `report.md` here, with Kev and Laya next to optiq and Qwen3.8 on every set, a truncation-adjusted reading
of the long-evidence sets, and a verdict for PRD gate 2: whether a CPU-servable model is good enough for
which callers, at which threshold.
