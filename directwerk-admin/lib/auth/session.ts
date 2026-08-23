'use client'

import {AUTH_REQUIRED, AUTH_TRANSIENT} from '@/lib/api/errors'
import {
    clearTokens as clearTokensBase,
    getAccessToken,
    isAccessTokenExpired,
    storeTokens,
} from '@/lib/auth/tokenStore'
import type {OAuthTokenResponse} from '@/lib/api/types'

let refreshInFlight: Promise<string> | null = null
let currentSessionGeneration = 0

function clearTokens(): void {
    currentSessionGeneration++
    clearTokensBase()
}

/**
 * Ends any refresh that is currently in flight so it can no longer write
 * tokens. Must be called whenever a new identity logs in — otherwise an
 * in-flight refresh for the previous identity passes its generation check
 * after login resolves and overwrites the fresh session.
 */
export function invalidatePendingRefresh(): void {
    currentSessionGeneration++
}

function isOAuthTokenResponse(value: unknown): value is OAuthTokenResponse {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const token = value as Record<string, unknown>
    return (
        typeof token.access_token === 'string' &&
        token.access_token.length > 0 &&
        token.access_token.length <= 8192 &&
        typeof token.token_type === 'string' &&
        token.token_type.toLowerCase() === 'bearer' &&
        (token.expires_in === undefined ||
            (typeof token.expires_in === 'number' &&
                Number.isFinite(token.expires_in)))
    )
}

async function postRefresh(sessionGeneration: number): Promise<string> {
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), 10000)

    try {
        // The refresh token lives in an httpOnly cookie; the refresh route reads
        // it server-side so the credential is never exposed to client JS.
        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: '{}',
            signal: abortController.signal,
        })

        clearTimeout(timeoutId)

        const body: unknown = await response.json().catch(() => null)
        if (response.status === 400 || response.status === 401) {
            // Definitive auth failure from the token endpoint.
            clearTokens()
            throw new Error(AUTH_REQUIRED)
        }
        if (!response.ok || !isOAuthTokenResponse(body)) {
            // Upstream outage or malformed reply — the session itself is
            // intact; keep tokens so the next call can retry.
            throw new Error(AUTH_TRANSIENT)
        }

        // Only store tokens if session hasn't been invalidated
        if (sessionGeneration === currentSessionGeneration) {
            storeTokens(body)
            return body.access_token
        } else {
            // Session was cleared during refresh, discard response
            throw new Error(AUTH_REQUIRED)
        }
    } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
            // A timeout is transient — do not destroy a recoverable session.
            throw new Error(AUTH_TRANSIENT)
        }
        throw error
    }
}

export async function refreshAccessToken(): Promise<string> {
    if (refreshInFlight !== null) {
        return refreshInFlight
    }

    const sessionGeneration = currentSessionGeneration
    refreshInFlight = postRefresh(sessionGeneration).finally(() => {
        refreshInFlight = null
    })

    return refreshInFlight
}

export async function getValidAccessToken(): Promise<string> {
    const accessToken = getAccessToken()
    if (accessToken !== null && !isAccessTokenExpired()) {
        return accessToken
    }

    return refreshAccessToken()
}

export async function ensureAuthenticated(): Promise<string> {
    return getValidAccessToken()
}
