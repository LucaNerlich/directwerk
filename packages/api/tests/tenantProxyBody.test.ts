import {describe, expect, it, vi} from 'vitest'

import {
    createTenantProxyRouteHandler,
    type UpstreamFetchRequest,
} from '../src/proxy/routeHandler'

const tenantHost = 'demo.example.com'

function request(method: string, body?: string, contentType?: string): Request {
    const headers = new Headers({
        'x-tenant-host': tenantHost,
        authorization: 'Bearer token',
    })
    if (contentType !== undefined) {
        headers.set('content-type', contentType)
    }
    return new Request('https://studio.example.com/api/proxy/me/feeds/1', {
        method,
        headers,
        body,
    })
}

const context = {params: Promise.resolve({path: ['me', 'feeds', '1']})}

function handler() {
    const fetchUpstream = vi.fn(
        async (_request: UpstreamFetchRequest) =>
            new Response(JSON.stringify({ok: true}), {
                status: 200,
                headers: {'content-type': 'application/json'},
            }),
    )
    return {
        fetchUpstream,
        route: createTenantProxyRouteHandler({
            fetchUpstream,
            jsonBodyLimit: 1024,
        }),
    }
}

describe('tenant proxy body handling', () => {
    it('forwards a bodyless DELETE without a JSON content type', async () => {
        const {fetchUpstream, route} = handler()

        const response = await route.DELETE(request('DELETE'), context)

        expect(response.status).toBe(200)
        expect(fetchUpstream).toHaveBeenCalledTimes(1)
        expect(fetchUpstream.mock.calls[0]?.[0].body).toBeUndefined()
    })

    it('still rejects a bodyless POST without a JSON content type', async () => {
        const {fetchUpstream, route} = handler()

        const response = await route.POST(request('POST'), context)

        expect(response.status).toBe(415)
        expect(fetchUpstream).not.toHaveBeenCalled()
    })
})
