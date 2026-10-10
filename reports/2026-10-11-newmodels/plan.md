# New candidates: Mellum 2.1, Muse Glimmer, Nemotron 3.5 Lightning, Gemma 4 QAT, 2026-10-11

Trigger: four new candidate models (BENCHMARKING.md, «When we benchmark»). Download approved by
the owner on 2026-10-11, about 76 GB.

| Profile | Weights | Size |
|---|---|---|
| `mellum2.1-12b-a2.5b-thinking-mxfp4` | local conversion of JetBrains/Mellum2.1-12B-A2.5B-Thinking (see below) | 6.5 GB |
| `muse-glimmer-30b-optiq-4bit` | mlx-community/Muse-Glimmer-30B-OptiQ-4bit | 23.9 GB |
| `nemotron-3.5-lightning-30b-a3b-optiq-4bit` | mlx-community/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-OptiQ-4bit | 22.8 GB |
| `gemma-4-26b-a4b-qat-optiq-4bit` | mlx-community/gemma-4-26B-A4B-it-qat-OptiQ-4bit | 21.9 GB |

Mellum has no official or mlx-community MLX build; the only one was a single-person upload. We
convert the official JetBrains safetensors ourselves (no remote code) with
`mlx_lm.convert --hf-path JetBrains/Mellum2.1-12B-A2.5B-Thinking -q --q-mode mxfp4`, the same
quantisation as that upload, into `~/models/mlx/Mellum2.1-12B-A2.5B-Thinking-mxfp4`. The source
download is 24.3 GB. The profile points `MLX_MODEL` at that local path; `_profiles.py` accepts a
`~/` or absolute path next to HF ids.

## Decision this run gates

Per model, against optiq base on the same harness (create-file 19/40, emm r1-r4 30/40), with the
rules from [the K2-Horizon plan](../2026-10-09-new-candidates/plan.md): replace optiq, add next to
it, or reject. Mellum is 6.5 GB, so it can also earn a place as a small-task worker even if it
does not beat optiq. No manifest routing changes in this PR.

## Pre-gate: tool-call probe

K2-Horizon lost a whole night to a tool format mlx-lm could not parse (#183). So each model first
gets one chat completion with a tool (5 min cap). No parsed `tool_calls`: logged as
`rejected: parser` and the next model starts. Parsed: the standard set runs.

## Standard set

`newmodels.queue`: per model validate, create-file r1-r4 and edit-multi-mechanical r1-r4, variant
`base`, 5 runs. About 4 h a model, local only, $0 cloud.

## Run

`newmodels-launcher` follows BENCHMARKING.md «Waiting launchers», waits for `cf-r3c.done` and a
free GPU, pulls `main`, preflights the queue (weights included) and runs the models in the order
of the table.

## Arm (after this PR is merged)
    cp reports/2026-10-11-newmodels/newmodels-launcher ~/tmp/ && nohup bash ~/tmp/newmodels-launcher >/dev/null 2>&1 &
