# Agent Instructions

## Terminal commands — use rtk to compress output

**Always prefix shell commands with `rtk`.**

`rtk` is a token-optimising proxy that filters and compresses command output before it enters your context. It saves 60–90% of the tokens that raw terminal output would otherwise consume.

```bash
# Instead of:        Use:
git status           rtk git status
git log -10          rtk git log -10
git diff             rtk git diff
cargo test           rtk cargo test
npm test             rtk npm test
docker ps            rtk docker ps
kubectl get pods     rtk kubectl get pods
```

### When to use rtk

Use `rtk` for any command whose output you will read into context:
- `git` commands
- Build tools (`cargo`, `npm`, `go`, `gradle`, `mvn`)
- Test runners
- Docker / kubectl
- `ls`, `find`, `grep` (for large outputs)

### When NOT to use rtk

- Commands that produce no output you need to read (`rm`, `mkdir`, `chmod`)
- Interactive commands that require stdin (`vim`, `less`)
- Commands where you need the raw unfiltered output for a specific reason

### Meta commands (use directly, no rtk prefix)

```bash
rtk gain            # token savings dashboard
rtk gain --history  # per-command savings history
rtk discover        # find missed rtk opportunities
```
