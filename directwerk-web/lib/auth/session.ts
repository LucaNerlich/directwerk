'use client'

import {AUTH_REQUIRED, AUTH_TRANSIENT} from '@/lib/api/errors'
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

async function postRefresh(legacyRefreshToken: string | null): Promise<string> {
    const tenantHost = getClientTenantHost()
    const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Tenant-Host': tenantHost,
        },
        // The httpOnly refresh cookie is preferred by the BFF; a legacy
        // sessionStorage token is only sent as a migration fallback.
        body: JSON.stringify(
            legacyRefreshToken === null
                ? {}
                : {refresh_token: legacyRefreshToken},
        ),
    })

    // Only definitive auth failures (invalid/expired refresh token) may clear
    // tokens. Upstream outages surface as >=500 from the refresh route —
    // destroying a still-valid credential for those would log subscribers out
    // during brief API restarts or network blips.
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

    const legacyRefreshToken = getRefreshToken()
    refreshInFlight = postRefresh(legacyRefreshToken).finally(() => {
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
