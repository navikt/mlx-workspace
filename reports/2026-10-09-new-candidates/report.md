# K2-Horizon MoVA as a local candidate, 2026-10-09

## Question
Can `mlx-community/K2-Horizon-MoVA-36B-A4B-4bit` replace optiq, or run next to it, on the standard set ([plan](plan.md))? The plan rejects a candidate whose tool calls do not parse.

## What shipped
Nothing.

## Method
The standard set from the plan, on 9 Oct from 19:02. The model needs about 27 GB of the 48 GB wired limit. Its weights (26.4 GB) were already on disk and matched the Hugging Face shard sizes. Night dir `.bench-logs/night3-20261009-190218`.

## Results
- create-file, base: 0/40. Every sample ended in about 10 s with "0 tools · no changes made".
- edit-multi-mechanical: 0/1, the same failure, before the run was stopped at 19:15.

## Verdict
The model never produced a tool call that nav-pilot parsed. Under the plan, that is a reject. The cause may be a mismatch between the model's tool-call format and the server's tool parser or chat template, not model quality. This run does not tell the two apart.

## Decision
Rejected for now; the run was stopped to free the GPU. Revisit only if someone adapts the tool parser or chat template for this model, then re-run the standard set.

## Sources
[plan.md](plan.md), `.bench-logs/night3-20261009-190218/02-base-create-file-base-k2-horizon-mova-36b-a4b-4bit.log`
