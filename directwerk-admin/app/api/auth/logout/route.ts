import {readRequestCookie} from '@directwerk/api/auth/cookies'
import {createLogoutRoute} from '@directwerk/api/server'

import {
    PLATFORM_REFRESH_COOKIE,
    TENANT_HOST_COOKIE,
    TENANT_REFRESH_COOKIE,
    revokePlatformRefreshToken,
    revokeTenantRefreshToken,
} from '@/lib/server/api'

/**
 * Clears httpOnly refresh cookies and best-effort revokes upstream refresh
 * tokens so a logged-out admin cannot be silently re-authenticated. Issue #435:
 * the same-origin guard lives in the shared factory now.
 */
export const POST = createLogoutRoute({
    clearCookies: [PLATFORM_REFRESH_COOKIE, TENANT_REFRESH_COOKIE, TENANT_HOST_COOKIE],
    guardSameOrigin: true,
    revoke: [
        async (request) => {
            const platformRefresh = readRequestCookie(request, PLATFORM_REFRESH_COOKIE)
            if (platformRefresh !== null) {
                await revokePlatformRefreshToken(platformRefresh)
            }
        },
        async (request) => {
            const tenantRefresh = readRequestCookie(request, TENANT_REFRESH_COOKIE)
            const tenantHost = readRequestCookie(request, TENANT_HOST_COOKIE)
            if (tenantRefresh !== null && tenantHost !== null) {
                await revokeTenantRefreshToken(tenantRefresh, tenantHost)
            }
        },
    ],
})
