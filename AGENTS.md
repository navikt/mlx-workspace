# Agent Instructions

## Context economy — keep it tight

Context is limited. Every unnecessary token slows generation.

- **Prefix all shell commands with `rtk`** — `rtk git status`, `rtk grep …`, `rtk npm test`; rtk compresses output and saves context
- **grep/glob before read** — narrow to relevant lines first, then open the file
- **Line ranges** — read `path:start_line-end_line`, not whole files, when you know the area
- **Sample large files** — `head -40 file` before deciding whether to read fully
- **Never repeat file contents** in your response — the tool result is already in context

## Task discipline

- **One phase at a time** — verify artifacts on disk before starting the next phase
- **Verify writes** — after creating a file, confirm it exists with `ls` before proceeding
- **Chain `cd` with the next command** — `cd /path && npm install`, not separate calls; a
  bare `cd` in its own shell call loses the directory change in the next call
- **Check `--help` before inventing flags** — if an option doesn't work, read the docs; do
  not try flag variations or invented options (e.g. `npm init --workdir` does not exist)

## TodoWrite — use it for multi-step tasks

Use the `TodoWrite` tool to plan and track work whenever a task has **3 or more distinct
steps**. Update status in real time: mark `in_progress` before starting a step, `completed`
immediately after verifying it on disk.

```
# ✅ correct flow
TodoWrite([{content: "Create package.json", status: "in_progress"}, ...])
→ run: npm init -y
→ verify: ls package.json
TodoWrite([{content: "Create package.json", status: "completed"}, ...])

# ❌ wrong — marking complete before verifying, or not using TodoWrite at all
```

Keep exactly one item `in_progress` at a time. Add follow-up todos if you discover new
work mid-task.
