# Internal documentation index

Agent and operator docs for the Directwerk monorepo. **Public integrator docs** live in
[`directwerk-docs/`](../directwerk-docs/). **Product design spec:** [`README.md`](../README.md).

## Start here

| Document | Use when |
|----------|----------|
| [`ui-system.md`](ui-system.md) | Building or changing Next.js UI (`@directwerk/ui`, tokens, components) |
| [`frontend-pages.md`](frontend-pages.md) | Adding a route/page in studio, web, or admin |
| [`directwerk-studio.md`](directwerk-studio.md) | Product context for the creator dashboard |
| [`directwerk-studio-implementation.md`](directwerk-studio-implementation.md) | Studio screens, API mappings, shipped checklist |
| [`directwerk-admin-implementation.md`](directwerk-admin-implementation.md) | Platform admin app |
| [`poc-alpha-setup.md`](poc-alpha-setup.md) | Local API setup + HTTP harness run order |

## Backend & domain

| Document | Status |
|----------|--------|
| [`user-backend-implementation.md`](user-backend-implementation.md) | Shipped — auth, roles, `/me` |
| [`asset-storage.md`](asset-storage.md) | Shipped — S3, upload/confirm, entitlements |
| [`content-creation-implementation.md`](content-creation-implementation.md) | Reference — content services, workflow |
| [`content-subscriptions-and-entitlements.md`](content-subscriptions-and-entitlements.md) | Reference — LEVEL/PACKAGE model |
| [`publication-desks-model.md`](publication-desks-model.md) | Reference — Write vs Podcast desks |
| [`payment.md`](payment.md) | Stripe Connect — live when env keys set |
| [`patreon-steady-integration.md`](patreon-steady-integration.md) | Planned / partial |
| [`bunny-net-integration.md`](bunny-net-integration.md) | Operator CDN guide |

## Historical / planning (do not treat as backlog)

These describe **completed** slices or open product decisions, not greenfield work:

| Document | Note |
|----------|------|
| [`phase-2e-4-4b-implementation.md`](phase-2e-4-4b-implementation.md) | Shipped 2026-07 — stream, RSS, entitlements |
| [`phase-studio-products-plan.md`](phase-studio-products-plan.md) | Partial — product UI shipped; polish items remain |
| [`ghost-positioning.md`](ghost-positioning.md) | Strategy — not a feature checklist |
| [`product-naming.md`](product-naming.md) | Naming + pre-launch legal TODOs |

## Removed

- `docs/superpowers/` — July 2026 implementation plans (pre-`@directwerk/ui`, CSS Modules era). Deleted; use this index and app READMEs instead.

*Last updated: 2026-08*
