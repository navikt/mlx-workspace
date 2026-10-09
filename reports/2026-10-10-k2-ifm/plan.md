# K2-Horizon with the ifm tool parser, 2026-10-10

Issue #183, Q4. K2-Horizon writes GLM-4.7-shaped tool calls with `ifm|` tags
(`<ifm|tool_calls><ifm|tool_call>NAME<ifm|arg_key>…</ifm|arg_key><ifm|arg_value>…</ifm|arg_value>`)
and reasons inside `<ifm|think>`. mlx-lm 0.31.3 has no parser for either, so the
[new-candidates run](../2026-10-09-new-candidates/plan.md) saw no tool calls (0/40).

## Fix

`.mise/tasks/_ifm_parser.py` renames the tags and hands each call to mlx-lm's own glm47 parser.
It also registers the think pair the profile's `reasoning_effort` opens (`<ifm|think_faster>` for low), so reasoning leaves the content. The server task
runs it in place of `mlx_lm.server` when a profile sets `MLX_TOOL_PARSER = "ifm"`; only the K2
profile does. Nothing in `.venv` changes. Self-check:
`.venv/bin/python .mise/tasks/_ifm_parser.py --check`.

## Run

`k2-ifm-launcher` follows BENCHMARKING.md «Waiting launchers». It starts no earlier than
2026-10-10 14:00, after `gap-fill.done` or once no gap-fill launcher is alive, and after 5 min of
free GPU. It pulls `main` and runs one probe: a single chat completion with a tool, 5 min cap,
response in `.bench-logs/k2-ifm-probe.json`. If `tool_calls` parse, it runs the standard set from
`../2026-10-09-new-candidates/new-candidates.queue` (about 4 h, local, $0 cloud). Results go to
`k2-ifm.md`.

## Decision

The rules in [the new-candidates plan](../2026-10-09-new-candidates/plan.md#decision-this-run-gates)
decide whether K2 replaces optiq, runs next to it, or is rejected. A probe without
`tool_calls` rejects it.

## Arm
    cp reports/2026-10-10-k2-ifm/k2-ifm-launcher ~/tmp/ && nohup bash ~/tmp/k2-ifm-launcher >/dev/null 2>&1 &
