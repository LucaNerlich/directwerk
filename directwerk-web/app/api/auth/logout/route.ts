import {directwerkFetch, getOAuthClientId} from '@/lib/directwerk'
import {parseTenantHost} from '@/lib/tenant/parseTenantHost'
import {jsonError} from '@/lib/api/upstream'
import {REFRESH_COOKIE, readRequestCookie, serializeClearCookie} from '@/lib/auth/cookies'

export async function POST(request: Request): Promise<Response> {
    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        return jsonError('A valid tenant is required.', 400)
    }

    const refreshToken = readRequestCookie(request, REFRESH_COOKIE)

    // Best-effort server-side revocation: a logged-out refresh token must not
    // remain valid upstream until its natural expiry. Failures are non-fatal —
    // the local logout always completes.
    if (refreshToken !== null) {
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

    const headers = new Headers({'Cache-Control': 'no-store', 'Pragma': 'no-cache'})
    headers.append('Set-Cookie', serializeClearCookie(REFRESH_COOKIE))
    return new Response(null, {status: 204, headers})
}
