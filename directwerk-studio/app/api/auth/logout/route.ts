import {REFRESH_COOKIE} from '@/lib/server/api'
import {serializeClearCookie} from '@directwerk/api/auth/cookies'

/**
 * Clears the httpOnly refresh cookie so a logged-out creator cannot be silently
 * re-authenticated by the persisted refresh token.
 */
export async function POST(): Promise<Response> {
    return new Response(null, {
        status: 204,
        headers: {'Set-Cookie': serializeClearCookie(REFRESH_COOKIE)},
    })
}
