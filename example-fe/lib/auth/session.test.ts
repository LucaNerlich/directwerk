import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {AUTH_REQUIRED} from '@/lib/api/errors'
import {
    clearTokens,
    getAccessToken,
    setTokens,
} from '@/lib/auth/tokenStore'

const storage = new Map<string, string>()

vi.mock('@/lib/tenantStore', () => ({
    getSelectedTenant: () => 'alpha-a.localhost',
}))

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
    vi.restoreAllMocks()
})

describe('session', () => {
    it('returns a valid access token without refreshing when not expired', async () => {
        setTokens({
            access_token: 'cached-access',
            refresh_token: 'refresh-token',
            expires_in: 900,
        })

        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)

        const {getValidAccessToken} = await import('./session')
        await expect(getValidAccessToken()).resolves.toBe('cached-access')
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('refreshes expired access tokens and stores the response', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))

        setTokens({
            access_token: 'expired-access',
            refresh_token: 'refresh-token',
            expires_in: 60,
        })

        vi.setSystemTime(new Date('2026-01-01T12:05:00Z'))

        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                Response.json({
                    access_token: 'fresh-access',
                    refresh_token: 'refresh-token',
                    expires_in: 900,
                    token_type: 'bearer',
                }),
            ),
        )

        const {getValidAccessToken} = await import('./session')
        await expect(getValidAccessToken()).resolves.toBe('fresh-access')
        expect(getAccessToken()).toBe('fresh-access')

        vi.useRealTimers()
    })

    it('clears tokens and throws when refresh fails', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))

        setTokens({
            access_token: 'expired-access',
            refresh_token: 'refresh-token',
            expires_in: 60,
        })

        vi.setSystemTime(new Date('2026-01-01T12:05:00Z'))

        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                Response.json({error: 'Authentication failed.'}, {status: 401}),
            ),
        )

        const {getValidAccessToken} = await import('./session')
        await expect(getValidAccessToken()).rejects.toThrow(AUTH_REQUIRED)
        expect(getAccessToken()).toBeNull()

        vi.useRealTimers()
    })
})
