import {describe, expect, it} from 'vitest'

import {
    buildPlatformApiPath,
    buildSafePlatformQueryString,
    buildTenantApiPath,
    createPlatformApiRequest,
    createPlatformTokenRequest,
    parseBearerAuthorization,
    safeUpstreamResponse,
} from './directwerk'

describe('buildPlatformApiPath', () => {
    it('builds only platform API paths from safe segments', () => {
        expect(buildPlatformApiPath(['tenants', '42', 'users'])).toBe(
            '/api/v1/platform/tenants/42/users'
        )
    })

    it.each([
        [[]],
        [['..', 'oauth2', 'token']],
        [['tenants%2F42']],
        [['tenants', '42?admin=true']],
        [['tenants', '']],
    ])('rejects unsafe proxy segments: %j', (segments) => {
        expect(() => buildPlatformApiPath(segments)).toThrow(
            'Invalid platform API path.'
        )
    })

    it('buildPlatformApiPath allows dotted hostname segments', () => {
        expect(buildPlatformApiPath(['tenants', '1', 'domains', 'tenant.example.com', 'verify']))
            .toBe('/api/v1/platform/tenants/1/domains/tenant.example.com/verify')
    })

    it('buildPlatformApiPath still rejects a lone dot or double-dot segment', () => {
        expect(() => buildPlatformApiPath(['tenants', '1', 'domains', '.', 'verify'])).toThrow()
        expect(() => buildPlatformApiPath(['tenants', '1', 'domains', '..', 'verify'])).toThrow()
    })
})

describe('parseBearerAuthorization', () => {
    it('accepts a bounded bearer token', () => {
        expect(parseBearerAuthorization('Bearer header.payload.signature')).toBe(
            'Bearer header.payload.signature'
        )
    })

    it.each([null, 'Basic abc', 'Bearer ', 'Bearer token with spaces'])(
        'rejects invalid authorization: %s',
        (authorization) => {
            expect(parseBearerAuthorization(authorization)).toBeNull()
        }
    )
})

describe('createPlatformTokenRequest', () => {
    it('uses server credentials without adding a tenant Host header', () => {
        const request = createPlatformTokenRequest(
            {
                email: 'platform-admin@publish.local',
                password: 'ChangeMe-Dev-Seed!',
            },
            {
                apiUrl: 'http://localhost:8080',
                clientId: 'publish-platform-admin',
                clientSecret: 'test-secret',
            }
        )
        const headers = new Headers(request.init.headers)

        expect(request.url).toBe('http://localhost:8080/oauth2/token')
        expect(headers.has('host')).toBe(false)
        expect(headers.get('authorization')).toBe(
            `Basic ${btoa('publish-platform-admin:test-secret')}`
        )
        expect(request.init.redirect).toBe('manual')
    })

    it.each([
        'https://user:password@api.example.com',
        'https://api.example.com?debug=true',
        'ftp://api.example.com',
    ])('rejects an unsafe API URL: %s', (apiUrl) => {
        expect(() =>
            createPlatformTokenRequest(
                {
                    email: 'platform-admin@publish.local',
                    password: 'ChangeMe-Dev-Seed!',
                },
                {
                    apiUrl,
                    clientId: 'publish-platform-admin',
                    clientSecret: 'test-secret',
                }
            )
        ).toThrow('Invalid Directwerk API URL.')
    })
})

describe('buildSafePlatformQueryString', () => {
    it('builds a validated queue job list query', () => {
        const params = new URLSearchParams({
            queue: 'email',
            status: 'FAILED',
            offset: '0',
            limit: '20',
        })

        expect(buildSafePlatformQueryString(params)).toBe(
            '?queue=email&status=FAILED&offset=0&limit=20'
        )
    })

    it('builds a validated tenant media list query', () => {
        const params = new URLSearchParams({
            assetType: 'IMAGE',
            status: 'READY',
            limit: '50',
        })

        expect(buildSafePlatformQueryString(params)).toBe(
            '?assetType=IMAGE&status=READY&limit=50'
        )
    })

    it('returns an empty string when no params are present', () => {
        expect(buildSafePlatformQueryString(new URLSearchParams())).toBe('')
    })

    it.each([
        ['queue', 'bad queue'],
        ['status', 'UNKNOWN'],
        ['assetType', 'GIF'],
        ['updatedAfter', 'not-a-date'],
        ['offset', '-1'],
        ['limit', '101'],
        ['unknown', 'email'],
    ])('rejects unsafe query params: %s=%s', (name, value) => {
        const params = new URLSearchParams({[name]: value})

        expect(() => buildSafePlatformQueryString(params)).toThrow(
            'Invalid platform API query.'
        )
    })

    it('rejects "." as a queue name', () => {
        const params = new URLSearchParams({queue: '.'})

        expect(() => buildSafePlatformQueryString(params)).toThrow(
            'Invalid platform API query.'
        )
    })

    it('rejects ".." as a queue name', () => {
        const params = new URLSearchParams({queue: '..'})

        expect(() => buildSafePlatformQueryString(params)).toThrow(
            'Invalid platform API query.'
        )
    })

    it('accepts valid queue names with underscores and hyphens', () => {
        const params = new URLSearchParams({queue: 'email_notifications-v2'})

        expect(buildSafePlatformQueryString(params)).toBe(
            '?queue=email_notifications-v2'
        )
    })
})

describe('createPlatformApiRequest', () => {
    const environment = {
        apiUrl: 'http://localhost:8080',
        clientId: 'publish-platform-admin',
        clientSecret: 'test-secret',
    }

    it('forwards only bearer authorization for a GET request', () => {
        const upstream = createPlatformApiRequest(
            ['tenants'],
            new Request('http://admin.local/api/proxy/tenants'),
            'Bearer header.payload.signature',
            environment
        )
        const headers = new Headers(upstream.init.headers)

        expect(upstream.url).toBe(
            'http://localhost:8080/api/v1/platform/tenants'
        )
        expect(upstream.init.method).toBe('GET')
        expect(upstream.init.body).toBeUndefined()
        expect(upstream.init.redirect).toBe('manual')
        expect(headers.get('authorization')).toBe(
            'Bearer header.payload.signature'
        )
        expect(headers.has('host')).toBe(false)
    })

    it('forwards validated query params for a GET request', () => {
        const upstream = createPlatformApiRequest(
            ['queue', 'jobs'],
            new Request(
                'http://admin.local/api/proxy/queue/jobs?queue=email&status=QUEUED&offset=0&limit=20'
            ),
            'Bearer header.payload.signature',
            environment
        )

        expect(upstream.url).toBe(
            'http://localhost:8080/api/v1/platform/queue/jobs?queue=email&status=QUEUED&offset=0&limit=20'
        )
    })

    it('does not forward query params for a POST request', () => {
        const request = new Request(
            'http://admin.local/api/proxy/queue/jobs?queue=email',
            {
                method: 'POST',
                headers: {'Content-Type': 'application/json; charset=utf-8'},
                body: JSON.stringify({queue: 'email', payload: {}, priority: 0}),
                duplex: 'half',
            } as RequestInit
        )
        const upstream = createPlatformApiRequest(
            ['queue', 'jobs'],
            request,
            'Bearer header.payload.signature',
            environment
        )

        expect(upstream.url).toBe(
            'http://localhost:8080/api/v1/platform/queue/jobs'
        )
    })

    it('forwards a JSON body for a mutation request', async () => {
        const request = new Request(
            'http://admin.local/api/proxy/tenants/42/suspend',
            {
                method: 'POST',
                headers: {'Content-Type': 'application/json; charset=utf-8'},
                body: JSON.stringify({reason: 'review'}),
                // Required by Node for requests backed by a stream.
                duplex: 'half',
            } as RequestInit
        )
        const upstream = createPlatformApiRequest(
            ['tenants', '42', 'suspend'],
            request,
            'Bearer header.payload.signature',
            environment
        )

        expect(upstream.init.method).toBe('POST')
        expect(new Headers(upstream.init.headers).get('content-type')).toBe(
            'application/json'
        )
        await expect(
            new Response(upstream.init.body as BodyInit).text()
        ).resolves.toBe(JSON.stringify({reason: 'review'}))
    })
})

describe('safeUpstreamResponse', () => {
    it('forwards a successful JSON response', async () => {
        const response = await safeUpstreamResponse(
            Response.json({data: {id: 42}}, {status: 200})
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({data: {id: 42}})
    })

    it('does not expose an upstream error body', async () => {
        const response = await safeUpstreamResponse(
            new Response('internal stack trace', {
                status: 500,
                headers: {'content-type': 'text/plain'},
            })
        )

        expect(response.status).toBe(500)
        await expect(response.json()).resolves.toEqual({
            error: 'Directwerk request failed.',
        })
    })

    it('returns a generic gateway error for invalid success responses', async () => {
        const response = await safeUpstreamResponse(
            new Response('<html>not json</html>', {
                status: 200,
                headers: {'content-type': 'text/html'},
            })
        )

        expect(response.status).toBe(502)
        await expect(response.json()).resolves.toEqual({
            error: 'Invalid response from Directwerk.',
        })
    })
})

describe('buildTenantApiPath', () => {
    it('builds tenant API paths and rejects platform prefix', () => {
        expect(buildTenantApiPath(['tenant', 'products'])).toBe(
            '/api/v1/tenant/products'
        )
        expect(() => buildTenantApiPath(['platform', 'tenants'])).toThrow(
            'Invalid tenant API path.'
        )
    })
})
