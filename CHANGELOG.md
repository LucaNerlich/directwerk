# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.1.1] - 2026-10-22

### Changed

- Updated the frontend toolchain: Next.js 16.4.2, React 19.3.1, refreshed testing dependencies, Node 24 / pnpm 12 engine constraints, and workspace policies for minimum release age and dependency trust.

## [0.1.0] - 2026-10-20

First tagged release of the Directwerk platform (REST API, creator studio, public site, admin, homepage and docs).

### Added

- Multi-tenant, API-first platform: verified `Host` to tenant resolution, per-tenant authorization and a REST API documented by OpenAPI.
- Role model (`PLATFORM_ADMIN`, `TENANT_ADMIN`, `EDITOR`, `SUBSCRIBER`, `GUEST`) with tenant memberships, invitations and optional per-member permission limits.
- Feature modules with server-side gating: `DIGITAL_CONTENT`, `PODCAST`, `PODCAST_RSS`, `FEED_BUILDER`, `ARTICLES`, `ARTICLE_RSS`, `ARTICLE_FEED_BUILDER` and `BONUS_CONTENT`.
- Creator studio: write and podcast desks, media library with folders and direct S3 uploads, formats and categories, products and access rules, subscriber directory, team management and analytics.
- Public site and subscriber portal: content catalog, private feeds, bonus downloads, account settings and a billing portal.
- Platform admin: tenant creation and suspension, module assignment, job queue, audit log and domain verification.
- Podcast publishing: series and episodes, public and private RSS feeds, a custom feed builder and per-subscriber feed tokens.
- Articles and newsletter: article RSS, RSS import into the write desk, and newsletter lists with public subscribe and publish fan-out.
- Product-based entitlements with `LEVEL` and `PACKAGE` access rules, manual grants, and billing sources for Stripe, Patreon and Steady — including Stripe Connect checkout, portal and webhooks.
- Transactional email and background jobs: SMTP and Mailgun transports, templates, retries and a database-backed job queue.
- Tenant branding: logo, favicon, custom domains and per-tenant Umami analytics settings.
- German and English path-based localisation across studio, web, admin, homepage and docs.
- Public documentation site with operator guides, API reference and an OpenAPI changelog, plus the platform marketing site.

### Changed

- Assets live in S3 under tenant-prefixed public and private keys; private downloads are served only through entitlement-checked signed URLs.
- Tenant customisation comes from one site config (branding, enabled modules, feed URLs) instead of per-page refetches.
- Content access is evaluated per asset instead of relying on the `SUBSCRIBER` role alone.
- The public namespace uses same-origin feed proxies for podcast and article feeds.

### Fixed

- Private feed tokens are cryptographically random and rotatable, and custom feeds always apply the entitlement filter.
- Stripe, Patreon and Steady webhook signatures are verified before processing.
- The media library keeps the folder the user navigated to when an upload finishes, and stale responses can no longer overwrite a newer folder load.
- Large directory reads no longer issue per-row queries: tenant members load in one query and platform lists are paged.
- Invitations record a `USER_INVITED` audit event.
- Umami analytics honours the configured mask level and no longer uses a closed HTTP client while events are in flight.

### Security

- Pre-signed uploads are restricted by MIME type and size, and staging keys are scoped to `{tenant}/staging/`.
- Module gates, private asset access and feed tokens are enforced server-side, never in the UI.
