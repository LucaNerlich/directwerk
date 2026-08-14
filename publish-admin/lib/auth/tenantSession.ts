'use client'

import type {OAuthTokenResponse} from '@/lib/api/types'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import {
    clearTenantTokens,
    getTenantAccessToken,
    getTenantRefreshToken,
    getTenantSessionHost,
    isTenantAccessTokenExpired,
    storeTenantTokens,
} from '@/lib/auth/tenantTokenStore'

function isOAuthTokenResponse(value: unknown): value is OAuthTokenResponse {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const tokens = value as Record<string, unknown>
    return (
        typeof tokens.access_token === 'string' &&
        tokens.access_token.length > 0
    )
}

export async function refreshTenantAccessToken(): Promise<string> {
    const refreshToken = getTenantRefreshToken()
    const tenantHost = getTenantSessionHost()
    if (!refreshToken || !tenantHost) {
        clearTenantTokens()
        throw new Error(AUTH_REQUIRED)
    }

    const response = await fetch('/api/auth/tenant-refresh', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Host': tenantHost,
        },
        body: JSON.stringify({refresh_token: refreshToken}),
        cache: 'no-store',
    })

    if (!response.ok) {
        clearTenantTokens()
        throw new Error(AUTH_REQUIRED)
    }

    const tokens: unknown = await response.json()
    if (!isOAuthTokenResponse(tokens)) {
        clearTenantTokens()
        throw new Error(AUTH_REQUIRED)
    }

    storeTenantTokens(tokens, tenantHost)
    return tokens.access_token
}

export async function getValidTenantAccessToken(): Promise<string> {
    const existing = getTenantAccessToken()
    if (existing && !isTenantAccessTokenExpired()) {
        return existing
    }

    return refreshTenantAccessToken()
}

export async function loginTenantSession(input: {
    email: string
    password: string
    tenantHost: string
}): Promise<void> {
    const response = await fetch('/api/auth/tenant-login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Host': input.tenantHost,
        },
        body: JSON.stringify({
            email: input.email,
            password: input.password,
        }),
        cache: 'no-store',
    })

    if (!response.ok) {
        throw new Error(AUTH_REQUIRED)
    }

    const tokens: unknown = await response.json()
    if (!isOAuthTokenResponse(tokens)) {
        throw new Error(AUTH_REQUIRED)
    }

    storeTenantTokens(tokens, input.tenantHost)
}
