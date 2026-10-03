import {
    PLATFORM_REFRESH_COOKIE,
    TENANT_HOST_COOKIE,
    TENANT_REFRESH_COOKIE,
    revokePlatformRefreshToken,
    revokeTenantRefreshToken,
} from '@/lib/server/api'
import {readRequestCookie, serializeClearCookie} from '@directwerk/api/auth/cookies'

/**
 * Clears httpOnly refresh cookies and best-effort revokes upstream refresh
 * tokens so a logged-out admin cannot be silently re-authenticated.
 */
export async function POST(request: Request): Promise<Response> {
    const platformRefresh = readRequestCookie(request, PLATFORM_REFRESH_COOKIE)
    const tenantRefresh = readRequestCookie(request, TENANT_REFRESH_COOKIE)
    const tenantHost = readRequestCookie(request, TENANT_HOST_COOKIE)

    if (platformRefresh !== null) {
        try {
            await revokePlatformRefreshToken(platformRefresh)
        } catch {
            // Ignore upstream failures; clear the local session regardless.
        }
    }

    if (tenantRefresh !== null && tenantHost !== null) {
        try {
            await revokeTenantRefreshToken(tenantRefresh, tenantHost)
        } catch {
            // Ignore upstream failures; clear the local session regardless.
        }
    }

    const headers = new Headers({'Cache-Control': 'no-store', Pragma: 'no-cache'})
    headers.append('Set-Cookie', serializeClearCookie(PLATFORM_REFRESH_COOKIE))
    headers.append('Set-Cookie', serializeClearCookie(TENANT_REFRESH_COOKIE))
    headers.append('Set-Cookie', serializeClearCookie(TENANT_HOST_COOKIE))
    return new Response(null, {status: 204, headers})
}
