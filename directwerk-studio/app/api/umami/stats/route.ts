import {parseTenantHost, readBearerToken} from '@directwerk/api/proxy'
import {jsonError} from '@directwerk/api/proxy'
import {isAllowedOrigin} from '@directwerk/api/server/originGuard'

import {fetchSiteConfigServerOptional} from '@/lib/site/fetchSiteConfigServer'

const UPSTREAM_TIMEOUT_MS = 8_000
const MAX_WEBSITE_ID_LENGTH = 64

const RANGES = {
    '7d': {days: 7, unit: 'day'},
    '30d': {days: 30, unit: 'day'},
    '12m': {days: 365, unit: 'month'},
} as const

type UmamiRangeKey = keyof typeof RANGES

function isAllowedApiBase(value: string): boolean {
    try {
        return isAllowedOrigin(new URL(value))
    } catch {
        return false
    }
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

/** Short-lived cache for the self-hosted login token (best-effort per worker). */
let cachedToken: {token: string; obtainedAt: number} | null = null
const TOKEN_TTL_MS = 15 * 60 * 1_000

export function __resetUmamiTokenCacheForTests(): void {
    cachedToken = null
}

async function login(base: string, username: string, password: string): Promise<string | null> {
    let response: Response
    try {
        response = await fetch(`${base}/api/auth/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', Accept: 'application/json'},
            body: JSON.stringify({username, password}),
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        })
    } catch {
        return null
    }
    if (!response.ok) {
        return null
    }
    let payload: unknown
    try {
        payload = await response.json()
    } catch {
        return null
    }
    if (typeof payload !== 'object' || payload === null) {
        return null
    }
    const token = (payload as Record<string, unknown>).token
    return typeof token === 'string' && token.length > 0 ? token : null
}

/**
 * Resolves the auth headers for Umami API calls via username/password login;
 * the token is cached briefly and refreshed on auth failures. Credentials stay
 * server-side and are never logged or sent to the browser.
 */
async function resolveAuthHeaders(
    base: string,
    forceRelogin: boolean,
): Promise<Record<string, string> | null> {
    const username = (process.env.UMAMI_USERNAME ?? '').trim()
    const password = process.env.UMAMI_PASSWORD ?? ''
    if (username.length === 0 || password.length === 0) {
        return null
    }
    if (
        !forceRelogin &&
        cachedToken !== null &&
        Date.now() - cachedToken.obtainedAt < TOKEN_TTL_MS
    ) {
        return {Accept: 'application/json', Authorization: `Bearer ${cachedToken.token}`}
    }
    const token = await login(base, username, password)
    if (token === null) {
        cachedToken = null
        return null
    }
    cachedToken = {token, obtainedAt: Date.now()}
    return {Accept: 'application/json', Authorization: `Bearer ${token}`}
}

/**
 * Studio BFF proxy for Umami website statistics (issue #191).
 *
 * The Umami read API needs credentials the browser must never see, so they
 * stay in the server-only `UMAMI_USERNAME`/`UMAMI_PASSWORD` env vars: this
 * route logs in (`POST /api/auth/login`) server-to-server and calls the API
 * with the resulting Bearer token, which is cached briefly. Tenant and
 * website are not client-controlled: they resolve from the studio
 * site-config, so callers cannot pivot this route into an open proxy. An
 * optional `UMAMI_API_BASE_URL` overrides the API base when the credentials
 * belong to a different host than the tenant's configured Umami host.
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

    const baseOverride = (process.env.UMAMI_API_BASE_URL ?? '').trim()
    const apiBase = baseOverride.length > 0 ? baseOverride : analytics.umamiHostUrl
    if (!isAllowedApiBase(apiBase)) {
        return jsonError('The configured Umami host is invalid.', 502, 'UMAMI_HOST_INVALID')
    }
    const base = apiBase.replace(/\/+$/, '')
    const websiteId = analytics.umamiWebsiteId.trim()

    let authHeaders = await resolveAuthHeaders(base, false)
    if (authHeaders === null) {
        const loginFailed =
            (process.env.UMAMI_USERNAME ?? '').trim().length > 0 &&
            (process.env.UMAMI_PASSWORD ?? '').length > 0
        return loginFailed
            ? jsonError('Umami login failed.', 502, 'UMAMI_UNAUTHORIZED')
            : jsonError(
                  'Umami credentials are missing. Set UMAMI_USERNAME and UMAMI_PASSWORD on the studio server.',
                  503,
                  'UMAMI_CREDENTIALS_MISSING',
              )
    }

    const endAt = Date.now()
    const startAt = endAt - RANGES[range].days * 24 * 60 * 60 * 1_000
    const unit = RANGES[range].unit
    const query = new URLSearchParams({
        startAt: String(startAt),
        endAt: String(endAt),
    })

    async function fetchStats(
        headers: Record<string, string>,
    ): Promise<[Response, Response]> {
        return Promise.all([
            fetch(
                `${base}/api/websites/${encodeURIComponent(websiteId)}/stats?${query}`,
                {headers, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)},
            ),
            fetch(
                `${base}/api/websites/${encodeURIComponent(websiteId)}/pageviews?${query}&unit=${unit}&timezone=UTC`,
                {headers, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)},
            ),
        ])
    }

    let statsResponse: Response
    let pageviewsResponse: Response
    try {
        ;[statsResponse, pageviewsResponse] = await fetchStats(authHeaders)
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'TimeoutError') {
            return jsonError('Umami request timed out.', 504)
        }
        return jsonError('Umami is unavailable.', 502)
    }

    if (statsResponse.status === 401 || statsResponse.status === 403) {
        // Token may have expired: log in once more and retry before giving up.
        const refreshed = await resolveAuthHeaders(base, true)
        if (refreshed !== null) {
            authHeaders = refreshed
            try {
                ;[statsResponse, pageviewsResponse] = await fetchStats(authHeaders)
            } catch (error: unknown) {
                if (error instanceof Error && error.name === 'TimeoutError') {
                    return jsonError('Umami request timed out.', 504)
                }
                return jsonError('Umami is unavailable.', 502)
            }
        }
    }

    if (statsResponse.status === 401 || statsResponse.status === 403) {
        return jsonError(
            'Umami rejected the credentials or website access.',
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
