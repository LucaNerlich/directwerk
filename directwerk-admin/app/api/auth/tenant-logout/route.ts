import {readRequestCookie} from '@directwerk/api/auth/cookies'
import {createLogoutRoute} from '@directwerk/api/server'

import {TENANT_HOST_COOKIE, TENANT_REFRESH_COOKIE, revokeTenantRefreshToken} from '@/lib/server/api'

/**
 * Ends only the tenant session (the platform session stays signed in).
 * "Clear session" in the tenant panel used to drop sessionStorage but leave the
 * httpOnly tenant refresh cookie valid, so /api/auth/tenant-refresh could mint a
 * fresh tenant token while the UI said the session was cleared.
 */
export const POST = createLogoutRoute({
    clearCookies: [TENANT_REFRESH_COOKIE, TENANT_HOST_COOKIE],
    guardSameOrigin: true,
    revoke: [
        async (request) => {
            const tenantRefresh = readRequestCookie(request, TENANT_REFRESH_COOKIE)
            const tenantHost = readRequestCookie(request, TENANT_HOST_COOKIE)
            if (tenantRefresh !== null && tenantHost !== null) {
                await revokeTenantRefreshToken(tenantRefresh, tenantHost)
            }
        },
    ],
})
