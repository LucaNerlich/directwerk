'use client'

/**
 * sessionStorage-backed access-token store shared by the reference frontends.
 *
 * Access tokens live in sessionStorage; refresh tokens live in httpOnly
 * cookies handled by the BFF and never touch client JS (the legacy
 * `refresh_token` sessionStorage key is only read as a one-way migration
 * fallback when configured).
 */

const DEFAULT_ACCESS_TTL_SECONDS = 900
export const REFRESH_BUFFER_MS = 60_000

/** Minimal OAuth token payload accepted by the store. */
export interface StoredTokens {
    access_token: string
    refresh_token?: string
    token_type?: string
    expires_in?: number
}

export interface SessionTokenStoreConfig {
    /** sessionStorage key holding the access token. */
    accessTokenKey: string
    /** sessionStorage key holding the absolute expiry timestamp (epoch ms). */
    accessTokenExpiresAtKey: string
    /**
     * Legacy sessionStorage key that used to hold the refresh token before the
     * httpOnly-cookie migration. When set, it is only read (never written) so
     * pre-migration sessions keep working, and dropped as soon as a fresh
     * cookie-based token set arrives.
     */
    legacyRefreshTokenKey?: string
    /**
     * When set (directwerk-admin tenant session), the store also persists the
     * tenant host the tokens belong to.
     */
    tenantHostKey?: string
}

export interface SessionTokenStore {
    getAccessToken(): string | null
    getAccessTokenExpiresAt(): number | null
    isAccessTokenExpired(bufferMs?: number): boolean
    /** Legacy migration fallback; returns null unless configured. */
    getRefreshToken(): string | null
    /** Tenant host persisted alongside the tokens (admin tenant session). */
    getTenantHost(): string | null
    setTokens(tokens: StoredTokens, tenantHost?: string): void
    clearTokens(): void
    subscribeToTokenStore(callback: () => void): () => void
}

function resolveExpiresAt(tokens: StoredTokens): number {
    const ttlSeconds =
        typeof tokens.expires_in === 'number' && Number.isFinite(tokens.expires_in)
            ? tokens.expires_in
            : DEFAULT_ACCESS_TTL_SECONDS
    return Date.now() + ttlSeconds * 1000
}

export function createSessionTokenStore(
    config: SessionTokenStoreConfig,
): SessionTokenStore {
    let accessTokenCache: string | null | undefined
    let expiresAtCache: number | null | undefined
    let tenantHostCache: string | null | undefined

    const tokenListeners = new Set<() => void>()

    function notifyTokenListeners(): void {
        tokenListeners.forEach((fn) => fn())
    }

    function initializeAccessCache(): void {
        if (accessTokenCache === undefined) {
            accessTokenCache = sessionStorage.getItem(config.accessTokenKey)
        }
    }

    function initializeExpiresAtCache(): void {
        if (expiresAtCache === undefined) {
            const stored = sessionStorage.getItem(config.accessTokenExpiresAtKey)
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
            tenantHostCache =
                config.tenantHostKey === undefined
                    ? null
                    : sessionStorage.getItem(config.tenantHostKey)
        }
    }

    function resetCaches(): void {
        accessTokenCache = undefined
        expiresAtCache = undefined
        tenantHostCache = undefined
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('storage', (event) => {
            if (
                event.key === config.accessTokenKey ||
                event.key === config.accessTokenExpiresAtKey ||
                event.key === config.legacyRefreshTokenKey ||
                event.key === config.tenantHostKey ||
                event.key === null
            ) {
                resetCaches()
                notifyTokenListeners()
            }
        })
    }

    return {
        getAccessToken(): string | null {
            initializeAccessCache()
            return accessTokenCache ?? null
        },

        getAccessTokenExpiresAt(): number | null {
            initializeExpiresAtCache()
            return expiresAtCache ?? null
        },

        isAccessTokenExpired(bufferMs: number = REFRESH_BUFFER_MS): boolean {
            const expiresAt = this.getAccessTokenExpiresAt()
            if (expiresAt === null) {
                return this.getAccessToken() === null
            }

            return Date.now() >= expiresAt - bufferMs
        },

        getRefreshToken(): string | null {
            if (config.legacyRefreshTokenKey === undefined) {
                return null
            }
            // Legacy fallback only — new sessions keep the refresh token in an
            // httpOnly cookie handled by the BFF.
            return sessionStorage.getItem(config.legacyRefreshTokenKey)
        },

        getTenantHost(): string | null {
            initializeTenantHostCache()
            return tenantHostCache ?? null
        },

        setTokens(tokens: StoredTokens, tenantHost?: string): void {
            const expiresAt = resolveExpiresAt(tokens)

            sessionStorage.setItem(config.accessTokenKey, tokens.access_token)
            sessionStorage.setItem(config.accessTokenExpiresAtKey, String(expiresAt))
            if (config.tenantHostKey !== undefined && tenantHost !== undefined) {
                sessionStorage.setItem(config.tenantHostKey, tenantHost)
                tenantHostCache = tenantHost
            }
            accessTokenCache = tokens.access_token
            expiresAtCache = expiresAt

            // The refresh token is delivered as an httpOnly cookie by the BFF
            // and is intentionally NOT stored client-side. If a legacy session
            // token still exists here, drop it once a fresh cookie-based token
            // set arrives.
            if (
                config.legacyRefreshTokenKey !== undefined &&
                tokens.refresh_token !== undefined
            ) {
                sessionStorage.removeItem(config.legacyRefreshTokenKey)
            }
            notifyTokenListeners()
        },

        clearTokens(): void {
            sessionStorage.removeItem(config.accessTokenKey)
            sessionStorage.removeItem(config.accessTokenExpiresAtKey)
            if (config.tenantHostKey !== undefined) {
                sessionStorage.removeItem(config.tenantHostKey)
            }
            if (config.legacyRefreshTokenKey !== undefined) {
                sessionStorage.removeItem(config.legacyRefreshTokenKey)
            }
            accessTokenCache = null
            expiresAtCache = null
            tenantHostCache = null
            notifyTokenListeners()
        },

        subscribeToTokenStore(callback: () => void): () => void {
            tokenListeners.add(callback)
            return () => {
                tokenListeners.delete(callback)
            }
        },
    }
}
