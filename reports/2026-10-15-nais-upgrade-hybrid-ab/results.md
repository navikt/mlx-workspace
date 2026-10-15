# #285: A/B of local_dep_upgrade (navikt/copilot#1832) and skills/dependency-upgrade (#1833)

Harness `bench-nais-upgrade` at eff0ed3 (PR #297), hybrid mode. nav-pilot built from navikt/copilot#1832 head 6117deec2bd0. Skill from #1833 head 278979b40a35. Orchestrator claude-sonnet-5.5, local worker qwen3.8-27b-8bit-64g (mlx-lm). nais/examples base d015b89 (before #312). Cap 25 min, launched from the repo root, 2 rounds x 4 arms x 3 tasks = 24 sessions, all valid (nav-pilot announced local dispatch in each one). Raw rows: [results.jsonl](results.jsonl).

## Results

Each cell gives the count over 2 runs.

| Arm (flag / skill) | loadgen full+green | frontend full+green | tools full | Worker tasks | Guard violations | Cloud cost |
|---|---|---|---|---|---|---|
| off / without | 2/2 | 0/2 (pnpm) | 1/2 | 0 | 2 pm, 1 postgres 16→18, 2 pnpm pin | $1.23 |
| on / without | 2/2 | 0/2 (pnpm) | 1/2 | 0 | 2 pm, 2 postgres 16→18, 2 pnpm pin | $1.24 |
| off / with | 2/2 | 0/2 (pnpm) | 0/2 | 0 | 2 pm, 0 postgres, 1 pnpm pin | $1.41 |
| on / with | 2/2 | 0/2 (pnpm) | 0/2 | 0 | 2 pm, 0 postgres, 0 pnpm pin | $1.49 |

Totals: $5.37 cloud (cap $15), 70 min of session time (80 min wall clock), 0 nonexistent versions, 0 `pinned_deny`, and 0 edits to pinned files outside the tools task.

## Findings

- **No work was dispatched to the local worker in any of the 24 sessions.** Each session made one local completion and started no `local-worker` task. Sonnet 5.5 did every upgrade itself. Dispatch share: 0 % in all arms.
- **The #1832 policy paragraph was never written.** `ProjectDepUpgrade` only checks the working directory for a lockfile. In a monorepo like nais/examples the lockfiles sit in `quotes-*/`, so a launch from the repo root gives `""`. With the flag on, the only thing that changes is the pinned-file gate, and it never fired because the worker never ran. The flag-on and flag-off arms therefore cannot be told apart in this run.
- **Endpoint mode ignores the flag too.** `applyEndpointConfig` never calls `local.SetDepUpgrade`, so `local_dep_upgrade` has no effect with `local_endpoint`. For that reason this bench attaches nav-pilot to the harness's server through a managed-mode `server.json`.
- **Frontend: 8/8 got every package upgraded and passed the checks inside the session, then failed `pnpm install --frozen-lockfile`.** Inside nav-pilot's sandbox the session ran the global pnpm 12.8.1, not the repo's pnpm 10, and that flipped `autoInstallPeers` in the lockfile. The skill (which says "use the repo's pinned package manager") was loaded in all 4 frontend skill runs and did not catch it. This is the lockfile/package-manager guard violation from #285, and it happened in every arm.
- **Tools: the skill arms made fewer guard violations.** postgres 16→18 (with the volume path changed): 3/4 without the skill, 0/4 with it. pnpm pin moved off the lockfile's major: 4/4 without, 1/4 with. With the skill, more tags stayed behind on purpose, so full upgrade was 2/4 without and 0/4 with. The skill was loaded explicitly in only 1 of 4 tools runs, so its description in the skill list may be doing the work. n=4 per side, so treat this as a direction, not a result.
- loadgen: 8/8 full upgrade and green in all arms, about 50 s each.

## Harness notes

- cplt refuses the `.env` files some Go modules ship, and it reset long `go get` fetches. Go modules therefore come from a cache warmed outside the sandbox (`--go-warm`).
- opencode under nav-pilot did not start in about half of the smoke launches. The harness retries twice. No launch needed a retry in the run itself.
- `~/.nav-pilot` and `~/.config/opencode` were not written during the run. One file under `~/.copilot` changed (`session-store.db-shm`), from an interactive Copilot session; the bench HOMEs were temp dirs.

## Recommendation for the next iteration

- #1832: decide eligibility per project directory, not per cwd. A root launch in a monorepo must find `quotes-*/go.sum` and similar. Wire `SetDepUpgrade` in endpoint mode. Then rerun: with the paragraph missing, this run says nothing about routing.
- #1832: an orchestrator that does the whole upgrade itself is the cheaper failure (about $0.13–0.37 per task). If the aim is to move the work local, the policy has to say "send it", not "may go to".
- #1833: keep the infra and tool-pin hold-backs; they are the one measured effect. Make the package-manager step a check rather than prose: run `pnpm --version` against `packageManager` or the mise pin before installing, and stop on a mismatch.
