# nais/examples dependency upgrade: results (2026-10-14)

Harness `bench-nais-upgrade` at 7ca7059 (PR #272), base c876680, opencode in cplt sandbox, 25 min cap.
Raw rows: [results.jsonl](results.jsonl). "Harness green" is what the harness recorded; "Re-check" is a manual re-run of the same five frontend checks with the repo's pnpm 10 and `CI=true`.

| Model | Task | Moved | Behind | Harness green | Re-check | Wall (s) | Tool calls | Result |
|---|---|---|---|---|---|---|---|---|
| qwen3.8-27b-8bit-mtplx | loadgen | 8 | 0 | yes | | 95 | 8 | full upgrade |
| qwen3.8-27b-8bit-mtplx | frontend | 24 | 1 | no | 5/5 pass | 170 | 26 | all but TypeScript 7 |
| qwen3.8-27b-8bit-mtplx | tools | 19 | 3 | parse ok | | 1302 | 174 | partial, has errors (see below) |
| qwen3.6-35b-a3b-optiq-64g | loadgen | 8 | 0 | yes | | 135 | 18 | full upgrade |
| qwen3.6-35b-a3b-optiq-64g | frontend | 23 | 1 | no | 5/5 pass | 265 | 33 | stayed on TypeScript 5.9 |
| qwen3.6-35b-a3b-optiq-64g | tools | 0 | 12 | no | | 45 | 19 | read files, stopped, no edits |
| qwen3.6-35b-a3b-8bit-64g | loadgen | 8 | 0 | yes | | 125 | 12 | full upgrade |
| qwen3.6-35b-a3b-8bit-64g | frontend | 24 | 1 | no | 5/5 pass | 290 | 31 | all but TypeScript 7 |
| qwen3.6-35b-a3b-8bit-64g | tools | 0 | 12 | no | | 566 | 105 | stopped while looking up image tags (and read from a wrong path), no edits |
| qwen3.8-27b-optiq-4bit | loadgen | 8 | 0 | yes | | 466 | 16 | full upgrade |
| qwen3.8-27b-optiq-4bit | frontend | 24 | 1 | no | 5/5 pass | 1512 | 47 | timed out, but the tree was already upgraded |
| qwen3.8-27b-optiq-4bit | tools | 0 | 12 | no | | 1512 | 39 | timed out, no edits |

Watchdog retries are not recorded: on a retry the harness overwrites the session log, and each log holds a single session.

## Findings

- **The frontend "red" results are a harness false negative.** Each session ran `pnpm install` with the store under its temporary HOME. The harness check then hit `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` (pnpm asks before purging node_modules and there is no TTY), which failed `install` and everything after it. Re-run with `CI=true`, all four trees pass install, vitest, tsc, eslint and build. Fix for the harness: set `CI=true` (or `confirmModulesPurge=false`) in the check environment.
- **A full frontend upgrade fits in 25 min.** The jump covers 6 majors (jest-dom 7, @types/node 26, @vitejs/plugin-react 6, jsdom 30, TypeScript 6, vitest 5, plus vite 8 added as a peer). Three models did it in 3–5 min. The only package left behind is TypeScript 7, which typescript-eslint does not support yet, so holding it back is correct. A minor/patch-only upgrade was never needed to reach green.
- All four models changed `src/app/page.tsx` to satisfy the new `react-hooks/set-state-in-effect` rule in eslint-plugin-react-hooks 7.1. That change is in scope. mtplx's version (async loaders and a cancel flag on unmount) keeps the original behaviour.
- **The tools diff from mtplx is not safe to apply as-is:** `watchexec = "8.4.4"` does not exist (the CLI's latest release is v2.8.0), pnpm is pinned to 12.11.2 although the lockfile and the frozen-install check need pnpm 10, postgres goes 16→18 (existing data volumes will not start), and Node stays on 25. The pinned action SHAs (checkout v7.0.1, codeql v4.38.3, setup-java v6.0.1, mise-action v5.1.2, codecov v7.1.1) all exist upstream. The harness counted watchexec 8.4.4 as up to date, so its "behind" check needs to verify that a version exists.
- **Scope and isolation:** no write/edit calls outside each session's clone, and every changed file is inside the task scope. During the run window (08:37–10:32), `~/.copilot`, `~/.nav-pilot` and `~/.config/opencode` were not written. `~/.local/share/opencode` was written, but only by unrelated interactive sessions: the nais/examples snapshot project was last modified before the run, and no tool output mentions the run.

## Recommendation

- loadgen: apply any of the four (identical module set). mtplx was fastest.
- frontend: apply qwen3.8-27b-8bit-mtplx (`clones/qwen3.8-27b-8bit-mtplx--frontend`), after a quick UI smoke test of page.tsx.
- tools: do not apply. If a human uses it, take only the action SHA bumps and the Go/dotnet/gradle image pins.
