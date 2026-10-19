import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))

const cookieSet = vi.fn()
vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: () => ({value: 'rt-1'}),
        set: (...args: unknown[]) => cookieSet(...args),
    }),
}))

vi.mock('@/lib/server/api', () => ({
    PLATFORM_REFRESH_COOKIE: 'dw_admin_refresh',
    createConfiguredPlatformRefreshRequest: () => ({
        url: 'https://upstream.example/oauth2/token',
        init: {method: 'POST'},
    }),
    createConfiguredPlatformApiRequest: vi.fn(),
}))

vi.mock('@directwerk/api/auth/cookies', () => ({
    sealRefreshToken: async () => ({
        ok: true,
        status: 200,
        headers: {get: () => 'dw_admin_refresh=rt-2; Path=/; HttpOnly'},
        json: async () => ({access_token: 'at-1'}),
    }),
}))

vi.mock('@directwerk/api/validation/token', () => ({
    parseTokenResponse: () => ({access_token: 'at-1'}),
}))

const fetchMock = vi.fn()

import {resolvePlatformAuthorization} from './platform'

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue(new Response('{}', {status: 200}))
})

describe('resolvePlatformAuthorization', () => {
    it('shares one refresh rotation between concurrent consumers', async () => {
        const [first, second] = await Promise.all([
            resolvePlatformAuthorization(),
            resolvePlatformAuthorization(),
        ])

        // Issue #556: the second consumer must await the first rotation, not spend the
        // already-rotated refresh token and sign the tab out.
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(first).toEqual({ok: true, authorization: 'Bearer at-1'})
        expect(second).toEqual(first)
    })
})
