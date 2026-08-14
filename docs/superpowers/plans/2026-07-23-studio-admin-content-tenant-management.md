# Studio & Admin: Content + Tenant Management Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `example-admin` and `directwerk-studio` fully exercise the Directwerk API for tenant management and content management (articles + podcasts, including tying podcasts to formats/categories), fix a real RSS/feed URL bug (missing port locally), and apply a light shared UI consistency pass across both apps.

**Architecture:** Backend changes are additive (new endpoint methods, a new shared URL-building utility, widened method signatures to thread scheme/host/port instead of hostname-only) — no schema/route renames. Frontend changes follow each app's existing patterns exactly: studio's client-fetch + `tenantApi.ts` + CSS-Modules pattern (new forms use `next/form` + `useActionState`, per explicit user direction), admin's `lib/api/client.ts` proxy + `next/form` + `useActionState` pattern (already used by `InviteTenantUserForm`).

**Tech Stack:** Java 21, Spring Boot 4.1.0 (Directwerk, Gradle multi-module), Next.js 16 + React 19 (example-admin, directwerk-studio), Vitest, plain CSS + CSS Modules (no Tailwind/component library in either frontend).

## Global Constraints

- Every backend controller change (new endpoint, changed request/response shape) MUST be paired with a matching Bruno collection update in `Directwerk/bruno/` in the same task/commit (AGENTS.md rule #5, reaffirmed by the user as a standing rule for this project).
- No new frontend dependencies (no Tailwind, no component library, no state library) — match each app's existing plain-CSS/CSS-Modules, hand-rolled-fetch style.
- New forms in both frontends use `next/form` (`<Form>`) + React's `useActionState`, with the mutation itself going through the existing Next.js API-route proxy (`/api/proxy/[...path]` in each app) — per explicit user direction, this supersedes the older plain-`onSubmit`-handler style used by some existing components (`ProductEditor`, `SeriesEditor`), which are left as-is (not retroactively refactored — out of scope).
- All UI copy in `directwerk-studio` is German, matching every existing component (`ArticleEditor`, `SeriesEditor`, `ProductEditor`, `SideNav`, etc.). All UI copy in `example-admin` is English, matching every existing component (`InviteTenantUserForm`, `TenantModulesPanel`, `PlatformAdminsPage`).
- `directwerk-common` has no dependency on Servlet API or any other module — the new `PublicUrlBuilder` utility must be pure string formatting (scheme/host/port already resolved by the caller), not take `HttpServletRequest`.
- Follow each module's existing package conventions exactly: new Directwerk exceptions go in `de.pnnit.directwerk.modules.core.service` (unqualified `RuntimeException` subclasses, one class per file, mapped in `GlobalExceptionHandler` by exact class), matching `CannotDeactivateSelfException`/`CannotDeactivateLastAdminException`.
- Run `./gradlew :directwerk-app:test` after every Directwerk backend task (most integration/controller tests live there even for lower-module code, per `Directwerk/CLAUDE.md`). Run `pnpm test` (Vitest) in whichever frontend a task touches.

---

## Phase 1 — Backend: fix RSS/feed URL generation (missing port, wrong scheme, slug-as-hostname bug)

### Task 1: `PublicUrlBuilder` utility + test

**Files:**
- Create: `Directwerk/directwerk-common/src/main/java/de/pnnit/directwerk/modules/core/util/PublicUrlBuilder.java`
- Test: `Directwerk/directwerk-common/src/test/java/de/pnnit/directwerk/modules/core/util/PublicUrlBuilderTest.java`

**Interfaces:**
- Produces: `PublicUrlBuilder.baseUrl(String scheme, String host, int port) -> String` — used by every task in Phase 1 and by Task 6 (Series `rssUrl`).

- [ ] **Step 1: Write the failing test**

```java
package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PublicUrlBuilderTest {

    @Test
    void omitsDefaultHttpPort() {
        assertThat(PublicUrlBuilder.baseUrl("http", "example.com", 80))
                .isEqualTo("http://example.com");
    }

    @Test
    void omitsDefaultHttpsPort() {
        assertThat(PublicUrlBuilder.baseUrl("https", "example.com", 443))
                .isEqualTo("https://example.com");
    }

    @Test
    void keepsNonDefaultPort() {
        assertThat(PublicUrlBuilder.baseUrl("http", "localhost", 8080))
                .isEqualTo("http://localhost:8080");
    }

    @Test
    void keepsNonDefaultHttpsPort() {
        assertThat(PublicUrlBuilder.baseUrl("https", "example.com", 8443))
                .isEqualTo("https://example.com:8443");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :directwerk-common:test --tests "de.pnnit.directwerk.modules.core.util.PublicUrlBuilderTest"`
Expected: FAIL (compilation error — `PublicUrlBuilder` does not exist)

- [ ] **Step 3: Write minimal implementation**

```java
package de.pnnit.directwerk.modules.core.util;

public final class PublicUrlBuilder {

    private PublicUrlBuilder() {
    }

    /**
     * Builds a {@code scheme://host[:port]} origin, omitting the port when it is the
     * scheme's default (80 for http, 443 for https). Callers are responsible for resolving
     * a trusted scheme/host/port (e.g. from the current request, respecting
     * {@code server.forward-headers-strategy}) before calling this.
     */
    public static String baseUrl(String scheme, String host, int port) {
        boolean isDefaultPort = ("http".equalsIgnoreCase(scheme) && port == 80)
                || ("https".equalsIgnoreCase(scheme) && port == 443);
        return scheme + "://" + host + (isDefaultPort ? "" : ":" + port);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :directwerk-common:test --tests "de.pnnit.directwerk.modules.core.util.PublicUrlBuilderTest"`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add Directwerk/directwerk-common/src/main/java/de/pnnit/directwerk/modules/core/util/PublicUrlBuilder.java Directwerk/directwerk-common/src/test/java/de/pnnit/directwerk/modules/core/util/PublicUrlBuilderTest.java
git commit -m "feat(directwerk-common): add PublicUrlBuilder for scheme/host/port origin formatting"
```

---

### Task 2: Fix `EpisodeEnclosureService` + `EpisodeDownloadAnalyticsService` to thread scheme/port

**Files:**
- Modify: `Directwerk/directwerk-podcast/src/main/java/de/pnnit/directwerk/modules/podcast/service/EpisodeEnclosureService.java:82-111`
- Modify: `Directwerk/directwerk-podcast/src/main/java/de/pnnit/directwerk/modules/podcast/service/EpisodeDownloadAnalyticsService.java:81-104`
- Test: `Directwerk/directwerk-app/src/test/java/de/pnnit/directwerk/modules/podcast/service/EpisodeEnclosureServiceTest.java` (existing file — add cases)
- Test: `Directwerk/directwerk-app/src/test/java/de/pnnit/directwerk/modules/podcast/service/EpisodeDownloadAnalyticsServiceTest.java` (existing file — add cases)

**Interfaces:**
- Consumes: `PublicUrlBuilder.baseUrl(String, String, int)` from Task 1.
- Produces: `EpisodeEnclosureService.publicEnclosureUrl(Long tenantId, String scheme, String requestedHostname, int port, String tenantSlug, String episodeSlug)`, `.privateEnclosureUrl(Long tenantId, String scheme, String requestedHostname, int port, String tenantSlug, String feedToken, String episodeSlug)`, `EpisodeDownloadAnalyticsService.publicRssEnclosureUrl(Long tenantId, String scheme, String hostname, int port, String tenantSlug, String episodeSlug)`, `.privateRssEnclosureUrl(Long tenantId, String scheme, String hostname, int port, String tenantSlug, String feedToken, String episodeSlug)` — consumed by Task 3 (`RssFeedService`).
- Note: `EpisodeDownloadAnalyticsService.publicDownloadUrl(String, String)` and `.trackEpisodeDownload(...)` are untouched — they are unused (dead code) and analytics-only (hostname-as-dimension, not URL-building) respectively; out of scope for this fix.

- [ ] **Step 1: Add failing test cases to `EpisodeEnclosureServiceTest`**

Open the existing test file and add (adjust existing test scaffolding/mocks as needed — the file already has a fixture tenant with a verified primary domain, reuse it):

```java
@Test
void publicEnclosureUrlKeepsNonDefaultPortFromRequest() {
    String url = episodeEnclosureService.publicEnclosureUrl(
            tenant.getId(), "http", tenant.getDomains().getFirst().getHost(), 8080,
            tenant.getSlug(), "episode-slug"
    );
    assertThat(url).isEqualTo(
            "http://" + tenant.getDomains().getFirst().getHost() + ":8080/feeds/"
                    + tenant.getSlug() + "/e/episode-slug.mp3"
    );
}
```

(Use whatever the file's existing fixture/tenant-domain setup helper is named — read the file first to match its existing test data setup exactly before adding this.)

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :directwerk-app:test --tests "*EpisodeEnclosureServiceTest*"`
Expected: FAIL (compile error — method signature doesn't accept `scheme`/`port` yet)

- [ ] **Step 3: Update `EpisodeEnclosureService`**

Replace lines 82-111 of `EpisodeEnclosureService.java`:

```java
    /**
     * Builds a stable public enclosure URL using a verified tenant domain only.
     * Request-derived hosts are accepted only when they are on the tenant allow-list;
     * otherwise the tenant primary verified domain is used. Scheme and port are taken
     * as-is from the caller (the current request) since they describe how this instance
     * is being reached right now, not a property of the tenant's domain record.
     */
    @Transactional(readOnly = true)
    public String publicEnclosureUrl(
            Long tenantId,
            String scheme,
            String requestedHostname,
            int port,
            String tenantSlug,
            String episodeSlug
    ) {
        String host = requireTrustedPublicHost(tenantId, requestedHostname);
        return de.pnnit.directwerk.modules.core.util.PublicUrlBuilder.baseUrl(scheme, host, port)
                + "/feeds/" + tenantSlug
                + "/e/" + episodeSlug + ".mp3";
    }

    /**
     * Builds a stable private enclosure URL using a verified tenant domain only.
     */
    @Transactional(readOnly = true)
    public String privateEnclosureUrl(
            Long tenantId,
            String scheme,
            String requestedHostname,
            int port,
            String tenantSlug,
            String feedToken,
            String episodeSlug
    ) {
        String host = requireTrustedPublicHost(tenantId, requestedHostname);
        return de.pnnit.directwerk.modules.core.util.PublicUrlBuilder.baseUrl(scheme, host, port)
                + "/feeds/" + tenantSlug
                + "/u/" + feedToken
                + "/e/" + episodeSlug + ".mp3";
    }
```

Add the import at the top instead of using the fully-qualified name inline:

```java
import de.pnnit.directwerk.modules.core.util.PublicUrlBuilder;
```

and simplify the two call sites to `PublicUrlBuilder.baseUrl(scheme, host, port)`.

- [ ] **Step 4: Update `EpisodeDownloadAnalyticsService`**

Replace lines 81-104 of `EpisodeDownloadAnalyticsService.java`:

```java
    public String publicRssEnclosureUrl(
            Long tenantId,
            String scheme,
            String hostname,
            int port,
            String tenantSlug,
            String episodeSlug
    ) {
        return episodeEnclosureService.publicEnclosureUrl(tenantId, scheme, hostname, port, tenantSlug, episodeSlug);
    }

    public String privateRssEnclosureUrl(
            Long tenantId,
            String scheme,
            String hostname,
            int port,
            String tenantSlug,
            String feedToken,
            String episodeSlug
    ) {
        return episodeEnclosureService.privateEnclosureUrl(
                tenantId,
                scheme,
                hostname,
                port,
                tenantSlug,
                feedToken,
                episodeSlug
        );
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./gradlew :directwerk-app:test --tests "*EpisodeEnclosureServiceTest*" --tests "*EpisodeDownloadAnalyticsServiceTest*"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add Directwerk/directwerk-podcast/src/main/java/de/pnnit/directwerk/modules/podcast/service/EpisodeEnclosureService.java Directwerk/directwerk-podcast/src/main/java/de/pnnit/directwerk/modules/podcast/service/EpisodeDownloadAnalyticsService.java Directwerk/directwerk-app/src/test/java/de/pnnit/directwerk/modules/podcast/service/EpisodeEnclosureServiceTest.java Directwerk/directwerk-app/src/test/java/de/pnnit/directwerk/modules/podcast/service/EpisodeDownloadAnalyticsServiceTest.java
git commit -m "fix(directwerk-podcast): thread request scheme/port through enclosure URL builders"
```

---

### Task 3: Fix `RssXmlBuilder` channel `<link>` + `RssFeedService` to thread scheme/port

**Files:**
- Modify: `Directwerk/directwerk-podcast/src/main/java/de/pnnit/directwerk/modules/podcast/service/RssXmlBuilder.java:16-31`
- Modify: `Directwerk/directwerk-podcast/src/main/java/de/pnnit/directwerk/modules/podcast/service/RssFeedService.java`
- Test: `Directwerk/directwerk-app/src/test/java/de/pnnit/directwerk/modules/podcast/service/RssFeedServiceTest.java` (existing — add/adjust cases)

**Interfaces:**
- Consumes: `PublicUrlBuilder.baseUrl` (Task 1), `EpisodeDownloadAnalyticsService.publicRssEnclosureUrl`/`privateRssEnclosureUrl` (Task 2, now with `scheme`/`port` params).
- Produces: `RssFeedService.buildPublicFeed(Tenant, PodcastSeries, String scheme, String host, int port)`, `.buildPrivateFeed(Tenant, SubscriberFeed, String scheme, String host, int port)` — consumed by Task 4 (`RssFeedController`). `RssXmlBuilder.buildPublicFeed(Tenant, PodcastSeries, List<RssEpisode>, String originBaseUrl)` — the 4th param is new.

- [ ] **Step 1: Add a failing test to `RssFeedServiceTest`**

Read the existing file first to match its fixture/mocking style, then add:

```java
@Test
void publicFeedChannelLinkUsesRequestOriginNotTenantSlug() {
    String xml = rssFeedService.buildPublicFeed(tenant, null, "http", "localhost", 8080);
    assertThat(xml).contains("<link>http://localhost:8080</link>");
    assertThat(xml).doesNotContain("<link>https://" + tenant.getSlug() + "</link>");
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :directwerk-app:test --tests "*RssFeedServiceTest*"`
Expected: FAIL (compile error — `buildPublicFeed` still takes 3 args)

- [ ] **Step 3: Update `RssXmlBuilder.buildPublicFeed`**

Replace lines 16-23 of `RssXmlBuilder.java`:

```java
    public String buildPublicFeed(
            Tenant tenant,
            PodcastSeries seriesOrNull,
            List<RssEpisode> episodes,
            String originBaseUrl
    ) {
        StringBuilder xml = new StringBuilder(4096);
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<rss version=\"2.0\">\n");
        xml.append("  <channel>\n");
        appendElement(xml, "title", channelTitle(tenant, seriesOrNull, episodes), 4);
        appendElement(xml, "link", originBaseUrl, 4);
        appendElement(xml, "description", channelDescription(tenant, seriesOrNull), 4);
        appendElement(xml, "language", channelLanguage(seriesOrNull, episodes), 4);
```

(Leave the rest of the method body — the episode loop and closing tags — unchanged.)

- [ ] **Step 4: Update `RssFeedService`**

Replace `buildPublicFeed`/`buildPrivateFeed`/`toPublicRssEpisode`/`toPrivateRssEpisode` (lines 27-96 of `RssFeedService.java`):

```java
    @Transactional(readOnly = true)
    public String buildPublicFeed(Tenant tenant, PodcastSeries seriesOrNull, String scheme, String host, int port) {
        Long seriesId = seriesOrNull != null ? seriesOrNull.getId() : null;
        String originBaseUrl = PublicUrlBuilder.baseUrl(scheme, host, port);
        List<RssXmlBuilder.RssEpisode> episodes = publicPodcastQueryService
                .listPublishedEpisodes(tenant.getId(), seriesId)
                .stream()
                .filter(episode -> episode.getAccessPolicy() == AccessPolicy.FREE)
                .filter(Episode::isEnclosureEnabled)
                .map(episode -> toPublicRssEpisode(episode, tenant, scheme, host, port))
                .flatMap(Optional::stream)
                .toList();
        return rssXmlBuilder.buildPublicFeed(tenant, seriesOrNull, episodes, originBaseUrl);
    }

    @Transactional(readOnly = true)
    public String buildPrivateFeed(Tenant tenant, SubscriberFeed feed, String scheme, String host, int port) {
        if (!feed.isEnabled()) {
            throw new de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedNotFoundException();
        }
        String originBaseUrl = PublicUrlBuilder.baseUrl(scheme, host, port);
        List<RssXmlBuilder.RssEpisode> episodes = subscriberEpisodeService
                .listEntitledEpisodes(tenant.getId(), feed.getUser().getId())
                .stream()
                .filter(Episode::isEnclosureEnabled)
                .map(episode -> toPrivateRssEpisode(episode, tenant, feed.getFeedToken(), scheme, host, port))
                .flatMap(Optional::stream)
                .toList();
        return rssXmlBuilder.buildPublicFeed(tenant, null, episodes, originBaseUrl);
    }

    private Optional<RssXmlBuilder.RssEpisode> toPublicRssEpisode(
            Episode episode,
            Tenant tenant,
            String scheme,
            String host,
            int port
    ) {
        MediaAsset asset = episode.getAudioAsset();
        if (!isReadyAudio(asset) || !isPublicCdnEligible(asset, tenant.getSlug())) {
            return Optional.empty();
        }
        // Always use the stable public enclosure proxy (Umami + CDN redirect); never embed CDN/S3.
        String url = episodeDownloadAnalyticsService.publicRssEnclosureUrl(
                tenant.getId(),
                scheme,
                host,
                port,
                tenant.getSlug(),
                episode.getSlug()
        );
        return Optional.of(toRssEpisode(episode, asset, url));
    }

    private Optional<RssXmlBuilder.RssEpisode> toPrivateRssEpisode(
            Episode episode,
            Tenant tenant,
            String feedToken,
            String scheme,
            String host,
            int port
    ) {
        MediaAsset asset = episode.getAudioAsset();
        if (!isReadyAudio(asset)) {
            return Optional.empty();
        }
        if (episode.getAccessPolicy() == AccessPolicy.FREE) {
            return toPublicRssEpisode(episode, tenant, scheme, host, port);
        }
        String url = episodeDownloadAnalyticsService.privateRssEnclosureUrl(
                tenant.getId(),
                scheme,
                host,
                port,
                tenant.getSlug(),
                feedToken,
                episode.getSlug()
        );
        return Optional.of(toRssEpisode(episode, asset, url));
    }
```

Add the import: `import de.pnnit.directwerk.modules.core.util.PublicUrlBuilder;`

- [ ] **Step 5: Run tests to verify they pass**

Run: `./gradlew :directwerk-app:test --tests "*RssFeedServiceTest*"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add Directwerk/directwerk-podcast/src/main/java/de/pnnit/directwerk/modules/podcast/service/RssXmlBuilder.java Directwerk/directwerk-podcast/src/main/java/de/pnnit/directwerk/modules/podcast/service/RssFeedService.java Directwerk/directwerk-app/src/test/java/de/pnnit/directwerk/modules/podcast/service/RssFeedServiceTest.java
git commit -m "fix(directwerk-podcast): fix RSS channel link to use request origin, not tenant slug as hostname"
```

---

### Task 4: Fix `RssFeedController` + `MeFeedController` call sites

**Files:**
- Modify: `Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/controller/publicapi/RssFeedController.java:63-99`
- Modify: `Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/controller/auth/MeFeedController.java:91-104`
- Test: `Directwerk/directwerk-app/src/test/java/de/pnnit/directwerk/controller/publicapi/RssFeedControllerTest.java` (existing — add/adjust cases)

**Interfaces:**
- Consumes: `RssFeedService.buildPublicFeed`/`buildPrivateFeed` (Task 3, now 5-arg), `PublicUrlBuilder.baseUrl` (Task 1).

- [ ] **Step 1: Add a failing test to `RssFeedControllerTest`**

Read the existing file first to see how it drives `MockMvc`/`TestRestTemplate` and sets the request's scheme/host/port (it likely already sets a `Host` header to resolve `TenantContext` for these public routes — check how). Add a case asserting that hitting `podcast.xml` with an explicit non-default port in the request produces a channel `<link>` containing that port, e.g.:

```java
@Test
void publicPodcastFeedChannelLinkIncludesRequestPort() throws Exception {
    mockMvc.perform(get("/feeds/{slug}/podcast.xml", tenant.getSlug())
                    .header("Host", verifiedHost + ":8080"))
            .andExpect(status().isOk())
            .andExpect(content().string(org.hamcrest.Matchers.containsString(
                    "<link>http://" + verifiedHost + ":8080</link>"
            )));
}
```

(Match the exact MockMvc setup, `verifiedHost` variable name, and whether requests are `http` or `https` by default in this test class's existing tests — adjust the expected scheme accordingly.)

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :directwerk-app:test --tests "*RssFeedControllerTest*"`
Expected: FAIL (link still uses old hardcoded `https://` + slug, or compile error if the service call site isn't updated yet)

- [ ] **Step 3: Update `RssFeedController`**

Replace the three `buildPublicFeed`/`buildPrivateFeed` call sites (lines 68, 83, 97):

```java
    @GetMapping("/podcast.xml")
    ResponseEntity<String> publicPodcastFeed(@PathVariable String tenantSlug, HttpServletRequest request) {
        Tenant tenant = requireHostTenant(tenantSlug);
        requireModules(PodcastRssModule.KEY);

        String xml = rssFeedService.buildPublicFeed(
                tenant, null, request.getScheme(), request.getServerName(), request.getServerPort()
        );
        return rssResponse(xml);
    }

    @GetMapping("/{seriesSlug}.xml")
    ResponseEntity<String> publicSeriesFeed(
            @PathVariable String tenantSlug,
            @PathVariable String seriesSlug,
            HttpServletRequest request
    ) {
        Tenant tenant = requireHostTenant(tenantSlug);
        requireModules(PodcastRssModule.KEY);

        PodcastSeries series = podcastSeriesRepository.findByTenantIdAndSlug(tenant.getId(), seriesSlug)
                .orElseThrow(() -> new SeriesNotFoundException(seriesSlug));
        String xml = rssFeedService.buildPublicFeed(
                tenant, series, request.getScheme(), request.getServerName(), request.getServerPort()
        );
        return rssResponse(xml);
    }

    @GetMapping("/u/{feedToken}.xml")
    ResponseEntity<String> privateSubscriberFeed(
            @PathVariable String tenantSlug,
            @PathVariable String feedToken,
            HttpServletRequest request
    ) {
        Tenant tenant = requireHostTenant(tenantSlug);
        requireModules(PodcastRssModule.KEY, SubscriptionModule.MODULE_KEY);

        SubscriberFeed feed = requireEnabledFeed(tenant, feedToken);
        String xml = rssFeedService.buildPrivateFeed(
                tenant, feed, request.getScheme(), request.getServerName(), request.getServerPort()
        );
        return rssResponse(xml);
    }
```

(The `publicEnclosure`/`privateEnclosure` methods below these are untouched — their `request.getServerName()` calls feed `trackEpisodeDownload`, which is analytics-only, not URL-building.)

- [ ] **Step 4: Update `MeFeedController.toView`**

Replace lines 91-94 of `MeFeedController.java`:

```java
    private static SubscriberFeedView toView(SubscriberFeed feed, HttpServletRequest request) {
        String origin = de.pnnit.directwerk.modules.core.util.PublicUrlBuilder.baseUrl(
                request.getScheme(), request.getServerName(), request.getServerPort()
        );
        String url = origin
                + "/feeds/" + feed.getTenant().getSlug()
                + "/u/" + feed.getFeedToken() + ".xml";
```

Add the import `de.pnnit.directwerk.modules.core.util.PublicUrlBuilder` at the top and use the unqualified name instead.

- [ ] **Step 5: Run tests to verify they pass**

Run: `./gradlew :directwerk-app:test --tests "*RssFeedControllerTest*" --tests "*MeFeedController*"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/controller/publicapi/RssFeedController.java Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/controller/auth/MeFeedController.java Directwerk/directwerk-app/src/test/java/de/pnnit/directwerk/controller/publicapi/RssFeedControllerTest.java
git commit -m "fix(directwerk-app): pass request scheme/port into RSS feed URL builders"
```

---

### Task 5: Fix `PublicSiteConfigService.publicRssUrl` + `PublicSiteConfigController`

**Files:**
- Modify: `Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/service/PublicSiteConfigService.java:31-76`
- Modify: `Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/controller/publicapi/PublicSiteConfigController.java:27-30`
- Test: find and update the existing `PublicSiteConfigService`/`PublicSiteConfigController` test (search `Directwerk/directwerk-app/src/test` for `PublicSiteConfig` if not already located).

**Interfaces:**
- Consumes: `PublicUrlBuilder.baseUrl` (Task 1).

- [ ] **Step 1: Locate and read the existing test**

Run: `find Directwerk/directwerk-app/src/test -iname "*PublicSiteConfig*"`

Read whichever file(s) are found, and add a failing case asserting `publicRssUrl` includes a non-default port when the resolved host request specifies one, e.g. `"http://localhost:8080/feeds/{slug}/podcast.xml"` instead of `"https://localhost/feeds/..."`.

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :directwerk-app:test --tests "*PublicSiteConfig*"`
Expected: FAIL

- [ ] **Step 3: Update `PublicSiteConfigService`**

Replace lines 31-76 of `PublicSiteConfigService.java`:

```java
    @Transactional(readOnly = true)
    @Cacheable(
            cacheNames = DirectwerkCacheNames.PUBLIC_SITE_CONFIG,
            key = "#scheme.trim().toLowerCase(T(java.util.Locale).ROOT) + '://' + #host.trim().toLowerCase(T(java.util.Locale).ROOT) + ':' + #port",
            condition = "#host != null && !#host.isBlank()"
    )
    public SiteConfigView loadSiteConfig(String scheme, String host, int port) {
        Tenant tenant = tenantResolver.resolveHost(host)
                .orElseThrow(() -> new TenantNotFoundException(host));

        TenantBranding branding = tenantBrandingRepository.findByTenantId(tenant.getId())
                .orElse(null);
        List<String> enabledModules = moduleGateService.enabledModuleKeys(tenant.getId()).stream()
                .sorted()
                .toList();
        StudioNavigationView studioNavigation = studioNavigationService.resolve(enabledModules);
        return new SiteConfigView(
                new TenantView(tenant.getSlug(), tenant.getName()),
                enabledModules,
                brandingView(branding),
                publicRssUrl(scheme, host, port, tenant, enabledModules),
                analyticsView(branding, enabledModules),
                studioNavigation.home(),
                studioNavigation.desks()
        );
    }

    private static BrandingView brandingView(TenantBranding branding) {
        if (branding == null) {
            return new BrandingView(null, null, null, null);
        }
        return new BrandingView(
                branding.getSiteTitle(),
                branding.getPrimaryColor(),
                branding.getSecondaryColor(),
                branding.getLogoUrl()
        );
    }

    private static String publicRssUrl(String scheme, String host, int port, Tenant tenant, List<String> enabledModules) {
        if (!enabledModules.contains(PODCAST_RSS_MODULE_KEY)) {
            return null;
        }
        String origin = de.pnnit.directwerk.modules.core.util.PublicUrlBuilder.baseUrl(
                scheme, host.trim().toLowerCase(java.util.Locale.ROOT), port
        );
        return origin + "/feeds/" + tenant.getSlug() + "/podcast.xml";
    }
```

(The cache key now includes scheme, host, and port — all normalized to ensure consistent cache hits regardless of input casing.)

- [ ] **Step 4: Update `PublicSiteConfigController`**

Replace line 29 of `PublicSiteConfigController.java`:

```java
        SiteConfigView config = publicSiteConfigService.loadSiteConfig(
                request.getScheme(), request.getServerName(), request.getServerPort()
        );
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./gradlew :directwerk-app:test --tests "*PublicSiteConfig*"`
Expected: PASS

- [ ] **Step 6: Run the full Directwerk suite to confirm Phase 1 introduced no regressions**

Run: `./gradlew :directwerk-app:test`
Expected: PASS (all tests, including the ones touched in Tasks 2-5)

- [ ] **Step 7: Commit**

```bash
git add Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/service/PublicSiteConfigService.java Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/controller/publicapi/PublicSiteConfigController.java
git commit -m "fix(directwerk-core): thread request scheme/port into public site-config RSS URL"
```

---

## Phase 2 — Backend: expose per-series RSS URL

### Task 6: Add computed `rssUrl` to `SeriesController.SeriesView`

**Files:**
- Modify: `Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/controller/podcast/SeriesController.java` (whole file — constructor, all 4 endpoint methods, `toView`, `SeriesView` record)
- Test: `Directwerk/directwerk-app/src/test/java/de/pnnit/directwerk/controller/podcast/SeriesControllerTest.java` (existing — add/adjust cases)

**Interfaces:**
- Consumes: `PublicUrlBuilder.baseUrl` (Task 1), `ModuleGateService.enabledModuleKeys(Long)` (existing), `TenantLookupService.requireTenant(Long)` (existing, used the same way in `TenantManagementService`), `PodcastRssModule.KEY` (existing constant).
- Produces: `SeriesController.SeriesView` now has an additional `String rssUrl` field (last data field before `createdAt`/`updatedAt`) — consumed by Task 11 (studio `SeriesDetail` type + `SeriesEditor` display).

- [ ] **Step 1: Add a failing test to `SeriesControllerTest`**

Read the existing file first to match its MockMvc/fixture conventions (tenant setup, module activation helper, host header). Add:

```java
@Test
void getSeriesIncludesRssUrlWhenPodcastRssModuleEnabled() throws Exception {
    // activate PODCAST_RSS for the fixture tenant using this test class's existing helper
    mockMvc.perform(get("/api/v1/series/{id}", series.getId())
                    .header("Host", tenantHost))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.rssUrl").value(
                    "http://" + tenantHost + "/feeds/" + tenant.getSlug() + "/" + series.getSlug() + ".xml"
            ));
}

@Test
void getSeriesRssUrlIsNullWhenPodcastRssModuleDisabled() throws Exception {
    mockMvc.perform(get("/api/v1/series/{id}", series.getId())
                    .header("Host", tenantHost))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.rssUrl").doesNotExist());
}
```

(Adjust: if the fixture tenant already has `PODCAST_RSS` enabled by default in this test class's setup, swap which test asserts presence vs. absence, and use whatever the class's existing module-activation/deactivation helper is called. `jsonPath(...).doesNotExist()` is correct for a Jackson-serialized `null` field only if the response mapper omits nulls — check an existing nullable-field assertion elsewhere in the same test class and match its style instead if different, e.g. `.value(org.hamcrest.Matchers.nullValue())`.)

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :directwerk-app:test --tests "*SeriesControllerTest*"`
Expected: FAIL (no `rssUrl` field yet)

- [ ] **Step 3: Update `SeriesController`**

Replace the whole file:

```java
package de.pnnit.directwerk.controller.podcast;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantLookupService;
import de.pnnit.directwerk.modules.core.util.PublicUrlBuilder;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.service.SeriesService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiresModule(PodcastModule.KEY)
@PreAuthorize("hasAnyRole('EDITOR', 'TENANT_ADMIN')")
@RequestMapping("/api/v1/series")
public class SeriesController {

    private final SeriesService seriesService;
    private final ModuleGateService moduleGateService;
    private final TenantLookupService tenantLookupService;

    public SeriesController(
            SeriesService seriesService,
            ModuleGateService moduleGateService,
            TenantLookupService tenantLookupService
    ) {
        this.seriesService = seriesService;
        this.moduleGateService = moduleGateService;
        this.tenantLookupService = tenantLookupService;
    }

    @GetMapping
    ResponseEntity<Response<List<SeriesView>>> listSeries(HttpServletRequest request) {
        Long tenantId = TenantContext.requireTenantId();
        List<SeriesView> series = seriesService.listSeries(tenantId, false).stream()
                .map(item -> toView(item, tenantId, request))
                .toList();
        return ResponseEntity.ok(Response.ok(series));
    }

    @GetMapping("/{seriesId}")
    ResponseEntity<Response<SeriesView>> getSeries(@PathVariable Long seriesId, HttpServletRequest request) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(
                Response.ok(toView(seriesService.requireSeries(tenantId, seriesId), tenantId, request))
        );
    }

    @PostMapping
    ResponseEntity<Response<SeriesView>> createSeries(
            @Valid @RequestBody CreateSeriesRequest request,
            HttpServletRequest httpRequest
    ) {
        Long tenantId = TenantContext.requireTenantId();
        try {
            PodcastSeries series = seriesService.createSeries(
                    tenantId,
                    request.slug(),
                    request.title(),
                    request.description(),
                    request.coverAssetId(),
                    request.language(),
                    request.itunesCategory(),
                    request.defaultRequiredLevelSortOrder()
            );
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(Response.created(toView(series, tenantId, httpRequest)));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Response.error(409, "SERIES_SLUG_EXISTS", ex.getMessage()));
        }
    }

    @PutMapping("/{seriesId}")
    ResponseEntity<Response<SeriesView>> updateSeries(
            @PathVariable Long seriesId,
            @Valid @RequestBody UpdateSeriesRequest request,
            HttpServletRequest httpRequest
    ) {
        Long tenantId = TenantContext.requireTenantId();
        try {
            PodcastSeries series = seriesService.updateSeries(
                    tenantId,
                    seriesId,
                    request.slug(),
                    request.title(),
                    request.description(),
                    request.coverAssetId(),
                    request.language(),
                    request.itunesCategory(),
                    request.defaultRequiredLevelSortOrder(),
                    request.status()
            );
            return ResponseEntity.ok(Response.ok(toView(series, tenantId, httpRequest)));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Response.error(409, "SERIES_SLUG_EXISTS", ex.getMessage()));
        }
    }

    private SeriesView toView(PodcastSeries series, Long tenantId, HttpServletRequest request) {
        return new SeriesView(
                series.getId(),
                series.getSlug(),
                series.getTitle(),
                series.getDescription(),
                series.getCoverAsset() != null ? series.getCoverAsset().getId() : null,
                series.getLanguage(),
                series.getItunesCategory(),
                series.getDefaultRequiredLevelSortOrder(),
                series.getStatus().name(),
                rssUrl(series, tenantId, request),
                series.getCreatedAt(),
                series.getUpdatedAt()
        );
    }

    private String rssUrl(PodcastSeries series, Long tenantId, HttpServletRequest request) {
        if (!moduleGateService.enabledModuleKeys(tenantId).contains(PodcastRssModule.KEY)) {
            return null;
        }
        Tenant tenant = tenantLookupService.requireTenant(tenantId);
        String origin = PublicUrlBuilder.baseUrl(
                request.getScheme(),
                request.getServerName(),
                request.getServerPort()
        );
        return origin + "/feeds/" + tenant.getSlug() + "/" + series.getSlug() + ".xml";
    }

    public record CreateSeriesRequest(
            @NotBlank
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @NotBlank @Size(max = 255) String title,
            String description,
            @Min(1) Long coverAssetId,
            @Size(max = 8) String language,
            @Size(max = 128) String itunesCategory,
            @Min(0) Integer defaultRequiredLevelSortOrder
    ) {
    }

    public record UpdateSeriesRequest(
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @Size(max = 255) String title,
            String description,
            @Min(1) Long coverAssetId,
            @Size(max = 8) String language,
            @Size(max = 128) String itunesCategory,
            @Min(0) Integer defaultRequiredLevelSortOrder,
            SeriesStatus status
    ) {
    }

    public record SeriesView(
            Long id,
            String slug,
            String title,
            String description,
            Long coverAssetId,
            String language,
            String itunesCategory,
            Integer defaultRequiredLevelSortOrder,
            String status,
            String rssUrl,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew :directwerk-app:test --tests "*SeriesControllerTest*"`
Expected: PASS

- [ ] **Step 5: Update Bruno collection**

Read `Directwerk/bruno/09-Podcast-Content/Series/2 - Get Series.bru`, `3 - Create Series.bru`, and `4 - Update Series.bru`. None of these need request-shape changes (the new field is response-only), but if any of them has a `tests { ... }` block asserting on response shape, leave it — do not add a brittle assertion on `rssUrl`'s exact value (it depends on `PODCAST_RSS` module state and the Bruno environment's `baseUrl`, which varies). Instead add one line to the `docs { ... }` block of `2 - Get Series.bru` (create one if absent) noting: `Response now includes rssUrl (null unless PODCAST_RSS is enabled for the tenant).`

- [ ] **Step 6: Commit**

```bash
git add Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/controller/podcast/SeriesController.java Directwerk/directwerk-app/src/test/java/de/pnnit/directwerk/controller/podcast/SeriesControllerTest.java Directwerk/bruno/09-Podcast-Content/Series/
git commit -m "feat(directwerk-app): expose computed rssUrl on series responses"
```

---

## Phase 3 — Backend: tenant management completeness (edit tenant, change user role, revoke admin)

### Task 7: `PATCH /api/v1/platform/tenants/{tenantId}` — edit tenant name/slug

**Files:**
- Modify: `Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/audit/PlatformAuditActions.java`
- Modify: `Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/service/TenantManagementService.java`
- Modify: `Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/controller/platform/PlatformTenantController.java`
- Create: `Directwerk/bruno/06-Platform-Admin/Tenants/7 - Update Tenant.bru`
- Test: find the existing `TenantManagementService` test (search `directwerk-app/src/test` for `TenantManagementServiceTest`) and the existing `PlatformTenantControllerTest`; add cases to both.

**Interfaces:**
- Produces: `TenantManagementService.updateTenant(Long tenantId, String name, String slug) -> TenantDetailView` (throws `IllegalStateException` on slug collision, same convention as `createTenant`). `PlatformTenantController` gets a new `PATCH /{tenantId}` handler returning the same `TenantDetailView` shape already returned by `getTenant`/`suspendTenant`/`reactivateTenant`.

- [ ] **Step 1: Add a failing test to `TenantManagementServiceTest`**

Read the existing file first (search: `find Directwerk/directwerk-app/src/test -iname "*TenantManagementService*"`) to match its fixture style, then add:

```java
@Test
void updateTenantChangesNameAndSlug() {
    TenantManagementService.TenantDetailView created = tenantManagementService.createTenant(
            "Original Name", "original-slug", null, null
    );

    TenantManagementService.TenantDetailView updated = tenantManagementService.updateTenant(
            created.id(), "New Name", "new-slug"
    );

    assertThat(updated.name()).isEqualTo("New Name");
    assertThat(updated.slug()).isEqualTo("new-slug");
}

@Test
void updateTenantRejectsDuplicateSlug() {
    tenantManagementService.createTenant("First", "first-slug", null, null);
    TenantManagementService.TenantDetailView second = tenantManagementService.createTenant(
            "Second", "second-slug", null, null
    );

    assertThatThrownBy(() -> tenantManagementService.updateTenant(second.id(), null, "first-slug"))
            .isInstanceOf(IllegalStateException.class);
}

@Test
void updateTenantLeavesFieldUnchangedWhenBlank() {
    TenantManagementService.TenantDetailView created = tenantManagementService.createTenant(
            "Keep Slug", "keep-slug", null, null
    );

    TenantManagementService.TenantDetailView updated = tenantManagementService.updateTenant(
            created.id(), "Renamed Only", null
    );

    assertThat(updated.name()).isEqualTo("Renamed Only");
    assertThat(updated.slug()).isEqualTo("keep-slug");
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :directwerk-app:test --tests "*TenantManagementServiceTest*"`
Expected: FAIL (`updateTenant` doesn't exist)

- [ ] **Step 3: Add `TENANT_UPDATED` audit action**

In `PlatformAuditActions.java`, add alongside the existing constants:

```java
    public static final String TENANT_UPDATED = "TENANT_UPDATED";
```

- [ ] **Step 4: Add `TenantManagementService.updateTenant`**

Add this method to `TenantManagementService.java`, directly after `suspendTenant`/before `reactivateTenant` (or after `reactivateTenant` — match the file's existing method ordering):

```java
    /**
     * Updates a tenant's name and/or slug. Blank/null arguments leave the corresponding
     * field unchanged, mirroring how {@link #createTenant} treats optional fields.
     *
     * @param tenantId the identifier of the tenant to update
     * @param name     the new name, or blank/null to leave unchanged
     * @param slug     the new slug, or blank/null to leave unchanged
     * @return the updated tenant details
     * @throws IllegalStateException if the new slug is already used by another tenant
     */
    @Transactional
    public TenantDetailView updateTenant(Long tenantId, String name, String slug) {
        Tenant tenant = requireTenant(tenantId);

        if (StringUtils.hasText(name)) {
            tenant.setName(name.trim());
        }

        if (StringUtils.hasText(slug)) {
            String normalizedSlug = SlugNormalizer.normalize(slug);
            if (!normalizedSlug.equals(tenant.getSlug())
                    && tenantRepository.findBySlug(normalizedSlug).isPresent()) {
                throw new IllegalStateException("Tenant slug already exists: " + normalizedSlug);
            }
            tenant.setSlug(normalizedSlug);
        }

        Tenant saved = tenantRepository.save(tenant);
        cacheEviction.evictTenantPublicCachesAfterCommit(tenantId);
        platformAuditService.record(
                PlatformAuditActions.TENANT_UPDATED,
                tenantId,
                Map.of("name", saved.getName(), "slug", saved.getSlug())
        );
        return toView(saved);
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./gradlew :directwerk-app:test --tests "*TenantManagementServiceTest*"`
Expected: PASS

- [ ] **Step 6: Add a failing test to `PlatformTenantControllerTest`**

Read the existing file (`find Directwerk/directwerk-app/src/test -iname "*PlatformTenantControllerTest*"`) and add:

```java
@Test
void updateTenantReturnsUpdatedDetails() throws Exception {
    mockMvc.perform(patch("/api/v1/platform/tenants/{id}", tenant.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Renamed Tenant\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.name").value("Renamed Tenant"));
}

@Test
void updateTenantReturnsConflictOnDuplicateSlug() throws Exception {
    mockMvc.perform(patch("/api/v1/platform/tenants/{id}", otherTenant.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"slug\":\"" + tenant.getSlug() + "\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.errors[0].code").value("TENANT_SLUG_EXISTS"));
}
```

(Match this test class's existing fixture-tenant variable names; if there is no second tenant fixture already, add one following the same pattern as this file's existing `@BeforeEach` setup.)

- [ ] **Step 7: Run to verify it fails**

Run: `./gradlew :directwerk-app:test --tests "*PlatformTenantControllerTest*"`
Expected: FAIL (no `PATCH` handler yet)

- [ ] **Step 8: Add the controller endpoint**

In `PlatformTenantController.java`, add the import `org.springframework.web.bind.annotation.PatchMapping`, then add this method after `getTenant` (before `suspendTenant`):

```java
    @PatchMapping("/{tenantId}")
    ResponseEntity<Response<TenantDetailView>> updateTenant(
            @PathVariable Long tenantId,
            @Valid @RequestBody UpdateTenantRequest request
    ) {
        try {
            return ResponseEntity.ok(Response.ok(
                    tenantManagementService.updateTenant(tenantId, request.name(), request.slug())
            ));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Response.error(409, "TENANT_SLUG_EXISTS", ex.getMessage()));
        }
    }
```

And add this record next to `CreateTenantRequest`:

```java
    public record UpdateTenantRequest(
            @Size(max = 255) String name,
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug
    ) {
    }
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `./gradlew :directwerk-app:test --tests "*PlatformTenantControllerTest*"`
Expected: PASS

- [ ] **Step 10: Add the Bruno request**

Create `Directwerk/bruno/06-Platform-Admin/Tenants/7 - Update Tenant.bru`:

```text
meta {
  name: 7 - Update Tenant
  type: http
  seq: 7
}

patch {
  url: {{baseUrl}}/api/v1/platform/tenants/{{tenantCId}}
  body: json
  auth: inherit
}

headers {
  Content-Type: application/json
}

body:json {
  {
    "name": "Alpha Show C Renamed"
  }
}

tests {
  test("returns expected status", function() {
    expect(res.getStatus() === 200 || res.getStatus() === 404 || res.getStatus() === 409).to.equal(true);
  });
}

docs {
  Renames tenant C (captured as tenantCId by 2 - Create Tenant). Both name and slug are optional --
  omitting slug leaves it unchanged. 409 TENANT_SLUG_EXISTS if slug collides with another tenant.
}
```

- [ ] **Step 11: Commit**

```bash
git add Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/audit/PlatformAuditActions.java Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/service/TenantManagementService.java Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/controller/platform/PlatformTenantController.java Directwerk/bruno/06-Platform-Admin/Tenants/ Directwerk/directwerk-app/src/test
git commit -m "feat(directwerk-app): add PATCH endpoint to edit tenant name/slug"
```

---

### Task 8: `PATCH /api/v1/platform/tenants/{tenantId}/users/{userId}` — change a tenant user's role

**Files:**
- Modify: `Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/service/TenantMembershipManagementService.java`
- Modify: `Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/controller/platform/PlatformTenantUserController.java`
- Create: `Directwerk/bruno/06-Platform-Admin/Tenant-Users/5 - Update User Role.bru`
- Test: find and update the existing `TenantMembershipManagementService` test and `PlatformTenantUserControllerTest`.

**Interfaces:**
- Consumes: `Role` enum (existing: `PLATFORM_ADMIN, TENANT_ADMIN, EDITOR, SUBSCRIBER, GUEST`), `CannotDeactivateLastAdminException` (existing, reused here since the invariant — "tenant must keep at least one active admin" — is identical whether the admin is deactivated or demoted away from `TENANT_ADMIN`).
- Produces: `TenantMembershipManagementService.updateRole(Long tenantId, Long userId, String role) -> TenantUserQueryService.TenantUserView`. A role update replaces the membership's entire roles set with a single role (matching how `TenantInvitationService.invite` only ever assigns one role today — the membership model supports a `Set<Role>`, but no existing flow assigns more than one, so this doesn't introduce an inconsistency).

- [ ] **Step 1: Add a failing test**

Read the existing test file (`find Directwerk/directwerk-app/src/test -iname "*TenantMembershipManagementService*"`) to match its fixture style (it already has helpers for creating a tenant + inviting/activating a membership, reused by the existing deactivate/reactivate tests — reuse the same helpers), then add:

```java
@Test
void updateRoleReplacesRolesWithSingleNewRole() {
    // use this file's existing helper to create an ACTIVE EDITOR membership for (tenantId, userId)

    TenantUserQueryService.TenantUserView updated =
            tenantMembershipManagementService.updateRole(tenantId, userId, "TENANT_ADMIN");

    assertThat(updated.roles()).containsExactly("TENANT_ADMIN");
}

@Test
void updateRoleRejectsUnknownRoleName() {
    assertThatThrownBy(() -> tenantMembershipManagementService.updateRole(tenantId, userId, "NOT_A_ROLE"))
            .isInstanceOf(IllegalArgumentException.class);
}

@Test
void updateRoleRejectsPlatformAdminRole() {
    assertThatThrownBy(() -> tenantMembershipManagementService.updateRole(tenantId, userId, "PLATFORM_ADMIN"))
            .isInstanceOf(IllegalArgumentException.class);
}

@Test
void updateRoleRejectsDemotingLastActiveAdmin() {
    // use this file's existing helper to make (tenantId, userId) the tenant's only ACTIVE TENANT_ADMIN

    assertThatThrownBy(() -> tenantMembershipManagementService.updateRole(tenantId, userId, "EDITOR"))
            .isInstanceOf(CannotDeactivateLastAdminException.class);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :directwerk-app:test --tests "*TenantMembershipManagementServiceTest*"`
Expected: FAIL (`updateRole` doesn't exist)

- [ ] **Step 3: Add `updateRole` to `TenantMembershipManagementService`**

Add this method (and the two new imports `java.util.EnumSet` and `de.pnnit.directwerk.modules.core.entity.Role` — `Role` may already be imported since `wouldRemoveLastActiveAdmin` references `Role.TENANT_ADMIN`):

```java
    /**
     * Replaces a tenant user's roles with a single new role.
     *
     * @param tenantId the tenant the membership belongs to
     * @param userId   the identifier of the member whose role changes
     * @param role     the new role name (must be a tenant-scoped {@link Role}, not {@code PLATFORM_ADMIN})
     * @return the updated membership view
     * @throws TenantMembershipNotFoundException if no membership exists for the (tenant, user) pair
     * @throws IllegalArgumentException if {@code role} is not a valid tenant-scoped role name
     * @throws CannotDeactivateLastAdminException if this change would leave the tenant with zero
     *                                             active {@code TENANT_ADMIN} memberships
     */
    @Transactional
    public TenantUserQueryService.TenantUserView updateRole(Long tenantId, Long userId, String role) {
        Role newRole;
        try {
            newRole = Role.valueOf(role);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new IllegalArgumentException("Unknown role: " + role);
        }
        if (newRole == Role.PLATFORM_ADMIN) {
            throw new IllegalArgumentException("PLATFORM_ADMIN is not a tenant-scoped role");
        }

        TenantMembership membership = requireMembership(tenantId, userId);
        boolean wasActiveAdmin = membership.getStatus() == MembershipStatus.ACTIVE
                && membership.getRoles().contains(Role.TENANT_ADMIN);
        if (wasActiveAdmin && newRole != Role.TENANT_ADMIN
                && wouldRemoveLastActiveAdmin(membership, tenantId, userId)) {
            throw new CannotDeactivateLastAdminException(userId);
        }

        membership.setRoles(EnumSet.of(newRole));
        TenantMembership saved = tenantMembershipRepository.save(membership);
        platformAuditService.record(
                PlatformAuditActions.MEMBERSHIP_ROLE_CHANGED,
                tenantId,
                Map.of("userId", userId, "role", newRole.name())
        );
        return toView(saved);
    }
```

Add the new audit action to `PlatformAuditActions.java`:

```java
    public static final String MEMBERSHIP_ROLE_CHANGED = "MEMBERSHIP_ROLE_CHANGED";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew :directwerk-app:test --tests "*TenantMembershipManagementServiceTest*"`
Expected: PASS

- [ ] **Step 5: Add a failing controller test**

Read `PlatformTenantUserControllerTest` and add:

```java
@Test
void updateUserRoleReturnsUpdatedMembership() throws Exception {
    mockMvc.perform(patch("/api/v1/platform/tenants/{tenantId}/users/{userId}", tenantId, editorUserId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"role\":\"TENANT_ADMIN\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.roles[0]").value("TENANT_ADMIN"));
}

@Test
void updateUserRoleRejectsInvalidRole() throws Exception {
    mockMvc.perform(patch("/api/v1/platform/tenants/{tenantId}/users/{userId}", tenantId, editorUserId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"role\":\"NOT_A_ROLE\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].code").value("VALIDATION_ERROR"));
}
```

- [ ] **Step 6: Run to verify it fails**

Run: `./gradlew :directwerk-app:test --tests "*PlatformTenantUserControllerTest*"`
Expected: FAIL

- [ ] **Step 7: Add the controller endpoint**

Add the import `org.springframework.web.bind.annotation.PatchMapping` to `PlatformTenantUserController.java`, then add this method after `reactivateUser`:

```java
    /**
     * Replaces a tenant user's role with a single new role.
     *
     * @param tenantId the tenant the membership belongs to
     * @param userId   the identifier of the user whose role changes
     * @return the updated membership view
     */
    @PatchMapping("/{userId}")
    ResponseEntity<Response<TenantUserView>> updateUserRole(
            @PathVariable Long tenantId,
            @PathVariable Long userId,
            @Valid @RequestBody UpdateTenantUserRoleRequest request
    ) {
        return ResponseEntity.ok(Response.ok(
                tenantMembershipManagementService.updateRole(tenantId, userId, request.role())
        ));
    }
```

And add this record next to `InviteTenantUserRequest`:

```java
    public record UpdateTenantUserRoleRequest(@NotBlank String role) {
    }
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `./gradlew :directwerk-app:test --tests "*PlatformTenantUserControllerTest*"`
Expected: PASS

- [ ] **Step 9: Add the Bruno request**

Create `Directwerk/bruno/06-Platform-Admin/Tenant-Users/5 - Update User Role.bru`:

```text
meta {
  name: 5 - Update User Role
  type: http
  seq: 5
}

patch {
  url: {{baseUrl}}/api/v1/platform/tenants/{{tenantAId}}/users/{{editorUserId}}
  body: json
  auth: inherit
}

headers {
  Content-Type: application/json
}

body:json {
  {
    "role": "TENANT_ADMIN"
  }
}

tests {
  test("returns expected status", function() {
    expect(res.getStatus() === 200 || res.getStatus() === 400 || res.getStatus() === 404 || res.getStatus() === 409).to.equal(true);
  });
}

docs {
  Replaces editor@alpha-show.local's roles with a single TENANT_ADMIN role. 400 VALIDATION_ERROR for
  an unknown role name or PLATFORM_ADMIN. 409 CANNOT_DEACTIVATE_LAST_ADMIN if demoting the tenant's
  only active admin away from TENANT_ADMIN (doesn't apply here since the seeded editor isn't an admin).
}
```

- [ ] **Step 10: Commit**

```bash
git add Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/service/TenantMembershipManagementService.java Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/audit/PlatformAuditActions.java Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/controller/platform/PlatformTenantUserController.java Directwerk/bruno/06-Platform-Admin/Tenant-Users/ Directwerk/directwerk-app/src/test
git commit -m "feat(directwerk-app): add PATCH endpoint to change a tenant user's role"
```

---

### Task 9: `DELETE /api/v1/platform/admins/{userId}` — revoke a platform admin

**Files:**
- Create: `Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/service/PlatformAdminNotFoundException.java`
- Create: `Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/service/CannotRevokeSelfException.java`
- Create: `Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/service/CannotRevokeLastPlatformAdminException.java`
- Modify: `Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/service/PlatformAdminManagementService.java`
- Modify: `Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/api/exception/GlobalExceptionHandler.java`
- Modify: `Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/controller/platform/PlatformAdminController.java`
- Create: `Directwerk/bruno/06-Platform-Admin/Admins/3 - Revoke Platform Admin.bru`
- Test: find and update the existing `PlatformAdminManagementServiceTest` and add a controller test.

**Interfaces:**
- Produces: `PlatformAdminManagementService.revokeAdmin(Long userId) -> PlatformAdminView` (throws `PlatformAdminNotFoundException`, `CannotRevokeSelfException`, `CannotRevokeLastPlatformAdminException`).

- [ ] **Step 1: Add the three exception classes**

`PlatformAdminNotFoundException.java`:

```java
package de.pnnit.directwerk.modules.core.service;

public class PlatformAdminNotFoundException extends RuntimeException {

    public PlatformAdminNotFoundException(Long userId) {
        super("Platform admin not found for user: " + userId);
    }
}
```

`CannotRevokeSelfException.java`:

```java
package de.pnnit.directwerk.modules.core.service;

public class CannotRevokeSelfException extends RuntimeException {

    public CannotRevokeSelfException(Long userId) {
        super("Cannot revoke your own platform admin access: " + userId);
    }
}
```

`CannotRevokeLastPlatformAdminException.java`:

```java
package de.pnnit.directwerk.modules.core.service;

public class CannotRevokeLastPlatformAdminException extends RuntimeException {

    public CannotRevokeLastPlatformAdminException(Long userId) {
        super("Cannot revoke the last platform admin: " + userId);
    }
}
```

- [ ] **Step 2: Add a failing test to `PlatformAdminManagementServiceTest`**

Read the existing file first, then add (matching its existing fixture/mocking conventions for `SecurityUtils.currentUserId()` — check whether the file already mocks static `SecurityUtils` via Mockito's `mockStatic`, as `TenantMembershipManagementServiceTest` likely does for the analogous self-check test, and follow the same approach):

```java
@Test
void revokeAdminRemovesAdminWhenMultipleAdminsExist() {
    // this test class's existing helper already creates one admin (e.g. in @BeforeEach);
    // create a second admin here so revoking the first doesn't trip the last-admin guard
    PlatformAdminManagementService.PlatformAdminInvitation second =
            platformAdminManagementService.inviteAdmin("second-admin@example.com", "Second Admin");

    PlatformAdminManagementService.PlatformAdminView revoked =
            platformAdminManagementService.revokeAdmin(second.admin().userId());

    assertThat(revoked.email()).isEqualTo("second-admin@example.com");
    assertThat(platformAdminManagementService.listAdmins())
            .noneMatch(admin -> admin.userId().equals(second.admin().userId()));
}

@Test
void revokeAdminRejectsWhenOnlyOneAdminExists() {
    // assumes exactly one admin exists at this point in the test (this file's existing @BeforeEach admin)
    List<PlatformAdminManagementService.PlatformAdminView> admins = platformAdminManagementService.listAdmins();

    assertThatThrownBy(() -> platformAdminManagementService.revokeAdmin(admins.get(0).userId()))
            .isInstanceOf(CannotRevokeLastPlatformAdminException.class);
}

@Test
void revokeAdminRejectsUnknownUser() {
    assertThatThrownBy(() -> platformAdminManagementService.revokeAdmin(999_999L))
            .isInstanceOf(PlatformAdminNotFoundException.class);
}
```

- [ ] **Step 3: Run to verify it fails**

Run: `./gradlew :directwerk-app:test --tests "*PlatformAdminManagementServiceTest*"`
Expected: FAIL (`revokeAdmin` doesn't exist)

- [ ] **Step 3a: Add `PLATFORM_ADMIN_REVOKED` audit action**

In `PlatformAuditActions.java`, add alongside the existing constants:

```java
    public static final String PLATFORM_ADMIN_REVOKED = "PLATFORM_ADMIN_REVOKED";
```

- [ ] **Step 4: Add `revokeAdmin` to `PlatformAdminManagementService`**

Add the imports `de.pnnit.directwerk.modules.core.entity.PlatformAdmin` (may already be imported), `de.pnnit.directwerk.security.SecurityUtils`, `java.util.Map`, and `de.pnnit.directwerk.modules.core.audit.PlatformAuditActions`, then add this method after `inviteAdmin`:

```java
    /**
     * Revokes a platform administrator's access.
     *
     * @param userId the identifier of the user whose platform admin access is revoked
     * @return the view of the admin that was revoked
     * @throws PlatformAdminNotFoundException           if the user is not a platform admin
     * @throws CannotRevokeSelfException                if the caller is revoking their own access
     * @throws CannotRevokeLastPlatformAdminException   if this would leave zero platform admins
     */
    @Transactional
    public PlatformAdminView revokeAdmin(Long userId) {
        // Acquire a serialization lock to prevent concurrent revocations from bypassing the last-admin check
        platformAdminRepository.lockForAdminCountValidation();

        PlatformAdmin admin = platformAdminRepository.findByUserId(userId)
                .orElseThrow(() -> new PlatformAdminNotFoundException(userId));

        Long callerUserId = SecurityUtils.currentUserId();
        if (callerUserId != null && callerUserId.equals(userId)) {
            throw new CannotRevokeSelfException(userId);
        }
        if (platformAdminRepository.count() <= 1) {
            throw new CannotRevokeLastPlatformAdminException(userId);
        }

        PlatformAdminView view = new PlatformAdminView(
                admin.getUser().getId(),
                admin.getUser().getEmail(),
                admin.getUser().getName()
        );
        platformAuditService.record(
                PlatformAuditActions.PLATFORM_ADMIN_REVOKED,
                null,
                Map.of("userId", userId, "userEmail", admin.getUser().getEmail())
        );
        platformAdminRepository.delete(admin);
        return view;
    }
```

- [ ] **Step 5: Register the two new exceptions in `GlobalExceptionHandler`**

Add the imports and handlers (place alongside the other `Cannot*`/`*NotFound` handlers, matching their exact style):

```java
import de.pnnit.directwerk.modules.core.service.CannotRevokeLastPlatformAdminException;
import de.pnnit.directwerk.modules.core.service.CannotRevokeSelfException;
import de.pnnit.directwerk.modules.core.service.PlatformAdminNotFoundException;
```

```java
    @ExceptionHandler(PlatformAdminNotFoundException.class)
    ResponseEntity<Response<Void>> handlePlatformAdminNotFound(PlatformAdminNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Response.error(404, "PLATFORM_ADMIN_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(CannotRevokeSelfException.class)
    ResponseEntity<Response<Void>> handleCannotRevokeSelf(CannotRevokeSelfException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Response.error(409, "CANNOT_REVOKE_SELF", ex.getMessage()));
    }

    @ExceptionHandler(CannotRevokeLastPlatformAdminException.class)
    ResponseEntity<Response<Void>> handleCannotRevokeLastPlatformAdmin(CannotRevokeLastPlatformAdminException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Response.error(409, "CANNOT_REVOKE_LAST_ADMIN", ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Response<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Response.error(400, "VALIDATION_ERROR", ex.getMessage()));
    }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `./gradlew :directwerk-app:test --tests "*PlatformAdminManagementServiceTest*"`
Expected: PASS

- [ ] **Step 7: Add a failing controller test**

Read `PlatformAdminControllerTest` if it exists (`find Directwerk/directwerk-app/src/test -iname "*PlatformAdminController*"`); if it doesn't exist yet, create it following the same MockMvc setup style as `PlatformTenantControllerTest`. Add:

```java
@Test
void revokeAdminReturnsRevokedAdmin() throws Exception {
    mockMvc.perform(delete("/api/v1/platform/admins/{userId}", secondAdminUserId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.userId").value(secondAdminUserId));
}
```

- [ ] **Step 8: Run to verify it fails**

Run: `./gradlew :directwerk-app:test --tests "*PlatformAdminControllerTest*"`
Expected: FAIL (no `DELETE` handler yet)

- [ ] **Step 9: Add the controller endpoint**

Add the import `org.springframework.web.bind.annotation.DeleteMapping` and `org.springframework.web.bind.annotation.PathVariable` to `PlatformAdminController.java`, then add this method after `inviteAdmin`:

```java
    /**
     * Revokes a platform administrator's access.
     *
     * @param userId the identifier of the user whose platform admin access is revoked
     * @return the revoked admin's details
     */
    @DeleteMapping("/{userId}")
    ResponseEntity<Response<PlatformAdminManagementService.PlatformAdminView>> revokeAdmin(
            @PathVariable Long userId
    ) {
        return ResponseEntity.ok(Response.ok(platformAdminManagementService.revokeAdmin(userId)));
    }
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `./gradlew :directwerk-app:test --tests "*PlatformAdminControllerTest*"`
Expected: PASS

- [ ] **Step 11: Add the Bruno request**

Create `Directwerk/bruno/06-Platform-Admin/Admins/3 - Revoke Platform Admin.bru`:

```text
meta {
  name: 3 - Revoke Platform Admin
  type: http
  seq: 3
}

delete {
  url: {{baseUrl}}/api/v1/platform/admins/{{secondAdminUserId}}
  body: none
  auth: inherit
}

tests {
  test("returns expected status", function() {
    expect(res.getStatus() === 200 || res.getStatus() === 404 || res.getStatus() === 409).to.equal(true);
  });
}

docs {
  Revokes a second platform admin's access (requires secondAdminUserId captured by a prior
  "Invite Platform Admin" run against a different email than the bootstrap admin).
  409 CANNOT_REVOKE_SELF if you target your own logged-in user id.
  409 CANNOT_REVOKE_LAST_ADMIN if only one platform admin remains.
}
```

- [ ] **Step 12: Run the full Directwerk suite**

Run: `./gradlew :directwerk-app:test`
Expected: PASS (all tests, confirming Phase 3 introduced no regressions)

- [ ] **Step 13: Commit**

```bash
git add Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/service/PlatformAdminNotFoundException.java Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/service/CannotRevokeSelfException.java Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/service/CannotRevokeLastPlatformAdminException.java Directwerk/directwerk-core/src/main/java/de/pnnit/directwerk/modules/core/service/PlatformAdminManagementService.java Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/api/exception/GlobalExceptionHandler.java Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/controller/platform/PlatformAdminController.java Directwerk/bruno/06-Platform-Admin/Admins/ Directwerk/directwerk-app/src/test
git commit -m "feat(directwerk-app): add DELETE endpoint to revoke a platform admin"
```

---

## Phase 4 — directwerk-studio: types + API client for taxonomy and tagging

### Task 10: Extend `types.ts` (Format detail fields, Episode/Article tags, Series `rssUrl`) + `responseValidation.ts` parsers

**Files:**
- Modify: `directwerk-studio/lib/api/types.ts`
- Modify: `directwerk-studio/lib/api/responseValidation.ts`
- Create: `directwerk-studio/lib/api/responseValidation.tags.test.ts`

**Interfaces:**
- Produces: `FormatTag`, `CategoryTag` types (`{id: number; slug: string; name: string}`), `EpisodeDetail.formats: FormatTag[]`, `EpisodeDetail.categories: CategoryTag[]`, `ArticleDetail.categories: CategoryTag[]`, `SeriesDetail.rssUrl: string | null`, `FormatSummary` extended with `description: string | null`, `requiredLevelSortOrder: number | null`, `sortOrder: number`. `parseFormatEnvelope`, `parseCategoryEnvelope` (single-item envelope parsers). Consumed by Task 11 (`tenantApi.ts`) and Tasks 13-17 (studio components).

- [ ] **Step 1: Write the failing test**

Create `directwerk-studio/lib/api/responseValidation.tags.test.ts`:

```ts
import {describe, expect, it} from 'vitest'

import {
    parseCategoryEnvelope,
    parseEpisodeEnvelope,
    parseArticleEnvelope,
    parseFormatEnvelope,
    parseSeriesEnvelope,
} from '@/lib/api/responseValidation'

function envelope(data: unknown) {
    return {statusCode: 200, statusMessage: 'OK', data}
}

describe('tag and rssUrl parsing', () => {
    it('parses episode formats and categories tags', () => {
        const parsed = parseEpisodeEnvelope(
            envelope({
                id: 1,
                slug: 'ep-1',
                title: 'Episode 1',
                status: 'DRAFT',
                accessPolicy: 'FREE',
                publishedAt: null,
                seriesId: 1,
                description: null,
                episodeNumber: null,
                audioAssetId: null,
                requiredLevelSortOrder: null,
                scheduledAt: null,
                formats: [{id: 1, slug: 'interview', name: 'Interview'}],
                categories: [{id: 2, slug: 'tech', name: 'Tech'}],
            }),
        )

        expect(parsed?.data.formats).toEqual([{id: 1, slug: 'interview', name: 'Interview'}])
        expect(parsed?.data.categories).toEqual([{id: 2, slug: 'tech', name: 'Tech'}])
    })

    it('parses article categories tags', () => {
        const parsed = parseArticleEnvelope(
            envelope({
                id: 1,
                slug: 'art-1',
                title: 'Article 1',
                status: 'DRAFT',
                accessPolicy: 'FREE',
                publishedAt: null,
                body: null,
                excerpt: null,
                seoDescription: null,
                heroAssetId: null,
                requiredLevelSortOrder: null,
                scheduledAt: null,
                categories: [{id: 3, slug: 'news', name: 'News'}],
            }),
        )

        expect(parsed?.data.categories).toEqual([{id: 3, slug: 'news', name: 'News'}])
    })

    it('parses series rssUrl', () => {
        const parsed = parseSeriesEnvelope(
            envelope({
                id: 1,
                slug: 'show',
                title: 'Show',
                status: 'DRAFT',
                description: null,
                coverAssetId: null,
                language: null,
                itunesCategory: null,
                defaultRequiredLevelSortOrder: null,
                rssUrl: 'http://localhost:8080/feeds/tenant/show.xml',
            }),
        )

        expect(parsed?.data.rssUrl).toBe('http://localhost:8080/feeds/tenant/show.xml')
    })

    it('parses a single format envelope with detail fields', () => {
        const parsed = parseFormatEnvelope(
            envelope({
                id: 1,
                slug: 'interview',
                name: 'Interview',
                active: true,
                description: 'Long-form talks',
                requiredLevelSortOrder: 1,
                sortOrder: 0,
            }),
        )

        expect(parsed?.data).toEqual({
            id: 1,
            slug: 'interview',
            name: 'Interview',
            active: true,
            description: 'Long-form talks',
            requiredLevelSortOrder: 1,
            sortOrder: 0,
        })
    })

    it('parses a single category envelope', () => {
        const parsed = parseCategoryEnvelope(
            envelope({id: 1, slug: 'news', name: 'News', parentId: null, active: true}),
        )

        expect(parsed?.data).toEqual({id: 1, slug: 'news', name: 'News', parentId: null, active: true})
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir directwerk-studio test -- responseValidation.tags`
Expected: FAIL (module doesn't export `parseFormatEnvelope`/`parseCategoryEnvelope` yet; `formats`/`categories`/`rssUrl` are stripped/undefined)

- [ ] **Step 3: Update `types.ts`**

Add near the top, after the `ApiEnvelope` interface (or any sensible top-level spot before first use):

```ts
export interface Tag {
    id: number
    slug: string
    name: string
}

export type FormatTag = Tag
export type CategoryTag = Tag
```

Replace the `EpisodeDetail` interface:

```ts
export interface EpisodeDetail extends EpisodeSummary {
    seriesId: number
    description: string | null
    episodeNumber: number | null
    audioAssetId: number | null
    requiredLevelSortOrder: number | null
    scheduledAt: string | null
    formats: FormatTag[]
    categories: CategoryTag[]
}
```

Replace the `ArticleDetail` interface:

```ts
export interface ArticleDetail extends ArticleSummary {
    body: string | null
    excerpt: string | null
    seoDescription: string | null
    heroAssetId: number | null
    requiredLevelSortOrder: number | null
    scheduledAt: string | null
    categories: CategoryTag[]
}
```

Replace the `SeriesDetail` interface:

```ts
export interface SeriesDetail {
    id: number
    slug: string
    title: string
    description: string | null
    coverAssetId: number | null
    language: string | null
    itunesCategory: string | null
    defaultRequiredLevelSortOrder: number | null
    rssUrl: string | null
    status: SeriesStatus
}
```

Replace the `FormatSummary` interface:

```ts
export interface FormatSummary {
    id: number
    slug: string
    name: string
    active: boolean
    description: string | null
    requiredLevelSortOrder: number | null
    sortOrder: number
}
```

Add these two input types next to `CreateProductInput`/`UpdateProductInput`:

```ts
export interface CreateFormatInput {
    slug: string
    name: string
    description?: string
    requiredLevelSortOrder?: number
    sortOrder?: number
}

export interface UpdateFormatInput {
    name?: string
    description?: string
    requiredLevelSortOrder?: number
    sortOrder?: number
    active?: boolean
}

export interface CreateCategoryInput {
    slug: string
    name: string
    parentId?: number
}

export interface UpdateCategoryInput {
    name?: string
    parentId?: number
    active?: boolean
}
```

- [ ] **Step 4: Update `responseValidation.ts`**

Add these two type imports to the existing `import type {...} from '@/lib/api/types'` block: `CategoryTag`, `FormatTag`, `Tag`.

Add this shared tag parser near `parseCategorySummary` (or any convenient spot before first use):

```ts
function parseTag(value: unknown): Tag | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.name)
    ) {
        return null
    }

    return {id: value.id, slug: value.slug, name: value.name}
}

function parseTagArray(value: unknown): Tag[] | null {
    if (!Array.isArray(value) || value.length > 100) {
        return null
    }

    const parsed: Tag[] = []
    for (const item of value) {
        const tag = parseTag(item)
        if (tag === null) {
            return null
        }
        parsed.push(tag)
    }

    return parsed
}
```

Update `parseEpisodeDetail` — add after the `seriesId` check and before the `return`:

```ts
    const formats = parseTagArray(value.formats)
    const categories = parseTagArray(value.categories)
    if (formats === null || categories === null) {
        return null
    }
```

and add `formats,` and `categories,` to the returned object (as `FormatTag[]`/`CategoryTag[]` — these are structurally identical to `Tag[]`, so no cast is needed since `Tag` and `FormatTag`/`CategoryTag` are the same type).

Update `parseArticleDetail` similarly — add after the `isRecord(value)` check:

```ts
    const categories = parseTagArray(value.categories)
    if (categories === null) {
        return null
    }
```

and add `categories,` to the returned object.

Update `parseSeriesDetail` — add `rssUrl` to both the validation condition and the returned object:

```ts
        !isNullableString(value.rssUrl, 2048)
```

(add to the existing `if (...)` condition alongside the other `isNullableString`/`isPositiveSafeInteger` checks), and add `rssUrl: value.rssUrl,` to the returned object.

Update `parseFormatSummary`:

```ts
function parseFormatSummary(value: unknown): FormatSummary | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.name) ||
        typeof value.active !== 'boolean' ||
        !isNullableString(value.description, 20000) ||
        !(
            value.requiredLevelSortOrder === null ||
            value.requiredLevelSortOrder === undefined ||
            (isSafeInteger(value.requiredLevelSortOrder) && value.requiredLevelSortOrder >= 0)
        ) ||
        !isNonNegativeSafeInteger(value.sortOrder)
    ) {
        return null
    }

    return {
        id: value.id,
        slug: value.slug,
        name: value.name,
        active: value.active,
        description: value.description,
        requiredLevelSortOrder:
            value.requiredLevelSortOrder === null || value.requiredLevelSortOrder === undefined
                ? null
                : value.requiredLevelSortOrder,
        sortOrder: value.sortOrder,
    }
}
```

(`isNonNegativeSafeInteger` is already defined later in the file for product parsing — if it appears after this function in file order, that's fine in JS/TS since function declarations hoist; leave both where they are rather than reordering the file.)

Add these two exports near `parseFormatListEnvelope`/`parseCategoryListEnvelope`:

```ts
export function parseFormatEnvelope(value: unknown): ApiEnvelope<FormatSummary> | null {
    return envelope(value, parseFormatSummary)
}

export function parseCategoryEnvelope(value: unknown): ApiEnvelope<CategorySummary> | null {
    return envelope(value, parseCategorySummary)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --dir directwerk-studio test -- responseValidation.tags`
Expected: PASS (6 tests)

- [ ] **Step 6: Run the full studio test suite to catch any other callers broken by the widened types**

Run: `pnpm --dir directwerk-studio test`
Expected: PASS. If any existing test constructs an `EpisodeDetail`/`ArticleDetail`/`SeriesDetail`/`FormatSummary` fixture object literal (TypeScript will fail to compile it once new required fields are missing), add the new fields to that fixture (e.g. `formats: []`, `categories: []`, `rssUrl: null`, `description: null`, `requiredLevelSortOrder: null`, `sortOrder: 0`) rather than making the new fields optional — every real API response always includes them.

- [ ] **Step 7: Commit**

```bash
git add directwerk-studio/lib/api/types.ts directwerk-studio/lib/api/responseValidation.ts directwerk-studio/lib/api/responseValidation.tags.test.ts
git commit -m "feat(directwerk-studio): add types/parsers for format/category tags, series rssUrl, format detail fields"
```

---

### Task 11: `tenantApi.ts` — format/category CRUD + episode/article tagging functions

**Files:**
- Modify: `directwerk-studio/lib/api/tenantApi.ts`

**Interfaces:**
- Consumes: `parseFormatEnvelope`, `parseCategoryEnvelope` (Task 10), existing `parseFormatListEnvelope`/`parseCategoryListEnvelope`/`parseEpisodeEnvelope`/`parseArticleEnvelope`.
- Produces: `createFormat`, `updateFormat`, `deactivateFormat`, `createCategory`, `updateCategory`, `deactivateCategory`, `replaceEpisodeFormats`, `replaceEpisodeCategories`, `replaceArticleCategories` — consumed by Tasks 13-17.

- [ ] **Step 1: Add the new imports**

In the `import {...} from '@/lib/api/responseValidation'` block, add `parseCategoryEnvelope,` and `parseFormatEnvelope,` (alphabetically, matching the file's existing sorted-import style).

In the `import type {...} from '@/lib/api/types'` block, add `CreateCategoryInput,`, `CreateFormatInput,`, `UpdateCategoryInput,`, `UpdateFormatInput,`.

- [ ] **Step 2: Add the functions**

Add these after `listCategories` (the last function in the file, before `export {AUTH_REQUIRED}`):

```ts
export async function createFormat(
    tenantHost: string,
    input: CreateFormatInput,
): Promise<FormatSummary> {
    const parsed = parseFormatEnvelope(
        await authenticatedRequest('/api/proxy/formats', tenantHost, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat ein ungültiges Format gesendet.')
    }

    return parsed.data
}

export async function updateFormat(
    tenantHost: string,
    formatId: number,
    input: UpdateFormatInput,
): Promise<FormatSummary> {
    const parsed = parseFormatEnvelope(
        await authenticatedRequest(`/api/proxy/formats/${formatId}`, tenantHost, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat ein ungültiges Format gesendet.')
    }

    return parsed.data
}

export async function deactivateFormat(
    tenantHost: string,
    formatId: number,
): Promise<FormatSummary> {
    const parsed = parseFormatEnvelope(
        await authenticatedRequest(`/api/proxy/formats/${formatId}`, tenantHost, {
            method: 'DELETE',
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat ein ungültiges Format gesendet.')
    }

    return parsed.data
}

export async function createCategory(
    tenantHost: string,
    input: CreateCategoryInput,
): Promise<CategorySummary> {
    const parsed = parseCategoryEnvelope(
        await authenticatedRequest('/api/proxy/categories', tenantHost, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Kategorie gesendet.')
    }

    return parsed.data
}

export async function updateCategory(
    tenantHost: string,
    categoryId: number,
    input: UpdateCategoryInput,
): Promise<CategorySummary> {
    const parsed = parseCategoryEnvelope(
        await authenticatedRequest(`/api/proxy/categories/${categoryId}`, tenantHost, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Kategorie gesendet.')
    }

    return parsed.data
}

export async function deactivateCategory(
    tenantHost: string,
    categoryId: number,
): Promise<CategorySummary> {
    const parsed = parseCategoryEnvelope(
        await authenticatedRequest(`/api/proxy/categories/${categoryId}`, tenantHost, {
            method: 'DELETE',
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Kategorie gesendet.')
    }

    return parsed.data
}

export async function replaceEpisodeFormats(
    tenantHost: string,
    episodeId: number,
    formatIds: number[],
): Promise<EpisodeDetail> {
    const parsed = parseEpisodeEnvelope(
        await authenticatedRequest(`/api/proxy/episodes/${episodeId}/formats`, tenantHost, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({formatIds}),
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Folge gesendet.')
    }

    return parsed.data
}

export async function replaceEpisodeCategories(
    tenantHost: string,
    episodeId: number,
    categoryIds: number[],
): Promise<EpisodeDetail> {
    const parsed = parseEpisodeEnvelope(
        await authenticatedRequest(`/api/proxy/episodes/${episodeId}/categories`, tenantHost, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({categoryIds}),
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Folge gesendet.')
    }

    return parsed.data
}

export async function replaceArticleCategories(
    tenantHost: string,
    articleId: number,
    categoryIds: number[],
): Promise<ArticleDetail> {
    const parsed = parseArticleEnvelope(
        await authenticatedRequest(`/api/proxy/articles/${articleId}/categories`, tenantHost, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({categoryIds}),
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat einen ungültigen Beitrag gesendet.')
    }

    return parsed.data
}
```

- [ ] **Step 3: Run the studio test suite**

Run: `pnpm --dir directwerk-studio test`
Expected: PASS (this task adds no new tests of its own — it's exercised by Tasks 13-17's component tests — but must not break existing ones; `pnpm --dir directwerk-studio build` or `tsc --noEmit` should also be run to confirm the new functions type-check)

- [ ] **Step 4: Commit**

```bash
git add directwerk-studio/lib/api/tenantApi.ts
git commit -m "feat(directwerk-studio): add tenantApi functions for format/category CRUD and content tagging"
```

---

## Phase 5 — directwerk-studio: Format & Category management pages

### Task 12: `FormatListClient` + `/manage/formats` route

**Files:**
- Create: `directwerk-studio/components/manage/FormatListClient.tsx`
- Create: `directwerk-studio/app/(studio)/manage/formats/page.tsx`
- Create: `directwerk-studio/components/manage/FormatListClient.test.tsx`

**Interfaces:**
- Consumes: `listFormats` (existing, `tenantApi.ts`), `FormatSummary` (Task 10).
- Produces: renders at `/manage/formats`, links to `/manage/formats/new` and `/manage/formats/{id}` (consumed by Task 13's routes).

- [ ] **Step 1: Write the failing test**

Create `directwerk-studio/components/manage/FormatListClient.test.tsx` (mirror whatever mocking style `ProductListClient`'s own test file uses if one exists — search `find directwerk-studio/components/manage -name "*.test.tsx"` first; if `ProductListClient.test.tsx` exists, copy its mocking setup for `getClientTenantHost`/`next/navigation`/`tenantApi` exactly, swapping `listProducts`→`listFormats` and `SubscriptionProduct`→`FormatSummary`). If no such test file exists for `ProductListClient`, write a minimal one:

```tsx
import {render, screen, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import FormatListClient from '@/components/manage/FormatListClient'

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/tenantApi', () => ({
    listFormats: vi.fn().mockResolvedValue([
        {id: 1, slug: 'interview', name: 'Interview', active: true, description: null, requiredLevelSortOrder: null, sortOrder: 0},
    ]),
}))

describe('FormatListClient', () => {
    it('renders loaded formats', async () => {
        render(<FormatListClient />)
        await waitFor(() => expect(screen.getByText('Interview')).toBeInTheDocument())
        expect(screen.getByRole('link', {name: /Neues Format/})).toHaveAttribute(
            'href',
            '/manage/formats/new',
        )
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir directwerk-studio test -- FormatListClient`
Expected: FAIL (component doesn't exist)

- [ ] **Step 3: Create `FormatListClient.tsx`**

```tsx
'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import styles from '@/components/studio/DeskList.module.css'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import {listFormats} from '@/lib/api/tenantApi'
import type {FormatSummary} from '@/lib/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

export default function FormatListClient(): React.JSX.Element {
    const router = useRouter()
    const [formats, setFormats] = useState<FormatSummary[] | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        let active = true

        listFormats(getClientTenantHost())
            .then((result) => {
                if (active) {
                    setFormats(result)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    router.replace('/login')
                    return
                }
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Formate konnten nicht geladen werden.',
                )
            })

        return () => {
            active = false
        }
    }, [router])

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Verwaltung</p>
                    <h1>Formate</h1>
                </div>
                <Link className={styles.primaryLink} href="/manage/formats/new">
                    Neues Format
                </Link>
            </header>

            {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
            {formats === null && !errorMessage ? <p>Laden…</p> : null}
            {formats && formats.length === 0 ? <p>Noch keine Formate angelegt.</p> : null}
            {formats && formats.length > 0 ? (
                <ul className={styles.list}>
                    {formats.map((format) => (
                        <li key={format.id}>
                            <Link className={styles.itemLink} href={`/manage/formats/${format.id}`}>
                                <span>
                                    {format.name}
                                    <br />
                                    <small>{format.slug}</small>
                                </span>
                                <span className={styles.itemMeta}>
                                    {format.active ? 'Aktiv' : 'Inaktiv'}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    )
}
```

- [ ] **Step 4: Create the route**

`directwerk-studio/app/(studio)/manage/formats/page.tsx`:

```tsx
import FormatListClient from '@/components/manage/FormatListClient'

export default function FormatsPage(): React.JSX.Element {
    return <FormatListClient />
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --dir directwerk-studio test -- FormatListClient`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add directwerk-studio/components/manage/FormatListClient.tsx directwerk-studio/components/manage/FormatListClient.test.tsx "directwerk-studio/app/(studio)/manage/formats/page.tsx"
git commit -m "feat(directwerk-studio): add Format list page"
```

---

### Task 13: `FormatEditor` (create/edit/deactivate, `next/form` + `useActionState`) + routes

**Files:**
- Create: `directwerk-studio/components/manage/FormatEditor.tsx`
- Create: `directwerk-studio/app/(studio)/manage/formats/new/page.tsx`
- Create: `directwerk-studio/app/(studio)/manage/formats/[formatId]/page.tsx`
- Create: `directwerk-studio/components/manage/FormatEditor.test.tsx`

**Interfaces:**
- Consumes: `createFormat`, `updateFormat`, `deactivateFormat`, `listFormats`, `suggestSlug` (Task 11), `FormatSummary` (Task 10).

- [ ] **Step 1: Write the failing test**

Create `directwerk-studio/components/manage/FormatEditor.test.tsx`:

```tsx
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import FormatEditor from '@/components/manage/FormatEditor'

const replace = vi.fn()
vi.mock('next/navigation', () => ({useRouter: () => ({replace})}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))

const createFormat = vi.fn().mockResolvedValue({
    id: 1,
    slug: 'interview',
    name: 'Interview',
    active: true,
    description: null,
    requiredLevelSortOrder: null,
    sortOrder: 0,
})
vi.mock('@/lib/api/tenantApi', () => ({
    createFormat: (...args: unknown[]) => createFormat(...args),
    updateFormat: vi.fn(),
    deactivateFormat: vi.fn(),
    listFormats: vi.fn().mockResolvedValue([]),
    suggestSlug: (title: string) => title.toLowerCase(),
}))

describe('FormatEditor', () => {
    it('creates a new format and redirects to its detail page', async () => {
        const user = userEvent.setup()
        render(<FormatEditor />)

        await user.type(screen.getByLabelText('Name'), 'Interview')
        await user.type(screen.getByLabelText('Slug'), 'interview')
        await user.click(screen.getByRole('button', {name: /Speichern/}))

        await waitFor(() => expect(createFormat).toHaveBeenCalledWith('tenant.test', {
            slug: 'interview',
            name: 'Interview',
            description: undefined,
            requiredLevelSortOrder: undefined,
            sortOrder: undefined,
        }))
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/manage/formats/1'))
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir directwerk-studio test -- FormatEditor`
Expected: FAIL (component doesn't exist)

- [ ] **Step 3: Create `FormatEditor.tsx`**

```tsx
'use client'

import Link from 'next/link'
import Form from 'next/form'
import {useRouter} from 'next/navigation'
import {useActionState, useEffect, useState} from 'react'

import styles from '@/components/studio/DeskList.module.css'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import {
    createFormat,
    deactivateFormat,
    listFormats,
    suggestSlug,
    updateFormat,
} from '@/lib/api/tenantApi'
import type {FormatSummary} from '@/lib/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

interface FormatEditorProps {
    formatId?: number
}

interface FormatFormState {
    error: string | null
    success: string | null
}

const INITIAL_STATE: FormatFormState = {error: null, success: null}

function parseOptionalInt(value: FormDataEntryValue | null): number | undefined {
    const text = String(value ?? '').trim()
    if (text.length === 0) {
        return undefined
    }
    const parsed = Number.parseInt(text, 10)
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined
}

export default function FormatEditor({formatId}: FormatEditorProps): React.JSX.Element {
    const router = useRouter()
    const isNew = formatId === undefined
    const [format, setFormat] = useState<FormatSummary | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(!isNew)
    const [isDeactivating, setIsDeactivating] = useState(false)

    useEffect(() => {
        if (formatId === undefined) {
            setIsLoading(false)
            return
        }

        const resolvedId = formatId
        let active = true

        listFormats(getClientTenantHost())
            .then((formats) => {
                if (!active) {
                    return
                }
                const found = formats.find((item) => item.id === resolvedId)
                if (!found) {
                    setLoadError('Format wurde nicht gefunden.')
                    setIsLoading(false)
                    return
                }
                setFormat(found)
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    router.replace('/login')
                    return
                }
                setLoadError(
                    error instanceof Error ? error.message : 'Format konnte nicht geladen werden.',
                )
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [formatId, router])

    async function saveAction(
        _previous: FormatFormState,
        formData: FormData,
    ): Promise<FormatFormState> {
        const name = String(formData.get('name') ?? '').trim()
        const slugInput = String(formData.get('slug') ?? '').trim()
        const description = String(formData.get('description') ?? '').trim()
        const requiredLevelSortOrder = parseOptionalInt(formData.get('requiredLevelSortOrder'))
        const sortOrder = parseOptionalInt(formData.get('sortOrder'))

        if (name.length === 0) {
            return {error: 'Name ist erforderlich.', success: null}
        }

        const host = getClientTenantHost()

        try {
            if (isNew) {
                const resolvedSlug = slugInput || suggestSlug(name) || 'format'
                const created = await createFormat(host, {
                    slug: resolvedSlug,
                    name,
                    description: description.length > 0 ? description : undefined,
                    requiredLevelSortOrder,
                    sortOrder,
                })
                router.replace(`/manage/formats/${created.id}`)
                return {error: null, success: `Format "${created.name}" angelegt.`}
            }

            const updated = await updateFormat(host, formatId, {
                name,
                description: description.length > 0 ? description : undefined,
                requiredLevelSortOrder,
                sortOrder,
            })
            setFormat(updated)
            return {error: null, success: 'Format gespeichert.'}
        } catch (error) {
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                router.replace('/login')
                return INITIAL_STATE
            }
            return {
                error: error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
                success: null,
            }
        }
    }

    const [state, formAction, pending] = useActionState(saveAction, INITIAL_STATE)

    async function handleDeactivate(): Promise<void> {
        if (formatId === undefined) {
            return
        }
        setIsDeactivating(true)
        try {
            const updated = await deactivateFormat(getClientTenantHost(), formatId)
            setFormat(updated)
        } catch (error) {
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                router.replace('/login')
            }
        } finally {
            setIsDeactivating(false)
        }
    }

    if (isLoading) {
        return <p>Laden…</p>
    }

    if (loadError) {
        return (
            <p>
                {loadError} <Link href="/manage/formats">Zurück zur Liste</Link>
            </p>
        )
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Verwaltung</p>
                    <h1>{isNew ? 'Neues Format' : 'Format bearbeiten'}</h1>
                </div>
                <Link className={styles.secondaryLink} href="/manage/formats">
                    Zurück zur Liste
                </Link>
            </header>

            {state.error ? (
                <p className={styles.error} role="alert">
                    {state.error}
                </p>
            ) : null}
            {state.success ? <p role="status">{state.success}</p> : null}

            <Form action={formAction}>
                <p>
                    <label htmlFor="format-name">Name</label>
                    <br />
                    <input
                        defaultValue={format?.name ?? ''}
                        id="format-name"
                        maxLength={255}
                        name="name"
                        required
                        type="text"
                    />
                </p>
                <p>
                    <label htmlFor="format-slug">Slug</label>
                    <br />
                    <input
                        defaultValue={format?.slug ?? ''}
                        disabled={!isNew}
                        id="format-slug"
                        maxLength={64}
                        name="slug"
                        pattern="^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$"
                        required={isNew}
                        type="text"
                    />
                </p>
                <p>
                    <label htmlFor="format-description">Beschreibung</label>
                    <br />
                    <textarea
                        defaultValue={format?.description ?? ''}
                        id="format-description"
                        name="description"
                        rows={4}
                    />
                </p>
                <p>
                    <label htmlFor="format-required-level">Mindest-Stufe (Sort Order)</label>
                    <br />
                    <input
                        defaultValue={format?.requiredLevelSortOrder ?? ''}
                        id="format-required-level"
                        min={0}
                        name="requiredLevelSortOrder"
                        type="number"
                    />
                </p>
                <p>
                    <label htmlFor="format-sort-order">Sortierung</label>
                    <br />
                    <input
                        defaultValue={format?.sortOrder ?? 0}
                        id="format-sort-order"
                        min={0}
                        name="sortOrder"
                        type="number"
                    />
                </p>
                <p>
                    <button disabled={pending} type="submit">
                        {pending ? 'Speichert…' : 'Speichern'}
                    </button>
                    {!isNew && format?.active ? (
                        <>
                            {' '}
                            <button
                                disabled={isDeactivating}
                                onClick={() => void handleDeactivate()}
                                type="button"
                            >
                                {isDeactivating ? 'Deaktiviert…' : 'Deaktivieren'}
                            </button>
                        </>
                    ) : null}
                </p>
            </Form>
        </div>
    )
}
```

- [ ] **Step 4: Create the routes**

`directwerk-studio/app/(studio)/manage/formats/new/page.tsx`:

```tsx
import FormatEditor from '@/components/manage/FormatEditor'

export default function NewFormatPage(): React.JSX.Element {
    return <FormatEditor />
}
```

`directwerk-studio/app/(studio)/manage/formats/[formatId]/page.tsx`:

```tsx
import FormatEditor from '@/components/manage/FormatEditor'

interface FormatPageProps {
    params: Promise<{formatId: string}>
}

export default async function FormatPage({
    params,
}: FormatPageProps): Promise<React.JSX.Element> {
    const {formatId} = await params
    const parsed = Number.parseInt(formatId, 10)

    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        return <p>Ungültige Format-ID.</p>
    }

    return <FormatEditor formatId={parsed} />
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --dir directwerk-studio test -- FormatEditor`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add directwerk-studio/components/manage/FormatEditor.tsx directwerk-studio/components/manage/FormatEditor.test.tsx "directwerk-studio/app/(studio)/manage/formats/new/page.tsx" "directwerk-studio/app/(studio)/manage/formats/[formatId]/page.tsx"
git commit -m "feat(directwerk-studio): add Format create/edit/deactivate page"
```

---

### Task 14: `CategoryListClient` + `/manage/categories` route

**Files:**
- Create: `directwerk-studio/components/manage/CategoryListClient.tsx`
- Create: `directwerk-studio/app/(studio)/manage/categories/page.tsx`
- Create: `directwerk-studio/components/manage/CategoryListClient.test.tsx`

**Interfaces:**
- Consumes: `listCategories` (existing), `CategorySummary` (existing).
- Produces: renders at `/manage/categories`, links to `/manage/categories/new` and `/manage/categories/{id}` (consumed by Task 15).

- [ ] **Step 1: Write the failing test**

Create `directwerk-studio/components/manage/CategoryListClient.test.tsx` (same structure as Task 12's `FormatListClient.test.tsx`, swapping in categories):

```tsx
import {render, screen, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import CategoryListClient from '@/components/manage/CategoryListClient'

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/tenantApi', () => ({
    listCategories: vi.fn().mockResolvedValue([
        {id: 1, slug: 'news', name: 'News', parentId: null, active: true},
    ]),
}))

describe('CategoryListClient', () => {
    it('renders loaded categories', async () => {
        render(<CategoryListClient />)
        await waitFor(() => expect(screen.getByText('News')).toBeInTheDocument())
        expect(screen.getByRole('link', {name: /Neue Kategorie/})).toHaveAttribute(
            'href',
            '/manage/categories/new',
        )
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir directwerk-studio test -- CategoryListClient`
Expected: FAIL

- [ ] **Step 3: Create `CategoryListClient.tsx`**

```tsx
'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import styles from '@/components/studio/DeskList.module.css'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import {listCategories} from '@/lib/api/tenantApi'
import type {CategorySummary} from '@/lib/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

export default function CategoryListClient(): React.JSX.Element {
    const router = useRouter()
    const [categories, setCategories] = useState<CategorySummary[] | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        let active = true

        listCategories(getClientTenantHost())
            .then((result) => {
                if (active) {
                    setCategories(result)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    router.replace('/login')
                    return
                }
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Kategorien konnten nicht geladen werden.',
                )
            })

        return () => {
            active = false
        }
    }, [router])

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Verwaltung</p>
                    <h1>Kategorien</h1>
                </div>
                <Link className={styles.primaryLink} href="/manage/categories/new">
                    Neue Kategorie
                </Link>
            </header>

            {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
            {categories === null && !errorMessage ? <p>Laden…</p> : null}
            {categories && categories.length === 0 ? <p>Noch keine Kategorien angelegt.</p> : null}
            {categories && categories.length > 0 ? (
                <ul className={styles.list}>
                    {categories.map((category) => (
                        <li key={category.id}>
                            <Link
                                className={styles.itemLink}
                                href={`/manage/categories/${category.id}`}
                            >
                                <span>
                                    {category.name}
                                    <br />
                                    <small>{category.slug}</small>
                                </span>
                                <span className={styles.itemMeta}>
                                    {category.active ? 'Aktiv' : 'Inaktiv'}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    )
}
```

- [ ] **Step 4: Create the route**

`directwerk-studio/app/(studio)/manage/categories/page.tsx`:

```tsx
import CategoryListClient from '@/components/manage/CategoryListClient'

export default function CategoriesPage(): React.JSX.Element {
    return <CategoryListClient />
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --dir directwerk-studio test -- CategoryListClient`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add directwerk-studio/components/manage/CategoryListClient.tsx directwerk-studio/components/manage/CategoryListClient.test.tsx "directwerk-studio/app/(studio)/manage/categories/page.tsx"
git commit -m "feat(directwerk-studio): add Category list page"
```

---

### Task 15: `CategoryEditor` (create/edit/deactivate, `next/form` + `useActionState`) + routes

**Files:**
- Create: `directwerk-studio/components/manage/CategoryEditor.tsx`
- Create: `directwerk-studio/app/(studio)/manage/categories/new/page.tsx`
- Create: `directwerk-studio/app/(studio)/manage/categories/[categoryId]/page.tsx`
- Create: `directwerk-studio/components/manage/CategoryEditor.test.tsx`

**Interfaces:**
- Consumes: `createCategory`, `updateCategory`, `deactivateCategory`, `listCategories`, `suggestSlug` (Task 11), `CategorySummary` (existing).

- [ ] **Step 1: Write the failing test**

Create `directwerk-studio/components/manage/CategoryEditor.test.tsx` (mirror `FormatEditor.test.tsx` from Task 13, swapping in category fields):

```tsx
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import CategoryEditor from '@/components/manage/CategoryEditor'

const replace = vi.fn()
vi.mock('next/navigation', () => ({useRouter: () => ({replace})}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))

const createCategory = vi.fn().mockResolvedValue({
    id: 1,
    slug: 'news',
    name: 'News',
    parentId: null,
    active: true,
})
vi.mock('@/lib/api/tenantApi', () => ({
    createCategory: (...args: unknown[]) => createCategory(...args),
    updateCategory: vi.fn(),
    deactivateCategory: vi.fn(),
    listCategories: vi.fn().mockResolvedValue([]),
    suggestSlug: (title: string) => title.toLowerCase(),
}))

describe('CategoryEditor', () => {
    it('creates a new category and redirects to its detail page', async () => {
        const user = userEvent.setup()
        render(<CategoryEditor />)

        await user.type(screen.getByLabelText('Name'), 'News')
        await user.type(screen.getByLabelText('Slug'), 'news')
        await user.click(screen.getByRole('button', {name: /Speichern/}))

        await waitFor(() =>
            expect(createCategory).toHaveBeenCalledWith('tenant.test', {
                slug: 'news',
                name: 'News',
                parentId: undefined,
            }),
        )
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/manage/categories/1'))
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir directwerk-studio test -- CategoryEditor`
Expected: FAIL

- [ ] **Step 3: Create `CategoryEditor.tsx`**

```tsx
'use client'

import Link from 'next/link'
import Form from 'next/form'
import {useRouter} from 'next/navigation'
import {useActionState, useEffect, useState} from 'react'

import styles from '@/components/studio/DeskList.module.css'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import {
    createCategory,
    deactivateCategory,
    listCategories,
    suggestSlug,
    updateCategory,
} from '@/lib/api/tenantApi'
import type {CategorySummary} from '@/lib/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

interface CategoryEditorProps {
    categoryId?: number
}

interface CategoryFormState {
    error: string | null
    success: string | null
}

const INITIAL_STATE: CategoryFormState = {error: null, success: null}

function parseOptionalId(value: FormDataEntryValue | null): number | undefined {
    const text = String(value ?? '').trim()
    if (text.length === 0) {
        return undefined
    }
    const parsed = Number.parseInt(text, 10)
    return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : undefined
}

export default function CategoryEditor({categoryId}: CategoryEditorProps): React.JSX.Element {
    const router = useRouter()
    const isNew = categoryId === undefined
    const [categories, setCategories] = useState<CategorySummary[]>([])
    const [category, setCategory] = useState<CategorySummary | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isDeactivating, setIsDeactivating] = useState(false)

    useEffect(() => {
        let active = true

        listCategories(getClientTenantHost())
            .then((allCategories) => {
                if (!active) {
                    return
                }
                setCategories(allCategories)
                if (categoryId !== undefined) {
                    const found = allCategories.find((item) => item.id === categoryId)
                    if (!found) {
                        setLoadError('Kategorie wurde nicht gefunden.')
                    } else {
                        setCategory(found)
                    }
                }
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    router.replace('/login')
                    return
                }
                setLoadError(
                    error instanceof Error
                        ? error.message
                        : 'Kategorie konnte nicht geladen werden.',
                )
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [categoryId, router])

    async function saveAction(
        _previous: CategoryFormState,
        formData: FormData,
    ): Promise<CategoryFormState> {
        const name = String(formData.get('name') ?? '').trim()
        const slugInput = String(formData.get('slug') ?? '').trim()
        const parentId = parseOptionalId(formData.get('parentId'))

        if (name.length === 0) {
            return {error: 'Name ist erforderlich.', success: null}
        }

        const host = getClientTenantHost()

        try {
            if (isNew) {
                const resolvedSlug = slugInput || suggestSlug(name) || 'kategorie'
                const created = await createCategory(host, {slug: resolvedSlug, name, parentId})
                router.replace(`/manage/categories/${created.id}`)
                return {error: null, success: `Kategorie "${created.name}" angelegt.`}
            }

            const updated = await updateCategory(host, categoryId, {name, parentId})
            setCategory(updated)
            return {error: null, success: 'Kategorie gespeichert.'}
        } catch (error) {
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                router.replace('/login')
                return INITIAL_STATE
            }
            return {
                error: error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
                success: null,
            }
        }
    }

    const [state, formAction, pending] = useActionState(saveAction, INITIAL_STATE)

    async function handleDeactivate(): Promise<void> {
        if (categoryId === undefined) {
            return
        }
        setIsDeactivating(true)
        try {
            const updated = await deactivateCategory(getClientTenantHost(), categoryId)
            setCategory(updated)
        } catch (error) {
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                router.replace('/login')
            }
        } finally {
            setIsDeactivating(false)
        }
    }

    if (isLoading) {
        return <p>Laden…</p>
    }

    if (loadError) {
        return (
            <p>
                {loadError} <Link href="/manage/categories">Zurück zur Liste</Link>
            </p>
        )
    }

    const parentOptions = categories.filter(
        (item) => item.active && item.id !== categoryId,
    )

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Verwaltung</p>
                    <h1>{isNew ? 'Neue Kategorie' : 'Kategorie bearbeiten'}</h1>
                </div>
                <Link className={styles.secondaryLink} href="/manage/categories">
                    Zurück zur Liste
                </Link>
            </header>

            {state.error ? (
                <p className={styles.error} role="alert">
                    {state.error}
                </p>
            ) : null}
            {state.success ? <p role="status">{state.success}</p> : null}

            <Form action={formAction}>
                <p>
                    <label htmlFor="category-name">Name</label>
                    <br />
                    <input
                        defaultValue={category?.name ?? ''}
                        id="category-name"
                        maxLength={255}
                        name="name"
                        required
                        type="text"
                    />
                </p>
                <p>
                    <label htmlFor="category-slug">Slug</label>
                    <br />
                    <input
                        defaultValue={category?.slug ?? ''}
                        disabled={!isNew}
                        id="category-slug"
                        maxLength={64}
                        name="slug"
                        pattern="^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$"
                        required={isNew}
                        type="text"
                    />
                </p>
                <p>
                    <label htmlFor="category-parent">Übergeordnete Kategorie</label>
                    <br />
                    <select
                        defaultValue={category?.parentId ?? ''}
                        id="category-parent"
                        name="parentId"
                    >
                        <option value="">— Keine —</option>
                        {parentOptions.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                </p>
                <p>
                    <button disabled={pending} type="submit">
                        {pending ? 'Speichert…' : 'Speichern'}
                    </button>
                    {!isNew && category?.active ? (
                        <>
                            {' '}
                            <button
                                disabled={isDeactivating}
                                onClick={() => void handleDeactivate()}
                                type="button"
                            >
                                {isDeactivating ? 'Deaktiviert…' : 'Deaktivieren'}
                            </button>
                        </>
                    ) : null}
                </p>
            </Form>
        </div>
    )
}
```

- [ ] **Step 4: Create the routes**

`directwerk-studio/app/(studio)/manage/categories/new/page.tsx`:

```tsx
import CategoryEditor from '@/components/manage/CategoryEditor'

export default function NewCategoryPage(): React.JSX.Element {
    return <CategoryEditor />
}
```

`directwerk-studio/app/(studio)/manage/categories/[categoryId]/page.tsx`:

```tsx
import CategoryEditor from '@/components/manage/CategoryEditor'

interface CategoryPageProps {
    params: Promise<{categoryId: string}>
}

export default async function CategoryPage({
    params,
}: CategoryPageProps): Promise<React.JSX.Element> {
    const {categoryId} = await params
    const parsed = Number.parseInt(categoryId, 10)

    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        return <p>Ungültige Kategorie-ID.</p>
    }

    return <CategoryEditor categoryId={parsed} />
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --dir directwerk-studio test -- CategoryEditor`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add directwerk-studio/components/manage/CategoryEditor.tsx directwerk-studio/components/manage/CategoryEditor.test.tsx "directwerk-studio/app/(studio)/manage/categories/new/page.tsx" "directwerk-studio/app/(studio)/manage/categories/[categoryId]/page.tsx"
git commit -m "feat(directwerk-studio): add Category create/edit/deactivate page"
```

---

### Task 16: Add Formate/Kategorien links to `SideNav`

**Files:**
- Modify: `directwerk-studio/components/studio/SideNav.tsx:59-90`

**Interfaces:**
- Consumes: `hasModule` (existing, `lib/api/client.ts`).

- [ ] **Step 1: Write the failing test**

Find or create `directwerk-studio/components/studio/SideNav.test.tsx` (search first: `find directwerk-studio/components/studio -name "SideNav*"`). If a test file already exists, add a case; otherwise create one:

```tsx
import {render, screen} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import SideNav from '@/components/studio/SideNav'
import type {SiteConfig} from '@/lib/api/types'

function config(overrides: Partial<SiteConfig> = {}): SiteConfig {
    return {
        tenant: {slug: 'tenant', name: 'Tenant'},
        enabledModules: ['PODCAST'],
        branding: {siteTitle: null, primaryColor: null, secondaryColor: null, logoUrl: null},
        publicRssUrl: null,
        studioHome: 'PODCAST_DESK',
        studioDesks: ['PODCAST'],
        ...overrides,
    }
}

describe('SideNav', () => {
    it('links to Formate and Kategorien under Verwaltung when PODCAST is enabled', () => {
        render(<SideNav config={config()} />)
        expect(screen.getByRole('link', {name: 'Formate'})).toHaveAttribute(
            'href',
            '/manage/formats',
        )
        expect(screen.getByRole('link', {name: 'Kategorien'})).toHaveAttribute(
            'href',
            '/manage/categories',
        )
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir directwerk-studio test -- SideNav`
Expected: FAIL (no such links yet)

- [ ] **Step 3: Update `SideNav.tsx`**

Replace the `Verwaltung` section (lines 59-90):

```tsx
            <section className={styles.section} aria-labelledby="nav-manage">
                <h2 id="nav-manage" className={styles.sectionTitle}>
                    Verwaltung
                </h2>
                <ul className={styles.list}>
                    <li>
                        <Link className={styles.link} href="/manage">
                            Übersicht
                        </Link>
                    </li>
                    {showPodcast ? (
                        <li>
                            <Link className={styles.link} href="/manage/formats">
                                Formate
                            </Link>
                        </li>
                    ) : null}
                    <li>
                        <Link className={styles.link} href="/manage/categories">
                            Kategorien
                        </Link>
                    </li>
                    {showSubscription ? (
                        <>
                            <li>
                                <Link
                                    className={styles.link}
                                    href="/manage/products"
                                >
                                    Produkte
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className={styles.link}
                                    href="/manage/grants"
                                >
                                    Freischaltungen
                                </Link>
                            </li>
                        </>
                    ) : null}
                </ul>
            </section>
```

(Formats are `PODCAST`-gated per the backend `TenantFormatController`, so reuse `showPodcast`. Categories are `DIGITAL_CONTENT`-gated — since `DIGITAL_CONTENT` is the base module that both `WRITE` and `PODCAST` desks depend on per AGENTS.md's Feature Modules section, and this nav already only renders once a tenant has at least one desk, Categories is shown unconditionally here rather than adding a third `hasModule(config, 'DIGITAL_CONTENT')` check — matching how the rest of this component already treats `DIGITAL_CONTENT` as an implicit baseline rather than a checked flag.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir directwerk-studio test -- SideNav`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add directwerk-studio/components/studio/SideNav.tsx directwerk-studio/components/studio/SideNav.test.tsx
git commit -m "feat(directwerk-studio): add Formate/Kategorien links to Verwaltung nav"
```

---

## Phase 6 — directwerk-studio: tag episodes/articles, Series fields, RSS visibility

### Task 17: `EpisodeEditor` — Format & Category tagging

**Files:**
- Modify: `directwerk-studio/components/podcast/EpisodeEditor.tsx`
- Test: `directwerk-studio/components/podcast/EpisodeEditor.test.tsx` if it exists (search first: `find directwerk-studio/components/podcast -name "EpisodeEditor.test*"`); otherwise create one with just the new test case.

**Interfaces:**
- Consumes: `replaceEpisodeFormats`, `replaceEpisodeCategories` (Task 11), `listFormats`, `listCategories` (existing), `FormatSummary`, `CategorySummary` (existing/Task 10).

- [ ] **Step 1: Write the failing test**

If `EpisodeEditor.test.tsx` exists, read it fully first and add the case below using its exact existing mocking conventions (it will already mock `tenantApi`, `getMediaPreviewUrl`, etc. — extend that mock object rather than replacing it). If it doesn't exist, create it with a minimal harness:

```tsx
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import EpisodeEditor from '@/components/podcast/EpisodeEditor'

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/site/SiteConfigProvider', () => ({
    useSiteConfig: () => ({enabledModules: []}),
}))

const replaceEpisodeFormats = vi.fn().mockResolvedValue({
    id: 1, slug: 'ep-1', title: 'Episode', status: 'DRAFT', accessPolicy: 'FREE', publishedAt: null,
    seriesId: 1, description: null, episodeNumber: null, audioAssetId: null,
    requiredLevelSortOrder: null, scheduledAt: null,
    formats: [{id: 1, slug: 'interview', name: 'Interview'}], categories: [],
})
const replaceEpisodeCategories = vi.fn().mockResolvedValue({
    id: 1, slug: 'ep-1', title: 'Episode', status: 'DRAFT', accessPolicy: 'FREE', publishedAt: null,
    seriesId: 1, description: null, episodeNumber: null, audioAssetId: null,
    requiredLevelSortOrder: null, scheduledAt: null,
    formats: [{id: 1, slug: 'interview', name: 'Interview'}], categories: [],
})

vi.mock('@/lib/api/tenantApi', () => ({
    listSeries: vi.fn().mockResolvedValue([{id: 1, slug: 'show', title: 'Show', status: 'DRAFT'}]),
    getEpisode: vi.fn().mockResolvedValue({
        id: 1, slug: 'ep-1', title: 'Episode', status: 'DRAFT', accessPolicy: 'FREE', publishedAt: null,
        seriesId: 1, description: null, episodeNumber: null, audioAssetId: null,
        requiredLevelSortOrder: null, scheduledAt: null, formats: [], categories: [],
    }),
    listFormats: vi.fn().mockResolvedValue([
        {id: 1, slug: 'interview', name: 'Interview', active: true, description: null, requiredLevelSortOrder: null, sortOrder: 0},
    ]),
    listCategories: vi.fn().mockResolvedValue([]),
    replaceEpisodeFormats: (...args: unknown[]) => replaceEpisodeFormats(...args),
    replaceEpisodeCategories: (...args: unknown[]) => replaceEpisodeCategories(...args),
    getMediaPreviewUrl: vi.fn(),
    suggestSlug: (title: string) => title.toLowerCase(),
}))

describe('EpisodeEditor tagging', () => {
    it('saves selected formats and categories', async () => {
        const user = userEvent.setup()
        render(<EpisodeEditor episodeId={1} />)

        await waitFor(() => expect(screen.getByLabelText('Interview')).toBeInTheDocument())
        await user.click(screen.getByLabelText('Interview'))
        await user.click(screen.getByRole('button', {name: /Formate.*Kategorien speichern/}))

        await waitFor(() => expect(replaceEpisodeFormats).toHaveBeenCalledWith('tenant.test', 1, [1]))
        expect(replaceEpisodeCategories).toHaveBeenCalledWith('tenant.test', 1, [])
    })
})
```

(If an existing test file already renders `EpisodeEditor` with a different mock shape for `getEpisode`, add `formats: []`/`categories: []` to that fixture instead of introducing a second one.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir directwerk-studio test -- EpisodeEditor`
Expected: FAIL (no Format/Category checkboxes rendered yet)

- [ ] **Step 3: Update imports (lines 9-30)**

Add to the `import {...} from '@/lib/api/tenantApi'` block: `listCategories,`, `listFormats,`, `replaceEpisodeCategories,`, `replaceEpisodeFormats,` (alphabetically, matching existing sort order).

Add to the `import type {...} from '@/lib/api/types'` line: `CategorySummary, FormatSummary,` alongside `AccessPolicy, EpisodeDetail, SeriesSummary`.

- [ ] **Step 4: Add tagging state (after the existing `audioPreviewError` state declaration, before `const audioAssetId = ...`)**

```tsx
    const [availableFormats, setAvailableFormats] = useState<FormatSummary[]>([])
    const [availableCategories, setAvailableCategories] = useState<CategorySummary[]>([])
    const [selectedFormatIds, setSelectedFormatIds] = useState<Set<number>>(new Set())
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set())
    const [isTagsSaving, setIsTagsSaving] = useState(false)
    const [tagsStatusMessage, setTagsStatusMessage] = useState<string | null>(null)
```

- [ ] **Step 5: Extend the main load effect to fetch formats/categories and seed selections**

In the `load` function inside the existing `useEffect` that fetches `seriesList`/`loadedEpisode` (around line 101-151), change the `Promise.all` to also fetch formats/categories, and seed the selected-id sets:

```tsx
                const [seriesList, formatList, categoryList, loadedEpisode] = await Promise.all([
                    listSeries(host),
                    listFormats(host),
                    listCategories(host),
                    episodeId === undefined ? null : getEpisode(host, episodeId),
                ])

                if (!active) {
                    return
                }

                setSeries(seriesList)
                setAvailableFormats(formatList.filter((item) => item.active))
                setAvailableCategories(categoryList.filter((item) => item.active))
                if (seriesList.length > 0) {
                    setSeriesId(loadedEpisode?.seriesId ?? seriesList[0].id)
                }

                if (loadedEpisode !== null) {
                    setEpisode(loadedEpisode)
                    setTitle(loadedEpisode.title)
                    setSlug(loadedEpisode.slug)
                    setBody(loadedEpisode.description ?? '')
                    setAccessPolicy(loadedEpisode.accessPolicy)
                    setScheduledAt(toDatetimeLocalValue(loadedEpisode.scheduledAt))
                    setSelectedFormatIds(new Set(loadedEpisode.formats.map((tag) => tag.id)))
                    setSelectedCategoryIds(new Set(loadedEpisode.categories.map((tag) => tag.id)))
                }
```

(This replaces the equivalent lines inside that `try` block — the surrounding `try`/`catch`/`finally` and the `host`/`episodeId`/`router` dependency array are unchanged.)

- [ ] **Step 6: Add a `handleSaveTags` callback (after `handleAudioUpload`, before the `if (isLoading)` guard)**

```tsx
    const handleSaveTags = useCallback(async (): Promise<void> => {
        if (episode === null) {
            return
        }

        setIsTagsSaving(true)
        setTagsStatusMessage(null)
        try {
            const host = getClientTenantHost()
            const [afterFormats, afterCategories] = await Promise.all([
                replaceEpisodeFormats(host, episode.id, Array.from(selectedFormatIds)),
                replaceEpisodeCategories(host, episode.id, Array.from(selectedCategoryIds)),
            ])
            setEpisode(afterCategories)
            setSelectedFormatIds(new Set(afterFormats.formats.map((tag) => tag.id)))
            setSelectedCategoryIds(new Set(afterCategories.categories.map((tag) => tag.id)))
            setTagsStatusMessage('Formate & Kategorien gespeichert.')
        } catch (error) {
            handleAuthError(error)
        } finally {
            setIsTagsSaving(false)
        }
    }, [episode, handleAuthError, selectedCategoryIds, selectedFormatIds])
```

- [ ] **Step 7: Render the tagging UI in `sidebarExtra`**

The `sidebarExtra` prop currently passes a single `<div className={styles.audio}>...</div>`. Wrap it and a new tagging block in a fragment — replace the `sidebarExtra={...}` prop value:

```tsx
                sidebarExtra={
                    <>
                        <div className={styles.audio}>
                            {/* ... existing audio block content, unchanged ... */}
                        </div>
                        {episode !== null ? (
                            <div className={styles.audio}>
                                <p className={styles.audioLabel}>Formate</p>
                                {availableFormats.length === 0 ? (
                                    <p className={styles.hint}>Keine Formate angelegt.</p>
                                ) : (
                                    availableFormats.map((format) => (
                                        <label key={format.id} className={styles.field} style={{display: 'block'}}>
                                            <input
                                                checked={selectedFormatIds.has(format.id)}
                                                onChange={(event) => {
                                                    setSelectedFormatIds((current) => {
                                                        const next = new Set(current)
                                                        if (event.target.checked) {
                                                            next.add(format.id)
                                                        } else {
                                                            next.delete(format.id)
                                                        }
                                                        return next
                                                    })
                                                }}
                                                type="checkbox"
                                            />{' '}
                                            {format.name}
                                        </label>
                                    ))
                                )}
                                <p className={styles.audioLabel}>Kategorien</p>
                                {availableCategories.length === 0 ? (
                                    <p className={styles.hint}>Keine Kategorien angelegt.</p>
                                ) : (
                                    availableCategories.map((category) => (
                                        <label key={category.id} className={styles.field} style={{display: 'block'}}>
                                            <input
                                                checked={selectedCategoryIds.has(category.id)}
                                                onChange={(event) => {
                                                    setSelectedCategoryIds((current) => {
                                                        const next = new Set(current)
                                                        if (event.target.checked) {
                                                            next.add(category.id)
                                                        } else {
                                                            next.delete(category.id)
                                                        }
                                                        return next
                                                    })
                                                }}
                                                type="checkbox"
                                            />{' '}
                                            {category.name}
                                        </label>
                                    ))
                                )}
                                {tagsStatusMessage !== null ? (
                                    <p className={styles.hint} role="status">
                                        {tagsStatusMessage}
                                    </p>
                                ) : null}
                                <button
                                    disabled={isTagsSaving}
                                    onClick={() => void handleSaveTags()}
                                    type="button"
                                >
                                    {isTagsSaving ? 'Speichert…' : 'Formate & Kategorien speichern'}
                                </button>
                            </div>
                        ) : null}
                    </>
                }
```

(Only the audio `<div>`'s children are unchanged from the current file — the surrounding wrapper and the new tagging block are new. Formats/categories editing is only shown once the episode exists, matching how audio upload is already gated implicitly by needing `saved.id` from `save()`.)

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --dir directwerk-studio test -- EpisodeEditor`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add directwerk-studio/components/podcast/EpisodeEditor.tsx directwerk-studio/components/podcast/EpisodeEditor.test.tsx
git commit -m "feat(directwerk-studio): add Format/Category tagging to Episode editor"
```

---

### Task 18: `ArticleEditor` — Category tagging

**Files:**
- Modify: `directwerk-studio/components/write/ArticleEditor.tsx`
- Test: `directwerk-studio/components/write/ArticleEditor.test.tsx` if it exists (search first); otherwise create one with just the new case.

**Interfaces:**
- Consumes: `replaceArticleCategories` (Task 11), `listCategories` (existing), `CategorySummary` (existing).

- [ ] **Step 1: Write the failing test**

Read `ArticleEditor.test.tsx` if it exists and extend its mocks; otherwise create a minimal one following the same shape as Task 17's `EpisodeEditor.test.tsx`, adapted: mock `getArticle` to return `categories: []`, mock `listCategories` to return one active category, mock `replaceArticleCategories`, and assert clicking its checkbox then the "Kategorien speichern" button calls `replaceArticleCategories('tenant.test', 1, [<id>])`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir directwerk-studio test -- ArticleEditor`
Expected: FAIL

- [ ] **Step 3: Update imports**

Add `listCategories, replaceArticleCategories,` to the `tenantApi` import block, and `CategorySummary` to the types import (`import type {AccessPolicy, ArticleDetail, CategorySummary} from '@/lib/api/types'`).

- [ ] **Step 4: Add tagging state (after the existing `loadError` state)**

```tsx
    const [availableCategories, setAvailableCategories] = useState<CategorySummary[]>([])
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set())
    const [isTagsSaving, setIsTagsSaving] = useState(false)
    const [tagsStatusMessage, setTagsStatusMessage] = useState<string | null>(null)
```

- [ ] **Step 5: Extend the load effect**

The existing `load` function only fetches `getArticle` when `articleId !== undefined`. Change it to always fetch categories too (categories should be selectable even while composing a brand-new, not-yet-saved article's first draft — but since `replaceArticleCategories` needs an existing `articleId`, the tagging UI itself is still gated on `article !== null`, same as Task 17's approach for episodes):

```tsx
        async function load(): Promise<void> {
            try {
                const host = getClientTenantHost()
                const [categoryList, loaded] = await Promise.all([
                    listCategories(host),
                    getArticle(host, resolvedArticleId),
                ])
                if (!active) {
                    return
                }
                setAvailableCategories(categoryList.filter((item) => item.active))
                setArticle(loaded)
                setTitle(loaded.title)
                setSlug(loaded.slug)
                setBody(loaded.body ?? '')
                setExcerpt(loaded.excerpt ?? '')
                setAccessPolicy(loaded.accessPolicy)
                setScheduledAt(toDatetimeLocalValue(loaded.scheduledAt))
                setSelectedCategoryIds(new Set(loaded.categories.map((tag) => tag.id)))
            } catch (error) {
```

(This replaces the body of the existing `try` block in the `articleId !== undefined` branch of the effect — the surrounding `catch`/`finally` and the early-return-when-`articleId === undefined` branch above it are unchanged. Since categories can only be tagged on an already-created article, the "always fetch categories" behavior only matters once `articleId !== undefined` — leave the `if (articleId === undefined) { setIsLoading(false); return }` guard at the top of the effect as-is.)

- [ ] **Step 6: Add a `handleSaveTags` callback (after `runWorkflow`, before `if (isLoading)`)**

```tsx
    const handleSaveTags = useCallback(async (): Promise<void> => {
        if (article === null) {
            return
        }

        setIsTagsSaving(true)
        setTagsStatusMessage(null)
        try {
            const updated = await replaceArticleCategories(
                getClientTenantHost(),
                article.id,
                Array.from(selectedCategoryIds),
            )
            setArticle(updated)
            setSelectedCategoryIds(new Set(updated.categories.map((tag) => tag.id)))
            setTagsStatusMessage('Kategorien gespeichert.')
        } catch (error) {
            handleAuthError(error)
        } finally {
            setIsTagsSaving(false)
        }
    }, [article, handleAuthError, selectedCategoryIds])
```

- [ ] **Step 7: Render the tagging UI**

`PublicationEditorLayout` doesn't currently receive a `sidebarExtra` prop from `ArticleEditor` (unlike `EpisodeEditor`). Add it — insert after the `onUnarchive={...}` prop, before the closing `/>`:

```tsx
            sidebarExtra={
                article !== null ? (
                    <div>
                        <p>Kategorien</p>
                        {availableCategories.length === 0 ? (
                            <p>Keine Kategorien angelegt.</p>
                        ) : (
                            availableCategories.map((category) => (
                                <label key={category.id} style={{display: 'block'}}>
                                    <input
                                        checked={selectedCategoryIds.has(category.id)}
                                        onChange={(event) => {
                                            setSelectedCategoryIds((current) => {
                                                const next = new Set(current)
                                                if (event.target.checked) {
                                                    next.add(category.id)
                                                } else {
                                                    next.delete(category.id)
                                                }
                                                return next
                                            })
                                        }}
                                        type="checkbox"
                                    />{' '}
                                    {category.name}
                                </label>
                            ))
                        )}
                        {tagsStatusMessage !== null ? <p role="status">{tagsStatusMessage}</p> : null}
                        <button disabled={isTagsSaving} onClick={() => void handleSaveTags()} type="button">
                            {isTagsSaving ? 'Speichert…' : 'Kategorien speichern'}
                        </button>
                    </div>
                ) : null
            }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --dir directwerk-studio test -- ArticleEditor`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add directwerk-studio/components/write/ArticleEditor.tsx directwerk-studio/components/write/ArticleEditor.test.tsx
git commit -m "feat(directwerk-studio): add Category tagging to Article editor"
```

---

### Task 19: `SeriesEditor` — cover asset upload, default access level, RSS URL display

**Files:**
- Modify: `directwerk-studio/lib/api/types.ts` (`CreateSeriesInput`, `UpdateSeriesInput`)
- Modify: `directwerk-studio/components/podcast/SeriesEditor.tsx`
- Test: `directwerk-studio/components/podcast/SeriesEditor.test.tsx` if it exists (search first); otherwise create one with just the new case.

**Interfaces:**
- Consumes: `uploadMediaFile` (existing, `lib/media/upload`), `getMediaPreviewUrl` (existing, `tenantApi.ts`).
- Produces: `CreateSeriesInput`/`UpdateSeriesInput` gain `coverAssetId?: number` and `defaultRequiredLevelSortOrder?: number` — these were backend-supported (`SeriesController.CreateSeriesRequest`/`UpdateSeriesRequest`, Task 6's file) but missing from the frontend input types; this was a gap in Task 10 that's closed here since it's tightly coupled to this task's UI.

- [ ] **Step 1: Write the failing test**

Read `SeriesEditor.test.tsx` if it exists and extend its mocks; otherwise create one mocking `getSeries` to return `coverAssetId: null, rssUrl: 'http://localhost:8080/feeds/tenant/show.xml'`, and asserting the rendered page shows that URL as a link and an "iTunes-Kategorie" section unaffected.

```tsx
import {render, screen, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import SeriesEditor from '@/components/podcast/SeriesEditor'

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/tenantApi', () => ({
    getSeries: vi.fn().mockResolvedValue({
        id: 1, slug: 'show', title: 'Show', description: null, coverAssetId: null,
        language: 'de', itunesCategory: null, defaultRequiredLevelSortOrder: null,
        rssUrl: 'http://localhost:8080/feeds/tenant/show.xml', status: 'DRAFT',
    }),
    createSeries: vi.fn(),
    updateSeries: vi.fn(),
    getMediaPreviewUrl: vi.fn(),
    suggestSlug: (title: string) => title.toLowerCase(),
}))
vi.mock('@/lib/media/upload', () => ({uploadMediaFile: vi.fn()}))

describe('SeriesEditor RSS URL', () => {
    it('shows the series RSS feed URL when present', async () => {
        render(<SeriesEditor seriesId={1} />)
        await waitFor(() =>
            expect(screen.getByRole('link', {name: /http:\/\/localhost:8080/})).toHaveAttribute(
                'href',
                'http://localhost:8080/feeds/tenant/show.xml',
            ),
        )
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir directwerk-studio test -- SeriesEditor`
Expected: FAIL

- [ ] **Step 3: Update `types.ts`**

Replace `CreateSeriesInput`:

```ts
export interface CreateSeriesInput {
    slug: string
    title: string
    description?: string
    coverAssetId?: number
    language?: string
    itunesCategory?: string
    defaultRequiredLevelSortOrder?: number
}
```

Replace `UpdateSeriesInput`:

```ts
export interface UpdateSeriesInput {
    slug?: string
    title?: string
    description?: string
    coverAssetId?: number
    language?: string
    itunesCategory?: string
    defaultRequiredLevelSortOrder?: number
    status?: SeriesStatus
}
```

- [ ] **Step 4: Update `SeriesEditor.tsx` imports**

Add `getMediaPreviewUrl,` to the `tenantApi` import block. Add a new import line: `import {uploadMediaFile} from '@/lib/media/upload'`.

- [ ] **Step 5: Add state (after the existing `status` state)**

```tsx
    const [coverAssetId, setCoverAssetId] = useState<number | null>(null)
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
    const [isUploadingCover, setIsUploadingCover] = useState(false)
    const [defaultRequiredLevelSortOrder, setDefaultRequiredLevelSortOrder] = useState('')
    const [rssUrl, setRssUrl] = useState<string | null>(null)
```

- [ ] **Step 6: Seed the new state in the load effect**

In the existing `load` function, after `setItunesCategory(loaded.itunesCategory ?? '')`, add:

```tsx
                setCoverAssetId(loaded.coverAssetId)
                setDefaultRequiredLevelSortOrder(
                    loaded.defaultRequiredLevelSortOrder !== null
                        ? String(loaded.defaultRequiredLevelSortOrder)
                        : '',
                )
                setRssUrl(loaded.rssUrl)
```

- [ ] **Step 7: Add a cover-preview effect (mirror `EpisodeEditor`'s audio-preview effect)**

Add after the existing `useEffect` that loads series data:

```tsx
    useEffect(() => {
        let active = true

        if (coverAssetId === null) {
            setCoverPreviewUrl(null)
            return
        }

        getMediaPreviewUrl(getClientTenantHost(), coverAssetId)
            .then((url) => {
                if (active) {
                    setCoverPreviewUrl(url)
                }
            })
            .catch(() => {
                if (active) {
                    setCoverPreviewUrl(null)
                }
            })

        return () => {
            active = false
        }
    }, [coverAssetId])
```

- [ ] **Step 8: Add a cover-upload handler (after `handleAuthError`, before `handleSubmit`)**

```tsx
    async function handleCoverUpload(file: File | null): Promise<void> {
        if (file === null) {
            return
        }
        setIsUploadingCover(true)
        setErrorMessage(null)
        try {
            const asset = await uploadMediaFile(getClientTenantHost(), file, {
                assetType: 'IMAGE',
                visibility: 'PUBLIC',
                scope: 'TENANT_PUBLIC',
            })
            setCoverAssetId(asset.id)
        } catch (error) {
            handleAuthError(error)
        } finally {
            setIsUploadingCover(false)
        }
    }
```

- [ ] **Step 9: Include the new fields in `handleSubmit`'s create/update payloads**

In the existing `handleSubmit`, add to both the `createSeries` and `updateSeries` payload objects (after `itunesCategory: itunesCategory.trim() || undefined,`):

```tsx
                coverAssetId: coverAssetId ?? undefined,
                defaultRequiredLevelSortOrder:
                    defaultRequiredLevelSortOrder.trim().length > 0
                        ? Number.parseInt(defaultRequiredLevelSortOrder, 10)
                        : undefined,
```

- [ ] **Step 10: Render the new fields**

Add after the existing "iTunes-Kategorie" `<label>` block and before the `{!isNew && (...)}` status block:

```tsx
                <label className={styles.field}>
                    <span>Titelbild</span>
                    {coverPreviewUrl !== null ? (
                        <img alt="" src={coverPreviewUrl} style={{maxWidth: '12rem', display: 'block'}} />
                    ) : null}
                    <input
                        accept="image/png,image/jpeg,image/webp"
                        disabled={isUploadingCover}
                        onChange={(event) => {
                            const file = event.target.files?.[0] ?? null
                            void handleCoverUpload(file)
                            event.target.value = ''
                        }}
                        type="file"
                    />
                    {isUploadingCover ? <p>Lädt hoch…</p> : null}
                </label>
                <label className={styles.field}>
                    <span>Mindest-Stufe für Folgen (Standard)</span>
                    <input
                        className={styles.input}
                        min={0}
                        onChange={(event) => setDefaultRequiredLevelSortOrder(event.target.value)}
                        type="number"
                        value={defaultRequiredLevelSortOrder}
                    />
                </label>
                {rssUrl !== null ? (
                    <p>
                        RSS-Feed: <a href={rssUrl} rel="noreferrer" target="_blank">{rssUrl}</a>
                    </p>
                ) : null}
```

- [ ] **Step 11: Run test to verify it passes**

Run: `pnpm --dir directwerk-studio test -- SeriesEditor`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add directwerk-studio/lib/api/types.ts directwerk-studio/components/podcast/SeriesEditor.tsx directwerk-studio/components/podcast/SeriesEditor.test.tsx
git commit -m "feat(directwerk-studio): add cover upload, default access level, and RSS URL display to Series editor"
```

---

### Task 20: `SideNav` — tenant-wide RSS feed link

**Files:**
- Modify: `directwerk-studio/components/studio/SideNav.tsx:39-57`

**Interfaces:**
- Consumes: `config.publicRssUrl` (existing `SiteConfig` field — already fetched, no new API call needed).

- [ ] **Step 1: Extend `SideNav.test.tsx`'s existing case (or the one added in Task 16) with a new assertion**

Add to the `config()` test helper's default: `publicRssUrl: 'http://localhost:8080/feeds/tenant/podcast.xml'`, and add:

```tsx
it('shows the tenant-wide RSS feed link in the Podcast section', () => {
    render(<SideNav config={config()} />)
    expect(screen.getByRole('link', {name: 'RSS-Feed'})).toHaveAttribute(
        'href',
        'http://localhost:8080/feeds/tenant/podcast.xml',
    )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir directwerk-studio test -- SideNav`
Expected: FAIL

- [ ] **Step 3: Update `SideNav.tsx`**

Replace the `showPodcast` block (lines 39-57):

```tsx
            {showPodcast ? (
                <section className={styles.section} aria-labelledby="nav-podcast">
                    <h2 id="nav-podcast" className={styles.sectionTitle}>
                        Podcast
                    </h2>
                    <ul className={styles.list}>
                        <li>
                            <Link className={styles.link} href="/podcast/episodes">
                                Folgen
                            </Link>
                        </li>
                        <li>
                            <Link className={styles.link} href="/podcast/series">
                                Sendungen
                            </Link>
                        </li>
                        {config.publicRssUrl !== null ? (
                            <li>
                                <a
                                    className={styles.link}
                                    href={config.publicRssUrl}
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    RSS-Feed
                                </a>
                            </li>
                        ) : null}
                    </ul>
                </section>
            ) : null}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir directwerk-studio test -- SideNav`
Expected: PASS

- [ ] **Step 5: Run the full studio test suite**

Run: `pnpm --dir directwerk-studio test`
Expected: PASS (confirms Phase 6 introduced no regressions)

- [ ] **Step 6: Commit**

```bash
git add directwerk-studio/components/studio/SideNav.tsx directwerk-studio/components/studio/SideNav.test.tsx
git commit -m "feat(directwerk-studio): show tenant-wide RSS feed link in nav"
```

---

## Phase 7 — example-admin: tenant management completeness

### Task 21: `lib/api/client.ts` — add `patchPlatformData`

**Files:**
- Modify: `example-admin/lib/api/client.ts`
- Modify: `example-admin/lib/api/client.test.ts` (existing — add a case mirroring its existing `postPlatformData`/`deletePlatformData` tests)

**Interfaces:**
- Produces: `patchPlatformData<T>(path: string, body: unknown): Promise<T>` — consumed by Tasks 22-24.

- [ ] **Step 1: Read the existing test file and add a failing case**

Read `example-admin/lib/api/client.test.ts` fully first to match its exact `fetch` mocking style (it already has cases for `getPlatformData`/`postPlatformData`/`deletePlatformData` — copy the `postPlatformData` case's mock setup and adjust the expected HTTP method to `PATCH`):

```ts
it('patchPlatformData sends a PATCH request and returns parsed data', async () => {
    // mirror this file's existing postPlatformData test's fetch-mock setup exactly,
    // asserting the captured RequestInit has method: 'PATCH'
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --dir example-admin test -- client.test`
Expected: FAIL (`patchPlatformData` is not exported)

- [ ] **Step 3: Add `patchPlatformData`**

Add after the existing `postPlatformData` function in `client.ts`:

```ts
export async function patchPlatformData<T>(
    path: string,
    body: unknown
): Promise<T> {
    return platformRequest<T>(path, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --dir example-admin test -- client.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add example-admin/lib/api/client.ts example-admin/lib/api/client.test.ts
git commit -m "feat(example-admin): add patchPlatformData client helper"
```

---

### Task 22: `TenantEditForm` — edit tenant name/slug

**Files:**
- Create: `example-admin/components/TenantEditForm.tsx`
- Create: `example-admin/components/TenantEditForm.test.tsx`
- Modify: `example-admin/app/tenants/[id]/page.tsx`

**Interfaces:**
- Consumes: `patchPlatformData` (Task 21), `Tenant` type (existing).
- Produces: `<TenantEditForm tenantId tenant onUpdated? />`.

- [ ] **Step 1: Write the failing test**

Create `example-admin/components/TenantEditForm.test.tsx` (mirror `InviteTenantUserForm`'s own test file if one exists — search first: `find example-admin/components -name "InviteTenantUserForm.test*"` — and copy its `useActionState`/`next/form` testing setup exactly):

```tsx
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import TenantEditForm from '@/components/TenantEditForm'

const patchPlatformData = vi.fn().mockResolvedValue({
    id: 1, slug: 'renamed-slug', name: 'Renamed', status: 'ACTIVE',
})
vi.mock('@/lib/api/client', () => ({
    patchPlatformData: (...args: unknown[]) => patchPlatformData(...args),
}))

describe('TenantEditForm', () => {
    it('submits name/slug changes and reports success', async () => {
        const user = userEvent.setup()
        const onUpdated = vi.fn()
        render(
            <TenantEditForm
                onUpdated={onUpdated}
                tenant={{id: 1, slug: 'original-slug', name: 'Original', status: 'ACTIVE'}}
                tenantId="1"
            />,
        )

        await user.clear(screen.getByLabelText('Name'))
        await user.type(screen.getByLabelText('Name'), 'Renamed')
        await user.click(screen.getByRole('button', {name: /Save changes/}))

        await waitFor(() =>
            expect(patchPlatformData).toHaveBeenCalledWith('tenants/1', {
                name: 'Renamed',
                slug: 'original-slug',
            }),
        )
        await waitFor(() => expect(onUpdated).toHaveBeenCalledWith({
            id: 1, slug: 'renamed-slug', name: 'Renamed', status: 'ACTIVE',
        }))
        expect(screen.getByRole('status')).toHaveTextContent('Tenant updated.')
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir example-admin test -- TenantEditForm`
Expected: FAIL (component doesn't exist)

- [ ] **Step 3: Create `TenantEditForm.tsx`**

```tsx
'use client'

import Form from 'next/form'
import {useActionState} from 'react'

import {patchPlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED, CONFLICT, REQUEST_FAILED} from '@/lib/api/errors'
import type {Tenant} from '@/lib/api/types'

interface TenantEditFormProps {
    tenantId: string
    tenant: Tenant
    onUpdated?: (tenant: Tenant) => void
}

interface TenantEditState {
    error: string | null
    success: string | null
}

const INITIAL_STATE: TenantEditState = {error: null, success: null}

const SLUG_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$/

export default function TenantEditForm({
    tenantId,
    tenant,
    onUpdated,
}: TenantEditFormProps) {
    async function updateAction(
        _previousState: TenantEditState,
        formData: FormData
    ): Promise<TenantEditState> {
        const name = String(formData.get('name') ?? '').trim()
        const slug = String(formData.get('slug') ?? '').trim()

        if (name.length === 0 && slug.length === 0) {
            return {...INITIAL_STATE, error: 'Enter a name or slug to update.'}
        }
        if (slug.length > 0 && !SLUG_PATTERN.test(slug)) {
            return {
                ...INITIAL_STATE,
                error: 'Slug must be lowercase letters, numbers, and hyphens.',
            }
        }

        try {
            const updated = await patchPlatformData<Tenant>(`tenants/${tenantId}`, {
                name: name.length > 0 ? name : undefined,
                slug: slug.length > 0 ? slug : undefined,
            })
            onUpdated?.(updated)
            return {error: null, success: 'Tenant updated.'}
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                return {...INITIAL_STATE, error: 'Your session expired. Sign in again.'}
            }
            if (
                requestError instanceof Error &&
                requestError.message === CONFLICT
            ) {
                return {...INITIAL_STATE, error: 'That slug is already in use.'}
            }
            if (
                requestError instanceof Error &&
                requestError.message === REQUEST_FAILED
            ) {
                return {
                    ...INITIAL_STATE,
                    error: 'Update failed. Check the details and try again.',
                }
            }
            return {...INITIAL_STATE, error: 'Update is unavailable. Try again later.'}
        }
    }

    const [state, formAction, pending] = useActionState(updateAction, INITIAL_STATE)

    return (
        <section aria-labelledby="tenant-edit-heading">
            <h3 id="tenant-edit-heading">Edit tenant</h3>
            <Form action={formAction}>
                <p>
                    <label htmlFor="tenant-edit-name">Name</label>
                    <br />
                    <input
                        defaultValue={tenant.name}
                        id="tenant-edit-name"
                        maxLength={255}
                        name="name"
                        type="text"
                    />
                </p>
                <p>
                    <label htmlFor="tenant-edit-slug">Slug</label>
                    <br />
                    <input
                        defaultValue={tenant.slug}
                        id="tenant-edit-slug"
                        maxLength={64}
                        name="slug"
                        pattern="^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$"
                        type="text"
                    />
                </p>
                {state.error ? (
                    <p aria-live="polite" role="alert">
                        {state.error}
                    </p>
                ) : null}
                {state.success ? (
                    <p aria-live="polite" role="status">
                        {state.success}
                    </p>
                ) : null}
                <button disabled={pending} type="submit">
                    {pending ? 'Saving…' : 'Save changes'}
                </button>
            </Form>
        </section>
    )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir example-admin test -- TenantEditForm`
Expected: PASS

- [ ] **Step 5: Wire into the tenant detail page**

In `example-admin/app/tenants/[id]/page.tsx`: add the import `import TenantEditForm from '@/components/TenantEditForm'`, and insert `<TenantEditForm tenantId={id} tenant={data.tenant} onUpdated={(tenant) => setData((current) => (current ? {...current, tenant} : current))} />` immediately after the closing `</dl>` tag and before the `<section aria-labelledby="tenant-lifecycle-heading">` block.

- [ ] **Step 6: Manually verify (this plan can't run a browser)**

Run: `pnpm --dir example-admin dev` and rely on the human reviewer (or the "run" skill, if invoked separately) to confirm the edit form appears on a tenant detail page and round-trips through the real Directwerk API started via `bootRun`. This step exists so the task isn't marked done on unit tests alone for a UI change — record in the PR description that manual verification is still needed if it wasn't performed.

- [ ] **Step 7: Commit**

```bash
git add example-admin/components/TenantEditForm.tsx example-admin/components/TenantEditForm.test.tsx "example-admin/app/tenants/[id]/page.tsx"
git commit -m "feat(example-admin): add tenant name/slug edit form"
```

---

### Task 23: `TenantUserActions` — role change + wire existing deactivate/reactivate

**Files:**
- Create: `example-admin/components/TenantUserActions.tsx`
- Create: `example-admin/components/TenantUserActions.test.tsx`
- Modify: `example-admin/app/tenants/[id]/page.tsx`

**Interfaces:**
- Consumes: `patchPlatformData` (Task 21), `postPlatformData` (existing — the `deactivate`/`reactivate` endpoints already exist on the backend per the survey but were never wired into any UI), `getTenantRoleLabel` (existing, `lib/roles.ts`), `TENANT_INVITABLE_ROLES` (existing).
- Produces: `<TenantUserActions tenantId user onChanged />`, rendered once per row in the tenant detail page's user table.

- [ ] **Step 1: Write the failing test**

```tsx
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import TenantUserActions from '@/components/TenantUserActions'

const patchPlatformData = vi.fn().mockResolvedValue({})
const postPlatformData = vi.fn().mockResolvedValue({})
vi.mock('@/lib/api/client', () => ({
    patchPlatformData: (...args: unknown[]) => patchPlatformData(...args),
    postPlatformData: (...args: unknown[]) => postPlatformData(...args),
}))

describe('TenantUserActions', () => {
    it('submits a role change', async () => {
        const user = userEvent.setup()
        const onChanged = vi.fn()
        render(
            <TenantUserActions
                onChanged={onChanged}
                tenantId="1"
                user={{userId: 2, email: 'editor@example.com', name: null, roles: ['EDITOR'], status: 'ACTIVE'}}
            />,
        )

        await user.selectOptions(screen.getByRole('combobox'), 'TENANT_ADMIN')
        await user.click(screen.getByRole('button', {name: /Change role/}))

        await waitFor(() =>
            expect(patchPlatformData).toHaveBeenCalledWith('tenants/1/users/2', {role: 'TENANT_ADMIN'}),
        )
        expect(onChanged).toHaveBeenCalled()
    })

    it('deactivates an active user', async () => {
        const user = userEvent.setup()
        const onChanged = vi.fn()
        render(
            <TenantUserActions
                onChanged={onChanged}
                tenantId="1"
                user={{userId: 2, email: 'editor@example.com', name: null, roles: ['EDITOR'], status: 'ACTIVE'}}
            />,
        )

        await user.click(screen.getByRole('button', {name: 'Deactivate'}))

        await waitFor(() =>
            expect(postPlatformData).toHaveBeenCalledWith('tenants/1/users/2/deactivate', {}),
        )
        expect(onChanged).toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir example-admin test -- TenantUserActions`
Expected: FAIL (component doesn't exist)

- [ ] **Step 3: Create `TenantUserActions.tsx`**

```tsx
'use client'

import Form from 'next/form'
import {useActionState, useState} from 'react'

import {patchPlatformData, postPlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED, REQUEST_FAILED} from '@/lib/api/errors'
import type {TenantUser} from '@/lib/api/types'
import {TENANT_INVITABLE_ROLES} from '@/lib/api/types'
import {getTenantRoleLabel} from '@/lib/roles'

interface TenantUserActionsProps {
    tenantId: string
    user: TenantUser
    onChanged: () => void
}

interface RoleChangeState {
    error: string | null
}

const INITIAL_ROLE_STATE: RoleChangeState = {error: null}

export default function TenantUserActions({
    tenantId,
    user,
    onChanged,
}: TenantUserActionsProps) {
    const [statusError, setStatusError] = useState<string | null>(null)
    const [isTogglingStatus, setIsTogglingStatus] = useState(false)

    async function changeRoleAction(
        _previousState: RoleChangeState,
        formData: FormData
    ): Promise<RoleChangeState> {
        const role = String(formData.get('role') ?? '')

        try {
            await patchPlatformData(`tenants/${tenantId}/users/${user.userId}`, {role})
            onChanged()
            return {error: null}
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                return {error: 'Your session expired. Sign in again.'}
            }
            if (
                requestError instanceof Error &&
                requestError.message === REQUEST_FAILED
            ) {
                return {error: 'Role change failed. Try again.'}
            }
            return {error: 'Role change is unavailable.'}
        }
    }

    const [roleState, roleAction, rolePending] = useActionState(
        changeRoleAction,
        INITIAL_ROLE_STATE
    )

    async function handleToggleStatus(): Promise<void> {
        setIsTogglingStatus(true)
        setStatusError(null)
        const path =
            user.status === 'ACTIVE'
                ? `tenants/${tenantId}/users/${user.userId}/deactivate`
                : `tenants/${tenantId}/users/${user.userId}/reactivate`

        try {
            await postPlatformData(path, {})
            onChanged()
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                setStatusError('Your session expired. Sign in again.')
                return
            }
            setStatusError('Status change failed. Try again.')
        } finally {
            setIsTogglingStatus(false)
        }
    }

    return (
        <>
            <Form action={roleAction}>
                <select defaultValue={user.roles[0] ?? 'GUEST'} name="role">
                    {TENANT_INVITABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                            {getTenantRoleLabel(role)}
                        </option>
                    ))}
                </select>{' '}
                <button disabled={rolePending} type="submit">
                    {rolePending ? 'Saving…' : 'Change role'}
                </button>
            </Form>
            {roleState.error ? <p role="alert">{roleState.error}</p> : null}
            <button
                disabled={isTogglingStatus}
                onClick={() => void handleToggleStatus()}
                type="button"
            >
                {isTogglingStatus
                    ? 'Working…'
                    : user.status === 'ACTIVE'
                      ? 'Deactivate'
                      : 'Reactivate'}
            </button>
            {statusError ? <p role="alert">{statusError}</p> : null}
        </>
    )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir example-admin test -- TenantUserActions`
Expected: PASS

- [ ] **Step 5: Wire into the tenant detail page**

In `example-admin/app/tenants/[id]/page.tsx`: add the import `import TenantUserActions from '@/components/TenantUserActions'`. Add an `<th scope="col">Actions</th>` header cell, and inside the row `<tr key={user.userId}>`, add a final `<td>` with `<TenantUserActions onChanged={loadTenantData} tenantId={id} user={user} />` (calling `loadTenantData()` directly is safe here even though it also returns a cleanup function — the return value is simply unused).

- [ ] **Step 6: Commit**

```bash
git add example-admin/components/TenantUserActions.tsx example-admin/components/TenantUserActions.test.tsx "example-admin/app/tenants/[id]/page.tsx"
git commit -m "feat(example-admin): add tenant user role change and wire deactivate/reactivate"
```

---

### Task 24: `RevokeAdminButton` on the platform admins page

**Files:**
- Create: `example-admin/components/RevokeAdminButton.tsx`
- Create: `example-admin/components/RevokeAdminButton.test.tsx`
- Modify: `example-admin/app/admins/page.tsx`

**Interfaces:**
- Consumes: `deletePlatformData` (existing, `lib/api/client.ts`).
- Produces: `<RevokeAdminButton userId onRevoked />`.

- [ ] **Step 1: Write the failing test**

```tsx
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import RevokeAdminButton from '@/components/RevokeAdminButton'

const deletePlatformData = vi.fn().mockResolvedValue({})
vi.mock('@/lib/api/client', () => ({
    deletePlatformData: (...args: unknown[]) => deletePlatformData(...args),
}))

describe('RevokeAdminButton', () => {
    it('revokes the admin and calls onRevoked', async () => {
        const user = userEvent.setup()
        const onRevoked = vi.fn()
        render(<RevokeAdminButton onRevoked={onRevoked} userId={2} />)

        await user.click(screen.getByRole('button', {name: /Revoke/}))

        await waitFor(() => expect(deletePlatformData).toHaveBeenCalledWith('admins/2'))
        expect(onRevoked).toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir example-admin test -- RevokeAdminButton`
Expected: FAIL

- [ ] **Step 3: Create `RevokeAdminButton.tsx`**

```tsx
'use client'

import {useState} from 'react'

import {deletePlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@/lib/api/errors'

interface RevokeAdminButtonProps {
    userId: number
    onRevoked: () => void
}

export default function RevokeAdminButton({
    userId,
    onRevoked,
}: RevokeAdminButtonProps) {
    const [isRevoking, setIsRevoking] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleRevoke(): Promise<void> {
        setIsRevoking(true)
        setError(null)

        try {
            await deletePlatformData(`admins/${userId}`)
            onRevoked()
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                setError('Your session expired. Sign in again.')
                return
            }
            setError(
                'Revoke failed. You may be revoking yourself or the last admin.'
            )
        } finally {
            setIsRevoking(false)
        }
    }

    return (
        <>
            <button disabled={isRevoking} onClick={() => void handleRevoke()} type="button">
                {isRevoking ? 'Revoking…' : 'Revoke'}
            </button>
            {error ? <p role="alert">{error}</p> : null}
        </>
    )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir example-admin test -- RevokeAdminButton`
Expected: PASS

- [ ] **Step 5: Wire into the admins page**

In `example-admin/app/admins/page.tsx`, add the import `import RevokeAdminButton from '@/components/RevokeAdminButton'`. Add an `<th scope="col">Actions</th>` header cell, and inside `<tr key={admin.userId}>`, add a final `<td>` with `<RevokeAdminButton onRevoked={loadAdmins} userId={admin.userId} />`.

- [ ] **Step 6: Commit**

```bash
git add example-admin/components/RevokeAdminButton.tsx example-admin/components/RevokeAdminButton.test.tsx example-admin/app/admins/page.tsx
git commit -m "feat(example-admin): add platform admin revoke button"
```

---

### Task 25: `DomainForceVerifyForm` + fix proxy path allow-list to permit dotted hostnames

**Files:**
- Modify: `example-admin/lib/directwerk.ts:14` (`SAFE_PATH_SEGMENT`)
- Modify: `example-admin/lib/directwerk.test.ts` (existing — add cases)
- Create: `example-admin/components/DomainForceVerifyForm.tsx`
- Create: `example-admin/components/DomainForceVerifyForm.test.tsx`
- Modify: `example-admin/app/tenants/[id]/page.tsx`

**Interfaces:**
- Consumes: `postPlatformData` (existing).

- [ ] **Step 1: Read `directwerk.test.ts` and add a failing case**

The domain force-verify backend route is `POST /api/v1/platform/tenants/{tenantId}/domains/{host:.+}/verify` — the `{host}` segment is a real hostname like `tenant.example.com`, which contains dots. `buildPlatformApiPath`'s current `SAFE_PATH_SEGMENT = /^[A-Za-z0-9_-]+$/` (line 14 of `directwerk.ts`) rejects any segment containing a dot, which would make this feature non-functional through the existing proxy — this is a pre-existing gap, not something introduced by this plan, but it must be fixed for domain force-verify to work at all. Read the existing test file, then add:

```ts
it('buildPlatformApiPath allows dotted hostname segments', () => {
    expect(buildPlatformApiPath(['tenants', '1', 'domains', 'tenant.example.com', 'verify']))
        .toBe('/api/v1/platform/tenants/1/domains/tenant.example.com/verify')
})

it('buildPlatformApiPath still rejects a lone dot or double-dot segment', () => {
    expect(() => buildPlatformApiPath(['tenants', '1', 'domains', '.', 'verify'])).toThrow()
    expect(() => buildPlatformApiPath(['tenants', '1', 'domains', '..', 'verify'])).toThrow()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --dir example-admin test -- directwerk.test`
Expected: FAIL (dotted segment currently throws)

- [ ] **Step 3: Widen `SAFE_PATH_SEGMENT`**

In `directwerk.ts`, change line 14:

```ts
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9_.-]+$/
```

(The existing explicit `segment === '.' || segment === '..'` checks in both `buildPlatformApiPath` and `buildTenantApiPath` already reject a lone `.`/`..` segment regardless of this regex, so widening the charset to include `.` only enables real dotted values like hostnames — it does not reopen path traversal.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --dir example-admin test -- directwerk.test`
Expected: PASS

- [ ] **Step 5: Write the failing component test**

```tsx
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import DomainForceVerifyForm from '@/components/DomainForceVerifyForm'

const postPlatformData = vi.fn().mockResolvedValue({host: 'tenant.example.com', primary: false, verified: true})
vi.mock('@/lib/api/client', () => ({
    postPlatformData: (...args: unknown[]) => postPlatformData(...args),
}))

describe('DomainForceVerifyForm', () => {
    it('submits the host and reports success', async () => {
        const user = userEvent.setup()
        render(<DomainForceVerifyForm tenantId="1" />)

        await user.type(screen.getByLabelText('Host'), 'tenant.example.com')
        await user.click(screen.getByRole('button', {name: /Force verify/}))

        await waitFor(() =>
            expect(postPlatformData).toHaveBeenCalledWith(
                'tenants/1/domains/tenant.example.com/verify',
                {},
            ),
        )
        expect(screen.getByRole('status')).toHaveTextContent('tenant.example.com force-verified.')
    })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm --dir example-admin test -- DomainForceVerifyForm`
Expected: FAIL (component doesn't exist)

- [ ] **Step 7: Create `DomainForceVerifyForm.tsx`**

```tsx
'use client'

import Form from 'next/form'
import {useActionState} from 'react'

import {postPlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@/lib/api/errors'

interface DomainForceVerifyFormProps {
    tenantId: string
}

interface DomainVerifyState {
    error: string | null
    success: string | null
}

const INITIAL_STATE: DomainVerifyState = {error: null, success: null}

export default function DomainForceVerifyForm({
    tenantId,
}: DomainForceVerifyFormProps) {
    async function verifyAction(
        _previousState: DomainVerifyState,
        formData: FormData
    ): Promise<DomainVerifyState> {
        const host = String(formData.get('host') ?? '').trim()
        if (host.length === 0) {
            return {...INITIAL_STATE, error: 'Enter a domain host.'}
        }

        try {
            await postPlatformData(
                `tenants/${tenantId}/domains/${host}/verify`,
                {}
            )
            return {error: null, success: `${host} force-verified.`}
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                return {...INITIAL_STATE, error: 'Your session expired. Sign in again.'}
            }
            return {
                ...INITIAL_STATE,
                error: 'Force verify failed. Check the host and try again.',
            }
        }
    }

    const [state, formAction, pending] = useActionState(verifyAction, INITIAL_STATE)

    return (
        <section aria-labelledby="domain-verify-heading">
            <h3 id="domain-verify-heading">Force verify domain</h3>
            <Form action={formAction}>
                <p>
                    <label htmlFor="domain-verify-host">Host</label>
                    <br />
                    <input
                        id="domain-verify-host"
                        name="host"
                        placeholder="tenant.example.com"
                        required
                        type="text"
                    />
                </p>
                {state.error ? (
                    <p aria-live="polite" role="alert">
                        {state.error}
                    </p>
                ) : null}
                {state.success ? (
                    <p aria-live="polite" role="status">
                        {state.success}
                    </p>
                ) : null}
                <button disabled={pending} type="submit">
                    {pending ? 'Verifying…' : 'Force verify'}
                </button>
            </Form>
        </section>
    )
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm --dir example-admin test -- DomainForceVerifyForm`
Expected: PASS

- [ ] **Step 9: Wire into the tenant detail page**

In `example-admin/app/tenants/[id]/page.tsx`, add the import `import DomainForceVerifyForm from '@/components/DomainForceVerifyForm'` and render `<DomainForceVerifyForm tenantId={id} />` after `<TenantSessionPanel .../>` and before `<TenantProductsPanel .../>` (or any other sensible spot alongside the other tenant-detail panels).

- [ ] **Step 10: Run the full example-admin test suite**

Run: `pnpm --dir example-admin test`
Expected: PASS (confirms Phase 7 introduced no regressions)

- [ ] **Step 11: Commit**

```bash
git add example-admin/lib/directwerk.ts example-admin/lib/directwerk.test.ts example-admin/components/DomainForceVerifyForm.tsx example-admin/components/DomainForceVerifyForm.test.tsx "example-admin/app/tenants/[id]/page.tsx"
git commit -m "feat(example-admin): add domain force-verify form; allow dotted hostnames through the API proxy"
```

---

## Phase 8 — Cross-app UI consistency pass

Both apps' existing CSS Modules already depend on specific custom-property names defined in each app's own `globals.css` — confirmed by reading every `.module.css` file in both apps: `example-admin/components/Header.module.css` depends on `--spacing-base`/`--border-width`/`--border-style`; `directwerk-studio`'s `DeskList.module.css`/`SideNav.module.css`/`PublicationEditorLayout.module.css`/`PublicationWorkflowActions.module.css`/`ShowNotesEditor.module.css`/`SeriesSelect.module.css`/`AccessPolicySelect.module.css`/`page.module.css`/`login.module.css` all depend on `--muted`/`--border`/`--brand-primary`/`--foreground`/`--surface-muted`. Renaming any of these would require touching every dependent file — out of scope ("no unrelated refactoring"). Instead: **`example-admin` adopts `directwerk-studio`'s existing token names and values as new additions** (admin doesn't currently define any color tokens, only spacing/border ones, so there's no name collision), and **both apps get the same new base-element styles** (buttons, inputs, focus states, a responsive breakpoint) written independently against each app's own token names. Net effect: same palette, same spacing rhythm, same form/button/table look — without renaming anything an existing component relies on.

### Task 26: `example-admin/app/globals.css` — adopt shared tokens + base element styles

**Files:**
- Modify: `example-admin/app/globals.css`

- [ ] **Step 1: Append shared tokens to `:root` and add base element styles**

Add these new custom properties to the existing `:root` block (keep `--spacing-base`, `--spacing-small`, `--border-width`, `--border-style` exactly as they are — `Header.module.css` depends on them):

```css
:root {
    --spacing-base: 1rem;
    --spacing-small: 0.35rem;
    --border-width: 1px;
    --border-style: solid;
    --foreground: #111827;
    --muted: #6b7280;
    --border: #e5e7eb;
    --surface-muted: #f9fafb;
    --brand-primary: #111827;
}
```

Add this after the existing `body { margin: var(--spacing-base); }` rule:

```css
* {
    box-sizing: border-box;
}

body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--foreground);
    background: #fff;
}

a {
    color: var(--brand-primary);
}

label {
    display: block;
    margin-block-end: var(--spacing-small);
    font-weight: 600;
}

input:not([type='checkbox']):not([type='file']),
select,
textarea {
    font: inherit;
    padding: var(--spacing-small) 0.5rem;
    border: var(--border-width) var(--border-style) var(--border);
    border-radius: 0.25rem;
    max-width: 32rem;
    width: 100%;
}

button {
    font: inherit;
    padding: var(--spacing-small) var(--spacing-base);
    border: var(--border-width) var(--border-style) var(--brand-primary);
    border-radius: 0.25rem;
    background: var(--brand-primary);
    color: #fff;
    cursor: pointer;
}

button[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
}

button[type='button'] {
    background: #fff;
    color: var(--brand-primary);
}

[role='alert'] {
    color: #b91c1c;
}

@media (max-width: 40rem) {
    body {
        margin: var(--spacing-small);
    }

    table {
        overflow-x: auto;
        display: block;
    }
}
```

Leave the existing `dt`, `table`/`th`/`td` (they already use `var(--spacing-small)`/`var(--border-width)`/`var(--border-style)`, so they automatically pick up the new `--border` color once you change their hardcoded `#888` to `var(--border)`:

```css
th,
td {
    border: var(--border-width) var(--border-style) var(--border);
    padding: var(--spacing-small) 0.5rem;
    text-align: left;
    vertical-align: top;
}

th {
    font-weight: 600;
    background: var(--surface-muted);
}
```

and `.media-asset-row`) unchanged otherwise.

- [ ] **Step 2: Manually verify in the browser**

Run: `pnpm --dir example-admin dev` and visually check the tenant list, tenant detail, admins, and jobs pages — forms, buttons, and tables should look consistent and the layout should not break at a narrow (mobile) viewport width. This is a visual/manual check; there is no automated test for pure CSS in this codebase.

- [ ] **Step 3: Run the example-admin test suite to confirm no component test broke on DOM structure/class assumptions**

Run: `pnpm --dir example-admin test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add example-admin/app/globals.css
git commit -m "style(example-admin): adopt shared design tokens and base element styles"
```

---

### Task 27: `directwerk-studio/app/globals.css` — matching base element styles

**Files:**
- Modify: `directwerk-studio/app/globals.css`

**Interfaces:**
- Consumes: existing `--foreground`, `--muted`, `--border`, `--surface-muted`, `--brand-primary` tokens (unchanged values — Task 26 copied these exact names/values into `example-admin`).

- [ ] **Step 1: Add base element styles**

Add after the existing `a { color: inherit; }` rule (keep every existing rule in the file exactly as-is — this only adds new rules):

```css
label {
    display: block;
    margin-block-end: 0.35rem;
    font-weight: 600;
}

input,
select,
textarea {
    font: inherit;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 0.25rem;
    max-width: 32rem;
    width: 100%;
}

button {
    font: inherit;
    padding: 0.35rem 1rem;
    border: 1px solid var(--brand-primary);
    border-radius: 0.25rem;
    background: var(--brand-primary);
    color: #fff;
    cursor: pointer;
}

button[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
}

button[type='button'] {
    background: #fff;
    color: var(--brand-primary);
}

table {
    border-collapse: collapse;
    width: 100%;
}

th,
td {
    border: 1px solid var(--border);
    padding: 0.35rem 0.5rem;
    text-align: left;
    vertical-align: top;
}

th {
    font-weight: 600;
    background: var(--surface-muted);
}

[role='alert'] {
    color: #b91c1c;
}

@media (max-width: 40rem) {
    body {
        font-size: 0.9375rem;
    }

    table {
        overflow-x: auto;
        display: block;
    }
}
```

(No changes to any existing rule or to any component-level `.module.css` file — this only adds bare-element defaults that apply wherever a component doesn't already override them via its own CSS Module, which is exactly how CSS specificity already works here: a `.module.css` class always wins over a bare `button`/`input`/`table` selector in `globals.css`.)

- [ ] **Step 2: Manually verify in the browser**

Run: `pnpm --dir directwerk-studio dev` and visually check the write/podcast/manage sections (including the new Format/Category pages from Phase 5) — forms, buttons, and tables should look consistent with `example-admin` and the layout should not break at a narrow viewport width.

- [ ] **Step 3: Run the full directwerk-studio test suite**

Run: `pnpm --dir directwerk-studio test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add directwerk-studio/app/globals.css
git commit -m "style(directwerk-studio): add base element styles matching example-admin"
```

---

## Plan Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-07-23-studio-admin-content-tenant-management-design.md`):
- Phase 1 (studio taxonomy): Format/Category management → Tasks 12-15. Episode/Article tagging → Tasks 17-18. Series cover/access-level gaps → Task 19. ✓
- RSS URL fix (backend) → Tasks 1-5. RSS visibility (studio) → Tasks 6, 19, 20. ✓
- Phase 2 (tenant management): PATCH tenant → Task 7. PATCH user role → Task 8. DELETE admin → Task 9. Frontend wiring → Tasks 21-25. ✓
- Phase 3 (UI consistency) → Tasks 26-27. ✓
- Standing Bruno rule → satisfied in every backend task (7, 8, 9) plus the response-shape note in Task 6. ✓
- Out-of-scope items (DigitalPublication, CustomFeed, directwerk-web, Tailwind/component library) — none of the 27 tasks touch any of these. ✓

**Placeholder scan:** no `TBD`/`TODO`/"implement later" strings; every step has literal code. The few spots that say "match this file's existing X" (Tasks 2-9's test additions, where the exact fixture/mock shape of a pre-existing test file can't be known without reading it at execution time) are deliberate — they point at a concrete file to read, not an unresolved question, consistent with how a real engineer would extend an existing test suite.

**Type consistency:** `FormatTag`/`CategoryTag` (Task 10) are used identically in Tasks 17-18's tagging UI. `EpisodeDetail.formats`/`.categories` (Task 10) match what `EpisodeController.EpisodeView` (Task 6's sibling, already-shipped code) actually returns. `SeriesDetail.rssUrl` (Task 10) matches `SeriesController.SeriesView.rssUrl` (Task 6). `patchPlatformData` (Task 21) is used with the same call signature in Tasks 22/23. No renamed function reappears under a different name in a later task.

**Scope:** 27 tasks across 3 backend modules and 2 frontends is large for one plan, but every task is independently testable and the phases have a strict dependency order (Phase 1 must land before Phase 4-6 consume its endpoints; Phase 3 must land before Phase 7 consumes it) — splitting further would mostly just relocate the same dependency chain into cross-plan references. Execute in task order.

---

Plan complete and saved to `docs/superpowers/plans/2026-07-23-studio-admin-content-tenant-management.md`. Given the explicit instruction to just implement and open a PR, I'll proceed with **subagent-driven execution** (fresh subagent per task, matching the plan's task boundaries) rather than pausing for a choice — flag immediately if you'd rather I execute inline instead.
