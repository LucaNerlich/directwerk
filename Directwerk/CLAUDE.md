# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`Directwerk` is a Gradle multi-module Java project: a multi-tenant podcast SaaS backend (Spring Boot 4.1.0, Java 21). It is one part of the `publish` monorepo; the Next.js frontends (`publish-admin`, `publish-studio`, `publish-web`, and the retained `example-fe` harness) live as siblings and talk to this backend over HTTP.

All commands below run from this directory (`Directwerk/`).

## Commands

```sh
# Start local infra: Postgres (:5433) + Mailpit (SMTP :1025, UI :8025)
docker compose up -d

# Run the app locally (profile=local auto-starts Compose deps)
./gradlew :directwerk-app:bootRun

# Full test suite (all modules)
./gradlew test

# Single module / single test
./gradlew :directwerk-core:test
./gradlew :directwerk-app:test --tests "de.pnnit.directwerk.architecture.MultiTenancyArchitectureTest"

# Build the runnable jar
./gradlew :directwerk-app:bootJar

# Flyway CLI (the app also migrates on startup; this is for manual/CI use)
set -a && source .env && set +a
./gradlew :directwerk-app:flywayMigrate

# Full containerized stack (app + Postgres + Mailpit in Compose)
docker compose --profile stack up --build
```

Detailed run/deploy instructions, environment variables, and profiles: see `docs/build-and-deploy.md`, `docs/jobs-and-email.md`, and `docs/multi-tenancy.md`. Don't duplicate those here — read them when working on deployment, background jobs/email, or tenant-resolution behavior.

## Module layout and dependency order

`settings.gradle` declares the modules; their `build.gradle` files define this dependency graph:

```
directwerk-common → directwerk-core → directwerk-subscription
        ↓                  ├────────→ directwerk-email
directwerk-queue ──────────┼────────→ directwerk-digital → directwerk-podcast
        ↓                  │                              → directwerk-newsletter
directwerk-webhook         └── (`email` and `digital` also depend on `queue`)

all modules → directwerk-app
```

- **directwerk-common** — shared config/util, no internal dependencies. Everything depends on it (directly or transitively).
- **directwerk-queue** — Postgres-backed job queue + Quartz polling. Depends only on `common`.
- **directwerk-email** — transactional and content email via the queue. Depends on `queue`, `common`, and `core`; core itself only sees the `TransactionalEmailNotifier` port in `common`.
- **directwerk-webhook** — outbound webhook delivery stub. Depends on `queue`, `common`.
- **directwerk-core** — domain layer (tenants, users, memberships, module gating, multitenancy). Depends only on `common`; email notifications are invoked through the `TransactionalEmailNotifier` port declared there.
- **directwerk-subscription** — subscription products and entitlements. Depends on `core`.
- **directwerk-digital** — media assets + S3 storage foundation (`AssetAccessApi`, fail-closed storage entitlements). Depends on `core` and `queue`.
- **directwerk-podcast** — podcast series, episodes, formats (Formate), RSS, subscriber feeds, publish workflow. Depends on `digital`. Domain brief: `directwerk-podcast/README.md`.
- **directwerk-newsletter** — Write desk: newsletter/article publications (web + email channels). Depends on `digital`. Domain brief: `directwerk-newsletter/README.md`.
- **directwerk-app** — the runnable Spring Boot application: HTTP controllers, security (OAuth2 auth server + resource server), servlet-layer multitenancy filter, Flyway migrations, config/wiring for all of the above. Depends on every other module.

Every subproject applies `java-library` (except `directwerk-app`, which applies the Spring Boot plugin), Java 21 toolchain, Lombok, `io.spring.dependency-management`, JUnit 5, and Flyway 12 — configured once in the root `build.gradle`. Module-specific `build.gradle` files only add module-specific dependencies.

Package base for all modules: `de.pnnit.directwerk`.

## Working across modules

- Most business-logic and controller tests live in `directwerk-app` even when the code under test lives in a lower module (e.g. `directwerk-core` service tests, `directwerk-subscription` entitlement tests) — check there first if a module's own `src/test` looks sparse.
- `directwerk-app/src/test/.../architecture/` contains ArchUnit-style tests (e.g. `MultiTenancyArchitectureTest`) that enforce cross-cutting invariants — run these when touching tenant-scoped code or package boundaries.
- New background job types are added by implementing `JobHandler` (from `directwerk-queue`) in whichever module owns the job; the queue's allowed names are derived from registered handler beans at startup, not a static enum.
- See each submodule's own `CLAUDE.md` for module-specific architecture notes.
- Whenever a controller/API changes (new endpoint, changed request/response shape, new error code, renamed route), update the Bruno collection (`bruno/`) and the JetBrains `http/*.http` harness to match — both are manual test surfaces that drift silently otherwise.
