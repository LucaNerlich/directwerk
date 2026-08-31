import 'server-only'

// Allow '.' so segments like `podcast.xml` or `my-show.xml` are valid.
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9_.-]+$/
const UPSTREAM_TIMEOUT_MS = 10_000

function getApiOrigin(): URL | null {
    const configured = process.env.DIRECTWERK_API_URL
    if (configured === undefined || configured.length === 0) {
        return null
    }

    try {
        const apiUrl = new URL(configured)
        const isLoopback =
            apiUrl.hostname === 'localhost' ||
            apiUrl.hostname === '127.0.0.1' ||
            apiUrl.hostname === '[::1]'
        const usesAllowedProtocol =
            apiUrl.protocol === 'https:' || (apiUrl.protocol === 'http:' && isLoopback)
        return usesAllowedProtocol ? apiUrl : null
    } catch {
        return null
    }
}

function isSafeSegment(segment: string): boolean {
    return segment !== '.' && segment !== '..' && SAFE_PATH_SEGMENT.test(segment)
}

function buildFeedPath(tenantSlug: string, segments: string[]): string | null {
    if (!isSafeSegment(tenantSlug)) {
        return null
    }
    if (segments.length === 0 || segments.some((segment) => !isSafeSegment(segment))) {
        return null
    }
    return `/feeds/${tenantSlug}/${segments.join('/')}`
}

/**
 * Same-origin relay for the backend's public RSS/enclosure redirects under `/feeds/**`.
 * The backend resolves the tenant from `X-Tenant-Host`; the actual feed/audio content is a
 * 302 to CDN, so this only ever needs to forward the status + Location, never a body.
 */
export async function fetchTenantFeed(
    tenantSlug: string,
    segments: string[],
    tenantHost: string,
): Promise<Response> {
    const apiOrigin = getApiOrigin()
    if (apiOrigin === null) {
        return new Response(null, {status: 502})
    }

    const feedPath = buildFeedPath(tenantSlug, segments)
    if (feedPath === null) {
        return new Response(null, {status: 404})
    }

    const targetUrl = new URL(feedPath, apiOrigin)

    let upstreamResponse: Response
    try {
        upstreamResponse = await fetch(targetUrl, {
            method: 'GET',
            redirect: 'manual',
            headers: {'X-Tenant-Host': tenantHost},
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        })
    } catch {
        return new Response(null, {status: 502})
    }

    const location = upstreamResponse.headers.get('location')
    return new Response(null, {
        status: upstreamResponse.status,
        headers: {
            'Cache-Control': 'no-store',
            ...(location === null ? {} : {Location: location}),
        },
    })
}
