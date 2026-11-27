/**
 * Public API origin used in the hosted MCP config (Settings → API keys). Read in a Server
 * Component, so the value is inlined at build time — the studio Dockerfile declares the matching
 * build ARG. Never the server-side upstream base: that is an internal hostname external MCP
 * clients cannot reach (#1049).
 */
export function resolveMcpUrl(): string {
    const raw = process.env.NEXT_PUBLIC_API_URL?.trim()
    if (!raw) {
        return ''
    }
    return `${raw.replace(/\/$/, '')}/mcp`
}
