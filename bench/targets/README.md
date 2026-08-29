# Benchmark targets

One task set per stack. `bench/tasks.json` is the active one; the others are pinned
and ready to swap in.

| Stack | Repository | Why |
|---|---|---|
| Kotlin, Ktor | `navikt/isoppfolgingstilfelle` | Where new Nav apps go. The active target |
| Kotlin, Spring Boot | `navikt/ia-tjenester-metrikker` | The existing estate. Spring shapes: controllers, beans, `@ControllerAdvice` |
| TypeScript, Next.js | pending survey | The other half of what teams build |

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
