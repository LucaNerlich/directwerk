'use client'

import {createAuthSession} from '@directwerk/api/auth/session'
import {parseTokenResponse} from '@directwerk/api/validation/token'

import {getClientTenantHost} from '@directwerk/api/tenant'
import {tokenStore} from '@/lib/auth/tokenStore'

/**
 * Studio refresh/session coordinator — shared algorithm with a per-app
 * refresh endpoint header (`X-Tenant-Host`).
 */
const session = createAuthSession({
    store: tokenStore,
    refreshPath: '/api/auth/refresh',
    refreshHeaders: () => ({'X-Tenant-Host': getClientTenantHost()}),
    parseTokens: parseTokenResponse,
})

export const getValidAccessToken = session.getValidAccessToken
export const refreshAccessToken = session.refreshAccessToken

export async function ensureAuthenticated(): Promise<string> {
    return getValidAccessToken()
}
