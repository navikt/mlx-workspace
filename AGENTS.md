# Agent Instructions

## Terminal commands — rtk is active

**`rtk` rewrites your shell commands automatically** via the opencode plugin at
`~/.config/opencode/plugins/rtk.ts`. You do not need to manually prefix commands — the
plugin intercepts every bash tool call and runs `rtk rewrite` before execution.

This compresses command output by 60–90% before it enters your context window.

### Meta commands — run these directly

```bash
rtk gain            # token savings dashboard
rtk gain --history  # per-command savings history
rtk discover        # find any missed rewrite opportunities
```
