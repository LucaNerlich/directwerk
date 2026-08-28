# Directwerk — architecture context

Domain glossary and deepening modules for AI navigation. Terms here name **seams** (see `LANGUAGE.md` in the improve-codebase-architecture skill).

## Core domain (from README / AGENTS.md)

| Term | Meaning |
|------|---------|
| **Tenant** | Whitelabel publisher; resolved from verified Host |
| **Episode** | Podcast publication unit; workflow draft → published |
| **MediaAsset** | S3-backed file; staging → confirm → public/private visibility |
| **SubscriptionProduct** | Sellable access package |
| **ProductAccessRule** | LEVEL or PACKAGE scope linking products to content |
| **SubscriberFeed** | Tokenized private RSS; default per tenant |
| **Entitlement filter** | Evaluates Subscription + ProductAccessRule for access |
| **Feature module** | DIGITAL_CONTENT → PODCAST → PODCAST_RSS → FEED_BUILDER |

## Deepened modules (10)

### 1. Studio domain API (`directwerk-studio/lib/api/*Api.ts`)

**Interface:** Typed functions per domain (`listEpisodes`, `grantSubscription`, …).  
**Seam:** Browser → BFF proxy → upstream.  
**Depth:** ~75 calls grouped into podcast, write, media, subscription, tenant-settings.

### 2. API contract tower (`packages/api/src/validation` + OpenAPI)

**Interface:** Runtime parsers + TypeScript types per entity.  
**Seam:** Proxy response JSON → validated DTO.  
**Target:** Single source from exported OpenAPI (`./Directwerk/gradlew :directwerk-app:exportOpenApi`).

### 3. Transport policy (`packages/api/src/client/policies.ts`)

**Interface:** Named auth/error policies: `studioCreator`, `subscriberPortal`, `platformAdmin`, `platformTenantAdmin`.  
**Seam:** `createAuthedRequest(policy + session)`.

### 4. Admin BFF proxy (`packages/api/src/proxy/platformRouteHandler.ts`)

**Interface:** `createPlatformProxyRouteHandler`, `createAdminTenantProxyRouteHandler`.  
**Seam:** Next.js route → upstream platform/tenant API.

### 5. MediaAsset browser upload (`packages/api/src/media/browserUpload.ts`)

**Interface:** `uploadMediaFile(config)` with transport adapter for XHR.  
**Seam:** File → BFF upload route → parsed MediaAsset.

### 6. Entitlement evaluation (`directwerk-subscription` — `EntitlementService`)

**Interface:** `hasEpisodeAccess`, `hasDigitalAssetAccess`, batch filters.  
**Seam:** `EntitlementApi` port in digital; app wires adapter only.

### 7. SubscriberFeed access (`SubscriberFeedAccess` in podcast)

**Interface:** `(tenant, subscriber, feed) → entitled episodes/assets`.  
**Seam:** RSS, enclosure, portal, presign adapters call one module.

### 8. Feed snapshot lifecycle (`RssFeedSnapshotService` + module gate)

**Interface:** Refresh snapshot for a SubscriberFeed when modules active.  
**Seam:** Uses `ModuleGateService.isModuleActive(tenantId, key)`.

### 9. Module gate (`ModuleGateService`)

**Interface:** `requireModule(key)` for request context; `isModuleActive(tenantId, key)` for workers.  
**Seam:** Single cached activation read path.

### 10. Public asset policy (`PublicAssetPolicy` in digital)

**Interface:** `isPublicCdnEligible(tenantSlug, asset)`, `publicCdnUrl(asset)`.  
**Seam:** RSS, public site, enclosure redirect share one eligibility rule.

## Wave 3 deepened modules

### 11. Entitlement port (`EntitlementApi` in common)

**Interface:** `hasAccess`, `hasDigitalAssetAccess`, `filterAccessibleDigitalAssets`.  
**Seam:** Podcast adapter implements; digital fail-closed fallback.

### 12. Content scope lookup (`ContentScopeLookupApi` in common)

**Interface:** `requirePodcastSeries`, `requireFormat`, `requireCategory`, `requireDigitalAsset`.  
**Seam:** App adapter reaches podcast/digital repos; subscription validator uses port only.

### 13. Subscriber portal access (`SubscriberPortalAccessService` in podcast)

**Interface:** JWT portal Episode streams, library, MediaAsset downloads.  
**Seam:** Complements `SubscriberFeedAccess` (tokenized RSS).

### 14. RSS feed delivery (`RssFeedDeliveryFacade` in podcast)

**Interface:** Public/private enclosure redirect + analytics tracking.  
**Seam:** Controllers delegate; one place for enclosure delivery orchestration.

### 15. Public CDN resolver (`PublicCdnUrlResolver` in digital)

**Interface:** `resolve(MediaAsset)` via `PublicAssetPolicy`.  
**Seam:** `EpisodeMediaService.publicCdnUrl` and RSS paths share eligibility.

## Migration order

1. Transport policies (#3)  
2. Studio API split (#1)  
3. Media upload module (#5)  
4. Admin proxy (#4)  
5. Public asset policy (#10)  
6. Module gate consolidation (#9)  
7. SubscriberFeed access (#7)  
8. Entitlement locality (#6)  
9. Feed snapshot boundary (#8)  
10. OpenAPI contract tower (#2)
