# Studio & Admin: full content + tenant management coverage

Date: 2026-07-23
Status: Approved

## Goal

`example-admin` and `publish-studio` (referred to as `example-studio` in AGENTS.md) should let a
user fully exercise the Directwerk API for tenant management and content management (articles +
podcasts, including tying podcasts to formats/categories), using mostly-existing backend endpoints
plus a small number of net-new ones where the API itself is genuinely incomplete.

## Survey findings (baseline)

- Articles, Episodes, Series CRUD + publish workflow are already fully implemented backend + studio
  frontend.
- Format/Category CRUD exists on the backend and is Bruno-documented, but studio only *reads* them
  (for product-rule scoping) — no management UI, and no tagging UI wired into Episode/Article editors
  despite the backend supporting `PUT .../formats` and `.../categories`.
- Series editor is missing `coverAssetId` and `defaultRequiredLevelSortOrder`, both backend-supported.
- Tenant creation/list/get/suspend/reactivate + module management are fully wired in example-admin.
  Missing: tenant edit, user role change, admin revoke (none of these exist on the backend either,
  despite being described in `docs/publish-admin-implementation.md`). Also missing: UI for
  already-existing backend operations (user deactivate/reactivate, domain force-verify).
- RSS/feed URL generation has a real bug: every call site builds URLs as
  `"https://" + request.getServerName()`, and `getServerName()` never includes the port (servlet
  spec). This breaks locally (`:8080` missing, wrong scheme) and lacks a proper base-URL abstraction
  even in prod (unlike email links, which already have one in `EmailLinkBuilder`/`DirectwerkConfig`).
  `RssXmlBuilder`'s channel `<link>` additionally uses the tenant *slug* as if it were a hostname —
  a distinct correctness bug.
- Studio has zero feed-URL visibility today (confirmed green-field): `SiteConfig.publicRssUrl` exists
  in frontend types but is never rendered.
- Neither app uses Tailwind or a shared package; each is a standalone Next.js app with plain CSS +
  CSS Modules. No monorepo workspace tooling exists.

## Scope

### Phase 1 — publish-studio: content taxonomy + RSS

1. **Taxonomy management.** Add `(studio)/manage/formats` and `(studio)/manage/categories` pages
   (alongside existing `manage/products`, `manage/grants`) with list/create/edit/deactivate, backed
   by the existing Format (`PODCAST`-gated) and Category (`DIGITAL_CONTENT`-gated — fix the doc,
   which wrongly says `PODCAST` for categories) CRUD endpoints.
2. **Tagging in editors.** `EpisodeEditor` gets Format + Category multi-selects
   (`PUT /episodes/{id}/formats`, `.../categories`). `ArticleEditor` gets a Category multi-select only
   (`PUT /articles/{id}/categories`). Both read available options via existing `listFormats()` /
   `listCategories()`.
3. **Series editor gaps.** Add a cover-asset picker (reusing the existing media-upload component used
   for episode audio) and a `defaultRequiredLevelSortOrder` select.
4. **RSS URL fix (backend).** Introduce one shared URL-building helper that derives scheme/host/port
   correctly from the request (respecting `forward-headers-strategy` trust boundaries), and use it in
   `RssFeedController`, `EpisodeEnclosureService`, `EpisodeDownloadAnalyticsService`,
   `MeFeedController.toView`, `PublicSiteConfigService.publicRssUrl`. Fix `RssXmlBuilder`'s channel
   `<link>` to use the real tenant host instead of the slug. No route/path changes.
5. **RSS visibility (studio).** Add a computed `rssUrl` field to the Series response. Surface the
   tenant-wide podcast feed URL and each series' feed URL in studio (podcast overview + series
   detail), with copy-to-clipboard, gated behind `PODCAST_RSS`.
6. **Explicitly out of scope:** the subscriber-facing private feed / `CustomFeed` builder
   (filter-by-format-or-category feed) — genuinely unbuilt (documented "Phase 7, still open" in
   `directwerk-podcast/README.md`), and belongs to `publish-web`, not studio/admin.

### Phase 2 — example-admin: tenant management completeness

Backend (Directwerk), each following the existing controller's patterns, each with matching Bruno
requests and JetBrains HTTP harness files added (per AGENTS.md rule #5 and standing instruction: **any backend controller change
must be paired with matching Bruno collection updates and HTTP harness updates under Directwerk/http/ in the same change**):

1. `PATCH /api/v1/platform/tenants/{tenantId}` — edit name/slug (slug uniqueness validated same as
   creation) — `PlatformTenantController`.
2. `PATCH /api/v1/platform/tenants/{tenantId}/users/{userId}` — role update — `PlatformTenantUserController`.
3. `DELETE /api/v1/platform/admins/{userId}` — revoke — `PlatformAdminController`.

Frontend (example-admin):

- Tenant detail page: inline edit form for name/slug.
- Tenant user list: role-change control wired to the new PATCH; wire up the already-existing backend
  deactivate/reactivate endpoints (currently unused by the UI).
- Admins page: revoke button per row.
- Tenant detail: expose the existing domain force-verify endpoint as a button per domain.

### Phase 3 — cross-app UI consistency

Shared design tokens and base element styles (palette, spacing scale, typography, button/input/
table/card base styles) duplicated into both apps' `globals.css`, layered under existing CSS Modules
(not replacing them). Consistent header/nav chrome, form controls, tables/lists, and responsive
breakpoints across existing pages. No new dependencies, no IA changes, no shared package.

## Standing rule

Any Directwerk controller change in this project (new endpoint, changed request/response shape) is
paired with a matching Bruno collection update in `Directwerk/bruno/` in the same change.

## Out of scope

- `DigitalPublication` / downloadable-files content type — unbuilt (design docs only, per prior
  survey), not requested by the user.
- Subscriber-facing `CustomFeed` builder — unbuilt, belongs to `publish-web`.
- Any change to `publish-web` itself.
- Introducing Tailwind, a component library, or a shared monorepo package.
