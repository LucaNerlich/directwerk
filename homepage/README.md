# Homepage

Platform marketing site for **Directwerk** (`directwerk.de`) — separate from tenant
[`directwerk-web`](../directwerk-web/) subscriber portals.

## Run locally

```bash
cd homepage
pnpm install
pnpm dev
```

Open [http://localhost:3005](http://localhost:3005) (port **3005** avoids conflict with
`directwerk-studio` on 3002).

## Routes

| Path | Purpose |
|------|---------|
| `/` | Platform landing — features, product stack, creator journey, contact form |
| `/developers` | API excerpt for integrators — links to full VitePress docs |

## Optional env

Copy [`.env.local.example`](.env.local.example) to `.env.local`.

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Directwerk API for contact form + ALTCHA (default `http://localhost:8080`) |
| `NEXT_PUBLIC_DOCS_URL` | Public VitePress docs (default `http://localhost:5173`) |
| `NEXT_PUBLIC_SWAGGER_URL` | External link to staging Swagger UI on `/developers` |

## Stack

Next.js 16 · React 19 · Tailwind v4 · `@directwerk/ui`

```bash
pnpm test
pnpm typecheck
pnpm build
```
