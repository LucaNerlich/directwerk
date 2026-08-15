'use client'

import type {OAuthTokenResponse} from '@/lib/api/types'

const ACCESS_TOKEN_KEY = 'publish_admin_tenant_access'
const ACCESS_EXPIRES_AT_KEY = 'publish_admin_tenant_access_expires_at'
const TENANT_HOST_KEY = 'publish_admin_tenant_host'

const DEFAULT_ACCESS_TTL_SECONDS = 900
const REFRESH_BUFFER_MS = 60_000

let accessTokenCache: string | null | undefined
let expiresAtCache: number | null | undefined
let tenantHostCache: string | null | undefined

function initializeAccessCache(): void {
    if (accessTokenCache === undefined) {
        accessTokenCache = sessionStorage.getItem(ACCESS_TOKEN_KEY)
    }
}

function initializeExpiresAtCache(): void {
    if (expiresAtCache === undefined) {
        const stored = sessionStorage.getItem(ACCESS_EXPIRES_AT_KEY)
        if (stored === null) {
            expiresAtCache = null
            return
        }

        const parsed = Number.parseInt(stored, 10)
        expiresAtCache = Number.isFinite(parsed) ? parsed : null
    }
}

function initializeTenantHostCache(): void {
    if (tenantHostCache === undefined) {
        tenantHostCache = sessionStorage.getItem(TENANT_HOST_KEY)
    }
}

function resolveExpiresAt(tokens: OAuthTokenResponse): number {
    const ttlSeconds =
        typeof tokens.expires_in === 'number' && Number.isFinite(tokens.expires_in)
            ? tokens.expires_in
            : DEFAULT_ACCESS_TTL_SECONDS
    return Date.now() + ttlSeconds * 1000
}

export function getTenantAccessToken(): string | null {
    initializeAccessCache()
    return accessTokenCache ?? null
}

export function getTenantSessionHost(): string | null {
    initializeTenantHostCache()
    return tenantHostCache ?? null
}

export function isTenantAccessTokenExpired(
    bufferMs = REFRESH_BUFFER_MS
): boolean {
    initializeExpiresAtCache()
    if (expiresAtCache === null || expiresAtCache === undefined) {
        return getTenantAccessToken() === null
    }

    return Date.now() >= expiresAtCache - bufferMs
}

export function storeTenantTokens(
    tokens: OAuthTokenResponse,
    tenantHost: string
): void {
    const expiresAt = resolveExpiresAt(tokens)

    sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token)
    sessionStorage.setItem(ACCESS_EXPIRES_AT_KEY, String(expiresAt))
    sessionStorage.setItem(TENANT_HOST_KEY, tenantHost)
    accessTokenCache = tokens.access_token
    expiresAtCache = expiresAt
    tenantHostCache = tenantHost
}

export function clearTenantTokens(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(ACCESS_EXPIRES_AT_KEY)
    sessionStorage.removeItem(TENANT_HOST_KEY)
    accessTokenCache = null
    expiresAtCache = null
    tenantHostCache = null
}
