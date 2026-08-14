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
    it('stores access, refresh, and expiry metadata', () => {
        setTokens({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 900,
        })

        expect(getAccessToken()).toBe('access-token')
        expect(getRefreshToken()).toBe('refresh-token')
        expect(getAccessTokenExpiresAt()).toBeTypeOf('number')
        expect(isAccessTokenExpired()).toBe(false)
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
