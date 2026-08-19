# Content, subscriptions, and entitlements

Operator guide for Directwerk’s **public vs entitled** content model: access policies,
LEVEL/PACKAGE products, formats/categories, grants, and where content appears (API vs RSS).

| | |
|---|---|
| **Status** | Implemented (API); most studio/admin UI still missing |
| **Engine** | `EntitlementService` (`directwerk-subscription`) |
| **Harnesses** | `Directwerk/http/11-tenant-products.http`, `12-tenant-subscriptions.http`, `19-podcast-content.http`, `23-entitlements.http`, `21-public-rss.http`, `22-private-rss.http` |
| **Related** | [`asset-storage.md`](asset-storage.md) (bytes/CDN), [`README.md`](../README.md) (product vision), modules UI in `directwerk-admin` |

---

## Mental model

Access is two layers:

1. **Content gate** — episode (or article) `accessPolicy`: `FREE` | `PAID`
2. **Entitlement gate** — for `PAID` only: union of the user’s **active** subscriptions

```text
FREE episode  → everyone (public audio / public RSS / private RSS)
PAID episode  → metadata may be public; audio + private RSS only if entitled
```

**Products** (`SubscriptionProduct`) are what you sell or grant:

| `offeringType` | Meaning | How a PAID episode unlocks |
|----------------|---------|----------------------------|
| **LEVEL** | Tier ladder (`sortOrder`) | User’s max active LEVEL `sortOrder` ≥ episode `requiredLevelSortOrder` **and** ≥ any format-level floor on the episode |
| **PACKAGE** | Named bundle | Any `ProductAccessRule` on that package **matches** the episode (series / format / category / all podcasts) |

**Not the same things:**

| Concept | What it is |
|---------|------------|
| `SUBSCRIBER` role / tenant membership | Can sign in and hit `/me/*` |
| Active subscription to a product | Grants entitlements for PAID content |
| Platform/tenant admin roles | Manage products and grants; editors can preview all published episodes in `/me/episodes` |

There is **no** separate “subscriber level” entity. Level = max `sortOrder` among the user’s active **LEVEL** product subscriptions.

Entitlements are **derived** from active subscriptions (union). Multiple LEVEL + PACKAGE subs stack.

---

## Prerequisites (modules)

| Capability | Required modules |
|------------|------------------|
| Product CRUD, rules, grant/revoke | `SUBSCRIPTION` |
| Episode / series / formats CRUD | `PODCAST` |
| Categories CRUD | `DIGITAL_CONTENT` |
| Public RSS + public enclosure | `PODCAST_RSS` (+ `PODCAST` for enclosure) |
| Private RSS, `/me/feeds`, private enclosure | `PODCAST_RSS` + `SUBSCRIPTION` |
| Entitled episode list / stream | `PODCAST` (+ `SUBSCRIPTION` for PAID stream) |

Presets that include `SUBSCRIPTION`: `WRITER`, `PODCAST`, `FULL`, `PATREON_MIGRATOR`, `PRO`, `ENTERPRISE`.  
`FREE_PODCAST` has podcast + RSS but **no** subscription/entitlements.

Assign modules in **directwerk-admin** → tenant detail → Modules (platform admin), or via platform modules API.

Module off on public surfaces → **403** `FEATURE_NOT_ENABLED` (not a fake empty catalog / tenant-not-found).

---

## Content fields that control access

### Episode

| Field | Role |
|-------|------|
| `accessPolicy` | `FREE` (default) or `PAID` |
| `requiredLevelSortOrder` | Minimum LEVEL `sortOrder` for LEVEL-path unlock (default **0** if unset; create can inherit series `defaultRequiredLevelSortOrder`) |
| `formatIds` / `categoryIds` | Taxonomy tags; PACKAGE rules match on these; formats can also raise the LEVEL floor |
| `enclosureEnabled` | Whether the episode may appear with an audio enclosure in feeds |
| Publication status | Only **published** episodes appear in public/me/RSS surfaces |

**Formats** (`/api/v1/formats`, needs `PODCAST`): optional `requiredLevelSortOrder`. If an episode has formats with level floors, LEVEL unlock requires `max(user level) ≥ max(those floors)` **in addition to** the episode’s own `requiredLevelSortOrder`.

**Categories** (`/api/v1/categories`, needs `DIGITAL_CONTENT`): taxonomy only for PACKAGE matching (and future feed builder); no inherent level.

### Articles / digital assets

- Articles follow the same FREE/PAID content idea where implemented.
- Standalone digital assets unlock **only** via PACKAGE rules with scope `DIGITAL_ASSET` (LEVEL ladder does not apply).

---

## How entitlement is decided

Source of truth: `EntitlementService.hasEpisodeAccess`.

```text
if episode is FREE → allow

if any active LEVEL product has sortOrder ≥ episode.requiredLevelSortOrder
   AND (no format level floor OR user level ≥ max format floor)
   → allow

if any active PACKAGE has a matching ProductAccessRule → allow

else → deny
```

Active subscription = `status = ACTIVE` and (`endsAt` is null or in the future).

### PACKAGE rule scopes

| `scopeType` | `scopeId` | Episode match |
|-------------|-----------|---------------|
| `ALL_PODCASTS` | must be `null` | Always |
| `PODCAST_SERIES` | series id | Episode’s series id equals |
| `FORMAT` | format id | Episode has that format |
| `CATEGORY` | category id | Episode has that category |
| `DIGITAL_ASSET` | media asset id | **Not** for episodes (asset API only) |
| `FEED_BUILDER` | must be `null` | Reserved as a product-rule scope; does not grant episodes. Custom feeds are a subscriber filter, not an entitlement grant. |

Effect is only `GRANT` (no deny rules). Rules are **PACKAGE-only**; replace is full replace (`PUT .../rules`).

**PACKAGE bypasses level:** a matching package unlocks PAID even if the user’s LEVEL is too low.

---

## Where content appears

| Surface | FREE published | PAID entitled | PAID not entitled |
|---------|----------------|---------------|-------------------|
| Anonymous `GET /api/v1/public/episodes` | Listed; playable CDN URL if eligible | Listed; **`audioCdnUrl = null`** | Same |
| Signed-in `GET /api/v1/me/episodes` | Included + playable | Included + playable | **Omitted** (editors/admins see all published) |
| `GET /api/v1/me/episodes/{slug}/stream` | 302 if READY | 302 if entitled | Denied |
| Public RSS `/feeds/{slug}/podcast.xml` (and series `.xml`) | Item if enclosure on + READY | **Omitted** | Omitted |
| Public enclosure `/feeds/.../e/{ep}.mp3` | 302 → CDN | **404** | 404 |
| Private RSS `/feeds/.../u/{token}.xml` | Included (public enclosure URL) | Included (tokenized enclosure) | Omitted |
| Private enclosure `/feeds/.../u/{token}/e/{ep}.mp3` | 302 | 302 if entitled | **404** (no leak) |

**Takeaway:** Public JSON catalogs may show PAID metadata without audio. Public RSS is stricter: **FREE only**. Private feed = FREE + entitled PAID (not “paid-only”).

---

## Default private feed

Every subscriber gets one **default** `SubscriberFeed` (`defaultFeed=true`, `enabled=true`):

- Created on **manual grant** and on first `GET /api/v1/me/feeds`
- Title: `"{tenant name} Private Feed"`
- URL: `https://{host}/feeds/{tenantSlug}/u/{feedToken}.xml`
- Contents: published FREE + entitled PAID with enclosure enabled
- FREE items use **public** enclosure URLs; PAID use `/u/{token}/e/{episodeSlug}.mp3`
- Rotate: `POST /api/v1/me/feeds/default/rotate-token`
- Disable (subscriber): `PUT /api/v1/me/feeds/default/enabled` `{ "enabled": false }`
- List (admin): `GET /api/v1/tenant/subscriber-feeds` — feeds with user email + enabled state
- Disable (admin): `PUT /api/v1/tenant/subscriber-feeds/{feedId}/enabled`

### Custom private feeds (feed builder)

When `FEED_BUILDER` is on, any authenticated tenant member can create up to **5** extra
`SubscriberFeed` rows (`isDefault=false`) filtered by **Formate** (OR match). Entitlements still
apply; selecting a LEVEL-gated format is allowed (episodes the user cannot hear are omitted).

- Create: `POST /api/v1/me/feeds` `{ "title", "formatIds" }`
- Update: `PUT /api/v1/me/feeds/{id}`
- Preview: `GET /api/v1/me/feeds/preview?formatIds=` and `GET /api/v1/me/feeds/{id}/preview`
- Disable / rotate / delete owned custom feeds: `PUT .../enabled`, `POST .../rotate-token`, `DELETE .../{id}`
- Default feed stays unfiltered and is not deletable (`DEFAULT_FEED_NOT_DELETABLE`)
- RSS channel `<title>` is the feed title; empty XML is valid
- Custom PAID enclosures 404 when the episode’s formats are not selected, even if the user is entitled
- Public custom URLs 404 no-store when `FEED_BUILDER` is off (not JSON `FEATURE_NOT_ENABLED`)

Subscriber UI: `directwerk-web` `/feeds` (German copy). Tenant admins see custom feeds in studio
feed management as “(Eigener Feed)” plus format names.

---

## How to create public content

Goal: anyone can hear it in the browser and in the public RSS feed.

1. Enable `PODCAST` (+ `PODCAST_RSS` if you want public feeds).
2. Create series and episode with `accessPolicy: "FREE"` (default).
3. Attach READY public audio; enable enclosure if it should appear in RSS.
4. Publish the episode.

Optional: tag formats/categories for discovery; they do not restrict FREE playback.

**Check:**

- Public episode list shows `audioCdnUrl`
- `GET /feeds/{tenantSlug}/podcast.xml` includes the item with an enclosure
- Public enclosure proxy returns 302

---

## How to create entitled (PAID) content

Goal: metadata can be public; audio only for entitled subscribers (site + private RSS).

### A. Level-gated episode (tier ladder)

1. Enable `SUBSCRIPTION` (+ podcast modules as above).
2. Create LEVEL products with increasing `sortOrder` (e.g. Supporter `10`, Patron `20`):

```http
POST /api/v1/tenant/products
Host: {tenant-host}
Authorization: Bearer {tenant-admin-jwt}
Content-Type: application/json

{
  "slug": "supporter",
  "title": "Supporter",
  "sortOrder": 10,
  "offeringType": "LEVEL"
}
```

1. Create/update episode with `accessPolicy: "PAID"` and `requiredLevelSortOrder` matching the minimum tier (e.g. `10`).
2. Optionally set format `requiredLevelSortOrder` so that format raises the floor for tagged episodes.
3. Publish. Grant users a LEVEL product at or above that sort order (see [Assign subscribers](#assign-subscribers)).

### B. Package-gated episode (bundle)

1. Create a PACKAGE product (`offeringType: "PACKAGE"`).
2. Replace rules (PACKAGE only):

```http
PUT /api/v1/tenant/products/{productId}/rules
Content-Type: application/json

{
  "rules": [
    { "scopeType": "FORMAT", "scopeId": 12 },
    { "scopeType": "PODCAST_SERIES", "scopeId": 3 }
  ]
}
```

Or `{ "scopeType": "ALL_PODCASTS" }` with no `scopeId` for everything podcast-related.

1. Mark episodes `PAID`, assign matching formats/categories/series, publish.
2. Grant the PACKAGE product to subscribers.

### C. What “public teaser” means for PAID

- Public episode list: title/description appear; **no** playable CDN URL
- Public RSS: episode **not** listed
- Entitled user: `/me/episodes` + private RSS + stream/enclosure work

---

## Assign subscribers

Manual grant (API today; Stripe/Patreon sources exist on the entity for later):

```http
POST /api/v1/tenant/subscriptions
Host: {tenant-host}
Authorization: Bearer {tenant-admin-jwt}
Content-Type: application/json

{
  "email": "member@example.com",
  "productId": 42
}
```

Requirements: user exists, **ACTIVE** tenant membership, product `active`.  
Effect: upsert subscription `ACTIVE`, `source=MANUAL`, clear `endsAt`; ensure default private feed.

Revoke:

```http
DELETE /api/v1/tenant/subscriptions/{subscriptionId}
```

→ status `CANCELED`.

Inspect as the member:

- `GET /api/v1/me/access` — `activeLevels`, `maxLevelSortOrder`, `activePackages`
- `GET /api/v1/me/subscriptions`
- `GET /api/v1/me/episodes` / `GET /api/v1/me/feeds`

Public product catalog (pricing pages): `GET /api/v1/public/products` (active products; no internal ids).

---

## API cookbook (quick reference)

Auth: tenant `Host` + JWT unless public/feed token. Responses wrapped in `{ "data": ... }`.

| Area | Methods |
|------|---------|
| Products | `GET/POST /api/v1/tenant/products`, `PUT/DELETE /api/v1/tenant/products/{id}` |
| Rules | `GET/PUT /api/v1/tenant/products/{id}/rules` |
| Grants | `POST /api/v1/tenant/subscriptions`, `DELETE .../{id}` |
| Episodes | `POST/PUT /api/v1/episodes`, `PUT .../{id}/formats`, `PUT .../{id}/categories`, `PUT .../{id}/enclosure-enabled` |
| Formats | `GET/POST/PUT /api/v1/formats` |
| Categories | `GET/POST/PUT /api/v1/categories` |
| Me | `/api/v1/me/access`, `/subscriptions`, `/episodes`, `/feeds` |
| Public | `/api/v1/public/episodes`, `/products`, `/formats`, `/categories` |
| Feeds | `/feeds/{tenantSlug}/podcast.xml`, `/{seriesSlug}.xml`, `/u/{token}.xml`, enclosure `.mp3` paths |

Create product body: `{ slug, title, sortOrder?, offeringType? }` — omit `offeringType` → defaults to **LEVEL**.  
Slug pattern: `^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$`.

---

## End-to-end checklist

**Public FREE episode**

- [ ] Modules: `PODCAST`, `PODCAST_RSS`
- [ ] Episode `FREE`, published, enclosure on, READY audio
- [ ] Public list has audio URL; public RSS has enclosure

**LEVEL-gated PAID episode**

- [ ] Modules: above + `SUBSCRIPTION`
- [ ] LEVEL products with intentional `sortOrder` ladder
- [ ] Episode `PAID` + `requiredLevelSortOrder`
- [ ] Grant LEVEL ≥ required; confirm `/me/episodes` + private RSS; public RSS omits item

**PACKAGE-gated PAID episode**

- [ ] PACKAGE product + rules (FORMAT/CATEGORY/SERIES/ALL_PODCASTS)
- [ ] Episode tagged to match; `PAID`; published
- [ ] Grant PACKAGE; confirm access; revoke and confirm deny / 404 on private enclosure

---

## UI status (today)

| Surface | What exists | What’s missing |
|---------|-------------|----------------|
| **directwerk-studio** | Episode/article FREE/PAID select; **Manage → Produkte / Freischaltungen** (LEVEL/PACKAGE, PACKAGE rules, manual grant/revoke) when `SUBSCRIPTION` is on | Episode `requiredLevelSortOrder` editor; formats/categories CRUD; subscription inventory list (no GET API); Stripe checkout |
| **directwerk-admin** | Tenant modules assign/unassign; create/suspend/reactivate tenants; **dual-session** tenant login + products/rules/grants on tenant detail (POC escape hatch; needs `TENANT_OAUTH_*`) | Platform impersonation; domains on `TenantView`; shared component library with studio |
| **example-fe** | Public catalog, `/me/feeds`, me clients | Checkout/shop for products |

Studio Manage is the intended creator path. The `directwerk-admin` tenant products UI is a dual-auth POC — platform JWT still never calls `/api/v1/tenant/*`.

---

## Pitfalls

1. **LEVEL + format floor** — both episode level and max format `requiredLevelSortOrder` must pass for the LEVEL path.
2. **PACKAGE bypasses level** — intentional; use when a bundle should unlock content regardless of tier.
3. **Public JSON ≠ public RSS** — PAID can appear in public JSON without audio; RSS never lists PAID.
4. **Private enclosure deny → 404** — avoids leaking episode existence via token.
5. **Role ≠ entitlement** — `SUBSCRIBER` alone does not unlock PAID.
6. **Union semantics** — max LEVEL across all active LEVEL products + any matching PACKAGE rule.
7. **Subscription sources** on the entity include `MANUAL`, `SEED`, `STRIPE`, `PATREON`, `IMPORT`; grant API creates **MANUAL** today.
8. Design README still mentions optional separate `Entitlement` table / Stripe checkout; **shipped path** is subscription rows + `EntitlementService` as documented here.

---

## Key code

| Concern | Location |
|---------|----------|
| Access decisions | `directwerk-subscription/.../EntitlementService.java` |
| Episode → subject | `directwerk-app/.../EntitlementApiAdapter.java` |
| Products / rules / grants | `SubscriptionProductService`, `ProductAccessRuleService`, `TenantSubscriptionController` |
| RSS / enclosures | `RssFeedService`, `SubscriberEpisodeService`, `EpisodeEnclosureService`, `SubscriberFeedService` |
| Unit tests | `EntitlementServiceTest.java` |
