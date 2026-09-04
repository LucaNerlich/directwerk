import 'server-only'

import {parseTenantHost} from '@directwerk/api/proxy'

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
 * Only forward upstream redirect targets that are same-origin paths or
 * https (loopback http for local dev). Anything else is dropped so a
 * compromised upstream cannot turn the same-origin relay into an open
 * redirector.
 */
function isSafeRedirectTarget(location: string): boolean {
    if (location.startsWith('/') && !location.startsWith('//')) {
        return true
    }
    try {
        const parsed = new URL(location)
        if (parsed.protocol === 'https:') {
            return true
        }
        if (parsed.protocol === 'http:') {
            const hostname = parsed.hostname.trim().toLowerCase()
            return (
                hostname === 'localhost' ||
                hostname === '127.0.0.1' ||
                hostname === '[::1]' ||
                hostname.endsWith('.localhost')
            )
        }
        return false
    } catch {
        return false
    }
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
    // The route passes the raw Host header; normalize + validate so header
    // injection (ports, casing, garbage) never reaches the upstream request.
    const normalizedHost = parseTenantHost(tenantHost)
    if (normalizedHost === null) {
        return new Response(null, {status: 400})
    }

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
            headers: {'X-Tenant-Host': normalizedHost},
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        })
    } catch {
        return new Response(null, {status: 502})
    }

    const location = upstreamResponse.headers.get('location')
    const safeLocation =
        location !== null && isSafeRedirectTarget(location) ? location : null
    return new Response(null, {
        status: upstreamResponse.status,
        headers: {
            'Cache-Control': 'no-store',
            ...(safeLocation === null ? {} : {Location: safeLocation}),
        },
    })
}
