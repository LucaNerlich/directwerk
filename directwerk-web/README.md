# Directwerk — tenant public site + subscriber portal
#
# Sibling of directwerk-studio. Resolves tenant from the request Host (with a
# localhost fallback to NEXT_PUBLIC_DIRECTWERK_DEFAULT_TENANT_HOST).

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
| `/pricing` | Public subscription products (read-only) |
| `/feeds` | Public + private RSS links |
| `/login`, `/register`, … | OAuth2 password-grant auth |
| `/account` | `/me` + `/me/access` portal shell |

`example-fe` remains the two-tenant API harness; this app is the Host-based reference site.
