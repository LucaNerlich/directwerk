import {safeUpstreamResponse} from '@directwerk/api/server'
import {requestTenantRefresh} from '@/lib/server/api'
import {parseTenantHost} from '@directwerk/api/proxy'
import {TENANT_HOST_COOKIE, TENANT_REFRESH_COOKIE} from '@/lib/server/api'
import {readRequestCookie, sealRefreshToken} from '@directwerk/api/auth/cookies'
import {resolvePlatformAuthorization} from '@/lib/server/platform'

export async function POST(request: Request): Promise<Response> {
    // Tenant refresh requires a live platform admin session so a stolen
    // tenant refresh token does not outlive platform logout/expiry.
    const platform = await resolvePlatformAuthorization()
    if (!platform.ok) {
        return Response.json(
            {error: 'A platform admin session is required.'},
            {status: platform.status}
        )
    }

    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        return Response.json(
            {error: 'A valid tenant host is required.'},
            {status: 400}
        )
    }

    // Replay-scope binding: the refresh cookie was issued for the login host.
    const boundHost = readRequestCookie(request, TENANT_HOST_COOKIE)
    if (boundHost !== null && boundHost !== tenantHost) {
        return Response.json(
            {error: 'Tenant session does not match this host.'},
            {status: 401}
        )
    }

    const refreshToken = readRequestCookie(request, TENANT_REFRESH_COOKIE)
    if (!refreshToken) {
        return Response.json(
            {error: 'A valid refresh token is required.'},
            {status: 401}
        )
    }

    try {
        const upstream = await requestTenantRefresh(refreshToken, tenantHost)
        const sealed = await sealRefreshToken(
            await safeUpstreamResponse(upstream),
            TENANT_REFRESH_COOKIE
        )
        const headers = new Headers(sealed.headers)
        headers.set('Cache-Control', 'no-store')
        headers.set('Pragma', 'no-cache')
        return new Response(sealed.body, {
            status: sealed.status,
            statusText: sealed.statusText,
            headers,
        })
    } catch {
        return Response.json(
            {error: 'Authentication service is unavailable.'},
            {status: 502}
        )
    }
}
