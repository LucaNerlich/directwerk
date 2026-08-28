---
title: Local development
description: Run the Directwerk Spring Boot API on your host with Compose for Postgres and Mailpit.
outline: deep
---

<!-- source: Directwerk/docs/build-and-deploy.md §1 -->

# Local development

The preferred workflow for day-to-day API work: **Compose for infrastructure**, **Gradle for the app**.

## Prerequisites

| Tool | When needed |
|------|-------------|
| **Java 21** | Host `./gradlew` builds, tests, and `bootRun` |
| **Docker** + **Compose v2** | Local Postgres + Mailpit (recommended) |
| **pnpm 12** (optional) | Next.js apps at repo root |
| **`.env` file** | Copy from `Directwerk/.env.example`; never commit |

## Configure environment

```sh
cd Directwerk
cp .env.example .env
```

Set at least:

```ini
SPRING_PROFILES_ACTIVE=local
SPRING_DATASOURCE_PASSWORD=your-local-db-password
DIRECTWERK_PLATFORM_CLIENT_SECRET=your-platform-client-secret
DIRECTWERK_TENANT_CLIENT_SECRET=your-tenant-client-secret
DIRECTWERK_DEV_PLATFORM_ADMIN_PASSWORD=ChangeMe-Dev-Seed!
DIRECTWERK_DEV_SEED_PASSWORD=ChangeMe-Dev-Seed!
```

JWT PEM keys can stay empty locally — ephemeral keys are generated at startup.

Optional overrides (defaults match Compose):

| Variable | Default | Purpose |
|----------|---------|---------|
| `DIRECTWERK_POSTGRES_PORT` | `5433` | Host port for Postgres |
| `DIRECTWERK_MAILPIT_SMTP_PORT` | `1025` | Mailpit SMTP |
| `DIRECTWERK_MAILPIT_UI_PORT` | `8025` | Mailpit web UI |
| `DIRECTWERK_APP_PORT` | `8080` | App container port |

## Start Postgres + Mailpit

```sh
docker compose up -d
```

| Service | Host access |
|---------|-------------|
| **postgres** | `localhost:5433` → container `5432` |
| **mailpit SMTP** | `127.0.0.1:1025` |
| **mailpit UI** | [http://127.0.0.1:8025](http://127.0.0.1:8025) |

## Run the API on the host

```sh
./gradlew :directwerk-app:bootRun
```

With `SPRING_PROFILES_ACTIVE=local`, Spring Boot:

- loads `.env` via `spring.config.import`
- auto-starts Compose services if not running
- runs Flyway migrations
- seeds alpha tenants and dev users
- points SMTP at Mailpit

Useful URLs:

| URL | Purpose |
|-----|---------|
| [http://localhost:8080/actuator/health](http://localhost:8080/actuator/health) | Health |
| [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html) | OpenAPI UI |
| [http://127.0.0.1:8025](http://127.0.0.1:8025) | Mailpit |

## Seeded local accounts

| Email | Role | Password env |
|-------|------|--------------|
| `platform-admin@directwerk.local` | Platform admin | `DIRECTWERK_DEV_PLATFORM_ADMIN_PASSWORD` |
| `admin-a@alpha-show.local` | Tenant A admin | `DIRECTWERK_DEV_SEED_PASSWORD` |
| `admin-b@alpha-show.local` | Tenant B admin | `DIRECTWERK_DEV_SEED_PASSWORD` |
| `editor@alpha-show.local` | Tenant A editor | `DIRECTWERK_DEV_SEED_PASSWORD` |

Seeded tenant hosts:

- `alpha-a.localhost` → tenant `alpha-show-a`
- `alpha-b.localhost` → tenant `alpha-show-b`

For non-browser clients, add to `/etc/hosts`:

```text
127.0.0.1 alpha-a.localhost alpha-b.localhost
::1       alpha-a.localhost alpha-b.localhost
```

## Verify email + background jobs

1. Trigger an invite or password-reset flow (Swagger, `directwerk-admin`, or HTTP harness).
2. Open Mailpit UI — message appears with rendered HTML.
3. In `directwerk-admin`, open **Jobs** and filter queue `email`.

See [Email & background jobs](/operators/email-and-jobs) for architecture notes.

## Optional frontends

With the API on `:8080`:

```sh
# Platform admin (port 3001)
cd directwerk-admin && cp .env.local.example .env.local && pnpm dev

# Creator studio (port 3003)
cd directwerk-studio && pnpm dev

# Public / subscriber site (port 3004)
cd directwerk-web && pnpm dev
```

## HTTP API harness

```sh
cd Directwerk/http
cp http-client.private.env.example.json http-client.private.env.json
```

Open `00-index.http` in the JetBrains HTTP Client.

## Build and test without running

```sh
./gradlew test bootJar
```

JAR output: `directwerk-app/build/libs/directwerk-app.jar`.

## Reverse proxy / Host trust

Tenant routing uses `Host` / `getServerName()`. For production behind Coolify or another proxy:

1. Ensure the proxy **overwrites** `Host` (or forwards via standard Forwarded headers).
2. Set `DIRECTWERK_FORWARD_HEADERS_STRATEGY=framework`.
3. Do **not** expose the app port directly when forward-headers is enabled.

Local default keeps `server.forward-headers-strategy=none`. Details: [Multi-tenancy](/architecture/multi-tenancy).

## Related

- [Docker & Coolify](/install/docker-and-coolify)
- [Environment variables](/install/environment-variables)
