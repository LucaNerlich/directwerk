# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.5.1] - 2026-10-31

### Added

- Public docs site `/changelog` route, synced from the root `CHANGELOG.md`.

### Fixed

- Article (and episode) Markdown body rendered as HTML on the public site: Markdown→HTML on write with sanitization, plus shared client HTML rendering.
- Studio mobile sidebar stays open when SideNav remounts.

## [0.5.0] - 2026-10-31

### Added

- Studio content MCP tools for archive/unarchive, cancel schedule, bulk publish/unpublish/delete, notify (+ preview), episode enclosure, article newsletter lists, and media rename/preview/references/limits/storage summary (hosted `/mcp` and stdio `@directwerk/mcp-studio` parity).

### Fixed

- Studio mobile sidebar closes on SideNav navigation (link click and pathname change).

## [0.4.0] - 2026-10-31

### Added

- Hosted Studio content MCP over Streamable HTTP on the API (`/mcp`), alongside the stdio `@directwerk/mcp-studio` package.
- Studio API keys page: MCP setup section with copyable configuration for OpenCode and Claude Desktop/Cursor, with the workspace host prefilled.
- Directwerk MCP server for Studio content management, plus tenant API keys with content scopes.
- Bulk podcast import through the MCP server, including a manifest builder for channel2mp3 output and OpenCode setup docs.
- Studio remembers the last open desk, and shows the tenant favicon in the sidebar and the login workspace picker.
- Short `/e/` and `/a/` content detail aliases on the public website.

### Fixed

- Studio sticky editor action bar now uses the standard card surface (rounded, ring, elevation) and sits below the mobile shell header.
- Studio tenant-name home navigation and language switching in settings.
- Mailgun API key handling hardened against accidental disclosure.

## [0.3.0] - 2026-10-30

### Added

- Studio layout / IA restructure: hub subnavs (manage, media, settings), desk landing, and tenant first-run setup checklist.
- Umami episode-play tracking for podcast plays on the public website.

### Fixed

- Mediathek appears once in the studio sidepanel (duplicate nav removed).
- Studio branding accepts an Umami website ID without a host override.
- Umami website IDs validated as UUIDs; podcast contact email required in branding.

## [0.2.0] - 2026-10-29

### Added

- Tenant contact email on the tenant admin API, surfaced in podcast RSS / iTunes owner tags.
- Studio notify-subscribers preview, delivery status and retry for publish fan-out.
- Studio subscriber entitlement debugger for diagnosing product access.
- Persistent mini-player across public site routes.
- Guided domain verification wizard in studio.
- Private-feed onboarding for new subscribers on the public site.
- Public `GET` episode-by-slug endpoint so web detail pages skip a full catalog scan.
- Brand-driven startpage with an unstretched hero, and matching brand atmosphere on the homepage and studio.
- Mailgun send-test that delivers to all tenant admins via the email job pipeline.
- Shared Fuse.js fuzzy search for studio and admin list UIs.
- Filename search in the studio media library.
- Rename a media asset from its first content reference.

### Changed

- Pinned the workspace to Node 24 and pnpm 10.x, and removed the legacy `.npmrc`.
- Studio Schreiben desk labels renamed to Artikel.
- Email notify publish flow uses locale-aware deep links.

### Fixed

- Public site LCP and SSR: seed catalog pages like home, cache anonymous BFF reads, preload only the true LCP image, drop the hero opacity entrance delay, wrap long brand titles, and keep SSR detail visible while entitled fetches run.
- Studio media library: truthful folder counts, orphan filter, content references, inline audio player, grouped Mediathek search, rename-from-reference UX, move-dialog target stability, and page/search for directories.
- Studio uploads no longer 502 under Coolify: spool before S3 PUT and raise the idle timeout / Traefik labels.
- Episode create keeps selected audio across redirect; article/episode editors, lists and RSS import share parameterised clients with BFF pagination allowlists.
- Stripe live status resolves outside the webhook transaction; canceled rows can rebind; currencies that `priceCents` cannot express are rejected.
- Cross-origin studio logout and tenant-select are rejected.
- Feed and asset safety: cap private snapshot URL lifetime, durable feed-presence invalidation, refuse deleting media still used by published content, and map status-carrying exceptions correctly.
- Analytics: episode identity on download events; Umami branding requires website ID and server; session-replay recorder deferred past hydration / with `lazyOnload`.
- Queue and email: one failing queue no longer starves `pollAll`; after-commit failures no longer fail the request; email transport config validated at startup; Mailgun test uses the email job + template path.
- Misc API: paged episode/article lists, media offset paging, 404 for known-missing slugs, bodyless DELETE through the tenant BFF, robots/sitemap kept out of the locale proxy, and batch rights IDs through the platform proxy.

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
