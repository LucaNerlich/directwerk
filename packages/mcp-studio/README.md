# `@directwerk/mcp-studio`

stdio MCP server that manages Directwerk Studio content (articles, episodes, series, categories, formats, media) via the public REST API and a tenant API key.

## Environment

| Variable | Purpose |
|----------|---------|
| `DIRECTWERK_API_BASE_URL` | API origin, e.g. `https://api.example.com` or `http://localhost:8080` |
| `DIRECTWERK_API_KEY` | Tenant API key (`dwk_…`) from Studio → Settings → API keys |
| `DIRECTWERK_TENANT_HOST` | Verified tenant hostname (sent as `X-Tenant-Host` for multi-tenancy) |

## Cursor install

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

## OpenCode install

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
      "description": "Full show notes",
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
- Episode `description` is limited by the backend's content text limit; the mp3 duration is not set by the import (asset processing can fill it later).

A reference implementation of a downloader-to-manifest converter (channel2mp3 output: `LOG.md` + `meta/*.info.json` + `mp3/` + `thumbs/`) lives in [`scripts/build-manifest.py`](scripts/build-manifest.py).

## Develop

```sh
pnpm --filter @directwerk/mcp-studio build
pnpm --filter @directwerk/mcp-studio start
```

Keys never grant `/api/v1/tenant/**` (billing, domains, users). Content scopes map to editor-equivalent access on content routes (plus categories/formats for taxonomy tools).
