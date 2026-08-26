import {directwerkFetch, getOAuthClientId} from '@/lib/server/api'
import {parseTenantHost} from '@directwerk/api/proxy'
import {jsonError, toClientResponse} from '@directwerk/api/proxy'
import {readBoundedBody} from '@directwerk/api/proxy'
import {parseJsonText, parseRefreshTokenInput} from '@directwerk/api/validation'
import {REFRESH_COOKIE} from '@/lib/server/api'
import {readRequestCookie, sealRefreshToken} from '@directwerk/api/auth/cookies'

export async function POST(request: Request): Promise<Response> {
    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        return jsonError('A valid tenant is required.', 400)
    }

    // Prefer the httpOnly refresh cookie set by login/refresh; the JSON body is
    // only a fallback for clients that logged in before cookie-based refresh.
    let refreshToken = readRequestCookie(request, REFRESH_COOKIE)

    if (refreshToken === null) {
        const bodyText = await readBoundedBody(request.body)
        if (bodyText === null) {
            return jsonError('The request body is invalid.', 400)
        }

        // Web variant: trimmed token, 512-char cap (legacy migration fallback).
        const input = parseRefreshTokenInput(parseJsonText(bodyText), {maxLength: 512, trim: true})
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

        // toClientResponse already marks every proxied response no-store.
        return sealRefreshToken(await toClientResponse(response), REFRESH_COOKIE)
    } catch {
        return jsonError('The upstream service is unavailable.', 502)
    }
}
