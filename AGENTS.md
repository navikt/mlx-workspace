# Agent Instructions

## rtk — command output compression

The opencode plugin at `~/.config/opencode/plugins/rtk.ts` runs `rtk rewrite`
automatically on every bash call, compressing output by 60–90%. No manual prefix needed.

### IMPORTANT: shell builtins — never prefix with rtk

`cd`, `export`, `source`, `alias`, `pushd`, `popd`, `unset` are shell builtins. They must
run in the current shell process. If wrapped in a subprocess (`rtk` does this), the state
change is lost when the subprocess exits. The plugin strips an erroneous `rtk` prefix as a
workaround ([rtk-ai/rtk#2508](https://github.com/rtk-ai/rtk/issues/2508)), but always
write builtins without the prefix:

```bash
# ✅ correct — cd stays in the same shell
cd /path && npm init -y

# ❌ wrong — cd change is lost, next command runs in wrong directory
rtk cd /path && npm init -y
```

### rtk meta commands

```bash
rtk gain            # token savings dashboard
rtk gain --history  # per-command savings history
rtk discover        # find missed rewrite opportunities
```

## Context economy — keep it tight

Context is limited. Every unnecessary token slows generation.

- **grep/glob before read** — narrow to relevant lines first, then open the file
- **Line ranges** — read `path:start_line-end_line`, not whole files, when you know the area
- **Sample large files** — `head -40 file` before deciding whether to read fully
- **Never repeat file contents** in your response — the tool result is already in context

## Task discipline

- **One phase at a time** — verify artifacts on disk before starting the next phase
- **Verify writes** — after creating a file, confirm it exists with `ls` before proceeding
- **Check `--help` before inventing flags** — if an option doesn't work, read the docs; do
  not try flag variations or invented options (e.g. `npm init --workdir` does not exist)
