---
title: Introduction
description: What Directwerk is — API-first publication and membership platform for creators and integrators.
outline: deep
---

<!-- source: docs/directwerk-studio.md, docs/content-platform-strategy.md -->

# What is Directwerk?

**Directwerk** is a whitelabel **publication and monetization platform** — not a full CMS. Creators publish podcast episodes, articles, and digital files on their own domain; subscribers get free or paid access through a unified entitlement engine.

The platform is **API-first**: `directwerk-studio` (creator dashboard) and `directwerk-web` (public/subscriber site) are reference frontends that call the same `/api/v1/` REST contract agencies and integrators use.

## Three apps

| App | Audience | Role |
|-----|----------|------|
| **directwerk-studio** | Creators and editors | Upload media, publish content, manage products and subscribers |
| **directwerk-web** | Subscribers and visitors | Public site, account portal, entitled feeds and downloads |
| **directwerk-admin** | Platform operators | Tenants, modules, job queue (superadmin only) |

Creators **never need to know the REST API exists**. Studio is the default path for non-technical users; the API is the architecture choice for whitelabel and custom frontends.

## What Directwerk is not

| Misconception | Reality |
|---------------|---------|
| A full CMS like Ghost Admin | **Publisher ops** — structured content + workflow, not block editor or themes |
| A subscriber-facing site | Subscribers use **directwerk-web** (or a custom frontend) |
| Optional “for developers only” | Studio is the **default** creator experience |

## Core capabilities

- **Multi-tenant whitelabel** — verified custom domains, tenant branding, Host-based routing ([Multi-tenancy](/architecture/multi-tenancy))
- **Entitlements** — FREE/PAID content, LEVEL and PACKAGE products ([Subscriptions & entitlements](/operators/subscriptions-and-entitlements))
- **Media on EU S3** — presigned upload, public CDN vs private signed URLs ([Asset storage](/architecture/asset-storage))
- **Podcast RSS** — public and subscriber feeds with entitlement filtering ([RSS feeds](/architecture/rss-feeds))
- **Billing** — Stripe Connect (Patreon/Steady planned) ([Stripe billing](/architecture/billing-stripe))

## Publication platform vs CMS

Directwerk manages **what content exists, who can access it, and how it is delivered** — not authoring UX, page layout, or email infrastructure.

| Layer | Directwerk stance |
|-------|-------------------|
| **Publication platform** | Workflow, slugs, taxonomy, entitlements, RSS, downloads — **we build this** |
| **CMS (authoring product)** | Block editor, themes, plugins — **integrate or thin ops UI** |

## Primary audience

**Default buyer:** non-technical German creators (podcasters, newsletter writers) who want one place to create, manage members, and publish on their domain — similar to Substack or Ghost, with EU-friendly hosting and exit from Patreon/Steady lock-in.

**Integrators:** agencies building custom frontends against the same API, with verified Host tenancy and structured error codes.

## Next steps

- [Quickstart](/guide/quickstart) — shortest path to a running stack
- [Apps](/guide/apps) — studio, web, admin, and other frontends
- [Local development](/install/local-development) — Gradle + Compose setup
- [API integration](/api/integration) — auth, tenancy, and OpenAPI reference
