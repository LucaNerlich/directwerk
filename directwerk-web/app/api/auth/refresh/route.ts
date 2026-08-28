import {directwerkFetch, getOAuthClientId} from '@/lib/server/api'
import {parseTenantHost} from '@directwerk/api/proxy'
import {jsonError, toClientResponse} from '@directwerk/api/proxy'
import {REFRESH_COOKIE} from '@/lib/server/api'
import {readRequestCookie, sealRefreshToken} from '@directwerk/api/auth/cookies'

export async function POST(request: Request): Promise<Response> {
    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        return jsonError('A valid tenant is required.', 400)
    }

    const refreshToken = readRequestCookie(request, REFRESH_COOKIE)
    if (refreshToken === null) {
        return jsonError('A valid refresh token is required.', 401)
    }

    try {
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: getOAuthClientId(),
        })
        const response = await directwerkFetch({
            path: '/oauth2/token',
            tenantHost,
            method: 'POST',
            body: body.toString(),
            contentType: 'application/x-www-form-urlencoded',
            useOAuthClient: true,
        })

        return sealRefreshToken(await toClientResponse(response), REFRESH_COOKIE)
    } catch {
        return jsonError('The upstream service is unavailable.', 502)
    }
}
