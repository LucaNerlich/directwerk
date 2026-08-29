# Directwerk — Local API setup & HTTP harness

Companion to [`platform-design.md`](platform-design.md). The alpha POC (tenancy, auth, modules,
storage, podcast, RSS, entitlements) is **shipped** — use this doc for **local API setup** and
**manual HTTP test order**, not as a greenfield backlog.

| Document | Purpose |
|----------|---------|
| [`Directwerk/docs/build-and-deploy.md`](../Directwerk/docs/build-and-deploy.md) | Authoritative run/deploy guide |
| [`platform-design.md`](platform-design.md) | Full product design spec |
| [`user-backend-implementation.md`](user-backend-implementation.md) | Auth, roles, `/me` |
| [`asset-storage.md`](asset-storage.md) | S3, upload/confirm, entitlements |
| [`Directwerk/http/`](../Directwerk/http/) | JetBrains HTTP Client harness |
| [`Directwerk/bruno/`](../Directwerk/bruno/) | Bruno collection — keep in sync with controllers |

**Status (2026-08):** Phases A–G shipped (backend, studio, web, RSS, entitlements, Stripe scaffold).
Remaining: live billing in prod, Patreon/Steady dual-run, subscriber email notifications.

---

## Quick start

```sh
cd Directwerk
cp .env.example .env
docker compose up -d
./gradlew :directwerk-app:bootRun
```

| Service | URL |
|---------|-----|
| API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| Actuator | http://localhost:8080/actuator/health |
| Mailpit | http://127.0.0.1:8025 |

Full detail: [`Directwerk/docs/build-and-deploy.md`](../Directwerk/docs/build-and-deploy.md).

S3 is not in Docker. Set `S3_*` in `.env` for upload tests — see
[`asset-storage.md`](asset-storage.md) and [`Directwerk/docs/media-upload-howto.md`](../Directwerk/docs/media-upload-howto.md).

### Dev tenant hosts

Map seeded tenants in `/etc/hosts` (or use JetBrains `Host` header):

```hosts
127.0.0.1 alpha-a.localhost alpha-b.localhost
```

| Tenant slug | Domain | Notes |
|-------------|--------|-------|
| `alpha-show-a` | `alpha-a.localhost` | Primary test tenant |
| `alpha-show-b` | `alpha-b.localhost` | Cross-tenant isolation tests |

Platform admin uses the API host directly (`localhost:8080`) — no tenant `Host` header.

### Seed accounts

From Flyway `R__alpha_dev_seed.sql` (passwords match `Directwerk/.env.example`):

| Role | Email | Password (default) |
|------|-------|------------------|
| Platform admin | `platform-admin@directwerk.local` | `ChangeMe-Platform-Admin!` |
| Tenant A admin | `admin-a@alpha-show.local` | `ChangeMe-Tenant-Admin!` |
| Tenant B admin | `admin-b@alpha-show.local` | `ChangeMe-Tenant-Admin!` |
| Tenant A editor | `editor@alpha-show.local` | `ChangeMe-Editor!` |

Register subscribers via `03-auth.http` or studio/web UI.

---

## HTTP harness

Manual API regression tests live in [`Directwerk/http/`](../Directwerk/http/).

**Index:** [`00-index.http`](../Directwerk/http/00-index.http) — canonical file order and credentials.

Copy [`http-client.private.env.example.json`](../Directwerk/http/http-client.private.env.example.json)
→ `http-client.private.env.json` and match `Directwerk/.env` secrets.

### Key scenario files

| File | Covers |
|------|--------|
| `01-health.http` | Actuator smoke |
| `02-oauth2.http` | Token endpoint |
| `03-auth.http` | Register, login, password reset |
| `06-platform-tenants.http` | Tenant CRUD |
| `15-multi-tenant-isolation.http` | Cross-tenant denial |
| `17-media-upload.http` | Pre-signed upload + confirm |
| `19-podcast-content.http` | Series, episodes, publish |
| `20-episode-stream.http` | Entitled episode stream |
| `21-public-rss.http` | Public RSS (run before 22) |
| `22-private-rss.http` | Private subscriber RSS |
| `23-entitlements.http` | LEVEL/PACKAGE rules |
| `26-stripe-billing.http` | Stripe Connect (needs `STRIPE_*` keys) |
| `27-custom-feeds.http` | Feed builder |

### Running tests

1. Open `Directwerk/http/` in IntelliJ IDEA or WebStorm
2. Select environment **`dev`** in the HTTP Client gutter
3. Run files in the order listed in `00-index.http`
4. Do not run `21-public-rss.http` and `22-private-rss.http` concurrently against the same tenant

Scripts chain tokens via `> {% client.global.set("...", ...); %}` response handlers.

---

## What's next

| Track | Doc |
|-------|-----|
| Live Stripe billing | [`payment.md`](payment.md) |
| Patreon/Steady dual-run | [`patreon-steady-integration.md`](patreon-steady-integration.md) |
| Studio / web polish | [`directwerk-studio-implementation.md`](directwerk-studio-implementation.md) |
| Subscriber email on publish | Post-MVP — [`content-platform-strategy.md`](content-platform-strategy.md) |

---

*Last updated: 2026-08*
