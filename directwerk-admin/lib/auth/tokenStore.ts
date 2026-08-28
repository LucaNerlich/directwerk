'use client'

import {createSessionTokenStore} from '@directwerk/api/auth/tokenStore'

/** Admin platform session token store configuration. */
export const tokenStore = createSessionTokenStore({
    accessTokenKey: 'publish_admin_access',
    accessTokenExpiresAtKey: 'publish_admin_access_expires_at',
})

export const getAccessToken = tokenStore.getAccessToken.bind(tokenStore)
export const storeTokens = tokenStore.setTokens.bind(tokenStore)
export const clearTokens = tokenStore.clearTokens.bind(tokenStore)
export const subscribeToTokenStore =
    tokenStore.subscribeToTokenStore.bind(tokenStore)
