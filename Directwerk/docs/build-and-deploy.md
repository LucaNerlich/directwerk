# Directwerk — How to run and deploy

This is the authoritative guide for building, running, and deploying the Directwerk Spring Boot API.

The project is a Gradle multi-module build under `projects/directwerk/Directwerk/`. Only `directwerk-app` produces the runnable fat JAR (`directwerk-app.jar`). Other modules are libraries on the classpath.

Related docs:

- [jobs-and-email.md](jobs-and-email.md) — queue handlers, transactional email, scaling workers
- [multi-tenancy.md](multi-tenancy.md) — Host-based tenant routing and isolation
- [media-upload-howto.md](media-upload-howto.md) — upload-url → PUT → confirm → read (2c/2d)
- [`.env.example`](../.env.example) — full environment variable reference

## Prerequisites

| Tool | When needed |
|------|-------------|
| **Java 21** | Host `./gradlew` builds, tests, and `bootRun` |
| **Docker** + **Compose v2** | Local Postgres + Mailpit (recommended); full container stack; image builds |
| **pnpm 12** (optional) | Example Next.js apps under `projects/directwerk/example-*` |
| **`.env` file** | Copy from [`.env.example`](../.env.example); never commit `.env` |

## Project layout (build-relevant)

```text
Directwerk/
├── Dockerfile                 # multi-stage production image
├── compose.yaml               # Postgres + Mailpit; optional app via profile `stack`
├── .env.example               # env template (secrets stay in `.env`)
├── scripts/                   # optional host-Postgres bootstrap SQL
├── http/                      # JetBrains HTTP Client API harness
├── directwerk-app/            # Spring Boot entrypoint, Flyway, security, controllers
├── directwerk-common/         # shared config / ports
├── directwerk-core/           # domain (tenants, users, invites, …)
├── directwerk-queue/          # Postgres job queue + Quartz worker
├── directwerk-email/          # transactional email (queue consumer → SMTP)
├── directwerk-webhook/        # outbound webhook job stub (future HTTP delivery)
├── directwerk-subscription/   # subscription products / entitlements slice
├── directwerk-digital/        # MediaAsset + S3 upload/presign (2c/2d)
└── directwerk-podcast/        # series, episodes, formats (Formate) — Phase 3
```

Frontends (separate Node apps, not in this Gradle build):

| App | Port | Role |
|-----|------|------|
| [`example-fe`](../../example-fe) | 3000 | Subscriber / tenant demo |
| [`directwerk-admin`](../../directwerk-admin) | 3001 | Platform admin (tenants, invites, job queue UI) |
| [`directwerk-studio`](../../directwerk-studio) | 3003 | Creator studio |
| [`directwerk-web`](../../directwerk-web) | 3004 | Public site and subscriber portal |

---

## 1. Local development (JVM on host)

Preferred workflow for day-to-day API work: Compose for infrastructure, Gradle for the app.

### 1.1 Configure environment

```sh
cd projects/directwerk/Directwerk
cp .env.example .env
```

Set at least:

```env
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
| `DIRECTWERK_POSTGRES_PORT` | `5433` | Host port for Postgres (avoids clash with local `5432`) |
| `DIRECTWERK_MAILPIT_SMTP_PORT` | `1025` | Mailpit SMTP on loopback |
| `DIRECTWERK_MAILPIT_UI_PORT` | `8025` | Mailpit web UI on loopback |
| `DIRECTWERK_APP_PORT` | `8080` | Used when publishing the app container |

### 1.2 Start Postgres + Mailpit

```sh
docker compose up -d
```

| Service | Host access | Notes |
|---------|-------------|-------|
| **postgres** | `localhost:5433` → container `5432` | DB `mydatabase`, user `myuser`, password from `.env` |
| **mailpit SMTP** | `127.0.0.1:1025` | App sends mail here (`DIRECTWERK_MAIL_*`) |
| **mailpit UI** | [http://127.0.0.1:8025](http://127.0.0.1:8025) | Search/capture outbound email; bound to loopback only |

Compose does **not** start the Directwerk app unless you use the `stack` profile (see [§3](#3-full-stack-in-docker-compose)).

Check containers:

```sh
docker compose ps
```

### 1.3 Run the API on the host

```sh
./gradlew :directwerk-app:bootRun
```

With `SPRING_PROFILES_ACTIVE=local` (default in `.env.example`), Spring Boot:

- loads `.env` via `spring.config.import` in `application-local.yaml`
- auto-starts Compose services if they are not already running (`spring.docker.compose.enabled=true`)
- runs Flyway schema migrations (`classpath:db/migration`)
- seeds alpha tenants via `LocalDevSeedRunner` (`db/seed/alpha_dev_seed.sql`), then platform and tenant users via `DevDataInitializer`
- points SMTP at Mailpit (`localhost:1025`)

Useful URLs after startup:

| URL | Purpose |
|-----|---------|
| [http://localhost:8080/actuator/health](http://localhost:8080/actuator/health) | Health |
| [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html) | OpenAPI UI (local / docker / stage) |
| [http://127.0.0.1:8025](http://127.0.0.1:8025) | Mailpit inbox |

### 1.4 Seeded local accounts

Created on first `local` startup (passwords from `.env`):

| Email | Role | Password env |
|-------|------|--------------|
| `platform-admin@directwerk.local` (or `DIRECTWERK_DEV_PLATFORM_ADMIN_EMAIL`) | Platform admin | `DIRECTWERK_DEV_PLATFORM_ADMIN_PASSWORD` |
| `admin-a@alpha-show.local` | Tenant A admin | `DIRECTWERK_DEV_SEED_PASSWORD` |
| `admin-b@alpha-show.local` | Tenant B admin | `DIRECTWERK_DEV_SEED_PASSWORD` |
| `editor@alpha-show.local` | Tenant A editor | `DIRECTWERK_DEV_SEED_PASSWORD` |

Seeded tenant hosts (for multi-tenant demos / `example-fe`):

- `alpha-a.localhost` → tenant `alpha-show-a`
- `alpha-b.localhost` → tenant `alpha-show-b`

For non-browser clients (such as `curl` or podcast apps on Linux) to resolve `*.localhost`, add to `/etc/hosts` or run `./scripts/setup-local-hosts.sh`:

```hosts
127.0.0.1 alpha-a.localhost alpha-b.localhost
::1       alpha-a.localhost alpha-b.localhost
```

Local profile disables required email verification and may expose invite/reset tokens in API responses for easier testing (`expose-dev-tokens`). Never enable that in production.

### 1.5 Verify email + background jobs

1. Trigger an invite or password-reset flow (HTTP harness, Swagger, or `directwerk-admin`).
2. Open Mailpit UI → message appears with rendered HTML.
3. In `directwerk-admin`, open **Jobs** and filter queue `email` to see queued / completed jobs.

Architecture notes: [jobs-and-email.md](jobs-and-email.md).

### 1.6 Optional: frontends

With the API running on `:8080`:

```sh
# Platform admin (port 3001)
cd ../directwerk-admin
cp .env.local.example .env.local
# set OAuth secret = DIRECTWERK_PLATFORM_CLIENT_SECRET
pnpm install && pnpm dev

# Subscriber / tenant frontend (port 3000)
cd ../example-fe
cp .env.local.example .env.local
# set OAUTH_CLIENT_ID=directwerk-tenant-frontend
# set OAUTH_CLIENT_SECRET=DIRECTWERK_TENANT_CLIENT_SECRET
pnpm install && pnpm dev
```

Email link bases default to these ports (`DIRECTWERK_EMAIL_STUDIO_BASE_URL=http://localhost:3000`, `DIRECTWERK_EMAIL_ADMIN_BASE_URL=http://localhost:3001`).

### 1.7 Optional: HTTP API harness

```sh
cd http
cp http-client.private.env.example.json http-client.private.env.json
# fill passwords + client secrets to match Directwerk/.env
```

Open `00-index.http` in the JetBrains HTTP Client and run files in order.

### 1.8 Optional: host Postgres without Compose

If you already run PostgreSQL 18/19 on the host:

```sh
set -a && source .env && set +a
psql -U postgres -f scripts/setup-local-database.sql
# then either docker compose up -d mailpit   # mail only
# or point DIRECTWERK_MAIL_* at another SMTP catcher
./gradlew :directwerk-app:bootRun
```

Align `DIRECTWERK_POSTGRES_PORT` / `SPRING_DATASOURCE_URL` with your instance.

### 1.9 Build and test without running

```sh
./gradlew test bootJar
```

JAR output: `directwerk-app/build/libs/directwerk-app.jar`.

### 1.10 Reverse proxy / Host trust (multi-tenancy)

Tenant routing uses `Host` / `getServerName()`. For production behind Coolify or another proxy:

1. Ensure the proxy **overwrites** `Host` (or forwards via standard Forwarded headers).
2. Set `DIRECTWERK_FORWARD_HEADERS_STRATEGY=framework` so Spring applies forwarded headers.
3. Do **not** expose the app port directly to the internet when forward-headers is enabled.
4. Optionally configure `directwerk.security.trusted-proxies` for rate-limit client IP extraction.

Local default keeps `server.forward-headers-strategy=none`. Details: [multi-tenancy.md](multi-tenancy.md).

---

## 2. Build the Docker image

Build context is **`projects/directwerk/Directwerk/`** (the directory containing `Dockerfile`).

```sh
cd projects/directwerk/Directwerk
docker build -t directwerk:local .
```

The Dockerfile:

1. **Build stage** — `./gradlew :directwerk-app:bootJar -x test` on JDK 21 Alpine (copies all Gradle modules including `directwerk-webhook`)
2. **Runtime stage** — JRE 21 Alpine, non-root user `directwerk`, port `8080`, health check `/actuator/health` (90s start period)

Registry example:

```sh
docker build -t registry.example.com/directwerk:$(git rev-parse --short HEAD) .
docker push registry.example.com/directwerk:$(git rev-parse --short HEAD)
```

---

## 3. Full stack in Docker Compose

Run **Postgres + Mailpit + Directwerk** entirely in containers with the Compose `stack` profile:

```sh
cd projects/directwerk/Directwerk
cp .env.example .env   # secrets required — see below
docker compose --profile stack up --build
```

Stop the stack (API stops before Postgres/Mailpit via `depends_on` reverse order; **Postgres data is kept** in the `postgres_data` volume):

```sh
docker compose --profile stack down
```

Always pass `--profile stack` on `down` if you started with it. Plain `docker compose down` stops only Postgres/Mailpit and leaves the app container holding `directwerk_default` (“Network … still in use”). Optional: set `COMPOSE_PROFILES=stack` in `.env` so bare `up`/`down` include the app.

The `docker` profile uses a short graceful-shutdown window and does not wait for in-flight Quartz jobs, so Compose teardown does not hang on DB/SMTP connections. Use `down -v` only when you intentionally want a fresh database.

| Service | Host access | Notes |
|---------|-------------|-------|
| **directwerk** | [http://localhost:8080](http://localhost:8080) | Override with `DIRECTWERK_APP_PORT` |
| **postgres** | `localhost:5433` | Same credentials as local host-dev |
| **mailpit UI** | [http://127.0.0.1:8025](http://127.0.0.1:8025) | Captured outbound email |

The app container forces Spring profile **`docker`** (`application-docker.yaml`):

- JDBC URL `jdbc:postgresql://postgres:5432/mydatabase`
- SMTP host `mailpit:1025` (no auth / no STARTTLS)
- Compose auto-start **disabled** (infra is already in the same compose file)
- Runs `LocalDevSeedRunner` (`db/seed/alpha_dev_seed.sql`) then `DevDataInitializer`
  (same alpha tenants / users as host `local` — set `DIRECTWERK_DEV_SEED_PASSWORD`
  and optionally `DIRECTWERK_DEV_PLATFORM_ADMIN_*` in `.env`)
- Email verification off and `expose-dev-tokens` on by default (override via env for stricter local stack)

### Minimum `.env` for the stack profile

```env
SPRING_DATASOURCE_PASSWORD=your-local-db-password
DIRECTWERK_PLATFORM_CLIENT_SECRET=your-platform-client-secret
DIRECTWERK_TENANT_CLIENT_SECRET=your-tenant-client-secret
DIRECTWERK_EMAIL_FROM=noreply@directwerk.local
DIRECTWERK_EMAIL_STUDIO_BASE_URL=http://localhost:3000
DIRECTWERK_EMAIL_ADMIN_BASE_URL=http://localhost:3001
DIRECTWERK_DEV_SEED_PASSWORD=ChangeMe-Dev-Seed!
DIRECTWERK_DEV_PLATFORM_ADMIN_PASSWORD=ChangeMe-Dev-Seed!
```

JWT keys may stay empty under `docker` (ephemeral keys). For stable tokens across restarts, set `DIRECTWERK_JWT_PRIVATE_KEY` and `DIRECTWERK_JWT_PUBLIC_KEY`.

Optional first platform admin (any profile, including `docker` / `prod`):

```env
DIRECTWERK_BOOTSTRAP_PLATFORM_ADMIN_EMAIL=admin@example.com
DIRECTWERK_BOOTSTRAP_PLATFORM_ADMIN_PASSWORD='Strong-Password-Here'
```

Both must be set together; password must satisfy `PasswordPolicy`. Bootstrap runs only when no platform admin exists yet.

Stop (keeps Postgres + Mailpit data volumes):

```sh
docker compose --profile stack down
```

Wipe DB and Mailpit storage (destructive):

```sh
docker compose --profile stack down -v
```

---

## 4. Production (and stage) deployment

Production uses the **same Docker image** with `SPRING_PROFILES_ACTIVE=prod` (or `stage`) and **external managed PostgreSQL**. Do **not** run Compose Postgres or Mailpit in production.

### Required environment variables

Validated at startup by `ProdSecurityPropertiesValidator`, `ProdEmailPropertiesValidator`, and
`ProdStoragePropertiesValidator` when profile is `prod`:

| Variable | Required | Notes |
|----------|----------|-------|
| `SPRING_PROFILES_ACTIVE` | yes | `prod` or `stage` |
| `SPRING_DATASOURCE_URL` | yes | e.g. `jdbc:postgresql://db.internal:5432/directwerk` |
| `SPRING_DATASOURCE_USERNAME` | yes | Database user |
| `SPRING_DATASOURCE_PASSWORD` | yes | Database password |
| `DIRECTWERK_ISSUER` | yes (prod) | Public **HTTPS** issuer URL, e.g. `https://api.example.com` |
| `DIRECTWERK_PLATFORM_CLIENT_SECRET` | yes | OAuth2 platform client secret |
| `DIRECTWERK_TENANT_CLIENT_SECRET` | yes | OAuth2 tenant client secret |
| `DIRECTWERK_JWT_PRIVATE_KEY` | yes (prod) | RSA private key PEM |
| `DIRECTWERK_JWT_PUBLIC_KEY` | yes (prod) | RSA public key PEM |
| `DIRECTWERK_EMAIL_PROVIDER` | if email enabled | `smtp` (default) or `none`. HTTP ESPs are not wired yet. |
| `DIRECTWERK_EMAIL_FROM` | if email enabled | Verified sender address |
| `DIRECTWERK_EMAIL_STUDIO_BASE_URL` | if email enabled | Absolute **HTTPS** studio URL |
| `DIRECTWERK_EMAIL_ADMIN_BASE_URL` | if email enabled | Absolute **HTTPS** admin URL |
| `DIRECTWERK_STORAGE_ENABLED` | yes (prod) | Must be `true` |
| `DIRECTWERK_STORAGE_BUCKET` | yes (prod) | Object-storage bucket |
| `DIRECTWERK_STORAGE_PUBLIC_CDN_BASE_URL` | yes (prod) | Absolute **HTTPS** public pull-zone URL |

Also set real SMTP for Mailgun (or equivalent):

```env
DIRECTWERK_MAIL_HOST=smtp.mailgun.org
DIRECTWERK_MAIL_PORT=587
DIRECTWERK_MAIL_USERNAME=postmaster@mg.example.com
DIRECTWERK_MAIL_PASSWORD=***
DIRECTWERK_MAIL_SMTP_AUTH=true
DIRECTWERK_MAIL_SMTP_STARTTLS=true
```

To disable outbound email entirely: `DIRECTWERK_EMAIL_ENABLED=false` or `DIRECTWERK_EMAIL_PROVIDER=none` (skips email property validation).

Optional but recommended in prod:

| Variable | Purpose |
|----------|---------|
| `DIRECTWERK_BOOTSTRAP_PLATFORM_ADMIN_EMAIL` / `_PASSWORD` | Create the first platform admin when none exists |
| `DIRECTWERK_FORWARD_HEADERS_STRATEGY=framework` | Behind a trusted reverse proxy |
| `DIRECTWERK_QUEUE_WORKER_ID` | Stable worker id per pod when scaling horizontally |
| `DIRECTWERK_QUEUE_*` | Tune poll/lease/retention — see `application.yaml` / [jobs-and-email.md](jobs-and-email.md) |

**Must stay false in prod:** `DIRECTWERK_ACCOUNT_EXPOSE_DEV_TOKENS` (validator refuses startup if true).

Full list: [`.env.example`](../.env.example).

### Example: run the prod image manually

```sh
docker run --rm -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://db.example.com:5432/directwerk \
  -e SPRING_DATASOURCE_USERNAME=directwerk \
  -e SPRING_DATASOURCE_PASSWORD='***' \
  -e DIRECTWERK_ISSUER=https://api.example.com \
  -e DIRECTWERK_PLATFORM_CLIENT_SECRET='***' \
  -e DIRECTWERK_TENANT_CLIENT_SECRET='***' \
  -e DIRECTWERK_JWT_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----...' \
  -e DIRECTWERK_JWT_PUBLIC_KEY='-----BEGIN PUBLIC KEY-----...' \
  -e DIRECTWERK_EMAIL_FROM=noreply@example.com \
  -e DIRECTWERK_EMAIL_STUDIO_BASE_URL=https://studio.example.com \
  -e DIRECTWERK_EMAIL_ADMIN_BASE_URL=https://admin.example.com \
  -e DIRECTWERK_MAIL_HOST=smtp.mailgun.org \
  -e DIRECTWERK_MAIL_PORT=587 \
  -e DIRECTWERK_MAIL_USERNAME=postmaster@mg.example.com \
  -e DIRECTWERK_MAIL_PASSWORD='***' \
  -e DIRECTWERK_MAIL_SMTP_AUTH=true \
  -e DIRECTWERK_MAIL_SMTP_STARTTLS=true \
  -e DIRECTWERK_FORWARD_HEADERS_STRATEGY=framework \
  directwerk:local
```

### Deploying with Coolify / Hetzner

This monorepo deploys other services via [Coolify](https://coolify.io) on Hetzner Cloud (see repo `deployment/`). For Directwerk:

1. Create a **Dockerfile** application in Coolify.
2. Set **build context** to `projects/directwerk/Directwerk`.
3. Set **Dockerfile** to `Dockerfile`.
4. Configure the environment variables above as Coolify secrets.
5. Attach managed **PostgreSQL 18+**; point `SPRING_DATASOURCE_*` at it.
6. Expose port **8080**; terminate TLS at the reverse proxy; set `DIRECTWERK_FORWARD_HEADERS_STRATEGY=framework` when the proxy overwrites `Host` / Forwarded headers.
7. Health check path: `/actuator/health` (allow ~90s on cold start with migrations).
8. Scale horizontally as needed — Quartz is clustered (`isClustered: true`); set a distinct `DIRECTWERK_QUEUE_WORKER_ID` per instance if you want predictable worker names in the admin UI.

Flyway runs automatically on startup (`spring.flyway.enabled=true`, `ddl-auto: validate`). Migrations include the jobs queue, email delivery tables, OAuth2 authorization store (V16), and Quartz JDBC tables (V17), through the latest `V*` scripts under `directwerk-app/src/main/resources/db/migration/`.

---

## 5. Spring profiles summary

| Profile | Use case | Compose auto-start | Local seed / DevData | Swagger |
|---------|----------|--------------------|----------------------|---------|
| `local` | Host `./gradlew bootRun` | Yes | Yes | Enabled |
| `docker` | App in Compose `stack` profile | No | Yes (same as `local`) | Enabled |
| `stage` | Pre-production | No | No | Enabled |
| `prod` | Production | No | No | Disabled |
| `test` | Vitest/JUnit only | No | No | n/a |

`SPRING_PROFILES_ACTIVE` has **no default** in base `application.yaml` — set it explicitly (`.env`, Compose, or Coolify).

---

## 6. Troubleshooting

### App exits immediately in prod

Check logs for `ProdSecurityPropertiesValidator`, `ProdEmailPropertiesValidator`, or `ProdStoragePropertiesValidator` — missing HTTPS issuer, JWT PEMs, client secrets, email base URLs when email is enabled, or object storage / public CDN settings.

### Flyway migration failure on first start

Ensure Postgres is reachable and the DB user can create tables. The app expects an empty or already-migrated schema; it does not use `ddl-auto: create`.

### Flyway validate fails with `alpha dev seed`

Older local/docker runs recorded `R__alpha_dev_seed.sql` in `flyway_schema_history`. The seed is no longer a Flyway migration (it runs from `LocalDevSeedRunner` after schema migrate). Startup ignores missing repeatables; `./gradlew :directwerk-app:flywayMigrate` does too.

If a **failed** seed row still blocks startup (`Detected failed migration`):

```sql
DELETE FROM flyway_schema_history WHERE script = 'R__alpha_dev_seed.sql';
```

### OAuth / JWT errors after container restart (`docker` / `local` without PEMs)

Ephemeral JWT keys rotate on each restart unless `DIRECTWERK_JWT_*` PEM keys are set. Persist keys for stable tokens.

### Health check failing

Startup runs Flyway (and may seed local data). Cold databases can take up to ~90 seconds. Dockerfile and Compose health checks allow a 90-second start period.

### Mail not appearing locally

1. Confirm Mailpit is up: `docker compose ps` and open [http://127.0.0.1:8025](http://127.0.0.1:8025).
2. Confirm `DIRECTWERK_MAIL_HOST=localhost` and port `1025` (or Compose service name `mailpit` inside the `stack` profile).
3. Confirm `DIRECTWERK_EMAIL_ENABLED=true`.
4. Check the jobs table / `directwerk-admin` Jobs page — failed sends show on the `email` queue.

### Build fails in Docker

Build context must be `projects/directwerk/Directwerk` (not the monorepo root). The Dockerfile copies every Gradle subproject listed in `settings.gradle`.

### Port already in use

Change `DIRECTWERK_POSTGRES_PORT`, `DIRECTWERK_MAILPIT_*_PORT`, or `DIRECTWERK_APP_PORT` / `SERVER_PORT` in `.env`.

---

## 7. Related commands

```sh
# Tests (CI-equivalent for this module)
./gradlew test

# Flyway CLI against local Postgres (optional; app also migrates on startup)
set -a && source .env && set +a
./gradlew :directwerk-app:flywayMigrate

# Build JAR only (no Docker)
./gradlew :directwerk-app:bootJar

# Infra only
docker compose up -d

# Full containerized stack
docker compose --profile stack up --build
```
