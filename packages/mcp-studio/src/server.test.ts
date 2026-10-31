import assert from 'node:assert/strict'
import {test} from 'node:test'
import {DirectwerkClient} from './client.js'
import {createMcpServer} from './server.js'

type ToolRegistry = Record<string, unknown>

function registeredToolNames(server: ReturnType<typeof createMcpServer>): string[] {
    const tools = (server as unknown as {_registeredTools: ToolRegistry})._registeredTools
    return Object.keys(tools).sort()
}

function stubClient(): DirectwerkClient {
    return new DirectwerkClient({
        baseUrl: 'http://127.0.0.1:9',
        apiKey: 'dwk_test',
        tenantHost: 'example.test',
    })
}

test('HTTP-style createMcpServer omits import_podcast_manifest', () => {
    const names = registeredToolNames(createMcpServer(stubClient()))
    assert.equal(names.includes('import_podcast_manifest'), false)
    assert.equal(names.includes('list_articles'), true)
})

test('stdio-style createMcpServer registers import_podcast_manifest', () => {
    const names = registeredToolNames(createMcpServer(stubClient(), {filesystemTools: true}))
    assert.equal(names.includes('import_podcast_manifest'), true)
})

test('list tools omit unbound q/seriesId filters', () => {
    const server = createMcpServer(stubClient())
    const tools = (server as unknown as {
        _registeredTools: Record<string, {inputSchema?: {shape?: Record<string, unknown>}}>
    })._registeredTools
    const articleKeys = Object.keys(tools.list_articles?.inputSchema?.shape ?? {})
    const episodeKeys = Object.keys(tools.list_episodes?.inputSchema?.shape ?? {})
    const mediaKeys = Object.keys(tools.list_media?.inputSchema?.shape ?? {})
    assert.deepEqual(articleKeys.sort(), ['limit', 'offset'])
    assert.deepEqual(episodeKeys.sort(), ['limit', 'offset'])
    assert.deepEqual(mediaKeys.sort(), ['folderId', 'limit', 'offset'])
})
