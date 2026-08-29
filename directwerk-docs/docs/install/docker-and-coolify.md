---
title: Docker & Coolify
description: Build the API Docker image, run the full Compose stack, and deploy to Coolify on Hetzner.
outline: deep
---

<!-- source: Directwerk/docs/build-and-deploy.md §2–5 -->

# Docker & Coolify

## Build the Docker image

Build context is **`Directwerk/`** (the directory containing `Dockerfile`).

```sh
cd Directwerk
docker build -t directwerk:local .
```

The Dockerfile:

1. **Build stage** — `./gradlew :directwerk-app:bootJar -x test` on JDK 21 Alpine
2. **Runtime stage** — JRE 21 Alpine, non-root user, port `8080`, health check `/actuator/health` (90s start period)

## Full stack in Docker Compose

Run **Postgres + Mailpit + Directwerk** with the `stack` profile:

```sh
cd Directwerk
cp .env.example .env
docker compose --profile stack up --build
```

Stop (keeps Postgres data):

```sh
docker compose --profile stack down
```

| Service | Host access |
|---------|-------------|
| **directwerk** | [http://localhost:8080](http://localhost:8080) |
| **postgres** | `localhost:5433` |
| **mailpit UI** | [http://127.0.0.1:8025](http://127.0.0.1:8025) |

Minimum `.env` for the stack profile:

```ini
SPRING_DATASOURCE_PASSWORD=your-local-db-password
DIRECTWERK_PLATFORM_CLIENT_SECRET=your-platform-client-secret
DIRECTWERK_TENANT_CLIENT_SECRET=your-tenant-client-secret
DIRECTWERK_EMAIL_FROM=noreply@directwerk.local
DIRECTWERK_EMAIL_STUDIO_BASE_URL=http://localhost:3004
DIRECTWERK_EMAIL_ADMIN_BASE_URL=http://localhost:3001
DIRECTWERK_DEV_SEED_PASSWORD=ChangeMe-Dev-Seed!
DIRECTWERK_DEV_PLATFORM_ADMIN_PASSWORD=ChangeMe-Dev-Seed!
```

## Production deployment

Production uses the **same Docker image** with `SPRING_PROFILES_ACTIVE=prod` and **external managed PostgreSQL**. Do **not** run Compose Postgres or Mailpit in production.

### Required environment variables (prod)

| Variable | Required | Notes |
|----------|----------|-------|
| `SPRING_PROFILES_ACTIVE` | yes | `prod` or `stage` |
| `SPRING_DATASOURCE_URL` | yes | Managed Postgres JDBC URL |
| `SPRING_DATASOURCE_USERNAME` / `PASSWORD` | yes | Database credentials |
| `DIRECTWERK_ISSUER` | yes (prod) | Public **HTTPS** issuer URL |
| `DIRECTWERK_PLATFORM_CLIENT_SECRET` | yes | OAuth2 platform client secret |
| `DIRECTWERK_TENANT_CLIENT_SECRET` | yes | OAuth2 tenant client secret |
| `DIRECTWERK_JWT_PRIVATE_KEY` / `PUBLIC_KEY` | yes (prod) | RSA PEM keys |
| `DIRECTWERK_STORAGE_ENABLED` | yes (prod) | Must be `true` |
| `DIRECTWERK_STORAGE_BUCKET` | yes (prod) | Object-storage bucket |
| `DIRECTWERK_STORAGE_PUBLIC_CDN_BASE_URL` | yes (prod) | HTTPS public CDN URL |

Email and SMTP variables are required when email is enabled. Full list: [Environment variables](/install/environment-variables).

**Must stay false in prod:** `DIRECTWERK_ACCOUNT_EXPOSE_DEV_TOKENS`.

## Deploying with Coolify / Hetzner

1. Create a **Dockerfile** application in Coolify.
2. Set **build context** to `Directwerk`.
3. Set **Dockerfile** to `Dockerfile`.
4. Configure environment variables as Coolify secrets.
5. Attach managed **PostgreSQL 18+**.
6. Expose port **8080**; terminate TLS at the reverse proxy.
7. Set `DIRECTWERK_FORWARD_HEADERS_STRATEGY=framework` when the proxy overwrites `Host`.
8. Health check: `/actuator/health` (allow ~90s on cold start with migrations).
9. Scale horizontally as needed — set distinct `DIRECTWERK_QUEUE_WORKER_ID` per instance.

Flyway runs automatically on startup.

## Deploying this docs site on Coolify

The **directwerk-docs** static site has its own Dockerfile at `directwerk-docs/Dockerfile`:

| Setting | Value |
|---------|-------|
| Build context | Monorepo root |
| Dockerfile path | `directwerk-docs/Dockerfile` |
| Port | 80 |
| Health check | `GET /` |

See [directwerk-docs/README.md](/directwerk-docs/README.md) in the repo for build commands.

## Troubleshooting

### App exits immediately in prod

Check logs for `ProdSecurityPropertiesValidator`, `ProdEmailPropertiesValidator`, or `ProdStoragePropertiesValidator`.

### Flyway migration failure

Ensure Postgres is reachable and the DB user can create tables.

### Health check failing

Cold databases can take up to ~90 seconds during first startup with migrations.

### Build fails in Docker

Build context must be `Directwerk` (not the monorepo root for the API image).

## Related

- [Local development](/install/local-development)
- [Multi-tenancy](/architecture/multi-tenancy) — Host header and proxy setup
