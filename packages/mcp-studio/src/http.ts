#!/usr/bin/env node
/**
 * Optional local Streamable HTTP entry (stateless) for REST-backed MCP tools.
 * Production clients should use the API-hosted endpoint at `{API}/mcp` instead.
 * Filesystem tools (import_podcast_manifest) stay stdio-only.
 */
import {createServer} from 'node:http'
import {pathToFileURL} from 'node:url'
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {DirectwerkClient, loadConfigFromEnv} from './client.js'
import {createMcpServer} from './server.js'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

/**
 * Transport options for the loopback HTTP entry. A malicious page can DNS-rebind to loopback
 * and become same-origin; this entry has no request auth and holds the tenant API key, so the
 * SDK must reject any other Host/Origin (#1047).
 */
export function loopbackTransportOptions(port: number) {
    return {
        sessionIdGenerator: undefined,
        enableDnsRebindingProtection: true,
        allowedHosts: [
            `127.0.0.1:${port}`,
            `localhost:${port}`,
            `[::1]:${port}`,
        ],
        allowedOrigins: [
            `http://127.0.0.1:${port}`,
            `http://localhost:${port}`,
            `http://[::1]:${port}`,
        ],
    } satisfies ConstructorParameters<typeof StreamableHTTPServerTransport>[0]
}

async function main(): Promise<void> {
    const config = loadConfigFromEnv()
    const client = new DirectwerkClient(config)
    const port = Number(process.env.PORT ?? process.env.DIRECTWERK_MCP_PORT ?? '3100')
    const host = process.env.DIRECTWERK_MCP_HOST ?? '127.0.0.1'
    if (!LOOPBACK_HOSTS.has(host)) {
        throw new Error(
            `DIRECTWERK_MCP_HOST must be loopback (127.0.0.1, ::1, or localhost); got "${host}"`,
        )
    }

    const httpServer = createServer(async (req, res) => {
        const url = new URL(req.url ?? '/', `http://${host}`)
        if (url.pathname !== '/mcp') {
            res.writeHead(404, {'Content-Type': 'text/plain'}).end('Not Found')
            return
        }
        // Stateless: one transport + server per request (mirrors API-hosted mode).
        // No filesystemTools — HTTP must not expose import_podcast_manifest.
        const transport = new StreamableHTTPServerTransport(loopbackTransportOptions(port))
        const server = createMcpServer(client)
        await server.connect(transport)
        try {
            await transport.handleRequest(req, res)
        } finally {
            await transport.close().catch(() => undefined)
            await server.close().catch(() => undefined)
        }
    })

    httpServer.listen(port, host, () => {
        console.error(`directwerk-studio MCP (Streamable HTTP) on http://${host}:${port}/mcp`)
    })
}

const entryUrl = process.argv[1] === undefined ? null : pathToFileURL(process.argv[1]).href
if (entryUrl === import.meta.url) {
    main().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        console.error(message)
        process.exit(1)
    })
}
