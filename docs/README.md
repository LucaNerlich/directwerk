# Internal documentation index

Agent and operator docs for the Directwerk monorepo.

**Public integrator docs:** [`directwerk-docs/`](../directwerk-docs/) (VitePress).  
**Product design spec:** [`platform-design.md`](platform-design.md).  
**Repo entry point:** [`README.md`](../README.md).

When you change a canonical doc below that has a public mirror, update the matching page under
`directwerk-docs/docs/` in the same PR (see [`directwerk-docs/README.md`](../directwerk-docs/README.md)).

---

## Run the repo

| Document | Use when |
|----------|----------|
| [`Directwerk/docs/build-and-deploy.md`](../Directwerk/docs/build-and-deploy.md) | Local dev, Docker, Coolify, env vars |
| [`poc-alpha-setup.md`](poc-alpha-setup.md) | HTTP harness file map + run order |
| [`Directwerk/http/`](../Directwerk/http/), [`Directwerk/bruno/`](../Directwerk/bruno/) | Manual API tests |

---

## Product & strategy

| Document | Use when |
|----------|----------|
| [`platform-design.md`](platform-design.md) | Full design spec (entities, APIs, journeys) |
| [`content-platform-strategy.md`](content-platform-strategy.md) | Publication platform vs CMS scope |
| [`publication-desks-model.md`](publication-desks-model.md) | Write desk vs Podcast desk |
| [`ghost-positioning.md`](ghost-positioning.md) | Competitive framing vs Ghost |
| [`product-naming.md`](product-naming.md) | Naming + legal TODOs |

---

## Backend & domain (canonical → public mirror)

| Document | Status | Public mirror |
|----------|--------|---------------|
| [`user-backend-implementation.md`](user-backend-implementation.md) | Shipped | — |
| [`asset-storage.md`](asset-storage.md) | Shipped | `directwerk-docs/.../architecture/asset-storage` |
| [`content-subscriptions-and-entitlements.md`](content-subscriptions-and-entitlements.md) | Shipped | `directwerk-docs/.../operators/subscriptions-and-entitlements` |
| [`payment.md`](payment.md) | Shipped (501 without Stripe keys) | `directwerk-docs/.../architecture/billing-stripe` |
| [`content-creation-implementation.md`](content-creation-implementation.md) | Reference | — |
| [`patreon-steady-integration.md`](patreon-steady-integration.md) | Planned / partial | — |
| [`bunny-net-integration.md`](bunny-net-integration.md) | Operator CDN guide | — |
| [`Directwerk/docs/multi-tenancy.md`](../Directwerk/docs/multi-tenancy.md) | Shipped | `directwerk-docs/.../architecture/multi-tenancy` |
| [`Directwerk/docs/rss-feed-storage.md`](../Directwerk/docs/rss-feed-storage.md) | Shipped | `directwerk-docs/.../architecture/rss-feeds` |
| [`Directwerk/docs/jobs-and-email.md`](../Directwerk/docs/jobs-and-email.md) | Shipped | `directwerk-docs/.../operators/email-and-jobs` |
| [`Directwerk/docs/media-upload-howto.md`](../Directwerk/docs/media-upload-howto.md) | Shipped | `directwerk-docs/.../operators/media-upload` |

Module briefs: [`Directwerk/directwerk-podcast/README.md`](../Directwerk/directwerk-podcast/README.md),
[`Directwerk/directwerk-digital/README.md`](../Directwerk/directwerk-digital/README.md).

---

## Frontend apps

| Document | App |
|----------|-----|
| [`directwerk-studio.md`](directwerk-studio.md) | Creator product context |
| [`directwerk-studio-implementation.md`](directwerk-studio-implementation.md) | Studio screens + API map |
| [`directwerk-admin-implementation.md`](directwerk-admin-implementation.md) | Platform admin |
| [`frontend-pages.md`](frontend-pages.md) | Adding routes |
| [`ui-system.md`](ui-system.md) | `@directwerk/ui`, tokens, components |

---

*Last updated: 2026-08*
