'use client'

import {createAuthSession} from '@directwerk/api/auth/session'
import {parseTokenResponse} from '@directwerk/api/validation'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {getRefreshToken, tokenStore} from '@/lib/auth/tokenStore'

/**
 * Web refresh/session coordinator — shared algorithm with per-app refresh
 * headers (`X-Tenant-Host`) and the legacy sessionStorage refresh-token
 * migration fallback in the body.
 */
const session = createAuthSession({
    store: tokenStore,
    refreshPath: '/api/auth/refresh',
    refreshHeaders: () => ({'X-Tenant-Host': getClientTenantHost()}),
    // The httpOnly refresh cookie is preferred by the BFF; a legacy
    // sessionStorage token is only sent as a migration fallback.
    refreshBody: () => {
        const legacy = getRefreshToken()
        return legacy === null ? '{}' : JSON.stringify({refresh_token: legacy})
    },
    parseTokens: parseTokenResponse,
})

export const getValidAccessToken = session.getValidAccessToken
export const refreshAccessToken = session.refreshAccessToken

export async function ensureAuthenticated(): Promise<string> {
    return getValidAccessToken()
}
