'use client'

import type {TokenResponse} from '@/lib/api/types'

const ACCESS_TOKEN_KEY = 'publish_studio_access_token'
const ACCESS_EXPIRES_AT_KEY = 'publish_studio_access_expires_at'

const DEFAULT_ACCESS_TTL_SECONDS = 900
const REFRESH_BUFFER_MS = 60_000

let accessTokenCache: string | null | undefined
let expiresAtCache: number | null | undefined

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

export function getAccessToken(): string | null {
    initializeAccessCache()
    return accessTokenCache ?? null
}

function getAccessTokenExpiresAt(): number | null {
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
}

export function clearTokens(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(ACCESS_EXPIRES_AT_KEY)
    accessTokenCache = null
    expiresAtCache = null
}
