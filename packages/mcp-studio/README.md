# `@directwerk/mcp-studio`

MCP server that manages Directwerk Studio content (articles, episodes, series, categories, formats, media) via the public REST API and a tenant API key.

**Preferred install:** use the **API-hosted** Streamable HTTP endpoint (`{API}/mcp`) — URL + API key, no local package path. This package remains the **stdio** (and optional local HTTP) implementation for monorepo developers; tool handlers are shared between `index.ts` (stdio) and `http.ts` (local Streamable HTTP).

## Hosted remote MCP (recommended)

Endpoint: `POST/GET https://api.example.com/mcp`  
Auth: `Authorization: Bearer dwk_…` plus tenant `Host` or `X-Tenant-Host`.

Cursor:

```json
{
  "mcpServers": {
    "directwerk-studio": {
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer dwk_…",
        "X-Tenant-Host": "your-tenant.example.com"
      }
    }
  }
}
```

OpenCode (set `oauth: false` so the API key is used instead of OAuth discovery on the API host):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "directwerk-studio": {
        "type": "remote",
        "url": "https://api.example.com/mcp",
        "oauth": false,
        "headers": {
          "Authorization": "Bearer {env:DIRECTWERK_API_KEY}",
          "X-Tenant-Host": "your-tenant.example.com"
        }
      }
    }
  }
}
```

Studio → **Settings → API keys** shows a copy-paste remote snippet for the current platform API URL.

`import_podcast_manifest` (local filesystem bulk import) stays **stdio-only**.

## Environment (stdio / local HTTP)

| Variable | Purpose |
|----------|---------|
| `DIRECTWERK_API_BASE_URL` | API origin, e.g. `https://api.example.com` or `http://localhost:8080` |
| `DIRECTWERK_API_KEY` | Tenant API key (`dwk_…`) from Studio → Settings → API keys |
| `DIRECTWERK_TENANT_HOST` | Verified tenant hostname (sent as `X-Tenant-Host` for multi-tenancy) |
| `PORT` / `DIRECTWERK_MCP_PORT` | Local HTTP listen port (default `3100`, `start:http` only) |
| `DIRECTWERK_MCP_HOST` | Local HTTP bind host (default `127.0.0.1`; loopback only) |

## Cursor install (stdio)

1. In Studio (tenant admin): **Settings → API keys** → create a key with `content:write` (includes read).
2. Copy the secret once.
3. Add to Cursor MCP settings (stdio):

```json
{
  "mcpServers": {
    "directwerk-studio": {
      "command": "pnpm",
      "args": ["--filter", "@directwerk/mcp-studio", "exec", "node", "dist/index.js"],
      "env": {
        "DIRECTWERK_API_BASE_URL": "https://api.example.com",
        "DIRECTWERK_API_KEY": "dwk_…",
        "DIRECTWERK_TENANT_HOST": "your-tenant.example.com"
      }
    }
  }
}
```

Or after `pnpm --filter @directwerk/mcp-studio build`, point `command` at `node` and `args` at the absolute `dist/index.js` path.

Local Streamable HTTP (REST tools only — no `import_podcast_manifest`): `pnpm --filter @directwerk/mcp-studio start:http` → `http://127.0.0.1:3100/mcp`. Bind is loopback-only.

## OpenCode install (stdio)

OpenCode (V2) reads MCP servers from `opencode.json` (or `.opencode/opencode.json`) under `mcp.servers`. Add this once to the **repository root** so every session in the monorepo picks it up:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "directwerk-studio": {
        "type": "local",
        "command": ["bash", "-ic", "exec node /absolute/path/to/packages/mcp-studio/dist/index.js"],
        "environment": {
          "DIRECTWERK_API_BASE_URL": "https://api.directwerk.org",
          "DIRECTWERK_API_KEY": "{env:DIRECTWERK_API_KEY}",
          "DIRECTWERK_TENANT_HOST": "your-tenant.example.com"
        }
      }
    }
  }
}
```

Notes:

- Build first: `pnpm --filter @directwerk/mcp-studio build` (creates `dist/index.js`).
- The key stays out of the repo: `{env:DIRECTWERK_API_KEY}` is substituted from the environment. Export it in `~/.bashrc` (or your shell profile).
- The `bash -ic` wrapper exists because OpenCode's background service keeps the environment it was started with. Interactive bash sources `~/.bashrc` on every (re)connect, so the MCP process always sees the key even after a service restart.
- Config changes apply without restarting OpenCode: the config watcher reconnects MCP servers on save. Editing `dist/` alone does **not** reload the running server - save/touch the config (or reconnect from `/mcps`) to pick up new code.
- Verify with `opencode mcp list`; the server must report `connected`.

## Article `body` / episode `description` format

Both fields accept **HTML or CommonMark**. Prefer TipTap-shaped HTML (`<p>`, `<h2>`, `<h3>`, lists, links, …) when mirroring Studio. Markdown is fine for bulk/MCP authors — the API converts it with Flexmark and sanitizes before storage, so RSS, email, and the public site all see HTML.

Do not send MDX or raw `<script>`: disallowed tags are stripped on write.

## Bulk podcast import

`import_podcast_manifest` imports a whole show from local files through the same REST endpoints Studio uses (upload-url → S3 PUT → confirm → create episode → attach audio/cover → formats → publish). It is idempotent: READY assets are reused by `originalFilename`, and episodes are matched by slug, so a failed run can simply be repeated.

Manifest schema (JSON on disk, paths absolute):

```json
{
  "series": { "slug": "my-show" },
  "items": [
    {
      "n": 1,
      "slug": "episode-slug",
      "title": "Episode title",
      "description": "Full show notes (HTML preferred, CommonMark OK)",
      "publishedAt": "2024-01-15T12:00:00Z",
      "mp3":   { "path": "/abs/file.mp3", "filename": "file.mp3", "mimeType": "audio/mpeg", "sizeBytes": 12345678 },
      "cover": { "path": "/abs/cover.jpg", "filename": "cover.jpg", "mimeType": "image/jpeg", "sizeBytes": 81578 }
    }
  ]
}
```

Tool arguments: `manifestPath` (required), `formatIds` (format to attach when an episode has none - publishing fails with `EPISODE_VALIDATION_FAILED: At least one format is required` otherwise), `limit`/`offset`/`onlyNumbers` for chunked, resumable runs.

Backend constraints that shape the flow:

- Episode slugs: max 64 chars, `^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$`. Truncate at a word boundary when converting filenames.
- Publish before any format is attached returns 400 (`EPISODE_VALIDATION_FAILED`).
- Back-dating: `POST /api/v1/episodes/{id}/publish` accepts `{ "publishedAt": "..." }` (past dates). Future dates go through `POST /schedule` with `scheduledAt`.
- Episode `description` is limited by the backend's content text limit (HTML or Markdown; converted to sanitized HTML on write). The mp3 duration is not set by the import (asset processing can fill it later).

A reference implementation of a downloader-to-manifest converter (channel2mp3 output: `LOG.md` + `meta/*.info.json` + `mp3/` + `thumbs/`) lives in [`scripts/build-manifest.py`](scripts/build-manifest.py).

## Develop

```sh
pnpm --filter @directwerk/mcp-studio build
pnpm --filter @directwerk/mcp-studio start
```

Keys never grant `/api/v1/tenant/**` (billing, domains, users). Content scopes map to editor-equivalent access on content routes (plus categories/formats for taxonomy tools).

## Tool surface (hosted ↔ stdio)

Same names on API `/mcp` and this package (except stdio-only `import_podcast_manifest`):

- **Articles** — CRUD, categories, publish/unpublish/schedule/`cancel_schedule_article`, archive/unarchive, notify + notify-preview, `set_article_newsletter_lists`, bulk publish/unpublish/delete
- **Episodes** — CRUD, formats/categories, audio attach, `set_episode_enclosure_enabled`, publish/unpublish/schedule/`cancel_schedule_episode`, archive/unarchive, notify + notify-preview, bulk publish/unpublish/delete
- **Series / categories / formats** — list + CRUD (series update includes status)
- **Media** — list/get, upload-url + confirm, `rename_media`, `get_media_preview_url`, `list_media_references`, `get_media_limits`, `get_media_storage_summary`, delete/move, folders CRUD

Publish/schedule args match REST (`notifySubscribers`, `scheduledAt`, `publishedAt`). Newsletter **list** CRUD remains outside the API-key allowlist; attach uses article path only.

### Draft-over-publish

`update_*` / `set_*_categories` (and article newsletter lists / episode formats+audio) on a **PUBLISHED** item stage a `working_draft` overlay — status stays `PUBLISHED` and the public page stays up. Studio/MCP GET responses overlay draft fields and set `hasWorkingDraft: true`. Call `publish_*` again to apply the draft to live columns (over-publish). REST also exposes `POST …/discard-draft` to drop the overlay without changing live content.
