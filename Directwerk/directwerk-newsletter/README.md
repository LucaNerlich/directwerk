# directwerk-newsletter

Write desk vertical slice for Directwerk: **newsletter / article publications** — blog posts,
paid essays, and classic email newsletters.

A post published on the tenant site and a newsletter issue sent to inboxes are the **same
publication** (`Article`), with different **delivery channels**:

| Channel | Module / mechanism | Notes |
|---------|-------------------|-------|
| **Web** | This module + public API | Substack-style archive, SEO, paid body gating |
| **Email** | `EMAIL_NOTIFY` + `directwerk-email` | Optional on publish; excerpt or full body |

| Concern | Module / gate |
|---------|----------------|
| Article CRUD + publish workflow | This module |
| Feature flag for write ops | `DIGITAL_CONTENT` (`DigitalContentModule.KEY`) |
| Shared taxonomy | `Category` in `directwerk-digital` |
| Send to subscribers on publish | `EMAIL_NOTIFY` (transport in `directwerk-email`) |
| RSS distribution | `ARTICLE_RSS` (`ArticleRssModule.KEY`) |
| Subscriber-built private feeds filtered by Category | `ARTICLE_FEED_BUILDER` (`ArticleFeedBuilderModule.KEY`, needs `ARTICLE_RSS` + `SUBSCRIPTION`) |

## Article feeds

Mirrors the podcast RSS/feed stack (`directwerk-podcast`'s `feed`/`service`/`job` packages),
adapted for articles: one default public feed (`/feeds/{tenantSlug}/articles.xml`, all free
published articles), one default private per-user feed, and up to
`ArticleFeedService.MAX_CUSTOM_FEEDS_PER_USER` feed-builder custom feeds filtered by `Category`
(articles have no per-series grouping, so there is no series-feed equivalent). Object storage
mechanics (S3 upload/withdraw/deliver, presence tracking) are shared with the podcast RSS stack
via `directwerk-digital`'s `GeneratedFeedSnapshotStore`/`FeedSnapshotStateStore` — see
[`../docs/rss-feed-storage.md`](../docs/rss-feed-storage.md). Durable regeneration goes through
the `article-rss-feed-refresh` queue (`ArticleRssFeedRefreshJobHandler`/`JobProducer`), reacting
to the same tenant-level content events the podcast producer reacts to
(`TenantEntitlementsChangedEvent`/`TenantRssSnapshotStaleEvent` in `directwerk-common`) since
`directwerk-newsletter` and `directwerk-podcast` are Gradle siblings.

## Article view analytics

Mirrors [`directwerk-podcast`'s episode download analytics](../directwerk-podcast/README.md#episode-download-analytics):
Umami tracking defaults to the platform host configured with `DIRECTWERK_ANALYTICS_*`. A tenant can
replace that host with `TenantBranding.umamiHostUrl` (`tenant_branding.umami_host_url`). The override
must be an absolute HTTPS origin with no credentials, query, fragment, or non-root path, and its
hostname must resolve exclusively to public addresses. Unresolvable hosts and loopback, private,
link-local, multicast, local/internal, or reserved destinations are rejected; tracking falls back to
the platform host when available. When an analytics host, the tenant `ANALYTICS` module, and a
website ID are all present, `GET /api/v1/public/articles/{slug}` emits `article-view`. Articles
have no separate enclosure/download step — full free-article bodies are embedded directly in the
RSS `description`, so the public single-article read is the only per-article consumption event
and stands in for the podcast side's download/stream tracking. Analytics is fail-open and never
gates the read.

Companion: [`../directwerk-podcast/README.md`](../directwerk-podcast/README.md) (Podcast desk).
