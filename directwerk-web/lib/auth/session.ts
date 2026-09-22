'use client'

import {createAuthSession} from '@directwerk/api/auth/session'
import {parseTokenResponse} from '@directwerk/api/validation/token'

import {getWebClientTenantHost} from '@/lib/tenant/clientHost'
import {tokenStore} from '@/lib/auth/tokenStore'

const session = createAuthSession({
    store: tokenStore,
    refreshPath: '/api/auth/refresh',
    refreshHeaders: () => ({'X-Tenant-Host': getWebClientTenantHost()}),
    parseTokens: parseTokenResponse,
})

export const getValidAccessToken = session.getValidAccessToken
export const refreshAccessToken = session.refreshAccessToken
/** Clears tokens and invalidates any refresh that is currently in flight. */
export const clearSessionTokens = session.clearTokens
/** Must be called before storing tokens for a new identity (login/register). */
export const invalidatePendingRefresh = session.invalidatePendingRefresh

export async function ensureAuthenticated(): Promise<string> {
    return getValidAccessToken()
}
