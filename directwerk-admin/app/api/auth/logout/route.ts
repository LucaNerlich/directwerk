import {PLATFORM_REFRESH_COOKIE, TENANT_HOST_COOKIE, TENANT_REFRESH_COOKIE} from '@/lib/server/api'
import {serializeClearCookie} from '@directwerk/api/auth/cookies'

/**
 * Clears the httpOnly refresh cookies so a logged-out admin cannot be silently
 * re-authenticated by the persisted refresh token.
 */
export async function POST(): Promise<Response> {
    const headers = new Headers()
    headers.append('Set-Cookie', serializeClearCookie(PLATFORM_REFRESH_COOKIE))
    headers.append('Set-Cookie', serializeClearCookie(TENANT_REFRESH_COOKIE))
    headers.append('Set-Cookie', serializeClearCookie(TENANT_HOST_COOKIE))
    return new Response(null, {status: 204, headers})
}
