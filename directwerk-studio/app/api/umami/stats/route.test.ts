import {createServer, type Server} from 'node:http'
import type {AddressInfo} from 'node:net'

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {GET, __resetUmamiTokenCacheForTests} from '@/app/api/umami/stats/route'

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

async function listen(server: Server): Promise<string> {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as AddressInfo
    return `http://127.0.0.1:${address.port}`
}

async function close(server: Server): Promise<void> {
    await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
    )
}

beforeEach(() => {
    vi.stubEnv('UMAMI_USERNAME', 'umami-user')
    vi.stubEnv('UMAMI_PASSWORD', 'umami-pass')
    vi.stubEnv('UMAMI_API_BASE_URL', '')
    __resetUmamiTokenCacheForTests()
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

    it('returns 503 when the credentials are missing', async () => {
        vi.stubEnv('UMAMI_USERNAME', '')
        vi.stubEnv('UMAMI_PASSWORD', '')
        const response = await GET(request(authed))
        expect(response.status).toBe(503)
        expect(await response.json()).toMatchObject({code: 'UMAMI_CREDENTIALS_MISSING'})
    })

    it('proxies stats and pageviews with the login token', async () => {
        const fetchMock = vi.fn()
        fetchMock
            .mockResolvedValueOnce(
                new Response(JSON.stringify({token: 'login-token'}), {status: 200}),
            )
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

        const [loginUrl, loginInit] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(loginUrl).toBe('https://umami.example.com/api/auth/login')
        expect(JSON.parse(loginInit.body as string)).toEqual({
            username: 'umami-user',
            password: 'umami-pass',
        })
        const [, statsInit] = fetchMock.mock.calls[1] as [string, RequestInit]
        expect((statsInit.headers as Record<string, string>).Authorization).toBe(
            'Bearer login-token',
        )
        const [pageviewsUrl] = fetchMock.mock.calls[2] as [string, RequestInit]
        expect(pageviewsUrl).toContain('/api/websites/website-1/pageviews?')
        expect(pageviewsUrl).toContain('unit=day')
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('does not send login credentials to a redirect target', async () => {
        const redirectedBodies: string[] = []
        const redirectTarget = createServer((request, response) => {
            let body = ''
            request.setEncoding('utf8')
            request.on('data', (chunk: string) => {
                body += chunk
            })
            request.on('end', () => {
                redirectedBodies.push(body)
                response.end(JSON.stringify({token: 'redirected-token'}))
            })
        })
        const redirectTargetBase = await listen(redirectTarget)
        const umamiServer = createServer((_request, response) => {
            response.writeHead(307, {
                Location: `${redirectTargetBase}/api/auth/login`,
            })
            response.end()
        })
        const umamiBase = await listen(umamiServer)
        fetchSiteConfigMock.mockResolvedValue({
            analytics: {
                ...analyticsConfig().analytics,
                umamiHostUrl: umamiBase,
            },
        })

        try {
            const response = await GET(request(authed))

            expect(response.status).toBe(502)
            expect(await response.json()).toMatchObject({code: 'UMAMI_UNAUTHORIZED'})
            expect(redirectedBodies).toEqual([])
        } finally {
            await Promise.all([close(umamiServer), close(redirectTarget)])
        }
    })

    it('re-logs in once when the token expired', async () => {
        const fetchMock = vi.fn()
        fetchMock
            .mockResolvedValueOnce(
                new Response(JSON.stringify({token: 'stale-token'}), {status: 200}),
            )
            .mockResolvedValueOnce(new Response('expired', {status: 401}))
            .mockResolvedValueOnce(new Response('expired', {status: 401}))
            .mockResolvedValueOnce(
                new Response(JSON.stringify({token: 'fresh-token'}), {status: 200}),
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify(upstreamStats()), {status: 200}),
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify(upstreamPageviews()), {status: 200}),
            )
        vi.stubGlobal('fetch', fetchMock)

        const response = await GET(request(authed))
        expect(response.status).toBe(200)
        expect((await response.json()).data.stats).toMatchObject({visitors: 40})
        const loginCalls = fetchMock.mock.calls.filter(
            ([calledUrl]) =>
                (calledUrl as string) === 'https://umami.example.com/api/auth/login',
        )
        expect(loginCalls).toHaveLength(2)
        const lastStatsInit = fetchMock.mock.calls[4]?.[1] as RequestInit
        expect(
            (lastStatsInit.headers as Record<string, string>).Authorization,
        ).toBe('Bearer fresh-token')
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
