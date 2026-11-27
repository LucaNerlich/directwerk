import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import {fileURLToPath} from 'node:url'

import {DirectwerkClient} from './client.js'
import {createMcpServer} from './server.js'

const HOSTED_TOOLS = fileURLToPath(new URL(
    '../../../Directwerk/directwerk-app/src/main/java/de/pnnit/directwerk/mcp/StudioMcpTools.java',
    import.meta.url,
))

function stubClient(): DirectwerkClient {
    return new DirectwerkClient({
        baseUrl: 'http://127.0.0.1:9',
        apiKey: 'dwk_test',
        tenantHost: 'example.test',
    })
}

/**
 * The hosted `/mcp` catalog and this package are maintained by hand in two
 * languages. A missing mirror just means an agent gets a different surface
 * depending on how it connects, so pin the names.
 */
test('hosted and stdio catalogs expose the same tool names', () => {
    const java = readFileSync(HOSTED_TOOLS, 'utf8')
    const hosted = new Set([...java.matchAll(/tool\("([a-z0-9_]+)"/g)].map(match => match[1]))

    const tools = (createMcpServer(stubClient()) as unknown as {
        _registeredTools: Record<string, unknown>
    })._registeredTools
    const stdio = new Set(Object.keys(tools))
    // stdio-only: needs a local filesystem.
    stdio.delete('import_podcast_manifest')

    assert.deepEqual([...stdio].sort(), [...hosted].sort())
})
