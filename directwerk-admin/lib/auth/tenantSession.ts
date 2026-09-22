'use client'

import {createAuthSession} from '@directwerk/api/auth/session'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {parseTokenResponse} from '@directwerk/api/validation/token'

import {
    getTenantAccessToken,
    getTenantSessionHost,
    isTenantAccessTokenExpired,
    storeTenantTokens,
    tenantTokenStore,
} from '@/lib/auth/tenantTokenStore'

const session = createAuthSession({
    store: tenantTokenStore,
    refreshPath: '/api/auth/tenant-refresh',
    refreshHeaders: (): Record<string, string> => {
        const host = getTenantSessionHost()
        return host === null ? {} : {'X-Tenant-Host': host}
    },
    parseTokens: parseTokenResponse,
})

function invalidatePendingTenantRefresh(): void {
    session.invalidatePendingRefresh()
}

/** Clears tenant tokens and invalidates any refresh currently in flight. */
export function clearTenantSessionTokens(): void {
    session.clearTokens()
}

export async function refreshTenantAccessToken(): Promise<string> {
    const tenantHost = getTenantSessionHost()
    if (!tenantHost) {
        clearTenantSessionTokens()
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
    invalidatePendingTenantRefresh()
    const response = await fetch('/api/auth/tenant-login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Host': input.tenantHost,
        },
        body: JSON.stringify({email: input.email, password: input.password}),
        cache: 'no-store',
    })
    if (!response.ok) throw new Error(AUTH_REQUIRED)
    const tokens = parseTokenResponse(await response.json())
    if (tokens === null) throw new Error(AUTH_REQUIRED)
    storeTenantTokens(tokens, input.tenantHost)
}
