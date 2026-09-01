# AGENTS.md — Whitelabel Publisher Platform

## Project Overview

Multi-tenant **API-first** podcast SaaS. **Primary audience:** non-technical creators who use
**`directwerk-studio`** (dashboard) and **`directwerk-web`** (public site) on their domain. The REST API
is the contract; agencies may build custom frontends against the same endpoints.

See [`docs/platform-design.md`](docs/platform-design.md) for the full design specification. **How to run / deploy the API:**
[`Directwerk/docs/build-and-deploy.md`](Directwerk/docs/build-and-deploy.md) (Compose Postgres +
Mailpit, host `bootRun`, Docker image, Coolify/prod). **Public docs site:** [`directwerk-docs/`](directwerk-docs/) (VitePress). OpenAPI export: `./Directwerk/gradlew :directwerk-app:exportOpenApi`. Companion docs: [`docs/poc-alpha-setup.md`](docs/poc-alpha-setup.md),
[`Directwerk/docs/jobs-and-email.md`](Directwerk/docs/jobs-and-email.md),
[`Directwerk/docs/multi-tenancy.md`](Directwerk/docs/multi-tenancy.md),
[`docs/user-backend-implementation.md`](docs/user-backend-implementation.md),
[`docs/directwerk-studio-implementation.md`](docs/directwerk-studio-implementation.md),
[`docs/directwerk-admin-implementation.md`](docs/directwerk-admin-implementation.md),
[`docs/directwerk-studio.md`](docs/directwerk-studio.md),
[`docs/content-creation-implementation.md`](docs/content-creation-implementation.md),
[`docs/content-platform-strategy.md`](docs/content-platform-strategy.md),
[`docs/content-subscriptions-and-entitlements.md`](docs/content-subscriptions-and-entitlements.md),
[`docs/payment.md`](docs/payment.md),
[`docs/patreon-steady-integration.md`](docs/patreon-steady-integration.md),
[`docs/product-naming.md`](docs/product-naming.md), [`docs/asset-storage.md`](docs/asset-storage.md).
Manual API tests: [`Directwerk/http/`](Directwerk/http/). The retained API demo UI is
`example-fe`; product UIs are `directwerk-admin`, `directwerk-studio`, and `directwerk-web`.

**Public docs site:** [`directwerk-docs/`](directwerk-docs/) (VitePress). Internal doc index: [`docs/README.md`](docs/README.md).

**Stack**: Java 21 · Spring Boot 4.1.0 · Gradle 9.x · Flyway 12+ · PostgreSQL 19 (beta) · Hetzner/Bunny S3 (EU) · Stripe Connect · Patreon/Steady API

Alpha storage: `Directwerk/directwerk-digital` (`MediaAsset`, S3, upload-url/confirm, private
presign). See [`docs/asset-storage.md`](docs/asset-storage.md). Podcast Phase 3 domain brief:
[`Directwerk/directwerk-podcast/README.md`](Directwerk/directwerk-podcast/README.md).

**Reference frontends (default bundled apps for creators):**
- `directwerk-studio/` — **creator dashboard** (see [`docs/directwerk-studio.md`](docs/directwerk-studio.md))
- `directwerk-web/` — public site + subscriber portal (Phase 9)
- `directwerk-admin/` — platform superadmin dashboard (Phase 5)
- `homepage/` — **platform marketing site** + API excerpt at `/developers` ([`homepage/README.md`](homepage/README.md))
- `directwerk-docs/` — **public documentation** (VitePress — install, operators, API reference)

**Deployment**: Docker via Coolify on Hetzner Cloud — see [`Directwerk/docs/build-and-deploy.md`](Directwerk/docs/build-and-deploy.md)

**Package**: `de.pnnit.directwerk`

## Build / Dev / Test Commands

All Directwerk commands run from `Directwerk/` (not the parent `directwerk/` folder).
Full detail: [`Directwerk/docs/build-and-deploy.md`](Directwerk/docs/build-and-deploy.md).

```sh
cd Directwerk
cp .env.example .env                    # set secrets once
docker compose up -d                    # Postgres :5433 + Mailpit :1025 / UI :8025
./gradlew :directwerk-app:bootRun       # profile=local from .env

./gradlew test
./gradlew :directwerk-app:bootJar

# Optional Flyway CLI (app also migrates on startup)
set -a && source .env && set +a
./gradlew :directwerk-app:flywayMigrate

# Full stack in containers
docker compose --profile stack up --build
```

**Local endpoints:**

- Health: `http://localhost:8080/actuator/health`
- Swagger: `http://localhost:8080/swagger-ui.html`
- Mailpit UI: `http://127.0.0.1:8025`
- Directwerk admin / example FE: `http://localhost:3001` / `http://localhost:3000`
- Docs site: `http://localhost:5173` (`pnpm --filter directwerk-docs dev`)

## Domain Model (summary)

**Core entities:** Tenant, User, TenantMembership, PodcastSeries, Episode, Format, Category,
SubscriptionProduct, ProductAccessRule, Subscription, SubscriberFeed (default private),
CustomFeed (feed builder), MediaAsset, DigitalPublication.

**Billing sources:** `STRIPE`, `PATREON`, `STEADY`, `MANUAL` — unified product-based entitlements (LEVEL + PACKAGE).

**Roles:** `PLATFORM_ADMIN`, `TENANT_ADMIN`, `EDITOR`, `SUBSCRIBER`, `GUEST`.

**Feature modules:** `DIGITAL_CONTENT` (base) → `PODCAST` → `PODCAST_RSS` → `FEED_BUILDER`, and in
parallel → `ARTICLES` → `ARTICLE_RSS` → `ARTICLE_FEED_BUILDER`.
`ModuleService` + `@RequiresModule` AOP — see README Feature Modules section.

Multi-tenancy: verified `Host` → `TenantContext`, JWT `tenant_id` cross-check, Hibernate
`tenantFilter` + write guards. Details: [`Directwerk/docs/multi-tenancy.md`](Directwerk/docs/multi-tenancy.md).

## API-First Rules

1. Every feature must have REST endpoints — no UI-only workflows
2. OpenAPI spec is a product deliverable; keep in sync with code
3. Reference frontends (`directwerk-web`) call the same public API customers use — no private shortcuts
4. Use structured error `code` fields for integrators
5. **Bruno + http stay in lockstep with controllers** — update
   [`Directwerk/bruno/`](Directwerk/bruno/) **and** [`Directwerk/http/`](Directwerk/http/) in the
   **same change** as every new/changed REST endpoint (paths, request/response shapes, status codes,
   error `code`s). Do not ship controller work without Bruno coverage.

## Code Style

Follow [`projects/courses/AGENTS.md`](../courses/AGENTS.md) Java conventions.

### Next.js UI

The five Next.js apps in this directory use Tailwind CSS v4 and the shared
shadcn-based `@directwerk/ui` package in `packages/ui`. This is a directwerk-scoped
exception to the monorepo's general “no Tailwind” convention; do not extend it
to unrelated projects without an explicit migration.

- Import shared primitives directly from `@directwerk/ui/components/*`; no barrels.
- Keep domain logic in the app and reusable presentation in `packages/ui`.
- Use semantic theme tokens and `BrandTheme` for tenant primary colors.
- Follow [`docs/ui-system.md`](docs/ui-system.md) for responsive and accessibility
  expectations.

Package layout includes: `modules/digital/`, `modules/podcast/`, `feeds/`, `integrations/`,
`payments/`, `storage/`, `multitenancy/`.

## Security Rules

1. Feed tokens must be cryptographically random (128+ bits); rotatable
2. Custom feeds must always apply entitlement filter — never leak paid episodes
3. **All assets in S3** — tenant-prefixed keys; `public/` vs `private/` visibility enforced
4. Private assets only via `AssetAccessService` signed URLs after entitlement check
5. **Module gating** — `@RequiresModule` before presign; `DIGITAL_CONTENT` is core; optional modules gate podcast/subscription flows — see [`docs/asset-storage.md`](docs/asset-storage.md#module-gating)
6. **Role vs subscription** — `SUBSCRIBER` role ≠ paid access; entitlements evaluated per asset — see [`docs/asset-storage.md`](docs/asset-storage.md#access-control-model)
7. Verify all webhook signatures (Stripe, Patreon, Steady)
8. Pre-signed S3 uploads: mime/size allow-lists; keys scoped to `{tenant}/staging/`
9. Never log pre-signed S3 URLs
10. No secrets in code — env vars via `@ConfigurationProperties`

## Files to Never Commit

`.env`, `.env.local`, `application-prod.yml` (if contains secrets), `build/`, `.gradle/`,
database credentials, Stripe/Patreon/Steady keys, S3 credentials.
