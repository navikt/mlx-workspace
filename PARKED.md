# Parked

Work set aside on purpose. Each row says why and what would bring it back. Since 9 October 2026
benchmarks run on triggers only: a new model worth testing, or a nav-pilot local-mode release
([BENCHMARKING.md](BENCHMARKING.md#when-we-benchmark)). Active work is in [PLAN.md](PLAN.md).

Last updated 14 October 2026.

## Experiments and runtimes

| Item | Issue | Why parked | Resume trigger | What we'd need |
|---|---|---|---|---|
| Routine benchmarking | – | Trigger-only since 9 Oct; little left to learn from repeat runs | New model or local-mode release | Free GPU, current harness |
| DFlash speculative decoding (Qwen3.8-27B) | #258 | Owner skipped the 6 h bench; MTPLX covers speed | MTPLX falls short, or DFlash lands in mlx-lm | z-lab drafter provenance checks, ~6 GPU h |
| Rapid-MLX vs `mlx_lm.server` | #257 (closed) | Ran; no tool-call gain (#270) | New Rapid-MLX release claiming a fix | Same A/B, ~6 GPU h |
| Qwen3-Coder-Next 4-bit | #260 | Out of memory under the 48 GB wired limit of the 64 GB tier | A smaller quant, or a 96/128 GB tier | Fit check, then ~8 GPU h |
| Devstral Small 2 24B | – | Dense 24B, slower than the A3B MoEs; low expected gain | A coding result that beats Qwen3.8 at similar size | ~6 GPU h |
| Other runtimes: BaseRT, uzu, MetalRT, vLLM-mlx, MLC | – | Speed claims only; harness rewrite; MetalRT is binary-only | Independent numbers showing a pass-rate gain | Harness adapter per runtime |
| EAGLE-3 (mlx-vlm `--draft-kind`) | – | ~1.05x in the mlx-lm prototype | Upstream speedup ≥ 1.5x | Drafter, ~1 GPU h speed check |
| Laguna, occamy, Qwen3.8 4-bit | – | Owner excluded them | Owner reverses | – |
| navikt/cplt#761 (`allow_sysv_ipc`) | #263 | Open; the cplt owner blocked it because it weakens the sandbox. Replaced by #277 | Not planned | – |

## Issues labelled `parked`

| Item | Issue | Why parked | Resume trigger | What we'd need |
|---|---|---|---|---|
| Fleet upgrade: 48 vs 64 vs 128 GB | #17 | Unmeasured; no 128 GB machine to hand | Access to a 128 GB machine | Same task set across tiers |
| Per-sample cleanup of stray files | #90 | Workaround in preflight | Next stray-file failure | Harness change + selftest |
| read-qa with ANSWER-line reminder | #114 | Unmeasured; low priority | Next frontier run | ~1 GPU h |
| bench-hybrid: auto-rejected permission = invalid | #116 | Rare | Next hybrid run | Harness change |
| Linux endpoint on real hardware | #124 | No hardware | Linux/NVIDIA box available | Machine access |
| GPT-6 Sol at balanced, n ≥ 5 | #135 | Cost; trigger-only policy | New GPT model or local-mode release | Cloud budget |
| oMLX stamp keyed to site-packages | #212 | Harness nicety | Next setup bug | Small fix |
| R1 checker on final answer only | #206 | Checker change shifts old scores | Next cheap-ops rerun | Rescore |
| Pin model revisions bench-side | #205 | Manual pinning works for now | A model repo changes under us | Harness change |
| Qwen3.8-27B 8-bit rerun with metadata | #214 | Trigger-only policy | Next Qwen3.8 run | ~1 GPU h |
| night-run-3 preflight on hidden git history | #218 | Seen once after a killed run | Recurs | Preflight fix |
| cheap-ops sample wrote src/ at root | #186 | Workaround in place | Recurs | See #90 |
| Follow-ups from #178 | #179 | Small, not blocking | Next cheap-ops change | – |
| requeue-646c-launcher follow-ups | #156 | Launcher retired | Launcher reused | – |
