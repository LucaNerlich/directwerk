'use client'

import {createAuthSession} from '@directwerk/api/auth/session'
import {parseTokenResponse} from '@directwerk/api/validation/token'

import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {tokenStore} from '@/lib/auth/tokenStore'

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
