import {createLogoutRoute, createTenantRefreshTokenRevoker} from '@directwerk/api/server'

import {directwerkFetch, REFRESH_COOKIE} from '@/lib/server/api'

/**
 * Clears the httpOnly refresh cookie and best-effort revokes the refresh token
 * server-side so a logged-out subscriber cannot be silently re-authenticated.
 * A valid tenant host is required because the upstream revoke is Host-routed.
 */
export const POST = createLogoutRoute({
    clearCookies: [REFRESH_COOKIE],
    requireTenantHost: true,
    revoke: [createTenantRefreshTokenRevoker({directwerkFetch, refreshCookie: REFRESH_COOKIE})],
})
