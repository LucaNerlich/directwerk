'use client'

import type {TokenResponse} from '@directwerk/api/types'
import {createAuthSession} from '@directwerk/api/auth/session'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {
    clearTenantTokens,
    getTenantAccessToken,
    getTenantSessionHost,
    isTenantAccessTokenExpired,
    storeTenantTokens,
    tenantTokenStore,
} from '@/lib/auth/tenantTokenStore'

/**
 * Admin tenant refresh/session coordinator — shared algorithm with the
 * tenant host header.
 */
const session = createAuthSession({
    store: tenantTokenStore,
    refreshPath: '/api/auth/tenant-refresh',
    refreshHeaders: (): Record<string, string> => {
        const host = getTenantSessionHost()
        return host === null ? {} : {'X-Tenant-Host': host}
    },
    parseTokens: parseTenantTokens,
})

function parseTenantTokens(value: unknown): TokenResponse | null {
    if (typeof value !== 'object' || value === null) {
        return null
    }

    const tokens = value as Record<string, unknown>
    if (
        typeof tokens.access_token === 'string' &&
        tokens.access_token.length > 0
    ) {
        return value as TokenResponse
    }
    return null
}

export async function refreshTenantAccessToken(): Promise<string> {
    const tenantHost = getTenantSessionHost()
    if (!tenantHost) {
        clearTenantTokens()
        throw new Error(AUTH_REQUIRED)
    }

    return session.refreshAccessToken()
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
    // A new tenant identity is being established — end any refresh still in
    // flight for the previous one so it cannot overwrite this session.
    session.invalidatePendingRefresh()

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
    if (!parseTenantTokens(tokens)) {
        throw new Error(AUTH_REQUIRED)
    }

    storeTenantTokens(tokens as TokenResponse, input.tenantHost)
}
