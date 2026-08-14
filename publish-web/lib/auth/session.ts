'use client'

import {AUTH_REQUIRED} from '@/lib/api/errors'
import {parseTokenResponse} from '@/lib/api/responseValidation'
import {
    clearTokens,
    getAccessToken,
    getRefreshToken,
    isAccessTokenExpired,
    setTokens,
} from '@/lib/auth/tokenStore'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

let refreshInFlight: Promise<string> | null = null

async function postRefresh(refreshToken: string): Promise<string> {
    const tenantHost = getClientTenantHost()
    const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Tenant-Host': tenantHost,
        },
        body: JSON.stringify({refresh_token: refreshToken}),
    })

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) {
        clearTokens()
        throw new Error(AUTH_REQUIRED)
    }

    const value: unknown = await response.json()
    if (!response.ok) {
        clearTokens()
        throw new Error(AUTH_REQUIRED)
    }

    const tokens = parseTokenResponse(value)
    if (tokens === null) {
        clearTokens()
        throw new Error(AUTH_REQUIRED)
    }

    setTokens(tokens)
    return tokens.access_token
}

export async function refreshAccessToken(): Promise<string> {
    const refreshToken = getRefreshToken()
    if (refreshToken === null) {
        clearTokens()
        throw new Error(AUTH_REQUIRED)
    }

    if (refreshInFlight !== null) {
        return refreshInFlight
    }

    refreshInFlight = postRefresh(refreshToken).finally(() => {
        refreshInFlight = null
    })

    return refreshInFlight
}

export async function getValidAccessToken(): Promise<string> {
    const accessToken = getAccessToken()
    if (accessToken !== null && !isAccessTokenExpired()) {
        return accessToken
    }

    return refreshAccessToken()
}

export async function ensureAuthenticated(): Promise<string> {
    return getValidAccessToken()
}
