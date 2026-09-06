import {describe, expect, it, vi} from 'vitest'

import {buildSafePlatformQueryString} from '../src/server/platform'
import {
    createAdminTenantProxyRouteHandler,
    createPlatformProxyRouteHandler,
} from '../src/proxy/platformRouteHandler'

describe('buildSafePlatformQueryString', () => {
    it('allows overview query params including recentAuditLimit', () => {
        const params = new URLSearchParams({recentAuditLimit: '8'})
        expect(buildSafePlatformQueryString(params)).toBe('?recentAuditLimit=8')
    })

    it('allows audit list pagination params', () => {
        const params = new URLSearchParams({page: '0', size: '50'})
        expect(buildSafePlatformQueryString(params)).toBe('?page=0&size=50')
    })

    it('allows audit list filters', () => {
        const params = new URLSearchParams({
            page: '0',
            size: '20',
            tenantId: '42',
            action: 'TENANT_CREATED',
            actorEmail: 'admin@example.com',
            actorUserId: '7',
        })
        expect(buildSafePlatformQueryString(params)).toBe(
            '?page=0&size=20&tenantId=42&action=TENANT_CREATED&actorEmail=admin%40example.com&actorUserId=7',
        )
    })

    it('rejects unknown query params', () => {
        const params = new URLSearchParams({recentAuditLimit: '8', evil: '1'})
        expect(() => buildSafePlatformQueryString(params)).toThrow(
            'Invalid platform API query.',
        )
    })

    it('rejects recentAuditLimit outside API bounds', () => {
        expect(() =>
            buildSafePlatformQueryString(
                new URLSearchParams({recentAuditLimit: '0'}),
            ),
        ).toThrow('Invalid platform API query.')
        expect(() =>
            buildSafePlatformQueryString(
                new URLSearchParams({recentAuditLimit: '51'}),
            ),
        ).toThrow('Invalid platform API query.')
    })
})

describe('createPlatformProxyRouteHandler body policy', () => {
    function handlers(
        fetchUpstream: (
            segments: string[],
            request: Request,
            authorization: string,
        ) => Promise<Response> = async () => Response.json({ok: true}),
        jsonBodyLimit = 16,
    ) {
        return createPlatformProxyRouteHandler({fetchUpstream, jsonBodyLimit})
    }

    function postRequest(body: string, headers: Record<string, string>): Request {
        return new Request('http://local/api/proxy/tenants', {
            method: 'POST',
            headers: {authorization: 'Bearer token123', ...headers},
            body,
        })
    }

    it('rejects oversized bodies even when Content-Length lies', async () => {
        const fetchUpstream = vi.fn(async () => Response.json({ok: true}))
        const bigBody = JSON.stringify({data: 'x'.repeat(1024)})
        const response = await handlers(fetchUpstream).POST(
            postRequest(bigBody, {
                'content-type': 'application/json',
                // Attacker spoof: claims a tiny body to bypass header checks.
                'content-length': '2',
            }),
            {params: Promise.resolve({path: ['tenants']})},
        )
        expect(response.status).toBe(413)
        expect(fetchUpstream).not.toHaveBeenCalled()
    })

    it('rejects non-JSON content types with 415', async () => {
        const fetchUpstream = vi.fn(async () => Response.json({ok: true}))
        const response = await handlers(fetchUpstream).POST(
            postRequest('{"a":1}', {'content-type': 'text/plain'}),
            {params: Promise.resolve({path: ['tenants']})},
        )
        expect(response.status).toBe(415)
        expect(fetchUpstream).not.toHaveBeenCalled()
    })

    it('rejects malformed JSON with 400', async () => {
        const fetchUpstream = vi.fn(async () => Response.json({ok: true}))
        const response = await handlers(fetchUpstream).POST(
            postRequest('{"a":', {'content-type': 'application/json'}),
            {params: Promise.resolve({path: ['tenants']})},
        )
        expect(response.status).toBe(400)
        expect(fetchUpstream).not.toHaveBeenCalled()
    })

    it('allows bodyless DELETE without a Content-Type', async () => {
        const seen: Array<{url: string; body: string}> = []
        const response = await handlers(async (_segments, request) => {
            seen.push({url: request.url, body: await request.text()})
            return Response.json({ok: true})
        }).DELETE(
            new Request('http://local/api/proxy/tenants/7', {
                method: 'DELETE',
                headers: {authorization: 'Bearer token123'},
            }),
            {params: Promise.resolve({path: ['tenants', '7']})},
        )
        expect(response.status).toBe(200)
        expect(seen).toHaveLength(1)
        expect(seen[0]?.body).toBe('')
    })
})

describe('createAdminTenantProxyRouteHandler body policy', () => {
    function handlers(
        fetchUpstream: (
            pathWithQuery: string,
            tenantHost: string,
            method: string,
            authorization: string,
            body?: string,
        ) => Promise<Response> = async () => Response.json({ok: true}),
        jsonBodyLimit = 16,
    ) {
        return createAdminTenantProxyRouteHandler({fetchUpstream, jsonBodyLimit})
    }

    function postRequest(body: string, headers: Record<string, string>): Request {
        return new Request('http://local/api/tenant-proxy/media', {
            method: 'POST',
            headers: {
                authorization: 'Bearer token123',
                'x-tenant-host': 'tenant.example',
                ...headers,
            },
            body,
        })
    }

    it('rejects oversized bodies even when Content-Length lies', async () => {
        const fetchUpstream = vi.fn(async () => Response.json({ok: true}))
        const bigBody = JSON.stringify({data: 'x'.repeat(1024)})
        const response = await handlers(fetchUpstream).POST(
            postRequest(bigBody, {
                'content-type': 'application/json',
                // Attacker spoof: claims a tiny body to bypass header checks.
                'content-length': '2',
            }),
            {params: Promise.resolve({path: ['media']})},
        )
        expect(response.status).toBe(413)
        expect(fetchUpstream).not.toHaveBeenCalled()
    })

    it('rejects non-JSON content types with 415', async () => {
        const fetchUpstream = vi.fn(async () => Response.json({ok: true}))
        const response = await handlers(fetchUpstream).POST(
            postRequest('{"a":1}', {'content-type': 'text/plain'}),
            {params: Promise.resolve({path: ['media']})},
        )
        expect(response.status).toBe(415)
        expect(fetchUpstream).not.toHaveBeenCalled()
    })

    it('rejects malformed JSON with 400', async () => {
        const fetchUpstream = vi.fn(async () => Response.json({ok: true}))
        const response = await handlers(fetchUpstream).POST(
            postRequest('{"a":', {'content-type': 'application/json'}),
            {params: Promise.resolve({path: ['media']})},
        )
        expect(response.status).toBe(400)
        expect(fetchUpstream).not.toHaveBeenCalled()
    })

    it('allows bodyless DELETE without a Content-Type', async () => {
        const seen: Array<{pathWithQuery: string; tenantHost: string; body?: string}> = []
        const response = await handlers(async (pathWithQuery, tenantHost, _method, _auth, body) => {
            seen.push({pathWithQuery, tenantHost, body})
            return Response.json({ok: true})
        }).DELETE(
            new Request('http://local/api/tenant-proxy/media/7', {
                method: 'DELETE',
                headers: {
                    authorization: 'Bearer token123',
                    'x-tenant-host': 'tenant.example',
                },
            }),
            {params: Promise.resolve({path: ['media', '7']})},
        )
        expect(response.status).toBe(200)
        expect(seen).toEqual([
            {pathWithQuery: '/api/v1/media/7', tenantHost: 'tenant.example', body: undefined},
        ])
    })
})
