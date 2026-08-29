# Quarantined runs

Kept for provenance. None of these is a result, and none of them appears in any
table in `MODELS.md` except as evidence for the condition its suffix names.

| Suffix | Meaning |
|---|---|
| `.POLLUTED` | Measured before commit `9a2b324`, through a system prompt carrying about 8.5k tokens of instructions the benchmark never chose |
| `.INVALID` | The harness broke. Both files here recorded zero tool calls on every task because our own `AGENTS.md` routed the model's output into the reasoning field |
| `.CONFOUNDED` | Real numbers under a known confound. These are the runs where the server crashed part way through |
| `.DISKCONTENTION` | Ran while a 22 GB model download competed for the disk that every task restart reads weights from |
| `.CAP420` | A 420 second cap, kept because it bounds the interactive case while the 900 and 1800 second runs answer a different question |
| `.MLX6BIT`, `.ABANDONED` | The MLX 6-bit build, stopped twice. The slow numbers here were taken on a machine in swap and do not reproduce |
| `.POLLUTED` (DWQ) | The DWQ A/B was recorded before the prompt fix and carries no loop or timeout fields, so it predates the harness it was credited to. Its ranking against the plain build may survive, its absolute numbers do not, and the weights are no longer in the cache |
| `.PREFILL-OOM` | The MTPLX Q8 under a 36 GB wired limit. oMLX refuses the prompt before generating: 35.9 GB predicted against a 34.8 GB ceiling. Every task returns in seconds with zero turns, which is the client seeing an error, not the model working. Two files: the rig B context contract and the 65k one |
| `.THINKING`, `.RUN1` | Variant and superseded runs kept for comparison |

`bench/.previous/` holds automatic backups the runner writes before its first
write, and is not tracked.
