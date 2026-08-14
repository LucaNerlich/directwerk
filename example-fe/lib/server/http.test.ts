import {createServer, type RequestListener, type Server} from 'node:http'
import type {AddressInfo} from 'node:net'

import {describe, expect, it} from 'vitest'

import {requestWithTenantHost} from './http'

async function withTestServer(
    handler: RequestListener,
    run: (baseUrl: URL) => Promise<void>,
): Promise<void> {
    const server: Server = createServer(handler)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    try {
        const address = server.address()
        if (address === null || typeof address === 'string') {
            throw new Error('Test server address is unavailable')
        }

        await run(new URL(`http://127.0.0.1:${(address as AddressInfo).port}`))
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error === undefined ? resolve() : reject(error)))
        })
    }
}

describe('server HTTP transport', () => {
    it('sends the exact allow-listed tenant host to the upstream server', async () => {
        await withTestServer(
            (request, response) => {
                response.setHeader('Content-Type', 'application/json')
                response.end(JSON.stringify({host: request.headers.host}))
            },
            async (baseUrl) => {
                const response = await requestWithTenantHost({
                    targetUrl: new URL('/api/v1/test', baseUrl),
                    tenantHost: 'alpha-a.localhost',
                    method: 'GET',
                })

                expect(await response.json()).toEqual({host: 'alpha-a.localhost'})
            },
        )
    })

    it('falls back to the target host when no tenant host is provided', async () => {
        await withTestServer(
            (request, response) => {
                response.setHeader('Content-Type', 'application/json')
                response.end(JSON.stringify({host: request.headers.host}))
            },
            async (baseUrl) => {
                const response = await requestWithTenantHost({
                    targetUrl: new URL('/api/v1/auth/accept-invite', baseUrl),
                    method: 'POST',
                    contentType: 'application/json',
                    body: '{}',
                })

                expect(await response.json()).toEqual({
                    host: baseUrl.host,
                })
            },
        )
    })
})
