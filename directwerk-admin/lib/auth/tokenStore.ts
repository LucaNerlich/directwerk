'use client'

import type {OAuthTokenResponse} from '@/lib/api/types'

const ACCESS_TOKEN_KEY = 'publish_admin_access'
const REFRESH_TOKEN_KEY = 'publish_admin_refresh'
const ACCESS_EXPIRES_AT_KEY = 'publish_admin_access_expires_at'

const DEFAULT_ACCESS_TTL_SECONDS = 900
const REFRESH_BUFFER_MS = 60_000

let accessTokenCache: string | null | undefined
let refreshTokenCache: string | null | undefined
let expiresAtCache: number | null | undefined

const tokenListeners = new Set<() => void>()

function notifyTokenListeners(): void {
    tokenListeners.forEach((fn) => fn())
}

export function subscribeToTokenStore(callback: () => void): () => void {
    tokenListeners.add(callback)
    return () => {
        tokenListeners.delete(callback)
    }
}

function initializeAccessCache(): void {
    if (accessTokenCache === undefined) {
        accessTokenCache = sessionStorage.getItem(ACCESS_TOKEN_KEY)
    }
}

function initializeRefreshCache(): void {
    if (refreshTokenCache === undefined) {
        refreshTokenCache = sessionStorage.getItem(REFRESH_TOKEN_KEY)
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

function resetCaches(): void {
    accessTokenCache = undefined
    refreshTokenCache = undefined
    expiresAtCache = undefined
}

if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (
            event.key === ACCESS_TOKEN_KEY ||
            event.key === REFRESH_TOKEN_KEY ||
            event.key === ACCESS_EXPIRES_AT_KEY ||
            event.key === null
        ) {
            resetCaches()
            notifyTokenListeners()
        }
    })
}

export function getAccessToken(): string | null {
    initializeAccessCache()
    return accessTokenCache ?? null
}

export function getRefreshToken(): string | null {
    initializeRefreshCache()
    return refreshTokenCache ?? null
}

export function getAccessTokenExpiresAt(): number | null {
    initializeExpiresAtCache()
    return expiresAtCache ?? null
}

export function isAccessTokenExpired(bufferMs = REFRESH_BUFFER_MS): boolean {
    const expiresAt = getAccessTokenExpiresAt()
    if (expiresAt === null) {
        return getAccessToken() === null
    }

    return Date.now() >= expiresAt - bufferMs
}

function resolveExpiresAt(tokens: OAuthTokenResponse): number {
    const ttlSeconds =
        typeof tokens.expires_in === 'number' && Number.isFinite(tokens.expires_in)
            ? tokens.expires_in
            : DEFAULT_ACCESS_TTL_SECONDS
    return Date.now() + ttlSeconds * 1000
}

export function storeTokens(tokens: OAuthTokenResponse): void {
    const expiresAt = resolveExpiresAt(tokens)

    sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token)
    sessionStorage.setItem(ACCESS_EXPIRES_AT_KEY, String(expiresAt))
    accessTokenCache = tokens.access_token
    expiresAtCache = expiresAt

    if (tokens.refresh_token) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)
        refreshTokenCache = tokens.refresh_token
    } else {
        sessionStorage.removeItem(REFRESH_TOKEN_KEY)
        refreshTokenCache = null
    }
    notifyTokenListeners()
}

export function clearTokens(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    sessionStorage.removeItem(ACCESS_EXPIRES_AT_KEY)
    accessTokenCache = null
    refreshTokenCache = null
    expiresAtCache = null
    notifyTokenListeners()
}
