# Agent Instructions

## Terminal commands — rtk is active

**`rtk` rewrites your shell commands automatically** via the opencode plugin at
`~/.config/opencode/plugins/rtk.ts`. You do not need to manually prefix commands — the
plugin intercepts every bash tool call and runs `rtk rewrite` before execution.

This compresses command output by 60–90% before it enters your context window.

### Shell builtins — never prefix with rtk

Shell builtins (`cd`, `export`, `source`, `alias`, etc.) **must not** be prefixed with
`rtk`. They run in the current shell process; wrapping them in a subprocess (what `rtk`
does) means the state change (e.g. directory change) is lost when the subprocess exits.

The opencode plugin (rtk.ts) automatically strips an erroneous `rtk` prefix from builtins
as a workaround for [rtk-ai/rtk#2508](https://github.com/rtk-ai/rtk/issues/2508), but it
is still best to write builtins without the prefix:

```bash
# ✅ correct — cd stays in the same shell
cd /path/to/project && npm init -y

# ❌ wrong — rtk launches a subprocess; cd change is lost
rtk cd /path/to/project && npm init -y
```

### Meta commands — run these directly

```bash
rtk gain            # token savings dashboard
rtk gain --history  # per-command savings history
rtk discover        # find any missed rewrite opportunities
```
