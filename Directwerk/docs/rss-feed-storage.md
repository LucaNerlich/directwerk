# RSS feed snapshots and delivery

Directwerk serves stable feed URLs while treating generated XML in S3 as the durable source of
truth. This prevents podcatcher polling from repeating database, entitlement, and XML generation
work.

## Request flow

1. Resolve the tenant from the request host and validate the requested feed.
2. For private feeds, validate the current feed token and enabled state on every request.
3. Return `302` to the deterministic object in the corresponding pull zone, or `404` with
   `Cache-Control: no-store` when that object has never been written.

The consumer URL never changes. Feed responses are `302` with `Cache-Control: no-store` so
podcatchers cannot pin the pull-zone URL and skip Directwerk after a module or feed is turned
off. Directwerk does not `HEAD` S3 on the request path: a presence row written after a successful
`PUT` is what distinguishes a ready snapshot from the cold-start window. Signed private
pull-zone or S3 URLs are only short-lived redirect targets and must never be logged. XML objects
themselves stay cacheable on the pull zone (`max-age=300`).

## Object layout

```text
{tenantSlug}/public/rss/podcast.xml
{tenantSlug}/public/rss/series-{seriesId}.xml
{tenantSlug}/private/rss/feed-{subscriberFeedId}.xml
{tenantSlug}/public/rss/articles.xml
{tenantSlug}/private/rss/article-feed-{articleFeedId}.xml
```

Private feed tokens are intentionally absent from keys and local filenames. The public pull zone
must serve only the `{tenantSlug}/public/` prefix and must deny `{tenantSlug}/private/`. Configure a
separate private pull zone with Advanced Token Authentication for the private prefix. When private
pull-zone settings are incomplete, delivery fails closed; when they are absent, Directwerk falls
back to an S3 presigned GET.

Custom (feed-builder) feeds reuse the same `feed-{subscriberFeedId}.xml` object as the default
private feed. Turning `FEED_BUILDER` off withdraws snapshots for non-default feeds only; the
default private feed stays available while `PODCAST_RSS` and `SUBSCRIPTION` remain on. Article
feeds follow the identical pattern one level down: `ARTICLE_FEED_BUILDER` off withdraws non-default
`article-feed-{id}.xml` snapshots only; the default private article feed stays available while
`ARTICLE_RSS` and `SUBSCRIPTION` remain on. Articles have no per-series grouping, so there is no
`series-{id}`-equivalent object for articles.

The low-level snapshot mechanics (upload/withdraw/deliver, presence tracking in
`rss_snapshot_presence`/`rss_stale_prefixes`) are shared code — `directwerk-digital`'s
`GeneratedFeedSnapshotStore`/`FeedSnapshotStateStore` — used by both the podcast RSS stack
(`directwerk-podcast`) and the article RSS stack (`directwerk-newsletter`), which are otherwise
independent Gradle sibling modules. Podcast and article snapshot rows share the same
`rss_snapshot_presence` table but never collide: podcast uses kind literals `TENANT`/`SERIES`/
`PRIVATE_FEED`, articles use the distinct `ARTICLE_TENANT`/`ARTICLE_PRIVATE_FEED`.

## Refresh and failure behavior

Podcast content, feed, and entitlement mutations request the `podcast-rss-feed-refresh` queue
after their database transaction commits. At most one `QUEUED` job per tenant correlation id is
stored; a mutation
while a rebuild is already `PROCESSING` still enqueues a follow-up so the next run sees the latest
database state. The job regenerates the tenant feed, every series snapshot (so an unpublished
series is replaced by an empty feed rather than stale XML), and enabled subscriber feeds using the
primary verified tenant domain. Queue retries handle transient failures. Feed HTTP requests never
generate XML or inspect the database for episode eligibility.

Refresh is also requested when the XML *payload* would change without a content edit: tenant name
or slug, a newly verified or newly primary domain, a format `requiredLevelSortOrder` or `active`
change, custom-feed create/update/delete, and first-time `PODCAST_RSS` activation (so the initial
objects exist). Draft-only episode edits do not enqueue; enclosure toggles enqueue only for
published episodes. A tenant slug change records the previous prefix, 404s until the new objects
exist, then deletes and purges the old prefix.

Generation or upload failure never deletes or truncates an existing object. The previous S3 XML
stays live. Individual snapshot failures are isolated: one broken feed no longer aborts the
remaining feeds of the tenant; the job still fails afterwards so the queue retries the whole
tenant (uploads are idempotent). Tenants without a verified primary domain fall back to the
studio base URL host for absolute feed/enclosure URLs (same policy as
`PublicContentUrlResolver`) instead of failing every refresh. Turning `PODCAST_RSS` off, or
disabling a subscriber feed, deletes the corresponding S3 objects, clears presence rows, and
purges their unsigned pull-zone URLs so a previously redirected CDN location cannot keep
serving the feed. Deleting a custom feed withdraws its object
before the row is dropped. When the queue is disabled (normally local development), refresh
requests are skipped; RSS delivery requires configured object storage and an active queue worker.
Production refuses to start without storage enabled, a bucket, and an HTTPS public CDN base URL.

## Required configuration

```properties
DIRECTWERK_STORAGE_ENABLED=true
DIRECTWERK_STORAGE_BUCKET=directwerk
DIRECTWERK_STORAGE_PUBLIC_CDN_BASE_URL=https://public.example.com
DIRECTWERK_STORAGE_PRIVATE_CDN_BASE_URL=https://private.example.com
DIRECTWERK_STORAGE_CDN_TOKEN_AUTH_KEY=...
```

The S3 bucket and credentials use the existing `directwerk.storage.*` settings. XML snapshots use
the same public/private prefix and pull-zone trust boundary as media assets.

## Feed content and Apple metadata

Public feeds (`podcast.xml`, `series-{id}.xml`) contain **free episodes only**; paid episodes are
delivered exclusively through the private per-user subscriber feeds. A series whose episodes are
all paid therefore has an (intentionally) empty public series feed. Podcast feeds carry the Apple
Podcasts channel tags `itunes:category` (from the series setting), `itunes:explicit`
(`true`/`false`, series setting, default `false`), and `itunes:image` (series cover; feeds not
scoped to one series fall back to the first included episode's series cover). Every episode item
includes a `<link>` to its public episode page.
