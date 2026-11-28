# Feed sync (new upstream episodes)

`scripts/sync-feeds.mjs` keeps hosted podcast archives up to date. It reads the
show config, fetches each upstream RSS feed and imports only episodes that are
not in the tenant yet.

Idempotent by design: an episode counts as present when **title + publish date**
match, so re-runs and partial failures are safe. Slugs are derived from the
title and de-duplicated inside the series. Audio assets are reused by
`originalFilename` when a previous run uploaded before failing.

## Environment

```sh
export DIRECTWERK_API_BASE_URL=https://api.directwerk.org
export DIRECTWERK_API_KEY=dwk_...          # content:write
export DIRECTWERK_TENANT_HOST=lucanerlich.directwerk.org
```

The API key stays in the environment, never in `feeds.json`. The config holds
tenant content ids only.

## Run

```sh
cd packages/mcp-studio

# What would change?
node scripts/sync-feeds.mjs --config scripts/feeds.json --dry-run

# One show
node scripts/sync-feeds.mjs --config scripts/feeds.json --show "Hyrule Podcasters"

# Everything
node scripts/sync-feeds.mjs --config scripts/feeds.json
```

Options: `--show NAME` (exact name from the config), `--limit N` (newest N),
`--dry-run`. Exit code 1 when any show or episode failed.

## What it writes

For each new episode: upload-url → S3 PUT → confirm → create episode (audio,
cover, duration, format, categories, next sequence number) → publish with the
feed's `pubDate` (future dates are scheduled instead). No subscriber
notifications are sent.

Defaults per show: `accessPolicy: PAID`, level 1, `numbering: "sequence"`
(continues `max(episodeNumber) + 1`), series cover unless the item has its own
artwork.

## Add a new show

1. Create the series and a format in Studio (or with the MCP
   `create_series` / `create_format`), e.g. `slug`, title, language, cover.
2. Create the media folders `Audio` and `Cover` and upload the series cover;
   note the folder ids and the cover asset id.
3. Add an entry to `scripts/feeds.json` with `feedUrl`, `seriesId`, `formatId`,
   `audioFolderId`, `coverFolderId`, `seriesCoverAssetId`, optional
   `categoryIds`.
4. `--dry-run` for that show. It should list only missing episodes.
5. Run it, then verify:

```sh
curl -s -H "Authorization: Bearer $DIRECTWERK_API_KEY" \
  -H "X-Tenant-Host: $DIRECTWERK_TENANT_HOST" \
  "$DIRECTWERK_API_BASE_URL/api/v1/episodes?seriesId=<id>&limit=500" \
  | jq '.data | length'
```

## Schedule it

Cron example (daily at 04:15, env from a root-only file):

```cron
15 4 * * * set -a; . /etc/directwerk/feed-sync.env; set +a; cd /srv/directwerk/packages/mcp-studio && node scripts/sync-feeds.mjs --config scripts/feeds.json >> /var/log/directwerk-feed-sync.log 2>&1
```

Do not run two syncs for the same show concurrently; the title+date match makes
it mostly harmless, but duplicate uploads are still possible.

## Notes for agents (LLM runbook)

- Always start with `--dry-run` and report the expected new episodes before
  writing anything.
- Never invent episode numbers: `sequence` continues from the series maximum.
- Never change `accessPolicy` or folders as part of a sync.
- If `confirm` fails with 500, the script retries with a fresh upload URL. Two
  exhausted retries usually mean the upstream file is larger than the proxy
  timeout; report instead of retrying forever.
- After a real run, verify counts per series and spot-check one new episode
  (status, date, duration, audio). Report the summary, not raw JSON.
- The German supercut shows (SFS, DTTD, The Pod) are folder-based. They are not
  in `feeds.json`; import them with `import_podcast_manifest`.
- Rebuild `dist` after changing the MCP server itself; this script runs from
  source and needs no build.
