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

## Develop

```sh
pnpm --filter @directwerk/mcp-studio build
pnpm --filter @directwerk/mcp-studio start
```

Keys never grant `/api/v1/tenant/**` (billing, domains, users). Content scopes map to editor-equivalent access on content routes (plus categories/formats for taxonomy tools).
