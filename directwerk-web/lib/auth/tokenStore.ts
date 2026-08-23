'use client'

import type {TokenResponse} from '@/lib/api/types'

const ACCESS_TOKEN_KEY = 'publish_web_access_token'
// Legacy key: refresh tokens were stored here before the httpOnly-cookie
// migration. Only read (never written) so existing sessions keep working.
const LEGACY_REFRESH_TOKEN_KEY = 'publish_web_refresh_token'
const ACCESS_EXPIRES_AT_KEY = 'publish_web_access_expires_at'

const DEFAULT_ACCESS_TTL_SECONDS = 900
const REFRESH_BUFFER_MS = 60_000

let accessTokenCache: string | null | undefined
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
    expiresAtCache = undefined
}

if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (
            event.key === ACCESS_TOKEN_KEY ||
            event.key === LEGACY_REFRESH_TOKEN_KEY ||
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
    // Legacy fallback only — new sessions keep the refresh token in an
    // httpOnly cookie handled by the BFF.
    return sessionStorage.getItem(LEGACY_REFRESH_TOKEN_KEY)
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

function resolveExpiresAt(tokens: TokenResponse): number {
    const ttlSeconds = tokens.expires_in ?? DEFAULT_ACCESS_TTL_SECONDS
    return Date.now() + ttlSeconds * 1000
}

export function setTokens(tokens: TokenResponse): void {
    const expiresAt = resolveExpiresAt(tokens)

    sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token)
    sessionStorage.setItem(ACCESS_EXPIRES_AT_KEY, String(expiresAt))
    accessTokenCache = tokens.access_token
    expiresAtCache = expiresAt

    // The refresh token is delivered as an httpOnly cookie by the BFF and is
    // intentionally NOT stored client-side. If a legacy session token still
    // exists here, drop it once a fresh cookie-based token set arrives.
    if (tokens.refresh_token !== undefined) {
        sessionStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY)
    }
    notifyTokenListeners()
}

export function clearTokens(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY)
    sessionStorage.removeItem(ACCESS_EXPIRES_AT_KEY)
    accessTokenCache = null
    expiresAtCache = null
    notifyTokenListeners()
}
