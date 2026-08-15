import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {
    clearTokens,
    getAccessToken,
    getAccessTokenExpiresAt,
    isAccessTokenExpired,
    storeTokens,
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
    it('stores access and expiry metadata but not the refresh token', () => {
        storeTokens({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 900,
            token_type: 'bearer',
        })

        expect(getAccessToken()).toBe('access-token')
        expect(getAccessTokenExpiresAt()).toBeTypeOf('number')
        expect(isAccessTokenExpired()).toBe(false)
        expect(storage.has('publish_admin_refresh')).toBe(false)
    })

    it('clears all stored credentials', () => {
        storeTokens({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 900,
            token_type: 'bearer',
        })

        clearTokens()

        expect(getAccessToken()).toBeNull()
        expect(getAccessTokenExpiresAt()).toBeNull()
    })

    it('falls back to default TTL when expires_in is non-numeric', () => {
        storeTokens({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 'invalid' as unknown as number,
            token_type: 'bearer',
        })

        expect(getAccessToken()).toBe('access-token')
        expect(getAccessTokenExpiresAt()).toBeTypeOf('number')
        expect(isAccessTokenExpired()).toBe(false)
    })
})
