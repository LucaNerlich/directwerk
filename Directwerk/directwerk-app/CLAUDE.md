# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
# Run locally (profile=local auto-starts Compose deps: Postgres :5433, Mailpit :1025/8025)
./gradlew :directwerk-app:bootRun

# Test this module (full suite — most of the repo's ~113 tests live here, including
# integration tests for lower modules)
./gradlew :directwerk-app:test

# Single test
./gradlew :directwerk-app:test --tests "de.pnnit.directwerk.architecture.MultiTenancyArchitectureTest"

# Build + package
./gradlew :directwerk-app:test :directwerk-app:bootJar   # -> build/libs/directwerk-app.jar

# Flyway CLI (app also migrates on startup)
set -a && source .env && set +a
./gradlew :directwerk-app:flywayMigrate
```

Docker image build and full Compose stack: see `../docs/build-and-deploy.md`. Profiles: `local` (host dev, Compose auto-start), `docker` (container in Compose `stack` profile), `stage`/`prod` (deployed; Swagger disabled in `prod` — see `ProdSecurityPropertiesValidator`/`ProdEmailPropertiesValidator`/`ProdStoragePropertiesValidator`). Env vars: `../.env.example`.

## Architecture

The runnable Spring Boot application (`@SpringBootApplication` on `DirectwerkApplication`, which scans all `de.pnnit.directwerk.*` packages across every module). This is the top of the dependency graph — it depends on `directwerk-common`, `directwerk-queue`, `directwerk-email`, `directwerk-webhook`, `directwerk-core`, `directwerk-subscription`, `directwerk-digital`, `directwerk-podcast` — and owns everything that must not live in a reusable library module: HTTP surface, security, servlet-layer multitenancy, and all Flyway migrations.

- `de.pnnit.directwerk.controller.*` + `de.pnnit.directwerk.api.*` — REST controllers grouped by audience: `controller.auth` (login/me), `controller.platform` (`PlatformAdminController`, `PlatformModuleController`, `PlatformQueueController`, `PlatformTenantController`, `PlatformTenantUserController` — platform-admin-only, tenant-context-free), `controller.tenant` (tenant-admin-scoped, e.g. subscription management), `controller.publicapi` (unauthenticated, e.g. site config / public product listings), `controller.probe`/`controller.security` (health/diagnostic probes). `api.exception.GlobalExceptionHandler` and `api.response.Response`/`ErrorDetail` define the uniform error/response envelope; `api.dto` holds cross-cutting response DTOs (e.g. invitation mapping).
- `de.pnnit.directwerk.security.*` — the OAuth2 authorization server + JWT resource server stack: `SecurityConfig` (filter chain wiring), `security.oauth2` (in-memory registered client store, bootstrap, authorization service), `security.grants` (a custom password-grant flow: `PasswordGrantAuthenticationConverter`/`Provider`/`Token`), `DirectwerkJwtAuthenticationConverter`, `JwtTenantCustomizer` (embeds `tenant_id` into issued JWTs), `AudienceValidator`, `AuthRateLimitFilter`, `LoginContext`/`LoginContextFilter`, `TenantMembershipGuardFilter`.
- `de.pnnit.directwerk.multitenancy.TenantContextFilter` — the servlet-layer piece of multitenancy that intentionally lives here rather than in `directwerk-core`: it resolves `TenantContext` strictly from the verified request Host (never a client-supplied tenant header), distinguishes platform-scoped paths (`/api/v1/platform/**`, context cleared) from public paths (`/api/v1/public/**`, `/api/v1/auth/**`, `/feeds/**`, actuator/swagger) from tenant-scoped paths (everything else under `/api/v1/**`), and for authenticated tenant-scoped requests cross-checks the JWT principal's `tenantId()` against the Host-resolved tenant — a mismatch throws rather than silently trusting either side. See `../docs/multi-tenancy.md` for the full request-resolution model.
- `de.pnnit.directwerk.bootstrap.*` — `JpaAuditingConfig`, `CacheConfig`, `ApplicationConfig`, `DevDataInitializer` (dev-only seed data), `PlatformAdminBootstrap`, and the `Prod*PropertiesValidator` classes that fail fast at startup in `prod` if required security/email/storage properties are missing. (`de.pnnit.directwerk.config` holds only the shared leaf property/constant classes from `directwerk-common`.)
- `src/main/resources/` — `application*.yaml` per profile, Flyway migrations (`db/migration`), email templates (mirrors `directwerk-email`'s classpath template loading).
- `src/test/.../architecture/` — ArchUnit-style tests (e.g. `MultiTenancyArchitectureTest`) enforcing structural invariants across the whole module graph; run these whenever touching tenant-scoped entities, package boundaries, or the security filter chain.

Because this module aggregates every other module, it's also where most integration/service-layer tests for the *lower* modules live (e.g. `directwerk-core` service tests, `directwerk-subscription`'s `EntitlementServiceTest`, future `directwerk-podcast` series/episode tests) — check here first before assuming a lower module is untested.

Podcast domain language (series vs episode, Formate vs category, entitlements, Phase 3 plan): see `../directwerk-podcast/README.md`.

Whenever a controller under `controller.*`/`api.*` is added or changed (new endpoint, changed request/response shape, new error code, renamed route), update the Bruno collection (`../bruno/`) and the JetBrains `../http/*.http` harness in the same change — they're the project's manual API test surfaces and go stale silently otherwise.
