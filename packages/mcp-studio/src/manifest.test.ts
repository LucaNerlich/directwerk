import assert from 'node:assert/strict'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {test} from 'node:test'

import {DirectwerkClient} from './client.js'
import {createMcpServer} from './server.js'

function stubClient(): DirectwerkClient {
    return new DirectwerkClient({
        baseUrl: 'http://127.0.0.1:9',
        apiKey: 'dwk_test',
        tenantHost: 'example.test',
    })
}

function json(data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: {'content-type': 'application/json'},
    })
}

function manifestTools(media: unknown[] = []) {
    const server = createMcpServer(stubClient(), {filesystemTools: true})
    const tools = (server as unknown as {_registeredTools: Record<string, any>})._registeredTools
    return {tools, media}
}

async function withManifest<T>(manifest: unknown, run: (path: string) => Promise<T>): Promise<T> {
    const dir = await mkdtemp(join(tmpdir(), 'dw-manifest-'))
    const manifestPath = join(dir, 'manifest.json')
    await writeFile(manifestPath, JSON.stringify(manifest))
    try {
        return await run(manifestPath)
    } finally {
        await rm(dir, {recursive: true, force: true})
    }
}

test('import_podcast_manifest uploads audio as PRIVATE and the cover as PUBLIC', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dw-files-'))
    const audioPath = join(dir, 'ep.mp3')
    const coverPath = join(dir, 'cover.jpg')
    await writeFile(audioPath, Buffer.from('audio'))
    await writeFile(coverPath, Buffer.from('image'))
    const uploads: Array<Record<string, unknown>> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input))
        if (url.hostname === 's3.test') {
            return new Response('', {status: 200})
        }
        if (url.pathname.endsWith('/media/upload-url')) {
            uploads.push(JSON.parse(String(init?.body)))
            return json({data: {assetId: uploads.length, uploadUrl: 'https://s3.test/put', headers: {}}})
        }
        if (url.pathname === '/api/v1/series') {
            return json({data: [{id: 1, slug: 'show'}]})
        }
        if (url.pathname === '/api/v1/episodes') {
            return json({data: []})
        }
        if (url.pathname.startsWith('/api/v1/episodes/9')) {
            return json({data: {id: 9, slug: 'ep-1', status: 'DRAFT', formats: [{id: 1}]}})
        }
        if (url.pathname.startsWith('/api/v1/episodes')) {
            return json({data: {id: 9, slug: 'ep-1'}})
        }
        if (url.pathname.startsWith('/api/v1/media')) {
            return json({data: []})
        }
        return json({data: {}})
    }) as typeof fetch

    try {
        await withManifest({
            series: {slug: 'show'},
            items: [{
                n: 1,
                slug: 'ep-1',
                title: 'Episode 1',
                mp3: {path: audioPath, filename: 'ep.mp3', mimeType: 'audio/mpeg', sizeBytes: 5},
                cover: {path: coverPath, filename: 'cover.jpg', mimeType: 'image/jpeg', sizeBytes: 5},
            }],
        }, async (manifestPath) => {
            const {tools} = manifestTools()
            const result = await tools.import_podcast_manifest.handler({manifestPath}, {})
            const summary = JSON.parse(result.content[0].text)

            assert.equal(summary.summary.failed, 0)
            assert.deepEqual(
                uploads.map((upload) => [upload.assetType, upload.intendedVisibility]),
                [['AUDIO', 'PRIVATE'], ['IMAGE', 'PUBLIC']],
            )
        })
    } finally {
        globalThis.fetch = originalFetch
        await rm(dir, {recursive: true, force: true})
    }
})

test('import_podcast_manifest refuses PAID audio reused from a PUBLIC asset', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: string | URL | Request) => {
        const url = new URL(String(input))
        if (url.pathname === '/api/v1/series') {
            return json({data: [{id: 1, slug: 'show'}]})
        }
        if (url.pathname === '/api/v1/episodes') {
            return json({data: []})
        }
        if (url.pathname === '/api/v1/media') {
            return json({data: [{id: 4, originalFilename: 'ep.mp3', status: 'READY', visibility: 'PUBLIC'}]})
        }
        return json({data: {}})
    }) as typeof fetch

    try {
        await withManifest({
            series: {slug: 'show'},
            items: [{
                n: 1,
                slug: 'ep-1',
                title: 'Episode 1',
                accessPolicy: 'PAID',
                mp3: {path: '/does/not/matter.mp3', filename: 'ep.mp3', mimeType: 'audio/mpeg', sizeBytes: 5},
            }],
        }, async (manifestPath) => {
            const {tools} = manifestTools()
            const result = await tools.import_podcast_manifest.handler({manifestPath}, {})
            const summary = JSON.parse(result.content[0].text)

            assert.equal(summary.summary.failed, 1)
            assert.match(summary.results[0].error, /asset 4 is PUBLIC/)
        })
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('create_episode keeps the shared slug and title bounds', () => {
    const {tools} = manifestTools()
    const schema = tools.create_episode.inputSchema
    const shape = typeof schema.safeParse === 'function' ? schema.shape : schema

    assert.equal(shape.slug.safeParse('a'.repeat(64)).success, true)
    assert.equal(shape.slug.safeParse('a'.repeat(65)).success, false)
    assert.equal(shape.title.safeParse('a'.repeat(255)).success, true)
    assert.equal(shape.title.safeParse('a'.repeat(256)).success, false)
})

test('import_podcast_manifest rejects an invalid accessPolicy instead of defaulting to FREE', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: string | URL | Request) => {
        const url = new URL(String(input))
        if (url.pathname === '/api/v1/series') {
            return json({data: [{id: 1, slug: 'show'}]})
        }
        if (url.pathname === '/api/v1/episodes') {
            return json({data: []})
        }
        return json({data: {}})
    }) as typeof fetch

    try {
        await withManifest({
            series: {slug: 'show'},
            items: [{
                n: 1,
                slug: 'ep-1',
                title: 'Episode 1',
                accessPolicy: 'paid',
                mp3: {path: '/does/not/matter.mp3', filename: 'ep.mp3', mimeType: 'audio/mpeg', sizeBytes: 5},
            }],
        }, async (manifestPath) => {
            const {tools} = manifestTools()
            const result = await tools.import_podcast_manifest.handler({manifestPath}, {})
            const summary = JSON.parse(result.content[0].text)

            assert.equal(summary.summary.failed, 1)
            assert.match(summary.results[0].error, /invalid accessPolicy/)
        })
    } finally {
        globalThis.fetch = originalFetch
    }
})
