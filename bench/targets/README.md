# Benchmark targets

One task set per stack. `bench/tasks.json` is the active one; the others are pinned
and ready to swap in.

| Stack | Repository | Why |
|---|---|---|
| Kotlin, Ktor | `navikt/isoppfolgingstilfelle` | Where new Nav apps go. The active target |
| Kotlin, Spring Boot | `navikt/ia-tjenester-metrikker` | The existing estate. Spring shapes: controllers, beans, `@ControllerAdvice` |
| TypeScript, React and Express | `navikt/familie-tilbake-frontend` | The other half of what teams build. Not Next, see below |

## No Next.js target exists that we can verify

Every actively maintained Nav Next.js frontend routes the `@navikt` scope to GitHub Packages:
`@navikt/oasis`, `@navikt/next-logger`, `@navikt/texas` and `@navikt/nav-dekoratoren-moduler`
return 404 on npmjs and exist only there. A sweep of 186 navikt TypeScript repositories found no
exception among the maintained ones. `navikt/vera` is the one clean-registry Next 16 App Router
app, and 9 of its 10 tests need a MongoDB binary download, so it cannot be verified offline either.

`familie-tilbake-frontend` is the closest usable thing and it keeps the property that matters:
an Express 5 backend and a React 19 client in one tree, with separate tsconfigs. `src/backend` is
typecheck-only and never executed by tests, `src/frontend` runs under jsdom. A model that confuses
server and client code fails the typecheck, which is the Next-specific failure we wanted to measure.

61 test files, 572 tests, 9 seconds. 60,836 lines. Norwegian identifiers throughout, which is
representative and worth measuring rather than avoiding.

## Why picking a target is hard

`no.nav.security:token-support` stopped syncing to Maven Central after **5.0.30**.
Everything on 5.0.3x and 6.0.x resolves only from GitHub Packages or the Nav mirror,
both unreachable off the Nav network. A sweep of 232 `build.gradle.kts` files across
non-archived navikt Kotlin repositories found that `ia-tjenester-metrikker` pins
exactly 5.0.30, which is why it is usable and most are not.

Other common blockers, in order of frequency: Testcontainers requiring Docker,
JDK 25 or 26 toolchains against our pinned 21, and internal artifacts such as
`no.nav.klage:klage-kodeverk` or `no.nav.familie:*` on GitHub Packages.

Pin `ref` to a SHA rather than a branch. Dependabot will bump `token-support` past
5.0.30 within weeks and break cold priming.
