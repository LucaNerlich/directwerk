import {parseTenantHost, readBearerToken} from '@directwerk/api/proxy'
import {jsonError} from '@directwerk/api/proxy'

import {fetchSiteConfigServerOptional} from '@/lib/site/fetchSiteConfigServer'

const UPSTREAM_TIMEOUT_MS = 8_000
const MAX_WEBSITE_ID_LENGTH = 64

const RANGES = {
    '7d': {days: 7, unit: 'day'},
    '30d': {days: 30, unit: 'day'},
    '12m': {days: 365, unit: 'month'},
} as const

export type UmamiRangeKey = keyof typeof RANGES

function isAllowedApiBase(value: string): boolean {
    let url: URL
    try {
        url = new URL(value)
    } catch {
        return false
    }
    if (url.username.length > 0 || url.password.length > 0) {
        return false
    }
    if (url.search.length > 0 || url.hash.length > 0) {
        return false
    }
    if (url.pathname.length > 0 && url.pathname !== '/') {
        return false
    }
    const isLoopback =
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '[::1]'
    return url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback)
}

function isValidWebsiteId(value: string): boolean {
    const trimmed = value.trim()
    return trimmed.length > 0 && trimmed.length <= MAX_WEBSITE_ID_LENGTH
}

function isStatsPayload(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) {
        return false
    }
    const record = value as Record<string, unknown>
    return (
        typeof record.pageviews === 'number' &&
        typeof record.visitors === 'number' &&
        typeof record.visits === 'number' &&
        typeof record.bounces === 'number'
    )
}

/**
 * Studio BFF proxy for Umami website statistics (issue #191).
 *
 * The Umami read API needs an API key the browser must never see, so the
 * key stays in the server-only `UMAMI_API_KEY` env var and this route calls
 * Umami server-to-server. Tenant and website are not client-controlled: they
 * resolve from the studio site-config, so callers cannot pivot this route
 * into an open proxy. An optional `UMAMI_API_BASE_URL` overrides the API
 * base (needed for Umami Cloud, whose API lives on a separate host).
 */
export async function GET(request: Request): Promise<Response> {
    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        return jsonError('A valid tenant is required.', 400)
    }

    if (readBearerToken(request.headers.get('authorization')) === null) {
        return jsonError('A valid bearer token is required.', 401)
    }

    const url = new URL(request.url)
    const rangeParam = url.searchParams.get('range') ?? '30d'
    const range = Object.hasOwn(RANGES, rangeParam)
        ? (rangeParam as UmamiRangeKey)
        : null
    if (range === null) {
        return jsonError('Unknown range. Use 7d, 30d or 12m.', 400)
    }

    const config = await fetchSiteConfigServerOptional(tenantHost).catch(() => null)
    const analytics = config?.analytics ?? null
    if (analytics === null || !isValidWebsiteId(analytics.umamiWebsiteId)) {
        return jsonError('Umami is not configured for this tenant.', 404, 'ANALYTICS_NOT_CONFIGURED')
    }

    const apiKey = (process.env.UMAMI_API_KEY ?? '').trim()
    if (apiKey.length === 0) {
        return jsonError(
            'Umami API key is missing. Set UMAMI_API_KEY on the studio server.',
            503,
            'UMAMI_API_KEY_MISSING',
        )
    }

    const baseOverride = (process.env.UMAMI_API_BASE_URL ?? '').trim()
    const apiBase = baseOverride.length > 0 ? baseOverride : analytics.umamiHostUrl
    if (!isAllowedApiBase(apiBase)) {
        return jsonError('The configured Umami host is invalid.', 502, 'UMAMI_HOST_INVALID')
    }
    const base = apiBase.replace(/\/+$/, '')
    const websiteId = analytics.umamiWebsiteId.trim()

    const endAt = Date.now()
    const startAt = endAt - RANGES[range].days * 24 * 60 * 60 * 1_000
    const query = new URLSearchParams({
        startAt: String(startAt),
        endAt: String(endAt),
    })
    const headers = {
        Accept: 'application/json',
        'x-umami-api-key': apiKey,
    }

    let statsResponse: Response
    let pageviewsResponse: Response
    try {
        ;[statsResponse, pageviewsResponse] = await Promise.all([
            fetch(
                `${base}/api/websites/${encodeURIComponent(websiteId)}/stats?${query}`,
                {headers, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)},
            ),
            fetch(
                `${base}/api/websites/${encodeURIComponent(websiteId)}/pageviews?${query}&unit=${RANGES[range].unit}&timezone=UTC`,
                {headers, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)},
            ),
        ])
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'TimeoutError') {
            return jsonError('Umami request timed out.', 504)
        }
        return jsonError('Umami is unavailable.', 502)
    }

    if (statsResponse.status === 401 || statsResponse.status === 403) {
        return jsonError(
            'Umami rejected the API key or website access.',
            502,
            'UMAMI_UNAUTHORIZED',
        )
    }
    if (statsResponse.status === 404 || pageviewsResponse.status === 404) {
        return jsonError('Umami website not found.', 502, 'UMAMI_WEBSITE_NOT_FOUND')
    }
    if (!statsResponse.ok || !pageviewsResponse.ok) {
        return jsonError('Umami returned an error.', 502)
    }

    let stats: unknown
    let pageviews: unknown
    try {
        ;[stats, pageviews] = await Promise.all([
            statsResponse.json(),
            pageviewsResponse.json(),
        ])
    } catch {
        return jsonError('Umami returned an invalid response.', 502)
    }
    if (!isStatsPayload(stats) || typeof pageviews !== 'object' || pageviews === null) {
        return jsonError('Umami returned an invalid response.', 502)
    }

    return Response.json(
        {data: {range, startAt, endAt, stats, pageviews}},
        {headers: {'Cache-Control': 'private, max-age=300'}},
    )
}
