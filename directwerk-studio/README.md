# Directwerk Studio

Creator dashboard for tenant publishers — articles, podcast, media, subscribers,
and settings on the tenant's domain.

## Getting started

API and Postgres: [`../Directwerk/docs/build-and-deploy.md`](../Directwerk/docs/build-and-deploy.md).

```bash
pnpm install
cp .env.local.example .env.local   # set OAUTH_CLIENT_SECRET
pnpm dev                           # http://localhost:3003
```

Requires Directwerk API at `DIRECTWERK_API_URL` (default `http://localhost:8080`).

Open a seeded tenant host (e.g. via `/etc/hosts` or `NEXT_PUBLIC_DIRECTWERK_DEFAULT_TENANT_HOST`).

## Desks

- **Write** — `/write`, `/write/articles`
- **Podcast** — `/podcast`, `/podcast/episodes`
- **Manage** — products, categories, subscribers (`SUBSCRIPTION` module)
- **Settings** — branding, domains, team

See [`../docs/directwerk-studio.md`](../docs/directwerk-studio.md) for product scope.

## Adding a page

Follow [`../docs/frontend-pages.md`](../docs/frontend-pages.md). Studio routes
live under `app/(studio)/`. Use `PageStack`, `PageHeader`, and shared list
components from `@directwerk/ui`.

## Verification

```bash
pnpm test
pnpm typecheck
pnpm build
```
