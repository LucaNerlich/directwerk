#!/usr/bin/env node
/**
 * Optional local Streamable HTTP entry (stateless) for the same tools as stdio.
 * Production clients should use the API-hosted endpoint at `{API}/mcp` instead.
 */
import {createServer} from 'node:http'
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {DirectwerkClient, loadConfigFromEnv} from './client.js'
import {createMcpServer} from './server.js'

async function main(): Promise<void> {
    const config = loadConfigFromEnv()
    const client = new DirectwerkClient(config)
    const port = Number(process.env.PORT ?? process.env.DIRECTWERK_MCP_PORT ?? '3100')
    const host = process.env.DIRECTWERK_MCP_HOST ?? '127.0.0.1'

    const httpServer = createServer(async (req, res) => {
        const url = new URL(req.url ?? '/', `http://${host}`)
        if (url.pathname !== '/mcp') {
            res.writeHead(404, {'Content-Type': 'text/plain'}).end('Not Found')
            return
        }
        // Stateless: one transport + server per request (mirrors API-hosted mode).
        const transport = new StreamableHTTPServerTransport({sessionIdGenerator: undefined})
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

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exit(1)
})
