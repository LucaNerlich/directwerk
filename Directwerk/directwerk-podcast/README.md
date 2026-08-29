# directwerk-podcast

Optional **podcast** vertical slice for Directwerk: shows (series), episodes, taxonomy, and
publish workflow. Feature module key: `PODCAST` (`PodcastModule.KEY`). Requires `DIGITAL_CONTENT`
in the module catalog.

This document is the module’s product + engineering brief: domain language (including German
**Formate**), how access and feeds relate, what is shipped, and what remains deferred.

Companion docs:

| Doc | Role |
|-----|------|
| [`../docs/poc-alpha-setup.md`](../docs/poc-alpha-setup.md) | HTTP harness + local API setup |
| [`../../docs/platform-design.md`](../../docs/platform-design.md) | Full platform design |
| [`../../docs/content-creation-implementation.md`](../../docs/content-creation-implementation.md) | Studio + content blueprint |
| [`../../docs/asset-storage.md`](../../docs/asset-storage.md) | S3, promote, entitlements |

---

## Domain language

### Podcast series (the “show”)

A **series** is what a tenant admin creates in the simplest case: **one podcast**.

It holds **RSS / directory metadata** that podcatchers and Apple Podcasts / Spotify need for the
*show*, not for a single release:

- Title, slug, description
- Cover art (`MediaAsset`)
- Language, iTunes category
- Optional default access hint for new episodes (`default_required_level_sort_order`)
- Status: `DRAFT` | `PUBLISHED`

One tenant may run many series later; MVP UX can still feel like “create my podcast”.

### Episode (a release)

An **episode** is one publishable unit inside a series: audio file, show notes, access policy,
taxonomy tags, and workflow state (`DRAFT` → `SCHEDULED` → `PUBLISHED` → `ARCHIVED`).

Audio lives in `directwerk-digital` as a `MediaAsset`. On attach we set `MediaAsset.episode_id`.
On publish, **FREE** audio is promoted to the public CDN prefix; **PAID** audio stays private
(signed URLs later via entitlements).

### Format = Formate (primary taxonomy)

**Format** is the primary grouping axis — German product language: **Formate**.

Use formats to:

1. **Group on the website** — e.g. page “Interviews” lists every episode tagged Interview  
2. **Feed builder (later)** — subscribers pick which formats belong in their private RSS  
3. **Entitlements (later)** — gate who may access or select a format (free / paid / LEVEL 2+)

Examples: `Hauptfolge`, `Interview`, `Bonus`, `Q&A`, `Uncut`.

Formats are tags on **episodes**, not on the series. The series is the show; formats classify
releases so the same Formate power site sections, custom feeds, and PACKAGE rules.

Optional field: `Format.required_level_sort_order` — format only usable / visible from that LEVEL
upward (e.g. Bonus from LEVEL 2).

### Category (optional second axis)

**Category** is a second, optional facet when Formate alone is not enough:

- Seasons (`Season 3`)
- Topics (`Politik`)
- Campaigns

Same join pattern (`episode_categories`). Used later for site filters, feed builder
(`includeCategories`), and PACKAGE rules (`scope_type = CATEGORY`).

**Rule of thumb**

| Need | Use |
|------|-----|
| Site pages + feed builder + “who can hear this shape of content” | **Format (Formate)** |
| Extra facet (season / topic) | **Category** |
| Only one taxonomy for now | Ship **formats**; leave categories empty or defer UI |

---

## Simplest tenant-admin journey

1. Create **one series** with RSS-relevant metadata and cover  
2. Define **formats** (Formate) under taxonomy settings  
3. Upload audio via media API (`DIGITAL_CONTENT`)  
4. Create **episodes**, tag ≥1 format, set FREE/PAID (+ optional LEVEL)  
5. **Publish** — public catalog + RSS snapshot refresh; FREE audio on CDN

Studio UI is out of band for this module; the API must support the journey fully.

---

## Access control (roles vs subscriptions)

| Concept | Meaning |
|---------|---------|
| `SUBSCRIBER` **role** | Logged-in member of the tenant — **not** the same as paid access |
| **LEVEL** product | Tier ladder (`sort_order`); higher tier unlocks more |
| **PACKAGE** product | Named bundle via `ProductAccessRule` (series / format / category / asset) |

Example Formate gating (product intent; full engine is Phase 4b):

| Format | Access idea |
|--------|-------------|
| A (e.g. Hauptfolge) | Free for everyone (`FREE` episodes or no level gate) |
| B (e.g. Interview) | Paid subscribers (LEVEL ≥ 1) |
| C (e.g. Bonus) | Paid LEVEL ≥ 2 |

Mechanisms (combine as needed):

- Per **episode**: `access_policy` + `required_level_sort_order`  
- Per **format**: `Format.required_level_sort_order`  
- Per **product**: LEVEL ladder and/or PACKAGE rules with `FORMAT` / `CATEGORY` scopes  

Private paid assets are evaluated by `EntitlementApiAdapter` using the LEVEL/PACKAGE rules in
`directwerk-subscription`. The conditional digital fallback remains fail-closed when no entitlement
adapter is wired.

## Episode download analytics

Umami tracking is platform-configured with `DIRECTWERK_ANALYTICS_*`; tenants only store their
`tenant_branding.umami_website_id`. When platform analytics, the tenant `ANALYTICS` module, and a
website ID are all present, stream redirects and public download redirects emit `episode-download`.
Public RSS enclosures are rewritten to `/api/v1/public/episodes/{slug}/download` so downloads can be
tracked before redirecting to the public CDN. Analytics is fail-open and never gates playback.

---

## Feed builder (Formate)

Subscribers compose a **private** RSS feed by selecting one or more **Formate**. That feed only
includes episodes they are **entitled** to and that match at least one selected active format.

```text
SubscriberFeed { is_default=false, formats[] }
  → entitled PUBLISHED episodes with enclosure
  → private /feeds/{tenantSlug}/u/{feedToken}.xml
```

Create/update/preview require the tenant `FEED_BUILDER` module. Disable, delete, and token rotate
of an existing custom feed only need `PODCAST_RSS` + `SUBSCRIPTION` so leftover feeds can be
cleaned up after a downgrade. Public custom-feed URLs 404 (not JSON 403) when `FEED_BUILDER` is
off. Category filters remain deferred.

---

## Module layout

```
de.pnnit.directwerk.modules.podcast
  PodcastModule
  entity/       PodcastSeries, Episode, Format, Category + enums
  repository/
  service/      Series, Episode, Format, Category, PublicationWorkflow, RSS snapshots
  feed/         SubscriberFeed domain and persistence
  job/          Durable RSS refresh queue producer and handler
  util/         Slug helpers
  exception/
```

HTTP lives in `directwerk-app`:

| Audience | Paths (planned) | Auth |
|----------|-----------------|------|
| Publisher | `/api/v1/series`, `/api/v1/episodes` (+ workflow actions) | JWT, `EDITOR`+, `@RequiresModule(PODCAST)` |
| Taxonomy | `/api/v1/formats`, `/api/v1/categories` | JWT, `TENANT_ADMIN`, `PODCAST` |
| Public | `/api/v1/public/series\|episodes\|formats\|categories` | Host; empty list if module off |

Flyway: `directwerk-app` owns `V28__create_podcast_content.sql` (next after current media migrations).

---

## Publication workflow

```
DRAFT ⇄ SCHEDULED → PUBLISHED → ARCHIVED
(unarchive restores ARCHIVED → DRAFT)
         ↓ cancel      ↓ unpublish
       DRAFT         DRAFT
```

On publish:

1. Validate slug, title, show notes, READY audio (same tenant), format rules  
2. Sanitize HTML show notes (OWASP allow-list — server authoritative)  
3. Set `MediaAsset.episode_id`; promote FREE → public; keep PAID private  
4. Set `PUBLISHED` + `published_at`  
5. Enqueue a tenant RSS snapshot refresh after commit and optionally enqueue a
   `ContentPublishedEvent` email notification

Scheduled publish: Quartz job (~60s) claims due `SCHEDULED` rows.

---

## Implementation plan (phased)

Status: **implemented** for slices 1–7. Phase 3 now ships schema, tenant-scoped domain services,
publication workflow, public catalog endpoints, tests, and HTTP harness coverage.

| Slice | Deliverable | Status |
|-------|-------------|--------|
| **0 — Scaffold** | This module, Gradle wiring, `PodcastModule.KEY` | Done |
| **1 — Schema** | `V28` tables + JPA entities / repos (`TenantOwned` + Hibernate filter) | Done |
| **2 — Taxonomy** | Format / Category CRUD + tests | Done |
| **3 — Series** | Series CRUD; cover asset validation | Done |
| **4 — Episodes** | Draft CRUD, joins, slugs, `HtmlSanitizer`, audio attach | Done |
| **5 — Workflow** | publish / schedule / cancel / unpublish / archive + FREE promote + scheduler | Done |
| **6 — Public API** | Published catalog; FREE may expose CDN URL; PAID lock metadata only | Done |
| **7 — Harness / docs** | HTTP client file, checklist updates in `poc-alpha-setup` / content-creation | Done |

### Explicitly out of this module’s first delivery

Phase 2e, 4a, 4b, and 4c (stream, public RSS, entitlements, private RSS) are **shipped**. Remaining open items:

| Item | When |
|------|------|
| ~~`GET /api/v1/me/episodes/{slug}/stream` (Phase 2e)~~ | Shipped — `MeEpisodeController` |
| ~~Public FREE RSS (Phase 4a)~~ | Shipped — `RssFeedController` |
| ~~Real LEVEL/PACKAGE `hasAccess` on content (Phase 4b)~~ | Shipped — `EntitlementApiAdapter`, `ProductAccessRuleService` |
| ~~Private subscriber RSS (Phase 4c)~~ | Shipped — `MeFeedController`, `SubscriberFeedService` |
| Subscriber feed builder | Phase 7 — still open |
| `EMAIL_NOTIFY` send on publish | Post-MVP — still open (`notifySubscribers` may validate module only) |
| Studio UI | `directwerk-studio` — still open |

### Decisions locked

| Topic | Choice |
|-------|--------|
| Module | New Gradle module `directwerk-podcast` (not inside `digital`) |
| Formate | **Format** entity; primary axis |
| Category | Optional second axis |
| Paths | Top-level `/api/v1/series\|episodes\|formats\|categories` (EDITOR+ / TENANT_ADMIN), not only under `/tenant/` |
| Formats on publish | Required if tenant has ≥1 active format |
| PAID private audio | Entitlement-checked through `EntitlementApiAdapter`; fail-closed without an adapter |

## RSS caching

Feed endpoints stay stable for consumers:

- `/feeds/{tenantSlug}/podcast.xml`
- `/feeds/{tenantSlug}/{seriesSlug}.xml`
- `/feeds/{tenantSlug}/u/{feedToken}.xml`

Generated XML is a durable S3 snapshot, not an in-process or filesystem cache entry. Directwerk
writes public XML to `{tenantSlug}/public/rss/` and private XML to `{tenantSlug}/private/rss/`.
Public requests redirect to the public pull zone; private requests validate the feed token first and
then redirect to the private token-auth pull zone (or an S3 presigned GET fallback). Every feed
`302` is `Cache-Control: no-store`. When the snapshot has not been written yet, Directwerk returns
`404` with `no-store` instead of redirecting to a CDN miss. Tokens never appear in S3 keys or logs.
Disabling a subscriber feed or turning `PODCAST_RSS` off deletes the S3 objects, clears presence, and
purges the pull-zone URLs. A tenant slug change 404s until the new prefix is written, then deletes
the previous prefix.

Publishing, unpublishing, archiving, enclosure and series changes, subscriber-feed changes,
subscription/access-rule changes, tenant name/slug, verified/primary domain, format required-level,
and first-time `PODCAST_RSS` activation enqueue a tenant refresh after commit. Duplicate `QUEUED`
refresh jobs for the same tenant are coalesced. The Java queue job is the only path that generates
XML. A successful S3 `PUT` replaces the snapshot atomically and records presence; a failed job
leaves the prior object live and is retried. Feed requests only validate access and redirect—never
query episodes, evaluate entitlements, generate XML, or `HEAD` S3.

See [`../docs/rss-feed-storage.md`](../docs/rss-feed-storage.md) for deployment and pull-zone rules.

| Topic | Value |
|-------|-------|
| Migration version | `V28__create_podcast_content.sql` |

---

## Dependencies

- `directwerk-digital` (and transitively `directwerk-core`, queue for any jobs)

## Used by

- `directwerk-app` — HTTP controllers, Flyway, security matchers, integration tests

## Build

```sh
./gradlew :directwerk-podcast:build
./gradlew :directwerk-app:test
```

## Security notes

- Never trust client HTML for show notes — sanitize server-side  
- Tenant isolation via `TenantContext` + Hibernate `tenantFilter` + write guards  
- Module gate before write paths; public reads return empty when `PODCAST` is off  
- Do not log pre-signed URLs or feed tokens  
- Entitlement checks for private audio go through `AssetAccessApi` / `EntitlementApi` — do not bypass
