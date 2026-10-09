# What code changes at Nav look like: a navikt PR audit, 2026-10-09

## Question
Our local-model benchmarks assume a set of task classes (create-file, edit-single, edit-multi-mechanical, read-qa, ops). Do those classes match the code changes people at Nav actually make? The answer decides which classes deserve local-model effort and which benchmark tasks to add or drop.

## What shipped
Nothing. This report changes what we benchmark, not what nav-pilot does.

## Method
- Source: merged PRs in public `navikt` repos, 2026-07-11 to 2026-10-09, fetched with the GitHub GraphQL API (up to 100 recent merged PRs per repo, from 43 recently pushed repos).
- Bots (dependabot, renovate, github-actions and similar) are counted separately. The main sample is 356 human PRs from 30 repos, capped at 20 per repo. By language: TypeScript 108, Kotlin 83, Java 64, Python 60, Go 21, Shell/JS 18.
- Classes are assigned by a heuristic on file paths and added/deleted lines, not by reading the code. New classes were added where real work did not fit ours.
- Data: [sample.csv](sample.csv) (the 356 PRs, no author fields) and [repos.tsv](repos.tsv).

## Results
Bots made 1602 of 2437 PRs (66 %): 71 % of those are dependency bumps and 13 % config or workflow changes.

Human PRs by class:

| Class | Share | Median files | Median lines | Has tests | Cross-module |
|---|---|---|---|---|---|
| edit-single | 21.1 % | 3 | 45 | 40 % | 0 % |
| feature-multi (new) | 19.9 % | 9 | 333 | 80 % | 32 % |
| edit-multi-logic (new) | 12.4 % | 5.5 | 113 | 41 % | 16 % |
| config-deploy (new) | 9.0 % | 1 | 6 | 0 % | 0 % |
| frontend-feature (new) | 9.0 % | 11 | 447 | 41 % | 22 % |
| edit-multi-mechanical | 7.0 % | 13 | 154 | 64 % | 40 % |
| create-file | 5.3 % | 2 | 18 | 16 % | 0 % |
| docs (new) | 4.8 % | 1 | 15 | 0 % | 0 % |
| deps-bump by hand (new) | 4.5 % | 2 | 16 | 0 % | 0 % |
| db-migration (new) | 3.7 % | 13 | 130 | 69 % | 38 % |
| test-only (new) | 2.8 % | 4.5 | 118 | 100 % | 0 % |
| api-schema (new) | 0.6 % | 23 | 382 | 100 % | 100 % |

Overall, 44 % of human PRs include tests and 15 % touch more than one module. read-qa has no PR equivalent and is not measured here.

Task types we do not benchmark, with examples:
- Feature across service, domain, repo and test layers in a Kotlin backend (about 20 %): aap-behandlingsflyt#3319, #3623.
- DB migration plus model plus repository code (about 4 %): sykepengesoknad-backend#1590, aap-behandlingsflyt#3624, fptilbake#3240.
- Dependency upgrade with code fixes, where a bot bumps the version and a person fixes the breakage (about 7 % of titles, skewed by one repo): melosys-web#3230, #3227, #3225.
- Config, nais or workflow tweak (9 % of human PRs, plus 13 % of bot PRs): melosys-muninn#11, #12, rekrutteringsbistand-stilling-api#320.
- Test-only additions (3 %): sykepengesoknad-backend#1592, #1587, melosys-web#3233.

## Verdict
- **create-file is over-represented** in our benchmarks. It is 5 % of real work, and real create-file PRs are tiny (median 18 lines), far smaller than our weather-cli tasks.
- **edit-single fits well.** It is the largest class (21 %), usually one source file plus a test or config.
- **Multi-file logic changes with tests are under-represented.** feature-multi and edit-multi-logic are 32 % of human PRs, and we have no benchmark for them.
- About **42 %** of human PRs are small and single-module (edit-single, config-deploy, by-hand bumps, docs, test-only). They need little context and suit local models.
- About **41 %** are large, carry tests and often cross modules (feature-multi, frontend-feature, edit-multi-logic). They belong on cloud models.

## Limits
Public repos only. The classifier is a heuristic on paths and line counts. A few busy repos (melosys-web, copilot, aap-behandlingsflyt) weigh heavily even with the per-repo cap. The window is 90 days.

## Decision
Owner, 2026-10-09:
1. Add two tasks to cheap-ops: a nais.yaml or workflow change, and "write a test for an existing class".
2. Stop investing in create-file from scratch; it is rare in real work.
3. Keep feature-multi, frontend-feature and edit-multi-logic on cloud models. A migration-plus-model-plus-repository task may be added later as a ceiling probe, not for routing.
4. The voluntary session-sharing PRD (navikt/copilot#1519) is the planned way to replace this heuristic with real session data.

## Sources
[sample.csv](sample.csv), [repos.tsv](repos.tsv), navikt/copilot#1519
