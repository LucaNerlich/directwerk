'use client'

import {AUTH_REQUIRED, AUTH_TRANSIENT} from '../constants'
import type {StoredTokens} from './tokenStore'

export interface AuthSessionConfig {
    store: Pick<
        StoredTokensHolder,
        'getAccessToken' | 'isAccessTokenExpired' | 'setTokens' | 'clearTokens'
    >
    /** BFF refresh endpoint, e.g. `/api/auth/refresh`. */
    refreshPath: string
    /**
     * Extra headers for the refresh request (e.g. `X-Tenant-Host`).
     * Evaluated per refresh call.
     */
    refreshHeaders?: () => Record<string, string>
    /**
     * Extra JSON body for the refresh request (legacy migration fallback).
     * Evaluated per refresh call.
     */
    refreshBody?: () => string
    /**
     * Validates the refresh response body. Return null to treat the reply as
     * an unusable token payload.
     */
    parseTokens: (value: unknown) => StoredTokens | null
    /** Abort timeout for the refresh request. Default 10 s. */
    timeoutMs?: number
}

interface StoredTokensHolder {
    getAccessToken(): string | null
    isAccessTokenExpired(bufferMs?: number): boolean
    setTokens(tokens: StoredTokens): void
    clearTokens(): void
}

/**
 * Client-side session/refresh coordinator.
 *
 * Guarantees:
 * - concurrent callers share one in-flight refresh (dedup)
 * - a generation guard discards refresh results for sessions that were
 *   cleared or re-logged-in while the refresh was in flight
 *   (`invalidatePendingRefresh` must be called whenever a new identity logs
 *   in — otherwise an in-flight refresh for the previous identity passes its
 *   generation check after login resolves and overwrites the fresh session)
 * - the refresh request aborts after `timeoutMs`; timeouts are transient and
 *   never destroy the session
 * - only definitive auth failures (400/401 or unusable success payloads)
 *   clear tokens; upstream outages surface as `AUTH_TRANSIENT`
 *
 * This is directwerk-admin's algorithm, adopted for all apps.
 */
export function createAuthSession(config: AuthSessionConfig) {
    const timeoutMs = config.timeoutMs ?? 10_000

    let refreshInFlight: Promise<string> | null = null
    let currentSessionGeneration = 0

    function clearTokens(): void {
        currentSessionGeneration++
        config.store.clearTokens()
    }

    /**
     * Ends any refresh that is currently in flight so it can no longer write
     * tokens. Must be called whenever a new identity logs in.
     */
    function invalidatePendingRefresh(): void {
        currentSessionGeneration++
    }

    async function postRefresh(sessionGeneration: number): Promise<string> {
        const abortController = new AbortController()
        const timeoutId = setTimeout(() => abortController.abort(), timeoutMs)

        try {
            // The refresh token lives in an httpOnly cookie; the refresh route
            // reads it server-side so the credential is never exposed to
            // client JS.
            const response = await fetch(config.refreshPath, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    ...(config.refreshHeaders?.() ?? {}),
                },
                body: config.refreshBody?.() ?? '{}',
                signal: abortController.signal,
            })

            clearTimeout(timeoutId)

            if (response.status === 400 || response.status === 401) {
                // Definitive auth failure from the token endpoint.
                clearTokens()
                throw new Error(AUTH_REQUIRED)
            }

            let value: unknown = null
            try {
                value = await response.json()
            } catch {
                value = null
            }
            const tokens = response.ok ? config.parseTokens(value) : null

            if (!response.ok || tokens === null) {
                // Upstream outage or malformed reply — the session itself is
                // intact; keep tokens so the next call can retry.
                throw new Error(AUTH_TRANSIENT)
            }

            // Only store tokens if session hasn't been invalidated
            if (sessionGeneration === currentSessionGeneration) {
                config.store.setTokens(tokens)
                return tokens.access_token
            }

            // Session was cleared during refresh, discard response
            clearTokens()
            throw new Error(AUTH_REQUIRED)
        } catch (error) {
            clearTimeout(timeoutId)
            if (error instanceof Error && error.name === 'AbortError') {
                // A timeout is transient — do not destroy a recoverable session.
                throw new Error(AUTH_TRANSIENT)
            }
            if (error instanceof TypeError) {
                // Network-level failure reaching our own BFF is transient by
                // definition; classify it like an upstream outage instead of
                // leaking a raw TypeError to consumers.
                throw new Error(AUTH_TRANSIENT)
            }
            throw error
        }
    }

    async function refreshAccessToken(): Promise<string> {
        if (refreshInFlight !== null) {
            return refreshInFlight
        }

        const sessionGeneration = currentSessionGeneration
        refreshInFlight = postRefresh(sessionGeneration).finally(() => {
            refreshInFlight = null
        })

        return refreshInFlight
    }

    async function getValidAccessToken(): Promise<string> {
        const accessToken = config.store.getAccessToken()
        if (accessToken !== null && !config.store.isAccessTokenExpired()) {
            return accessToken
        }

        return refreshAccessToken()
    }

    return {
        refreshAccessToken,
        getValidAccessToken,
        clearTokens,
        invalidatePendingRefresh,
    }
}

/** Re-exported so app wiring modules can build on the exact shape. */
export type {StoredTokens}
