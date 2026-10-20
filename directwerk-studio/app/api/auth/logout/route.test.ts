import {beforeEach, describe, expect, it, vi} from 'vitest'

import {POST} from './route'

vi.mock('server-only', () => ({}))

const directwerkFetch = vi.fn()
vi.mock('@/lib/server/api', () => ({
    REFRESH_COOKIE: 'dw_refresh',
    directwerkFetch: (...args: unknown[]) => directwerkFetch(...args),
}))

beforeEach(() => {
    vi.clearAllMocks()
    directwerkFetch.mockResolvedValue(new Response(null, {status: 200}))
})

describe('POST /api/auth/logout (studio)', () => {
    it('still clears the cookie without a tenant host', async () => {
        const response = await POST(
            new Request('http://localhost/api/auth/logout', {
                method: 'POST',
                headers: {cookie: 'dw_refresh=rt-1'},
            }),
        )

        expect(response.status).toBe(204)
        expect(directwerkFetch).not.toHaveBeenCalled()
        expect(response.headers.getSetCookie().join('\n')).toContain('dw_refresh=')
    })

    it('clears the cookie and best-effort revokes the token', async () => {
        const response = await POST(
            new Request('http://localhost/api/auth/logout', {
                method: 'POST',
                headers: {cookie: 'dw_refresh=rt-1', 'x-tenant-host': 'acme.test'},
            }),
        )

        expect(response.status).toBe(204)
        expect(directwerkFetch).toHaveBeenCalledWith(
            expect.objectContaining({path: '/oauth2/revoke', tenantHost: 'acme.test'}),
        )
    })
})
