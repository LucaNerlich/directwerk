import {createServer, type Server} from 'node:http'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'

import {buildUpstreamTenantHeaders, createServerTransport} from '../src/server/transport'

describe('buildUpstreamTenantHeaders', () => {
    it('rewrites Host on plain HTTP', () => {
        expect(
            buildUpstreamTenantHeaders(
                new URL('http://127.0.0.1:8080'),
                'podcast.example.com',
                false,
            ),
        ).toEqual({host: 'podcast.example.com'})
    })

    it('forwards tenant host on HTTPS without rewriting Host', () => {
        expect(
            buildUpstreamTenantHeaders(
                new URL('https://api.example.com'),
                'podcast.example.com',
                false,
            ),
        ).toEqual({
            host: 'api.example.com',
            forwardedHost: 'podcast.example.com',
        })
    })

    it('requires tenant host when configured', () => {
        expect(() =>
            buildUpstreamTenantHeaders(new URL('https://api.example.com'), undefined, true),
        ).toThrow('A tenant host is required.')
    })
})

describe('createServerTransport', () => {
    let server: Server
    let port: number

    beforeAll(
        () =>
            new Promise<void>((resolve) => {
                server = createServer((req, res) => {
                    if (req.url === '/big') {
                        res.writeHead(200, {'content-type': 'application/json'})
                        res.end(JSON.stringify({blob: 'x'.repeat(2_000_000)}))
                        return
                    }
                    if (req.url === '/headers') {
                        const chunks: Buffer[] = []
                        req.on('data', (chunk: Buffer) => chunks.push(chunk))
                        req.on('end', () => {
                            res.writeHead(200, {'content-type': 'application/json'})
                            res.end(
                                JSON.stringify({
                                    host: req.headers.host,
                                    contentLength: req.headers['content-length'],
                                }),
                            )
                        })
                        return
                    }
                    res.writeHead(200, {'content-type': 'application/json'})
                    res.end('{"ok":true}')
                })
                server.listen(0, '127.0.0.1', () => {
                    port = (server.address() as {port: number}).port
                    resolve()
                })
            }),
    )

    afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

    it('allows plain HTTP for loopback targets and rewrites the Host header', async () => {
        const request = createServerTransport({maxResponseBytes: 1024})
        const response = await request({
            targetUrl: new URL(`http://127.0.0.1:${port}/`),
            tenantHost: 'podcast.example.com',
            method: 'GET',
        })
        expect(response.status).toBe(200)
    })

    it('rejects non-HTTPS remote targets', async () => {
        const request = createServerTransport({})
        await expect(
            request({
                targetUrl: new URL('http://example.invalid/'),
                method: 'GET',
            }),
        ).rejects.toThrow('Non-HTTPS URLs are not allowed except for loopback hosts.')
    })

    it('requires a tenant host when configured', async () => {
        const request = createServerTransport({requireTenantHost: true})
        await expect(
            request({
                targetUrl: new URL(`http://127.0.0.1:${port}/`),
                method: 'GET',
            }),
        ).rejects.toThrow('A tenant host is required.')
    })

    it('aborts responses exceeding the byte cap', async () => {
        const request = createServerTransport({maxResponseBytes: 1024})
        await expect(
            request({
                targetUrl: new URL(`http://127.0.0.1:${port}/big`),
                method: 'GET',
            }),
        ).rejects.toThrow()
    }, 15_000)

    it('forwards Content-Length only when configured', async () => {
        const lenient = createServerTransport({})
        const strict = createServerTransport({forwardContentLength: true})
        const url = new URL(`http://127.0.0.1:${port}/headers`)
        const body = '{"a":1}'

        const without = (await lenient({
            targetUrl: url,
            tenantHost: 'h.example',
            method: 'POST',
            authorization: 'Bearer x',
            body,
            contentType: 'application/json',
        })) as Response
        const withoutHeaders = (await without.json()) as Record<string, unknown>
        expect(withoutHeaders.contentLength).toBeUndefined()

        const withLen = (await strict({
            targetUrl: url,
            tenantHost: 'h.example',
            method: 'POST',
            authorization: 'Bearer x',
            body,
            contentType: 'application/json',
        })) as Response
        const withHeaders = (await withLen.json()) as Record<string, unknown>
        expect(withHeaders.contentLength).toBe(String(Buffer.byteLength(body)))
        expect(withHeaders.host).toBe('h.example')
    })
})
