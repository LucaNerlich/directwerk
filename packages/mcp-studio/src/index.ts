#!/usr/bin/env node
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'
import {DirectwerkClient, loadConfigFromEnv} from './client.js'
import {createMcpServer} from './server.js'

async function main(): Promise<void> {
    const config = loadConfigFromEnv()
    const client = new DirectwerkClient(config)
    const server = createMcpServer(client)
    const transport = new StdioServerTransport()
    await server.connect(transport)
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exit(1)
})
