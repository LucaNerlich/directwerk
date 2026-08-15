import {directwerkFetch, getOAuthClientId} from '@/lib/directwerk'
import {parseTenantHost} from '@/lib/tenant/parseTenantHost'
import {jsonError, toClientResponse} from '@/lib/api/upstream'
import {parseJsonText, parseRefreshTokenInput, readBoundedBody} from '@/lib/api/validation'
import {REFRESH_COOKIE, readRequestCookie, sealRefreshToken} from '@/lib/auth/cookies'

export async function POST(request: Request): Promise<Response> {
    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        return jsonError('A valid tenant is required.', 400)
    }

    // Prefer the httpOnly refresh cookie set by login/refresh; the JSON body is
    // only a fallback for clients that predate cookie-based refresh.
    let refreshToken = readRequestCookie(request, REFRESH_COOKIE)

    if (refreshToken === null) {
        const bodyText = await readBoundedBody(request.body)
        if (bodyText === null) {
            return jsonError('The request body is invalid.', 400)
        }

        const input = parseRefreshTokenInput(parseJsonText(bodyText))
        if (input === null) {
            return jsonError('A valid refresh token is required.', 400)
        }
        refreshToken = input.refresh_token
    }

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

        const clientResponse = await sealRefreshToken(
            await toClientResponse(response),
            REFRESH_COOKIE,
        )
        clientResponse.headers.set('Cache-Control', 'no-store')
        clientResponse.headers.set('Pragma', 'no-cache')
        return clientResponse
    } catch {
        return jsonError('The upstream service is unavailable.', 502)
    }
}
