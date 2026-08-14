# Directwerk publish admin

Next.js 16 application for platform administrator login, tenant listing, and
tenant management. Browser requests use same-origin Next.js Route Handlers;
the Directwerk URL and OAuth client secret stay server-side.

## Getting started

See the Directwerk runbook for Postgres, Mailpit, and API startup:
[`../Directwerk/docs/build-and-deploy.md`](../Directwerk/docs/build-and-deploy.md).

1. Start Directwerk on `http://localhost:8080` with the local profile and seed data.
2. Copy `.env.local.example` to `.env.local` and set the matching OAuth client secret.
3. Install and run the app:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001). The seeded platform account email defaults to
`platform-admin@publish.local` (`DIRECTWERK_DEV_PLATFORM_ADMIN_EMAIL`). Set the password via
`DIRECTWERK_DEV_PLATFORM_ADMIN_PASSWORD` when starting Directwerk (e.g., generate one with
`openssl rand -base64 16`). Tenant seed users continue to use `DIRECTWERK_DEV_SEED_PASSWORD`.

Tokens are kept in `sessionStorage` under `publish_admin_*` keys. This setup is
intended for local development; production deployment requires hardened
server-managed sessions.
Access tokens expire after 15 minutes and are refreshed automatically using the
7-day refresh token. Tokens are tab-scoped — a new browser tab requires signing
in again.

From a tenant detail page you can invite tenant admins, editors, subscribers, and
guests. The platform admins page supports inviting additional platform operators.

The jobs page lists platform queue jobs and supports filtering by queue and status.
After sending an invitation from `/admins` or a tenant page, open `/jobs` and filter
by the `email` queue to inspect the queued or completed mail job.

## Verification

```bash
pnpm test
pnpm build
```
