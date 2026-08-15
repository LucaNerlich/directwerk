'use client'

import type {OAuthTokenResponse} from '@/lib/api/types'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import {
    clearTenantTokens,
    getTenantAccessToken,
    getTenantSessionHost,
    isTenantAccessTokenExpired,
    storeTenantTokens,
} from '@/lib/auth/tenantTokenStore'

let refreshInFlight: Promise<string> | null = null
let currentSessionGeneration = 0

function invalidateTenantSession(): void {
    currentSessionGeneration++
    clearTenantTokens()
}

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

async function postRefresh(
    tenantHost: string,
    sessionGeneration: number
): Promise<string> {
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), 10000)

    try {
        // The refresh token lives in an httpOnly cookie; the refresh route reads
        // it server-side so the credential is never exposed to client JS.
        const response = await fetch('/api/auth/tenant-refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Host': tenantHost,
            },
            body: '{}',
            cache: 'no-store',
            signal: abortController.signal,
        })

        clearTimeout(timeoutId)

        const tokens: unknown = await response.json().catch(() => null)
        if (!response.ok || !isOAuthTokenResponse(tokens)) {
            invalidateTenantSession()
            throw new Error(AUTH_REQUIRED)
        }

        if (sessionGeneration === currentSessionGeneration) {
            storeTenantTokens(tokens, tenantHost)
            return tokens.access_token
        }

        invalidateTenantSession()
        throw new Error(AUTH_REQUIRED)
    } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
            invalidateTenantSession()
            throw new Error(AUTH_REQUIRED)
        }
        throw error
    }
}

export async function refreshTenantAccessToken(): Promise<string> {
    const tenantHost = getTenantSessionHost()
    if (!tenantHost) {
        invalidateTenantSession()
        throw new Error(AUTH_REQUIRED)
    }

    if (refreshInFlight !== null) {
        return refreshInFlight
    }

    const sessionGeneration = currentSessionGeneration
    refreshInFlight = postRefresh(tenantHost, sessionGeneration).finally(() => {
        refreshInFlight = null
    })

    return refreshInFlight
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
