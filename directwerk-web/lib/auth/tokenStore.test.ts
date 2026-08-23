import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {
    clearTokens,
    getAccessToken,
    getAccessTokenExpiresAt,
    getRefreshToken,
    isAccessTokenExpired,
    setTokens,
} from './tokenStore'

const storage = new Map<string, string>()

beforeEach(() => {
    storage.clear()
    vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
            storage.set(key, value)
        },
        removeItem: (key: string) => {
            storage.delete(key)
        },
    })
    vi.stubGlobal('window', {
        addEventListener: vi.fn(),
    })
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('tokenStore', () => {
    it('stores access and expiry metadata but never persists the refresh token', () => {
        setTokens({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 900,
        })

        expect(getAccessToken()).toBe('access-token')
        expect(getAccessTokenExpiresAt()).toBeTypeOf('number')
        expect(isAccessTokenExpired()).toBe(false)
        // The refresh token lives in an httpOnly cookie handled by the BFF.
        expect(getRefreshToken()).toBeNull()
    })

    it('drops a legacy sessionStorage refresh token on the next token write', () => {
        storage.set('publish_web_refresh_token', 'legacy-refresh-token')

        setTokens({
            access_token: 'access-token',
            refresh_token: 'cookie-managed-refresh-token',
            expires_in: 900,
        })

        expect(storage.get('publish_web_refresh_token')).toBeUndefined()
        expect(getRefreshToken()).toBeNull()
    })

    it('clears all stored credentials', () => {
        setTokens({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 900,
        })

        clearTokens()

        expect(getAccessToken()).toBeNull()
        expect(getRefreshToken()).toBeNull()
        expect(getAccessTokenExpiresAt()).toBeNull()
    })

    it('treats tokens as expired inside the refresh buffer', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))

        setTokens({
            access_token: 'access-token',
            expires_in: 120,
        })

        vi.setSystemTime(new Date('2026-01-01T12:01:30Z'))
        expect(isAccessTokenExpired()).toBe(true)

        vi.useRealTimers()
    })
})
