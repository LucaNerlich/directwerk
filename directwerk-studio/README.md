# Directwerk Studio

Creator dashboard for tenant publishers — articles, podcast, media, subscribers,
and settings.

## Getting started

API and Postgres: [`../Directwerk/docs/build-and-deploy.md`](../Directwerk/docs/build-and-deploy.md).

```bash
pnpm install
cp .env.local.example .env.local   # set OAUTH_CLIENT_SECRET
pnpm dev                           # http://localhost:3003
```

Requires Directwerk API at `DIRECTWERK_API_URL` (default `http://localhost:8080`).

**Shared studio** (e.g. `studio.directwerk.org`): sign in with email/password — workspaces are
discovered from the API; no tenant env vars at deploy time.

**Per-tenant host** (local): use a seeded tenant domain in `/etc/hosts` (see
[`../Directwerk/docs/build-and-deploy.md`](../Directwerk/docs/build-and-deploy.md)) or open the
app on a verified tenant domain.

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
