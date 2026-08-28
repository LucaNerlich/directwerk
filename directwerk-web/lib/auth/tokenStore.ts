'use client'

import {createSessionTokenStore} from '@directwerk/api/auth/tokenStore'

/**
 * Web session token store configuration. The legacy sessionStorage refresh
 * key is only read as a one-way migration fallback for sessions created
 * before the httpOnly-cookie migration.
 */
export const tokenStore = createSessionTokenStore({
    accessTokenKey: 'publish_web_access_token',
    accessTokenExpiresAtKey: 'publish_web_access_expires_at',
    legacyRefreshTokenKey: 'publish_web_refresh_token',
})

export const getAccessToken = tokenStore.getAccessToken.bind(tokenStore)
export const getRefreshToken = tokenStore.getRefreshToken.bind(tokenStore)
export const setTokens = tokenStore.setTokens.bind(tokenStore)
export const clearTokens = tokenStore.clearTokens.bind(tokenStore)
export const subscribeToTokenStore =
    tokenStore.subscribeToTokenStore.bind(tokenStore)
