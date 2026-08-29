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

## Wave 4 deepened modules

### 16. MediaAsset view mapper (`MediaAssetViewMapper` in app)

**Interface:** `toView(MediaAsset)`, `resolveCdnUrlString(MediaAsset)`.  
**Seam:** Controllers delegate CDN eligibility to `PublicCdnUrlResolver`.

### 17. Publication lifecycle support (`PublicationLifecycleSupport` + `PublicationNotificationSupport`)

**Interface:** Shared schedule/unpublish/archive transitions and subscriber notification claim.  
**Seam:** Episode and article workflow services call shared helpers.

### 18. Subscription membership provisioning (`SubscriptionMembershipActivatedEvent`)

**Interface:** Published on manual grant; listener ensures default SubscriberFeed.  
**Seam:** Replaces scattered `ensureDefaultFeed` calls from controllers.

### 19. Subscription revoke orchestration (`SubscriptionService.revokeSubscription`)

**Interface:** Local revoke + external Stripe cancel in one module.  
**Seam:** Controllers no longer scan subscriptions for STRIPE source.

### 20. Subscriber directory query (`SubscriberDirectoryQueryService`)

**Interface:** `listSubscribers(tenantId)` read model.  
**Seam:** Tenant admin subscriber list no longer merges in controller.

### 21. Feed URL resolver (`FeedUrlResolver` + extended `FeedUrls`)

**Interface:** Absolute subscriber/series/enclosure URLs from origin + slug.  
**Seam:** Studio feeds, RSS enclosures share URL grammar.

### 22. Public content projection (`PublicContentProjection`)

**Interface:** FREE-only body/audio/RSS exposure rules.  
**Seam:** Public HTTP and enclosure services share redaction policy.

### 23. Portal stream delivery (`PortalStreamDeliveryFacade`)

**Interface:** JWT stream resolve + analytics + redirect.  
**Seam:** Mirrors `RssFeedDeliveryFacade` for subscriber portal playback.

### 24. Episode access port (`EpisodeAccessApi.hasAccess`)

**Interface:** Single point check aligned with batch `filterAccessible`.  
**Seam:** `SubscriberFeedAccessService` uses podcast port, not cross-module `EntitlementApi`.

### 25. Studio API core (`studioApiCore.ts`)

**Interface:** `studioGet`, `studioMutate`, `createPublicationWorkflowApi`.  
**Seam:** Domain `*Api.ts` modules import only their parsers + core helpers.

### 26. Publication editor/list hooks (`usePublicationEditorWorkflow`, `usePublicationListActions`)

**Interface:** Shared save/workflow/autosave and list row mutations.  
**Seam:** Article and episode UIs share controller logic.

### 27. Web transport + parsers (`envelopeResult`, `createWebPublicParsers`, shared site-config)

**Interface:** Unified fetch/envelope unwrap; single public content parser factory.  
**Seam:** `publicApi`, `subscriberApi`, server fetch share one stack.

### 28. Account dashboard hook (`useAccountDashboard`)

**Interface:** Parallel load of subscriber account view model.  
**Seam:** Account page is presentation-only.

## Wave 5 deepened modules

### 29. Entitlement batch listing (`EntitlementApi.listEntitledDigitalAssetIds`)

**Interface:** Batch entitled digital-asset IDs for portal downloads.  
**Seam:** `SubscriberPortalAccessService` no longer calls `EntitlementService` directly.

### 30. Subscriber access read model (`SubscriberAccessQueryService`)

**Interface:** Active levels, max sort order, packages for `/me/access`.  
**Seam:** `MeController` delegates entitlement mapping to subscription module.

### 31. Tenant public host resolver (`TenantPublicHostResolver`)

**Interface:** Verified host selection (trust request vs primary domain).  
**Seam:** Enclosures, RSS snapshots, and email links share one host policy.

### 32. Episode view mapper (`PublicEpisodeViewMapper`)

**Interface:** `toPublicView`, `toPortalView`, `toStudioView`.  
**Seam:** Public site, subscriber portal, and studio share projection rules.

### 33. RSS CDN eligibility (`PublicCdnUrlResolver` in `RssFeedService`)

**Interface:** Public RSS items use same CDN resolver as API/enclosures.  
**Seam:** `PublicAssetPolicy` cannot drift between RSS and other surfaces.

### 34. Feed provisioning seam (`SubscriberFeedProvisioningService`)

**Interface:** `provisionOnMembershipActivated(tenantId, userId)`.  
**Seam:** Default feed created on membership activation, not lazy list.

### 35. Unified membership activation (`SubscriptionMembershipActivatedEvent`)

**Interface:** Published when Stripe/manual subscription becomes ACTIVE.  
**Seam:** Deleted `StripeMembershipActivatedEvent`; one listener path.

### 36. Validated product rules (`ProductAccessRuleService.replaceRules`)

**Interface:** Scope validation via `ProductAccessRuleScopeValidator` before replace.  
**Seam:** Controller no longer loops validation before service call.

### 37. Upload command mapper (`MediaUploadCommandMapper`)

**Interface:** `CreateUploadUrlRequest` → `UploadApi.CreateUploadUrlCommand`.  
**Seam:** Tenant and platform media controllers share command assembly.

### 38. Scheduled publication executor (`ScheduledPublicationExecutor`)

**Interface:** `publishDue(moduleKey, dueItems, publishOne, label)`.  
**Seam:** Episode and article Quartz jobs share due-item loop + module gate.

### 39. Shared feed URL grammar (`packages/api/src/urls/feedUrls.ts`)

**Interface:** TS mirror of Java `FeedUrls` + public content URL helpers.  
**Seam:** Studio and web build the same RSS/enclosure paths.

### 40. Admin platform modules API (`platformModulesApi.ts` + validators)

**Interface:** Typed platform module enable/disable with shared validation.  
**Seam:** `TenantModulesPanel` no longer inlines fetch paths and validators.

### 41. Platform API core (`platformApiCore.ts`)

**Interface:** `platformGet` / `platformMutate` envelope helpers.  
**Seam:** Admin pages use stable typed exports instead of raw paths.

### 42. Browser transport factory (`createBrowserTransport.ts`)

**Interface:** Shared fetch wrapper with policy injection.  
**Seam:** Studio and web transports differ only in tenant-host binding.

### 43. Publication list page hook (`usePublicationListPage`)

**Interface:** Auth, load, error state, and action wiring for list clients.  
**Seam:** Article and episode list pages are thin shells.

### 44. Publication editor fields (`usePublicationEditorFields` + schedule helpers)

**Interface:** Shared title/slug/access/schedule state and payload builder.  
**Seam:** Editors focus on domain-only preflight (audio, series, categories).

### 45. Web catalog hooks (`useSubscriberAuth`, `usePublicCatalog`)

**Interface:** Auth-aware public vs subscriber catalog with one caching strategy.  
**Seam:** Episodes/feeds/pricing pages stop duplicating token-store logic.

### 46. Cached tenant query (`useCachedTenantQuery`)

**Interface:** SWR-style reference data fetch with in-flight dedupe.  
**Seam:** Levels, products, subscribers clients drop hand-rolled effects.

## Wave 6 deepened modules

### 47. Public surface policy (`PublicSurfacePolicy` in common)

**Interface:** `isFreeAccess`, `exposesFullContent`, `includesInPublicRss`, `articleBody`.  
**Seam:** RSS filtering, public episode views, article redaction, enclosure guards share one module.  
**Note:** MediaAsset CDN eligibility stays in `PublicAssetPolicy` (digital).

### 48. Subscriber playback (`SubscriberPlaybackService` in podcast)

**Interface:** `resolvePortalPlayback`, `resolveRssPlayback`.  
**Seam:** JWT portal and tokenized RSS paths share playback URL policy.

### 49. Published episode entitlement gate (`PublishedEpisodeEntitlementGate`)

**Interface:** `hasAccess(tenantId, userId, episodeId)` with PUBLISHED guard.  
**Seam:** `EntitlementApiAdapter` and `EpisodeAccessAdapter` delegate here — no duplicate guards.

### 50. Episode portal asset access (`AssetAccessApi.resolveEpisodePortalUrl`)

**Interface:** PAID module gate + `resolveDownloadUrl` for subscriber portal streams.  
**Seam:** `SubscriberPlaybackService` no longer pre-gates PAID episodes at call sites.

### 51. OpenAPI codegen entry (`packages/api` `generate:openapi`)

**Interface:** `pnpm generate:openapi` → `src/generated/openapi.ts` from exported spec.  
**Seam:** Incremental migration off hand-written `src/validation/*` parsers.

### 52. Server-provided public series feed URLs (`PublicPodcastController.PublicSeriesView.rssUrl`)

**Interface:** Absolute series feed URL in public catalog API.  
**Seam:** `directwerk-web` uses API URLs instead of TS `feedUrls` client construction.

### 53. Publication lifecycle worker guard (`PublicationLifecycleSupport.skipScheduledPublishIfStatusChanged`)

**Interface:** Shared skip log + early return for Quartz scheduled publish races.  
**Seam:** Episode and article workflow services share worker guard; article archive uses `PublicationLifecycleSupport.archive`.

### 54. Content scope validation errors (`InvalidContentScopeException`)

**Interface:** `scopeType`, `scopeId`, message when ProductAccessRule target missing.  
**Seam:** `ContentScopeLookupAdapter` raises structured errors at the port boundary.

## Wave 7 deepened modules

### 55. Public content URL resolver (`PublicContentUrlResolver` + `PublicContentPaths`)

**Interface:** `episodePageUrl`, `articlePageUrl`, `notificationPreferencesUrl` via verified host policy.  
**Seam:** Email (`ContentPublicUrlBuilder`), Studio previews, and future API surfaces share one Java module.

### 56. Public site origin (`SiteConfigView.publicSiteUrl`)

**Interface:** Absolute tenant public-site origin in site config.  
**Seam:** Studio `publicEpisodePageUrl` / `publicArticlePageUrl` use server origin instead of RSS feed URL hack.

### 57. Published playable Episode guard (`PublishedPlayableEpisodeGuard`)

**Interface:** `requirePlayable(tenantId, slug, ENCLOSURE|PORTAL_STREAM)`, `hasReadyAudio`.  
**Seam:** Enclosure, portal stream, and RSS audio access share playability rules.

### 58. SubscriberFeed URL host policy (`FeedUrlResolver.subscriberFeedUrl` + `TenantPublicHostResolver`)

**Interface:** Private feed URLs resolve verified host, not raw `HttpServletRequest` host.  
**Seam:** `MeFeedController` matches public RSS/enclosure host policy (#31).

### 59. Public article view mapper (`PublicArticleViewMapper`)

**Interface:** `toPublicView(Article)` with `PublicSurfacePolicy` redaction.  
**Seam:** `PublicArticleController` delegates; mirrors `PublicEpisodeViewMapper` (#32).

### 60. Episode playback delivery (`EpisodePlaybackDeliveryFacade`)

**Interface:** `deliverEnclosure`, `deliverStream` — analytics + redirect choreography.  
**Seam:** `RssFeedDeliveryFacade` and `PortalStreamDeliveryFacade` delegate here.

### 61. OpenAPI generated contract (`packages/api/src/generated/openapi.ts`)

**Interface:** Real types from exported spec; `pnpm generate:openapi` + `check:openapi`.  
**Seam:** Incremental migration off hand-written parsers (#51 → active).

### 62. Subscriber feeds hook (`useSubscriberFeeds`)

**Interface:** Auth-aware private feed list with shared error handling.  
**Seam:** `/feeds` page is presentation-only; matches account dashboard loading pattern (#28).

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
