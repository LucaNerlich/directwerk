import {safeUpstreamResponse} from '@directwerk/api/server'
import {requestTenantRefresh} from '@/lib/server/api'
import {parseTenantHost} from '@directwerk/api/proxy'
import {TENANT_REFRESH_COOKIE} from '@/lib/server/api'
import {readRequestCookie, sealRefreshToken} from '@directwerk/api/auth/cookies'

export async function POST(request: Request): Promise<Response> {
    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        return Response.json(
            {error: 'A valid tenant host is required.'},
            {status: 400}
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
