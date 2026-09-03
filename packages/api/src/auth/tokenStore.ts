'use client'

/**
 * sessionStorage-backed access-token store shared by the reference frontends.
 *
 * Access tokens live in sessionStorage; refresh tokens live in httpOnly
 * cookies handled by the BFF and never touch client JS.
 *
 * SECURITY NOTE (token theft): any JavaScript-readable token store is
 * exfiltratable via XSS, so this store is only one layer of the session
 * posture — it must be paired with HTML sanitization at every render sink
 * (see `sanitizeContentHtml`), strict CSP, and the short access-token TTL
 * (15 min default). sessionStorage (not localStorage) is used so tokens do
 * not survive tab close and are not shared across tabs. The full httpOnly
 * migration path is already in place for refresh tokens via the BFF
 * (`sealRefreshToken`); moving access tokens fully server-side would require
 * routing all API reads through the `/api/proxy` BFF with the access token
 * kept in a sealed cookie — a larger latency/complexity tradeoff that is
 * deferred while the TTL + sanitization + CSP layers hold.
 */

const DEFAULT_ACCESS_TTL_SECONDS = 900
export const REFRESH_BUFFER_MS = 60_000

export interface StoredTokens {
    access_token: string
    refresh_token?: string
    token_type?: string
    expires_in?: number
}

export interface SessionTokenStoreConfig {
    accessTokenKey: string
    accessTokenExpiresAtKey: string
    tenantHostKey?: string
}

export interface SessionTokenStore {
    getAccessToken(): string | null
    getAccessTokenExpiresAt(): number | null
    isAccessTokenExpired(bufferMs?: number): boolean
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
            notifyTokenListeners()
        },
        clearTokens(): void {
            sessionStorage.removeItem(config.accessTokenKey)
            sessionStorage.removeItem(config.accessTokenExpiresAtKey)
            if (config.tenantHostKey !== undefined) {
                sessionStorage.removeItem(config.tenantHostKey)
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
