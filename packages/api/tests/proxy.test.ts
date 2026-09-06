import {describe, expect, it, vi} from 'vitest'

import {
    buildProxyPath,
    buildSafeMediaFolderDeleteQueryString,
    buildSafeMediaListQueryString,
    buildSafePreviewQueryString,
    readBearerToken,
} from '../src/proxy/path'
import {parseTenantHost} from '../src/proxy/tenantHost'
import {readBoundedRequestBody} from '../src/proxy/boundedBody'
import {createTenantProxyRouteHandler} from '../src/proxy/routeHandler'
import {PROXY_POLICIES} from '../src/proxy/proxyPolicy'

describe('buildProxyPath', () => {
    it('joins safe segments under /api/v1', () => {
        expect(buildProxyPath(['articles', '12'])).toBe('/api/v1/articles/12')
        // '.' is allowed inside segments so domain hosts can appear.
        expect(buildProxyPath(['podcast.example.com'])).toBe(
            '/api/v1/podcast.example.com',
        )
    })

    it('rejects traversal and empty segments', () => {
        expect(buildProxyPath([])).toBeNull()
        expect(buildProxyPath(['..'])).toBeNull()
        expect(buildProxyPath([''])).toBeNull()
        expect(buildProxyPath(['a/b'])).toBeNull()
    })
})

describe('readBearerToken', () => {
    it('accepts bounded bearer tokens only (returns the bare token)', () => {
        expect(readBearerToken('Bearer abc')).toBe('abc')
        expect(readBearerToken('bearer abc')).toBeNull()
        expect(readBearerToken('Bearer spaced token')).toBeNull()
        expect(readBearerToken(`Bearer ${'x'.repeat(9000)}`)).toBeNull()
        expect(readBearerToken(null)).toBeNull()
    })
})

describe('parseTenantHost', () => {
    it('normalizes case and strips ports', () => {
        expect(parseTenantHost('Podcast.Example.com:8443')).toBe('podcast.example.com')
        expect(parseTenantHost('localhost')).toBe('localhost')
    })

    it('rejects garbage', () => {
        expect(parseTenantHost(null)).toBeNull()
        expect(parseTenantHost('')).toBeNull()
        expect(parseTenantHost('-bad-.com')).toBeNull()
        expect(parseTenantHost('under_score.com')).toBeNull()
    })
})

describe('readBoundedRequestBody', () => {
    it('reads bodies within the cap', async () => {
        const request = new Request('http://local/', {
            method: 'POST',
            body: '{"a":1}',
        })
        const result = await readBoundedRequestBody(request, 1024)
        expect(result).toEqual({ok: true, text: '{"a":1}'})
    })

    it('rejects bodies exceeding the cap with 413', async () => {
        const request = new Request('http://local/', {
            method: 'POST',
            body: 'x'.repeat(100),
        })
        const result = await readBoundedRequestBody(request, 10)
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.status).toBe(413)
        }
    })

    it('treats a null body as empty (bodyless DELETE)', async () => {
        const request = new Request('http://local/', {method: 'DELETE'})
        const result = await readBoundedRequestBody(request, 1024)
        expect(result).toEqual({ok: true, text: ''})
    })
})

describe('buildSafePreviewQueryString', () => {
    it('allows repeated numeric format ids on the podcast preview path', () => {
        expect(
            buildSafePreviewQueryString(
                '/api/v1/me/feeds/preview',
                new URLSearchParams('formatIds=3&formatIds=7'),
            ),
        ).toBe('?formatIds=3&formatIds=7')
    })

    it('allows repeated numeric category ids on the article preview path', () => {
        expect(
            buildSafePreviewQueryString(
                '/api/v1/me/article-feeds/preview',
                new URLSearchParams('categoryIds=11'),
            ),
        ).toBe('?categoryIds=11')
    })

    it('rejects unknown paths, keys, and malformed ids', () => {
        expect(
            buildSafePreviewQueryString(
                '/api/v1/me/feeds',
                new URLSearchParams('formatIds=3'),
            ),
        ).toBeNull()
        expect(
            buildSafePreviewQueryString(
                '/api/v1/me/feeds/preview',
                new URLSearchParams('formatIds=3&evil=1'),
            ),
        ).toBeNull()
        expect(
            buildSafePreviewQueryString(
                '/api/v1/me/feeds/preview',
                new URLSearchParams('categoryIds=3'),
            ),
        ).toBeNull()
        expect(
            buildSafePreviewQueryString(
                '/api/v1/me/feeds/preview',
                new URLSearchParams('formatIds=abc'),
            ),
        ).toBeNull()
        expect(
            buildSafePreviewQueryString(
                '/api/v1/me/feeds/preview',
                new URLSearchParams('formatIds=0'),
            ),
        ).toBeNull()
        expect(
            buildSafePreviewQueryString(
                '/api/v1/me/feeds/preview',
                new URLSearchParams(''),
            ),
        ).toBeNull()
        expect(
            buildSafePreviewQueryString(
                '/api/v1/me/feeds/preview',
                new URLSearchParams(
                    Array.from({length: 51}, (_, index) => `formatIds=${index + 1}`).join('&'),
                ),
            ),
        ).toBeNull()
    })
})

describe('buildSafeMediaListQueryString', () => {
    it('builds the media-library filter query canonically', () => {
        expect(
            buildSafeMediaListQueryString(
                '/api/v1/media',
                new URLSearchParams('limit=100&unassignedOnly=true'),
            ),
        ).toBe('?limit=100&unassignedOnly=true')
        expect(
            buildSafeMediaListQueryString(
                '/api/v1/media',
                new URLSearchParams(
                    'assetType=AUDIO&status=READY&limit=50&folderId=3&recursive=true&unassignedOnly=true',
                ),
            ),
        ).toBe(
            '?assetType=AUDIO&status=READY&limit=50&folderId=3&recursive=true&unassignedOnly=true',
        )
    })

    it('rejects unknown paths, keys, duplicates, and invalid values', () => {
        expect(
            buildSafeMediaListQueryString(
                '/api/v1/media/7',
                new URLSearchParams('limit=10'),
            ),
        ).toBeNull()
        expect(
            buildSafeMediaListQueryString(
                '/api/v1/media',
                new URLSearchParams('limit=10&evil=1'),
            ),
        ).toBeNull()
        expect(
            buildSafeMediaListQueryString(
                '/api/v1/media',
                new URLSearchParams('limit=10&limit=20'),
            ),
        ).toBeNull()
        expect(
            buildSafeMediaListQueryString(
                '/api/v1/media',
                new URLSearchParams('limit=101'),
            ),
        ).toBeNull()
        expect(
            buildSafeMediaListQueryString(
                '/api/v1/media',
                new URLSearchParams('limit=abc'),
            ),
        ).toBeNull()
        expect(
            buildSafeMediaListQueryString(
                '/api/v1/media',
                new URLSearchParams('folderId=abc'),
            ),
        ).toBeNull()
        expect(
            buildSafeMediaListQueryString(
                '/api/v1/media',
                new URLSearchParams('assetType=EXECUTABLE'),
            ),
        ).toBeNull()
        expect(
            buildSafeMediaListQueryString(
                '/api/v1/media',
                new URLSearchParams('status=READY&status=PENDING'),
            ),
        ).toBeNull()
        expect(
            buildSafeMediaListQueryString(
                '/api/v1/media',
                new URLSearchParams('recursive=false'),
            ),
        ).toBeNull()
    })
})

describe('buildSafeMediaFolderDeleteQueryString', () => {
    it('builds the folder delete mode query on numeric folder paths', () => {
        expect(
            buildSafeMediaFolderDeleteQueryString(
                '/api/v1/media/folders/12',
                new URLSearchParams('mode=move_to_parent'),
            ),
        ).toBe('?mode=move_to_parent')
        expect(
            buildSafeMediaFolderDeleteQueryString(
                '/api/v1/media/folders/12',
                new URLSearchParams('mode=delete_contents'),
            ),
        ).toBe('?mode=delete_contents')
    })

    it('rejects other paths, extra keys, and invalid modes', () => {
        expect(
            buildSafeMediaFolderDeleteQueryString(
                '/api/v1/media/folders/abc',
                new URLSearchParams('mode=move_to_parent'),
            ),
        ).toBeNull()
        expect(
            buildSafeMediaFolderDeleteQueryString(
                '/api/v1/media/folders',
                new URLSearchParams('mode=move_to_parent'),
            ),
        ).toBeNull()
        expect(
            buildSafeMediaFolderDeleteQueryString(
                '/api/v1/media/folders/12',
                new URLSearchParams('mode=wipe_everything'),
            ),
        ).toBeNull()
        expect(
            buildSafeMediaFolderDeleteQueryString(
                '/api/v1/media/folders/12',
                new URLSearchParams('mode=move_to_parent&evil=1'),
            ),
        ).toBeNull()
        expect(
            buildSafeMediaFolderDeleteQueryString(
                '/api/v1/media/folders/12',
                new URLSearchParams(''),
            ),
        ).toBeNull()
    })
})

describe('createTenantProxyRouteHandler query handling', () => {
    function previewHandlers(fetchUpstream: (request: {
        path: string
        query?: string
    }) => Promise<Response>) {
        return createTenantProxyRouteHandler({
            fetchUpstream: (request) =>
                fetchUpstream({path: request.path, query: request.query}),
            jsonBodyLimit: 16_384,
            // Mirrors the studio BFF route: bodyless DELETEs are valid calls.
            allowMissingBody: true,
        })
    }

    function previewRequest(url: string): Request {
        return new Request(url, {
            headers: {
                'x-tenant-host': 'tenant.example',
                authorization: 'Bearer token123',
            },
        })
    }

    it('forwards canonical preview queries upstream', async () => {
        const seen: Array<{path: string; query?: string}> = []
        const handlers = previewHandlers(async (request) => {
            seen.push(request)
            return Response.json({statusCode: 200, statusMessage: 'OK', data: {episodeCount: 2, sampleTitles: []}, errors: [], metadata: {}})
        })

        const response = await handlers.GET(
            previewRequest(
                'http://local/api/proxy/me/feeds/preview?formatIds=3&formatIds=7',
            ),
            {params: Promise.resolve({path: ['me', 'feeds', 'preview']})},
        )

        expect(response.status).toBe(200)
        expect(seen).toEqual([{path: '/api/v1/me/feeds/preview', query: '?formatIds=3&formatIds=7'}])
    })

    it('forwards the media library list query upstream', async () => {
        const seen: Array<{path: string; query?: string}> = []
        const handlers = previewHandlers(async (request) => {
            seen.push(request)
            return Response.json({statusCode: 200, statusMessage: 'OK', data: [], errors: [], metadata: {}})
        })

        const response = await handlers.GET(
            previewRequest(
                'http://local/api/proxy/media?limit=100&unassignedOnly=true',
            ),
            {params: Promise.resolve({path: ['media']})},
        )

        expect(response.status).toBe(200)
        expect(seen).toEqual([{path: '/api/v1/media', query: '?limit=100&unassignedOnly=true'}])
    })

    it('rejects tampered media list queries without calling upstream', async () => {
        const fetchUpstream = vi.fn(async () => new Response('{}'))
        const handlers = createTenantProxyRouteHandler({
            fetchUpstream,
            jsonBodyLimit: 16_384,
        })

        const response = await handlers.GET(
            previewRequest('http://local/api/proxy/media?limit=100&token=x'),
            {params: Promise.resolve({path: ['media']})},
        )

        expect(response.status).toBe(400)
        expect(fetchUpstream).not.toHaveBeenCalled()
    })

    it('forwards the media folder delete mode upstream', async () => {
        const seen: Array<{path: string; query?: string}> = []
        const handlers = createTenantProxyRouteHandler({
            fetchUpstream: (request) => {
                seen.push(request)
                return Promise.resolve(
                    Response.json({statusCode: 200, statusMessage: 'OK', data: {}, errors: [], metadata: {}}),
                )
            },
            jsonBodyLimit: 16_384,
            allowMissingBody: true,
        })

        const response = await handlers.DELETE(
            previewRequest('http://local/api/proxy/media/folders/12?mode=delete_contents'),
            {params: Promise.resolve({path: ['media', 'folders', '12']})},
        )

        expect(response.status).toBe(200)
        expect(seen).toHaveLength(1)
        expect(seen[0]).toMatchObject({
            path: '/api/v1/media/folders/12',
            query: '?mode=delete_contents',
        })
    })

    it('still rejects query strings on non-preview paths', async () => {
        const fetchUpstream = vi.fn(async () => new Response('{}'))
        const handlers = createTenantProxyRouteHandler({
            fetchUpstream,
            jsonBodyLimit: 16_384,
        })

        const response = await handlers.GET(
            previewRequest('http://local/api/proxy/me/feeds?formatIds=3'),
            {params: Promise.resolve({path: ['me', 'feeds']})},
        )

        expect(response.status).toBe(400)
        expect(fetchUpstream).not.toHaveBeenCalled()
    })

    it('rejects tampered preview queries without calling upstream', async () => {
        const fetchUpstream = vi.fn(async () => new Response('{}'))
        const handlers = createTenantProxyRouteHandler({
            fetchUpstream,
            jsonBodyLimit: 16_384,
        })

        const response = await handlers.GET(
            previewRequest(
                'http://local/api/proxy/me/feeds/preview?formatIds=3&redirect=https%3A%2F%2Fevil.test',
            ),
            {params: Promise.resolve({path: ['me', 'feeds', 'preview']})},
        )

        expect(response.status).toBe(400)
        expect(fetchUpstream).not.toHaveBeenCalled()
    })
})

describe('createTenantProxyRouteHandler body limits', () => {
    it('rejects oversized bodies even when Content-Length lies', async () => {
        const fetchUpstream = vi.fn(async () => new Response('{}'))
        const handlers = createTenantProxyRouteHandler({
            fetchUpstream: async () => new Response('{}'),
            jsonBodyLimit: 16,
        })
        void fetchUpstream

        const bigBody = JSON.stringify({data: 'x'.repeat(1024)})
        const request = new Request('http://local/api/proxy/me', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                // Attacker spoof: claims a tiny body to bypass header checks.
                'content-length': '2',
                'x-tenant-host': 'tenant.example',
                authorization: 'Bearer token123',
            },
            body: bigBody,
        })

        const response = await handlers.POST(request, {
            params: Promise.resolve({path: ['me']}),
        })
        expect(response.status).toBe(413)
    })

    it.each(['text/plain', 'application/jsonp', 'text/application/json'])(
        'rejects non-JSON content type %s with 415',
        async (contentType) => {
            const fetchUpstream = vi.fn(async () => new Response('{}'))
            const handlers = createTenantProxyRouteHandler({
                fetchUpstream,
                jsonBodyLimit: 16_384,
            })

            const request = new Request('http://local/api/proxy/me', {
                method: 'POST',
                headers: {
                    'content-type': contentType,
                    'x-tenant-host': 'tenant.example',
                    authorization: 'Bearer token123',
                },
                body: '{"a":1}',
            })

            const response = await handlers.POST(request, {
                params: Promise.resolve({path: ['me']}),
            })
            expect(response.status).toBe(415)
            expect(fetchUpstream).not.toHaveBeenCalled()
        },
    )

    it('rejects malformed JSON with 400', async () => {
        const fetchUpstream = vi.fn(async () => new Response('{}'))
        const handlers = createTenantProxyRouteHandler({
            fetchUpstream,
            jsonBodyLimit: 16_384,
        })

        const request = new Request('http://local/api/proxy/me', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-tenant-host': 'tenant.example',
                authorization: 'Bearer token123',
            },
            body: '{"a":',
        })

        const response = await handlers.POST(request, {
            params: Promise.resolve({path: ['me']}),
        })
        expect(response.status).toBe(400)
        expect(fetchUpstream).not.toHaveBeenCalled()
    })
})

describe('createTenantProxyRouteHandler HEAD support', () => {
    function headHandlers(
        fetchUpstream: (request: {
            path: string
            method: string
            query?: string
        }) => Promise<Response>,
    ) {
        return createTenantProxyRouteHandler({
            fetchUpstream: (request) =>
                fetchUpstream({
                    path: request.path,
                    method: request.method,
                    query: request.query,
                }),
            jsonBodyLimit: 16_384,
        })
    }

    function headRequest(url: string): Request {
        return new Request(url, {
            method: 'HEAD',
            headers: {
                'x-tenant-host': 'tenant.example',
                authorization: 'Bearer token123',
            },
        })
    }

    it('forwards HEAD upstream without reading a body', async () => {
        const seen: Array<{path: string; method: string; body?: string}> = []
        const handlers = createTenantProxyRouteHandler({
            fetchUpstream: (request) => {
                seen.push({
                    path: request.path,
                    method: request.method,
                    body: request.body,
                })
                return Promise.resolve(
                    Response.json({statusCode: 200, statusMessage: 'OK', data: {}, errors: [], metadata: {}}),
                )
            },
            jsonBodyLimit: 16_384,
        })

        const response = await handlers.HEAD(
            headRequest('http://local/api/proxy/me'),
            {params: Promise.resolve({path: ['me']})},
        )

        expect(response.status).toBe(200)
        expect(seen).toEqual([{path: '/api/v1/me', method: 'HEAD', body: undefined}])
    })

    it('validates HEAD preview queries like GET', async () => {
        const seen: Array<{path: string; method: string; query?: string}> = []
        const handlers = headHandlers(async (request) => {
            seen.push(request)
            return Response.json({statusCode: 200, statusMessage: 'OK', data: {episodeCount: 0, sampleTitles: []}, errors: [], metadata: {}})
        })

        const response = await handlers.HEAD(
            headRequest(
                'http://local/api/proxy/me/feeds/preview?formatIds=3&formatIds=7',
            ),
            {params: Promise.resolve({path: ['me', 'feeds', 'preview']})},
        )

        expect(response.status).toBe(200)
        expect(seen).toEqual([
            {path: '/api/v1/me/feeds/preview', method: 'HEAD', query: '?formatIds=3&formatIds=7'},
        ])
    })
})

describe('PROXY_POLICIES', () => {
    it('pins the agreed per-app body limits and flags', () => {
        expect(PROXY_POLICIES.studioTenant).toEqual({
            name: 'studioTenant',
            jsonBodyLimit: 1_048_576,
            allowMissingBody: true,
            allowHead: true,
        })
        expect(PROXY_POLICIES.webTenant).toEqual({
            name: 'webTenant',
            jsonBodyLimit: 16_384,
            allowMissingBody: false,
            allowHead: true,
        })
        expect(PROXY_POLICIES.platform).toEqual({
            name: 'platform',
            jsonBodyLimit: 65_536,
            allowMissingBody: false,
            allowHead: true,
        })
        expect(PROXY_POLICIES.adminTenant).toEqual({
            name: 'adminTenant',
            jsonBodyLimit: 65_536,
            allowMissingBody: false,
            allowHead: true,
        })
    })
})
