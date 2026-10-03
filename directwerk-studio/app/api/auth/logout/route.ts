import {directwerkFetch, REFRESH_COOKIE} from '@/lib/server/api'
import {parseTenantHost} from '@directwerk/api/proxy'
import {readRequestCookie, serializeClearCookie} from '@directwerk/api/auth/cookies'

/**
 * Clears the httpOnly refresh cookie and best-effort revokes the refresh token
 * server-side so a logged-out creator cannot be silently re-authenticated.
 */
export async function POST(request: Request): Promise<Response> {
    const refreshToken = readRequestCookie(request, REFRESH_COOKIE)
    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))

    // Best-effort server-side revocation: a logged-out refresh token must not
    // remain valid upstream until its natural expiry. Failures are non-fatal —
    // the local logout always completes. Tenant host is required for upstream
    // Host routing; without it we still clear the cookie.
    if (refreshToken !== null && tenantHost !== null) {
        try {
            const body = new URLSearchParams({
                token: refreshToken,
                token_type_hint: 'refresh_token',
            })
            await directwerkFetch({
                path: '/oauth2/revoke',
                tenantHost,
                method: 'POST',
                body: body.toString(),
                contentType: 'application/x-www-form-urlencoded',
                useOAuthClient: true,
            })
        } catch {
            // Ignore upstream failures; clear the local session regardless.
        }
    }

    return new Response(null, {
        status: 204,
        headers: {
            'Cache-Control': 'no-store',
            Pragma: 'no-cache',
            'Set-Cookie': serializeClearCookie(REFRESH_COOKIE),
        },
    })
}
