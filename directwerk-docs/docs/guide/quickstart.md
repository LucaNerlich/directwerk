---
title: Quickstart
description: Shortest path from zero to a running Directwerk API locally.
---

# Quickstart

This page summarizes the fastest local setup. For full detail see [Local development](/install/local-development).

## Prerequisites

- **Java 21**
- **Docker** + Compose v2
- **pnpm 12** (optional — for Next.js frontends)

## 1. Start infrastructure

```sh
cd Directwerk
cp .env.example .env
# Set SPRING_DATASOURCE_PASSWORD, DIRECTWERK_PLATFORM_CLIENT_SECRET, DIRECTWERK_TENANT_CLIENT_SECRET
docker compose up -d
```

## 2. Run the API

```sh
./gradlew :directwerk-app:bootRun
```

| URL | Purpose |
|-----|---------|
| [http://localhost:8080/actuator/health](http://localhost:8080/actuator/health) | Health |
| [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html) | OpenAPI UI |
| [http://127.0.0.1:8025](http://127.0.0.1:8025) | Mailpit inbox |

## 3. Seeded tenants

Local profile seeds alpha tenants:

- `alpha-a.localhost` → tenant `alpha-show-a`
- `alpha-b.localhost` → tenant `alpha-show-b`

Add to `/etc/hosts` if needed:

```text
127.0.0.1 alpha-a.localhost alpha-b.localhost
```

Default password: value of `DIRECTWERK_DEV_SEED_PASSWORD` in `.env`.

## 4. Optional frontends

From the repo root:

```sh
pnpm install
cd directwerk-studio && pnpm dev   # :3003
cd directwerk-web && pnpm dev      # :3004
```

## Next

- [Environment variables](/install/environment-variables)
- [Subscriptions & entitlements](/operators/subscriptions-and-entitlements) — how paid content works
- [API integration](/api/integration)
