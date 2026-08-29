'use client'

import {createSessionTokenStore} from '@directwerk/api/auth/tokenStore'

export const tokenStore = createSessionTokenStore({
    accessTokenKey: 'publish_web_access_token',
    accessTokenExpiresAtKey: 'publish_web_access_expires_at',
})

export const getAccessToken = tokenStore.getAccessToken.bind(tokenStore)
export const setTokens = tokenStore.setTokens.bind(tokenStore)
export const clearTokens = tokenStore.clearTokens.bind(tokenStore)
export const subscribeToTokenStore = tokenStore.subscribeToTokenStore.bind(tokenStore)
