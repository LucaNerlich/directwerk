'use client'

import {createAuthSession} from '@directwerk/api/auth/session'
import {parseTokenResponse} from '@directwerk/api/validation/token'

import {tokenStore} from '@/lib/auth/tokenStore'

/**
 * Admin platform refresh/session coordinator — the shared algorithm
 * (generation guard + abort timeout) with no extra headers.
 */
const session = createAuthSession({
    store: tokenStore,
    refreshPath: '/api/auth/refresh',
    parseTokens: parseTokenResponse,
})

export const getValidAccessToken = session.getValidAccessToken
export const refreshAccessToken = session.refreshAccessToken

/**
 * Ends any refresh that is currently in flight so it can no longer write
 * tokens. Must be called whenever a new identity logs in — otherwise an
 * in-flight refresh for the previous identity passes its generation check
 * after login resolves and overwrites the fresh session.
 */
export const invalidatePendingRefresh = session.invalidatePendingRefresh

export async function ensureAuthenticated(): Promise<string> {
    return getValidAccessToken()
}
