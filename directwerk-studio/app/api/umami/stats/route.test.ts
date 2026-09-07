import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {GET} from '@/app/api/umami/stats/route'

const fetchSiteConfigMock = vi.fn()

vi.mock('@/lib/site/fetchSiteConfigServer', () => ({
    fetchSiteConfigServerOptional: (...args: unknown[]) =>
        fetchSiteConfigMock(...args),
}))

function analyticsConfig() {
    return {
        analytics: {
            umamiWebsiteId: 'website-1',
            umamiHostUrl: 'https://umami.example.com',
            umamiScriptUrl: 'https://umami.example.com/script.js',
        },
    }
}

function upstreamStats() {
    return {
        pageviews: 100,
        visitors: 40,
        visits: 50,
        bounces: 10,
        totaltime: 3600,
    }
}

function upstreamPageviews() {
    return {
        pageviews: [{x: '2026-08-01T00:00:00Z', y: 5}],
        sessions: [{x: '2026-08-01T00:00:00Z', y: 2}],
    }
}

function request(headers: Record<string, string>, url = 'https://studio.test/api/umami/stats'): Request {
    return new Request(url, {headers})
}

const authed = {
    'x-tenant-host': 'tenant.test',
    authorization: 'Bearer token',
}

beforeEach(() => {
    vi.stubEnv('UMAMI_API_KEY', 'secret-key')
    vi.stubEnv('UMAMI_API_BASE_URL', '')
    fetchSiteConfigMock.mockReset()
    fetchSiteConfigMock.mockResolvedValue(analyticsConfig())
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
})

describe('GET /api/umami/stats', () => {
    it('rejects unauthenticated callers', async () => {
        const response = await GET(request({'x-tenant-host': 'tenant.test'}))
        expect(response.status).toBe(401)
    })

    it('returns 404 when Umami is not configured', async () => {
        fetchSiteConfigMock.mockResolvedValue({analytics: null})
        const response = await GET(request(authed))
        expect(response.status).toBe(404)
        expect(await response.json()).toMatchObject({code: 'ANALYTICS_NOT_CONFIGURED'})
    })

    it('returns 503 when the API key is missing', async () => {
        vi.stubEnv('UMAMI_API_KEY', '')
        const response = await GET(request(authed))
        expect(response.status).toBe(503)
        expect(await response.json()).toMatchObject({code: 'UMAMI_API_KEY_MISSING'})
    })

    it('proxies stats and pageviews with the server-side key', async () => {
        const fetchMock = vi.fn()
        fetchMock
            .mockResolvedValueOnce(
                new Response(JSON.stringify(upstreamStats()), {status: 200}),
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify(upstreamPageviews()), {status: 200}),
            )
        vi.stubGlobal('fetch', fetchMock)

        const response = await GET(request(authed))
        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.data.range).toBe('30d')
        expect(body.data.stats).toMatchObject({visitors: 40, pageviews: 100})
        expect(body.data.pageviews).toMatchObject({
            pageviews: [{x: '2026-08-01T00:00:00Z', y: 5}],
        })
        expect(response.headers.get('Cache-Control')).toContain('max-age=300')

        const [statsUrl, statsInit] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(
            statsUrl.startsWith('https://umami.example.com/api/websites/website-1/stats?'),
        ).toBe(true)
        expect((statsInit.headers as Record<string, string>)['x-umami-api-key']).toBe(
            'secret-key',
        )
        const [pageviewsUrl] = fetchMock.mock.calls[1] as [string, RequestInit]
        expect(pageviewsUrl).toContain('/api/websites/website-1/pageviews?')
        expect(pageviewsUrl).toContain('unit=day')
    })

    it('maps upstream auth failures to 502 without leaking details', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(new Response('forbidden', {status: 403})),
        )
        const response = await GET(request(authed))
        expect(response.status).toBe(502)
        expect(await response.json()).toMatchObject({code: 'UMAMI_UNAUTHORIZED'})
    })

    it('rejects unknown ranges', async () => {
        const response = await GET(
            request(authed, 'https://studio.test/api/umami/stats?range=1h'),
        )
        expect(response.status).toBe(400)
    })
})
