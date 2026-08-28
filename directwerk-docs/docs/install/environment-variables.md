---
title: Environment variables
description: Reference for Directwerk API configuration — database, OAuth, email, storage, and production.
outline: deep
---

<!-- source: Directwerk/.env.example, Directwerk/docs/build-and-deploy.md -->

# Environment variables

Copy `Directwerk/.env.example` to `Directwerk/.env`. With profile `local`, Spring Boot loads it automatically via `spring.config.import`. Never commit `.env`.

## Runtime profile

| Variable | Default | Notes |
|----------|---------|-------|
| `SPRING_PROFILES_ACTIVE` | *(required)* | `local` \| `stage` \| `prod` \| `docker` |

## Database

| Variable | Default | Notes |
|----------|---------|-------|
| `DIRECTWERK_POSTGRES_PORT` | `5433` | Host port (Compose maps to container 5432) |
| `SPRING_DATASOURCE_USERNAME` | `myuser` | |
| `SPRING_DATASOURCE_PASSWORD` | *(required)* | Used by Compose, Spring, Flyway |
| `SPRING_DATASOURCE_URL` | auto (local) | Override for managed Postgres in prod |

## OAuth2 / JWT

| Variable | Notes |
|----------|-------|
| `DIRECTWERK_ISSUER` | Token issuer URL; HTTPS required in prod |
| `DIRECTWERK_PLATFORM_CLIENT_ID` | Default `directwerk-platform-admin` |
| `DIRECTWERK_TENANT_CLIENT_ID` | Default `directwerk-tenant-frontend` |
| `DIRECTWERK_PLATFORM_CLIENT_SECRET` | Required for local/stage/prod |
| `DIRECTWERK_TENANT_CLIENT_SECRET` | Required for local/stage/prod |
| `DIRECTWERK_JWT_PRIVATE_KEY` | RSA PEM; empty locally → ephemeral keys |
| `DIRECTWERK_JWT_PUBLIC_KEY` | RSA PEM; required in prod |

## Account / dev seeds (local)

| Variable | Purpose |
|----------|---------|
| `DIRECTWERK_DEV_PLATFORM_ADMIN_EMAIL` | Seeded platform admin email |
| `DIRECTWERK_DEV_PLATFORM_ADMIN_PASSWORD` | Platform admin password |
| `DIRECTWERK_DEV_SEED_PASSWORD` | Tenant seed user password |
| `DIRECTWERK_ACCOUNT_EMAIL_VERIFICATION_REQUIRED` | `false` locally for easy testing |
| `DIRECTWERK_BOOTSTRAP_PLATFORM_ADMIN_EMAIL` / `_PASSWORD` | First admin when none exists (docker/stage/prod) |

## Email

| Variable | Default (local) | Notes |
|----------|-----------------|-------|
| `DIRECTWERK_EMAIL_ENABLED` | `true` | |
| `DIRECTWERK_EMAIL_PROVIDER` | `smtp` | `none` skips delivery |
| `DIRECTWERK_EMAIL_FROM` | `noreply@directwerk.local` | Verified sender in prod |
| `DIRECTWERK_EMAIL_STUDIO_BASE_URL` | `http://localhost:3000` | HTTPS in prod |
| `DIRECTWERK_EMAIL_ADMIN_BASE_URL` | `http://localhost:3001` | HTTPS in prod |
| `DIRECTWERK_MAIL_HOST` | `localhost` | Mailpit locally |
| `DIRECTWERK_MAIL_PORT` | `1025` | |

See [Email & background jobs](/operators/email-and-jobs) for queue architecture.

## Object storage

| Variable | Notes |
|----------|-------|
| `DIRECTWERK_STORAGE_ENABLED` | Must be `true` to wire upload APIs; required in prod |
| `DIRECTWERK_STORAGE_PROVIDER` | `bunny` or `hetzner` |
| `DIRECTWERK_STORAGE_REGION` | Bunny region code (`de`, `uk`, …) |
| `DIRECTWERK_STORAGE_BUCKET` | Bucket / zone name |
| `DIRECTWERK_STORAGE_ENDPOINT` | S3-compatible endpoint URL |
| `DIRECTWERK_STORAGE_FORCE_PATH_STYLE` | `true` for Bunny |
| `DIRECTWERK_STORAGE_ACCESS_KEY` / `SECRET_KEY` | S3 credentials |
| `DIRECTWERK_STORAGE_PUBLIC_CDN_BASE_URL` | HTTPS public pull zone |
| `DIRECTWERK_STORAGE_PRIVATE_CDN_BASE_URL` | Optional private pull zone |
| `DIRECTWERK_STORAGE_CDN_TOKEN_AUTH_KEY` | Bunny Token Auth for private CDN |

See [Media upload](/operators/media-upload) and [Asset storage](/architecture/asset-storage).

## Stripe (optional until go-live)

| Variable | Notes |
|----------|-------|
| `STRIPE_SECRET_KEY` | Server-only |
| `STRIPE_PUBLISHABLE_KEY` | Used by studio/web |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `STRIPE_CONNECT_CLIENT_ID` | Connect onboarding |

Without these, money paths return **501** `STRIPE_NOT_IMPLEMENTED`. See [Stripe billing](/architecture/billing-stripe).

## Reverse proxy (prod)

| Variable | Purpose |
|----------|---------|
| `DIRECTWERK_FORWARD_HEADERS_STRATEGY` | Set to `framework` behind Coolify/Traefik |

## Job queue (optional tuning)

| Variable | Purpose |
|----------|---------|
| `DIRECTWERK_QUEUE_WORKER_ID` | Stable worker id per pod when scaling |
| `DIRECTWERK_QUEUE_POLL_INTERVAL_MS` | Poll interval |
| `DIRECTWERK_QUEUE_LEASE_SECONDS` | Job lease duration |

Full annotated template: `Directwerk/.env.example`.
