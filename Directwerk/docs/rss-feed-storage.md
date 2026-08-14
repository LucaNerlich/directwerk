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
```

Private feed tokens are intentionally absent from keys and local filenames. The public pull zone
must serve only the `{tenantSlug}/public/` prefix and must deny `{tenantSlug}/private/`. Configure a
separate private pull zone with Advanced Token Authentication for the private prefix. When private
pull-zone settings are incomplete, delivery fails closed; when they are absent, Directwerk falls
back to an S3 presigned GET.

## Refresh and failure behavior

Content, feed, and entitlement mutations request the `rss-feed-refresh` queue after their database
transaction commits. At most one `QUEUED` job per tenant correlation id is stored; a mutation
while a rebuild is already `PROCESSING` still enqueues a follow-up so the next run sees the latest
database state. The job regenerates the tenant feed, every series snapshot (so an unpublished
series is replaced by an empty feed rather than stale XML), and enabled subscriber feeds using the
primary verified tenant domain. Queue retries handle transient failures. Feed HTTP requests never
generate XML or inspect the database for episode eligibility.

Refresh is also requested when the XML *payload* would change without a content edit: tenant name
or slug, a newly verified or newly primary domain, a format `requiredLevelSortOrder` change, and
first-time `PODCAST_RSS` activation (so the initial objects exist). Draft-only episode edits do
not enqueue; enclosure toggles enqueue only for published episodes. A tenant slug change records
the previous prefix, 404s until the new objects exist, then deletes and purges the old prefix.

Generation or upload failure never deletes or truncates an existing object. The previous S3 XML
stays live. Turning `PODCAST_RSS` off, or disabling a subscriber feed, deletes the corresponding
S3 objects, clears presence rows, and purges their unsigned pull-zone URLs so a previously
redirected CDN location cannot keep serving the feed. When the queue is disabled (normally local
development), refresh requests are skipped; RSS delivery requires configured object storage and an
active queue worker. Production refuses to start without storage enabled, a bucket, and an HTTPS
public CDN base URL.

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
