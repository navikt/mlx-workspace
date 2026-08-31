# Quarantined runs

Kept for provenance. None of these is a result, and none of them appears in any
table in `MODELS.md` except as evidence for the condition its suffix names.

| Suffix | Meaning |
|---|---|
| `.POLLUTED` | Measured before commit `9a2b324`, through a system prompt carrying about 8.5k tokens of instructions the benchmark never chose |
| `.INVALID` | The harness broke. Both files here recorded zero tool calls on every task because our own `AGENTS.md` routed the model's output into the reasoning field |
| `.CONFOUNDED` | Real numbers under a known confound. These are the runs where the server crashed part way through |
| `.DISKCONTENTION` | Ran while a 22 GB model download competed for the disk that every task restart reads weights from |
| `.NODE20` | The target's suite ran under Node 20 while the target pins Node 24. All eight samples scored 0/8 for `webidl.util.markAsUncloneable`, which has nothing to do with the change being judged. The harness now honours the target's `node` field |
| `.NOCOMPILE` | Verified by a compile command that fails on an untouched tree. `tsc --noEmit` is not how the Next.js target typechecks: it needs the ambient types Next generates, so bare tsc cannot resolve an SVG import in a file nobody touched. All sixteen samples scored 0/8 |
| `.ILLPOSED` | Both arms scored 0 of 8. A task that no arm can complete is a task written for a different codebase, not a model result: rung 5 threads a field through a type, its mapper and every construction site, which is a Kotlin shape that does not map onto this frontend |
| `.CAP420` | A 420 second cap, kept because it bounds the interactive case while the 900 and 1800 second runs answer a different question |
| `.MLX6BIT`, `.ABANDONED` | The MLX 6-bit build, stopped twice. The slow numbers here were taken on a machine in swap and do not reproduce |
| `.POLLUTED` (DWQ) | The DWQ A/B was recorded before the prompt fix and carries no loop or timeout fields, so it predates the harness it was credited to. Its ranking against the plain build may survive, its absolute numbers do not, and the weights are no longer in the cache |
| `.PREFILL-OOM` | The MTPLX Q8 under a 36 GB wired limit. oMLX refuses the prompt before generating: 35.9 GB predicted against a 34.8 GB ceiling. Every task returns in seconds with zero turns, which is the client seeing an error, not the model working. Two files: the rig B context contract and the 65k one |
| `.THINKING`, `.RUN1` | Variant and superseded runs kept for comparison |

`bench/.previous/` holds automatic backups the runner writes before its first
write, and is not tracked.
