'use client'

import {AUTH_REQUIRED, AUTH_TRANSIENT} from '@/lib/api/errors'
import {parseTokenResponse} from '@/lib/api/responseValidation'
import {
    clearTokens,
    getAccessToken,
    isAccessTokenExpired,
    setTokens,
} from '@/lib/auth/tokenStore'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

let refreshInFlight: Promise<string> | null = null

async function postRefresh(): Promise<string> {
    const tenantHost = getClientTenantHost()
    // The refresh token lives in an httpOnly cookie; the refresh route reads it
    // server-side so the credential is never exposed to client JS.
    const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Tenant-Host': tenantHost,
        },
        body: '{}',
    })

    // Only definitive auth failures (invalid/expired refresh token) may clear
    // tokens. Upstream outages surface as >=500 from the refresh route —
    // destroying a still-valid cookie for those would log users out during
    // brief API restarts or network blips.
    if (response.status === 400 || response.status === 401) {
        clearTokens()
        throw new Error(AUTH_REQUIRED)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!response.ok || !contentType.toLowerCase().includes('application/json')) {
        throw new Error(AUTH_TRANSIENT)
    }

    let value: unknown
    try {
        value = await response.json()
    } catch {
        throw new Error(AUTH_TRANSIENT)
    }

    const tokens = parseTokenResponse(value)
    if (tokens === null) {
        // A 200 reply we cannot parse is a broken success payload; treat it as
        // an auth failure so the next attempt starts from a clean slate.
        clearTokens()
        throw new Error(AUTH_REQUIRED)
    }

    setTokens(tokens)
    return tokens.access_token
}

export async function refreshAccessToken(): Promise<string> {
    if (refreshInFlight !== null) {
        return refreshInFlight
    }

    refreshInFlight = postRefresh().finally(() => {
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
