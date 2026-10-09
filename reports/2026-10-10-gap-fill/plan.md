# Gap-fill after the Saturday GPU window (#183 Q2, Q3)

Starts after Sat 2026-10-10 14:00, once the fill launcher has finished, from `gap-fill-launcher`
(BENCHMARKING.md, "Waiting launchers"). $0 cloud: `FRONTIER_COST_CAP=0`.

The owner dropped Q1 (cloud-only arms for GPT-6 Sol and GPT-6 Luna): no standalone cloud-model
benchmarks. Cloud spend goes only to measuring cloud–local interaction (hybrid delegation and its
controls). Nothing in this plan needs that.

| # | Step | Cost | Decision |
|---|---|---|---|
| 1 | Q3: `ts/validate-ts` checks the two melosys-web tasks in Docker | CPU, ~15 min | If every check holds, wire F1/F2 into bench-cheap-ops as a TS rung and queue it on optiq (#183 queue item 4). If any check fails, fix the task first; it gets no GPU time |
| 2 | Q2: base create-file on optiq, r1–r4, n = 10 (`gap-fill.queue`) | GPU, ~2.5 h | If base ≈ retry2 at r1–r2, the harness fixes did the work and retry2 is optional complexity in #1156. If base is clearly lower, retry2 stays. The manifest stays `delegate: cloud` either way |

## Q3 tasks (`ts/`)

`navikt/melosys-web` at `881771a0`, React 19 + vitest, Node 22.23.2. The Dockerfile follows
navikt/copilot `benchmark/realistic/typescript`: dependencies are installed when the image is
built, and runs use `--network none`.

- **F1, component edit:** add an optional `erDnummer` prop to `Ident` that switches the hover text
  to "Kopier D-nummer". Checks: `tsc --noEmit`, the repo's `ident.test.tsx`, and a hidden test
  (`F1/ident.erDnummer.test.tsx`) that must fail on the untouched tree.
- **F2, test-only:** write `src/sider/tekstblokker/labels.test.ts` for `labels.ts`, which has no
  tests. Checks: the test passes, and it fails under each of four planted breaks (the T1 rule).
  Only that file may change.

`validate-ts` checks four things: the baseline is green, both reference solutions pass, the F1
check fails without the edit, and every F2 break applies and is caught.

**Owner action:** `@navikt/melosys-kodeverk` exists only on GitHub Packages, and the gh token
lacks `read:packages` (the probe returned 403). Run `gh auth refresh -h github.com -s read:packages`
before 14:00. Without it, the launcher skips step 1 with one log line and still runs step 2.

## Q2 harness

#183 names harness `98da309f03c1` (commit ca37518). Main now hashes to `df55185ed2eb`. The only
harness change since ca37518 is the O1/T1 `only`/`expect_diff` checks in `bench-cheap-ops`, and no
frontier create-file task uses them. Tasks (`cd8780d1d644`), profile, rungs and runs match the
retry2 run, so the comparison holds. The report must name both hashes.

## Not in the queue

Wiring `npm`-based checks into `bench-cheap-ops` changes the harness hash. That waits for the
step 1 verdict and a free checkout.
