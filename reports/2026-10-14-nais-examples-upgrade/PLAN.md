# nais/examples dependency upgrade with local models: plan

Target: github.com/nais/examples at local main c876680, cloned to a scratch dir outside ~/.cache
(cplt denies exec under ~/.cache). The owner's checkout is never touched. Nothing is pushed.

## Tasks (one agent session per task, own clone, own branch `upgrade/<task>-<model>-<n>`)
| task | scope | success check (run by the grader, outside the sandbox) |
|---|---|---|
| loadgen | go.mod/go.sum, Go version | `go build ./... && go test ./...`, `go list -m -u all` shows no direct dep behind |
| frontend | package.json, pnpm-lock.yaml | `pnpm install --frozen-lockfile && vitest run && tsc --noEmit && eslint . && pnpm build`; `pnpm outdated` empty for direct deps (majors allowed if green) |
| backend | **dropped by the owner**: Gradle's JDK cannot finish TLS to the plugin portal from this machine |
| tools | .mise.toml pins, Dockerfile FROM tags, workflow action pins | files parse; tags exist in registry; no docker build (colima is off) |
| analytics | **out of scope**: no .NET SDK installed, NuGet unreachable inside cplt |

## Grading (per attempt, automated)
baseline checks run first (task skipped if red); versions moved, and pass needs *fully upgraded*
(0 direct deps behind latest; for tools: mise pins for node/go/pnpm/watchexec, golang/node image tags,
action major tags vs latest release), checks green, `git diff --stat`
touches only the task's files, no dep removed or downgraded.

## Schedule (8 GPU h)
qwen3.8-27b-8bit-mtplx first, then qwen3.6-35b-a3b-optiq-64g, qwen3.6-35b-a3b-8bit-64g,
qwen3.8-27b-optiq-4bit. 3 tasks x 4 models x 1 attempt, 25 min cap each: at most 5 h plus server
starts, inside an 8 h window (`--deadline`). Optional: one Sonnet pass (cap $10) as reference.

## Network findings 2026-10-14 00:30
From this machine, TLS from non-curl clients to package hosts fails while curl succeeds:
- Gradle (JDK 21): "Remote host terminated the handshake" on plugins-artifacts.gradle.org;
  the wrapper times out on services.gradle.org. Baseline `./gradlew build` cannot run.
- mise (rustls): node tarball download fails ("error sending request"); worked around by hand.
- inside cplt: curl to api.nuget.org fails (SSL_ERROR_SYSCALL); Maven Central, Gradle plugin
  portal, npm and the Go proxy answer 200.
Baselines that are green: loadgen go test; frontend vitest 28/28, tsc, eslint, next build.
Go and pnpm reach their registries, so loadgen and frontend are gradable.

## Harness
`.mise/tasks/bench-nais-upgrade` (session per model x task, grader outside the sandbox, results.jsonl)
and `nais-upgrade-launcher` (waiting launcher, 8 h window). Each session runs with a temp HOME (`own_home`) and is killed as a process group on cap or SIGTERM.
Smoke 2026-10-14 (after review fixes): loadgen on qwen3.8-27b-8bit-mtplx, 86 s, pass: 8 direct deps
moved, 0 behind, `go build`/`go test` green, only go.mod/go.sum; no writes to the real opencode,
copilot or nav-pilot dirs.
