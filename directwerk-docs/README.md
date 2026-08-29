# directwerk-docs

Public documentation site for [Directwerk](https://directwerk.de) — built with [VitePress 2](https://vitepress.dev/).

Root [`docs/`](../docs/) and [`Directwerk/docs/`](../Directwerk/docs/) remain **internal/agent source**. This site curates public-facing pages.

## Development

Requires **Node.js 22+**.

```sh
# From repo root
pnpm install
pnpm --filter directwerk-docs dev
```

Opens at [http://localhost:5173](http://localhost:5173).

## Build

```sh
pnpm --filter directwerk-docs build
pnpm --filter directwerk-docs preview   # local preview on :4173
pnpm --filter directwerk-docs start     # production serve (0.0.0.0, respects $PORT)
```

Output: `directwerk-docs/docs/.vitepress/dist/`

## OpenAPI spec

The interactive API reference is generated from **springdoc** — Spring Boot introspects your controllers at runtime and produces `/v3/api-docs`. VitePress cannot read Java sources directly; export the JSON before building docs:

```sh
# Recommended — boots test context, no manual server (from repo root)
./Directwerk/gradlew :directwerk-app:exportOpenApi

# Or via docs package script (same Gradle task)
pnpm --filter directwerk-docs export-openapi

# Alternative — curl a running API instance
pnpm --filter directwerk-docs export-openapi -- --curl
# DIRECTWERK_API_URL=https://api.example.com pnpm --filter directwerk-docs export-openapi -- --curl
```

Then rebuild the docs site:

```sh
pnpm --filter directwerk-docs build
```

## Content workflow

1. Internal docs live in `docs/` and `Directwerk/docs/`.
2. Public pages are copied/adapted into `directwerk-docs/docs/` with frontmatter.
3. Migrated pages include `<!-- source: ... -->` comments for traceability.
4. When internal docs change materially, update the corresponding public page in the same PR.
5. For `architecture/asset-storage` and `architecture/billing-stripe`, run from repo root:

```sh
./directwerk-docs/scripts/sync-architecture-docs.sh
```

## Deploy on Coolify

**Recommended:** Dockerfile (static nginx — no Node at runtime).

| Setting | Value |
|---------|-------|
| Type | Dockerfile |
| **Build context** | Monorepo root (`/`) |
| **Dockerfile path** | `directwerk-docs/Dockerfile` |
| Port | **80** |
| Health check | `GET /` |
| Domain | e.g. `docs.directwerk.com` (TLS at reverse proxy) |

**Alternative (Node buildpack):** build `pnpm --filter directwerk-docs build`, start `pnpm --filter directwerk-docs start`, expose port **4173** (or set `PORT`).

No runtime secrets required — static site.

Rebuild when docs content or `docs/openapi/directwerk-api.json` changes.

## Structure

```text
directwerk-docs/
├── Dockerfile
├── nginx.conf
├── package.json
├── scripts/export-openapi.sh
└── docs/
    ├── .vitepress/config.ts
    ├── guide/           # Product overview
    ├── install/         # Local dev + deploy
    ├── operators/       # Creator/tenant admin how-tos
    ├── architecture/    # Integrator-facing design
    ├── api/             # Integration guide + OpenAPI reference
    └── openapi/         # Checked-in OpenAPI JSON
```
