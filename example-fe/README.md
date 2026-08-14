# Directwerk example frontend

Minimal Next.js subscriber demo for the two seeded Directwerk tenants. The browser
only calls same-origin Next.js Route Handlers; the BFF adds the allow-listed tenant
host and keeps the OAuth client secret on the server.

## Run locally

Start the API first — see [`../Directwerk/docs/build-and-deploy.md`](../Directwerk/docs/build-and-deploy.md)
(Compose Postgres + Mailpit, then `./gradlew :directwerk-app:bootRun`).

1. Start `../Directwerk` with its local profile and seed data.
2. Copy `.env.local.example` to `.env.local`.
3. Set `OAUTH_CLIENT_ID=directwerk-tenant-frontend` and `OAUTH_CLIENT_SECRET` to
   `DIRECTWERK_TENANT_CLIENT_SECRET` from Directwerk’s `.env`.
   Do **not** use `directwerk-platform-admin` here — that client is for `directwerk-admin` only.
4. Install dependencies and start the frontend:

```sh
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The seeded tenants are:

- Tenant A: `alpha-a.localhost` (`alpha-show-a`)
- Tenant B: `alpha-b.localhost` (`alpha-show-b`)

For non-browser clients (such as `curl` or podcast apps on Linux) to resolve `*.localhost`, add to `/etc/hosts` (or run `../Directwerk/scripts/setup-local-hosts.sh`):

```hosts
127.0.0.1 alpha-a.localhost alpha-b.localhost
::1       alpha-a.localhost alpha-b.localhost
```

Select a tenant, register a subscriber, and view `/account`. Switching tenants
clears the current tenant token. Access and refresh tokens are stored in
`sessionStorage` under `example_fe_*` keys for this local demo.

Sessions refresh automatically before the 15-minute access token expires (7-day
refresh token). Tokens are tab-scoped — opening a new tab requires signing in
again. The `/media` page requires an EDITOR or TENANT_ADMIN account (use a
seeded tenant admin/editor, not a subscriber registration).

Published content from **directwerk-studio** is readable here without login:

- `/articles` — public article list + `/articles/[slug]` detail (`GET /api/v1/public/articles`)
- `/episodes` — public series + episode list/detail with FREE audio (`GET /api/v1/public/series|episodes`)
- `/formats` — public formats + categories
- `/feeds` — public RSS URLs (prefer `site-config.publicRssUrl`) + private feeds when signed in
- `/pricing` — public subscription products

Signed-in subscribers also see entitled episode audio (`/me/episodes`), access packages,
subscriptions, and private feed manage actions (enable / rotate token).

Local feed links use `http://{tenant}.localhost:8080/...` (no HTTPS) so they open against
the Directwerk API on your machine.

## Verify

```sh
pnpm test
pnpm build
```
