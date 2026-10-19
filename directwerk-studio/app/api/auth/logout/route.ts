import {createLogoutRoute, createTenantRefreshTokenRevoker} from '@directwerk/api/server'

import {directwerkFetch, REFRESH_COOKIE} from '@/lib/server/api'

/**
 * Clears the httpOnly refresh cookie and best-effort revokes the refresh token
 * server-side so a logged-out creator cannot be silently re-authenticated.
 */
export const POST = createLogoutRoute({
    clearCookies: [REFRESH_COOKIE],
    revoke: [createTenantRefreshTokenRevoker({directwerkFetch, refreshCookie: REFRESH_COOKIE})],
})
