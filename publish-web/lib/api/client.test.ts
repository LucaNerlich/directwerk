import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {AUTH_REQUIRED} from './errors'
import {
    acceptInvite,
    forgotPassword,
    getMe,
    resetPassword,
    listMyDownloads,
    rotateDefaultFeedToken,
    setDefaultFeedEnabled,
} from './client'

vi.mock('@/lib/auth/session', () => ({
    getValidAccessToken: vi.fn(async () => 'access-token'),
    refreshAccessToken: vi.fn(async () => 'fresh-access'),
}))

vi.mock('@/lib/tenant/getClientTenantHost', () => ({
    getClientTenantHost: () => 'alpha-a.localhost',
}))

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
    vi.restoreAllMocks()
})

function mockJsonFetch(body: unknown, status = 200): void {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
            Response.json(body, {
                status,
                headers: {'content-type': 'application/json'},
            }),
        ),
    )
}

describe('auth client helpers', () => {
    it('posts accept-invite JSON without a tenant host', async () => {
        mockJsonFetch({})
        await acceptInvite({
            token: 'invite-token',
            password: 'Strong password 123!',
        })

        expect(fetch).toHaveBeenCalledWith(
            '/api/auth/accept-invite',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    token: 'invite-token',
                    password: 'Strong password 123!',
                }),
            }),
        )
        const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit
        expect(init.headers).not.toHaveProperty('X-Tenant-Host')
    })

    it('posts reset-password JSON without a tenant host', async () => {
        mockJsonFetch({})
        await resetPassword({
            token: 'reset-token',
            newPassword: 'Strong password 123!',
        })

        expect(fetch).toHaveBeenCalledWith(
            '/api/auth/reset-password',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    token: 'reset-token',
                    newPassword: 'Strong password 123!',
                }),
            }),
        )
    })

    it('returns a valid forgot-password dev reset token', async () => {
        mockJsonFetch({data: {devResetToken: 'dev-reset-token'}})

        await expect(
            forgotPassword({email: 'subscriber@example.com'}),
        ).resolves.toEqual({devResetToken: 'dev-reset-token'})
    })

    it('falls back to a null forgot-password token when absent', async () => {
        mockJsonFetch({data: {}})

        await expect(
            forgotPassword({email: 'subscriber@example.com'}),
        ).resolves.toEqual({devResetToken: null})
    })

    it('retries authenticated requests once after a 401', async () => {
        const meEnvelope = {
            statusCode: 200,
            statusMessage: 'OK',
            data: {
                email: 'editor@example.com',
                name: 'Editor',
                roles: ['EDITOR'],
                tenantId: 1,
            },
            errors: [],
            metadata: {},
        }

        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce(
                    Response.json({error: 'Unauthorized'}, {
                        status: 401,
                        headers: {'content-type': 'application/json'},
                    }),
                )
                .mockResolvedValueOnce(
                    Response.json(meEnvelope, {
                        status: 200,
                        headers: {'content-type': 'application/json'},
                    }),
                ),
        )

        const {refreshAccessToken} = await import('@/lib/auth/session')

        await expect(getMe('alpha-a.localhost')).resolves.toEqual({
            statusCode: 200,
            statusMessage: 'OK',
            data: meEnvelope.data,
            errors: [],
            metadata: {},
        })
        expect(refreshAccessToken).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('throws AUTH_REQUIRED when retry still returns 401', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                Response.json({error: 'Unauthorized'}, {
                    status: 401,
                    headers: {'content-type': 'application/json'},
                }),
            ),
        )

        await expect(getMe('alpha-a.localhost')).rejects.toThrow(AUTH_REQUIRED)
    })
})

const privateFeed = {
    id: 1,
    title: 'Alpha Private Feed',
    isDefault: true,
    enabled: true,
    url: 'http://alpha-a.localhost:8080/feeds/alpha-show-a/u/tok123.xml',
    createdAt: '2026-07-22T12:00:00Z',
    updatedAt: '2026-07-22T12:00:00Z',
}

describe('subscriber feed actions', () => {
    it('posts an empty JSON body when rotating the default feed token', async () => {
        mockJsonFetch({
            statusCode: 200,
            statusMessage: 'OK',
            data: privateFeed,
        })

        await expect(rotateDefaultFeedToken('alpha-a.localhost')).resolves.toEqual(privateFeed)
        expect(fetch).toHaveBeenCalledWith(
            '/api/proxy/me/feeds/default/rotate-token',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({}),
            }),
        )
    })

    it('puts enabled JSON when toggling the default feed', async () => {
        mockJsonFetch({
            statusCode: 200,
            statusMessage: 'OK',
            data: {...privateFeed, enabled: false},
        })

        await expect(setDefaultFeedEnabled('alpha-a.localhost', false)).resolves.toMatchObject({
            enabled: false,
        })
        expect(fetch).toHaveBeenCalledWith(
            '/api/proxy/me/feeds/default/enabled',
            expect.objectContaining({
                method: 'PUT',
                body: JSON.stringify({enabled: false}),
            }),
        )
    })

    it('lists entitled bonus downloads', async () => {
        mockJsonFetch({
            statusCode: 200,
            statusMessage: 'OK',
            data: [
                {
                    id: 71,
                    title: 'bonus.pdf',
                    assetType: 'DOCUMENT',
                    mimeType: 'application/pdf',
                    sizeBytes: 1024,
                    downloadUrl: 'http://alpha-a.localhost:8080/files/bonus.pdf',
                },
            ],
        })

        await expect(listMyDownloads('alpha-a.localhost')).resolves.toEqual([
            {
                id: 71,
                title: 'bonus.pdf',
                assetType: 'DOCUMENT',
                mimeType: 'application/pdf',
                sizeBytes: 1024,
                downloadUrl: 'http://alpha-a.localhost:8080/files/bonus.pdf',
            },
        ])
        expect(fetch).toHaveBeenCalledWith(
            '/api/proxy/me/downloads',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer access-token',
                }),
            }),
        )
    })
})
