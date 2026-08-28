# Directwerk — tenant public site + subscriber portal

Sibling of `directwerk-studio`. Resolves tenant from the request `Host` (with a
localhost fallback to `NEXT_PUBLIC_DIRECTWERK_DEFAULT_TENANT_HOST`).

```sh
pnpm install
cp .env.local.example .env.local   # set OAUTH_CLIENT_SECRET
pnpm dev                           # http://localhost:3004
```

Requires Directwerk API at `DIRECTWERK_API_URL` (default `http://localhost:8080`).

## MVP screens

| Route | Purpose |
|-------|---------|
| `/` | Branded landing from `site-config` |
| `/episodes` | Public / entitled episode catalog |
| `/articles` | Public articles |
| `/pricing` | Public subscription products |
| `/feeds` | Public + private RSS links |
| `/login`, `/register`, … | OAuth2 password-grant auth |
| `/account` | Profile, access, feeds, billing portal |
| `/downloads` | Subscriber bonus files |

`example-fe` remains the two-tenant API harness; this app is the Host-based
reference site.

## Adding a page

See [`../docs/frontend-pages.md`](../docs/frontend-pages.md).

Quick checklist:

1. Add `app/<route>/page.tsx` (server component when possible).
2. Wrap content in `<PageStack className="page-container">` + `<PageHeader>`.
3. Fetch via `lib/api/client.ts` or server helpers in `lib/site/`.
4. Handle loading, error, and empty states.
5. For auth-gated flows, redirect to `/login?returnTo=…` and use `safeReturnTo()`
   after login.

UI tokens and shared components: [`../docs/ui-system.md`](../docs/ui-system.md).

## Verification

```bash
pnpm test
pnpm typecheck
pnpm build
```
