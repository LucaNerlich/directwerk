import {beforeEach, describe, expect, it, vi} from 'vitest'

import {POST} from './route'

vi.mock('server-only', () => ({}))

const revokePlatformRefreshToken = vi.fn()
const revokeTenantRefreshToken = vi.fn()

vi.mock('@/lib/server/api', () => ({
    PLATFORM_REFRESH_COOKIE: 'dw_admin_refresh',
    TENANT_REFRESH_COOKIE: 'dw_admin_tenant_refresh',
    TENANT_HOST_COOKIE: 'dw_admin_tenant_host',
    revokePlatformRefreshToken: (...args: unknown[]) => revokePlatformRefreshToken(...args),
    revokeTenantRefreshToken: (...args: unknown[]) => revokeTenantRefreshToken(...args),
}))

describe('POST /api/auth/logout', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        revokePlatformRefreshToken.mockResolvedValue(new Response(null, {status: 200}))
        revokeTenantRefreshToken.mockResolvedValue(new Response(null, {status: 200}))
    })

    it('revokes platform and tenant refresh tokens then clears cookies', async () => {
        const request = new Request('http://localhost/api/auth/logout', {
            method: 'POST',
            headers: {
                cookie: [
                    'dw_admin_refresh=platform-rt',
                    'dw_admin_tenant_refresh=tenant-rt',
                    'dw_admin_tenant_host=acme.test',
                ].join('; '),
            },
        })

        const response = await POST(request)

        expect(response.status).toBe(204)
        expect(revokePlatformRefreshToken).toHaveBeenCalledWith('platform-rt')
        expect(revokeTenantRefreshToken).toHaveBeenCalledWith('tenant-rt', 'acme.test')
        const setCookie = response.headers.getSetCookie?.() ?? []
        expect(setCookie.join('\n')).toContain('dw_admin_refresh=')
        expect(setCookie.join('\n')).toContain('dw_admin_tenant_refresh=')
        expect(setCookie.join('\n')).toContain('dw_admin_tenant_host=')
    })

    it('still clears cookies when upstream revoke fails', async () => {
        revokePlatformRefreshToken.mockRejectedValue(new Error('upstream down'))
        const request = new Request('http://localhost/api/auth/logout', {
            method: 'POST',
            headers: {cookie: 'dw_admin_refresh=platform-rt'},
        })

        const response = await POST(request)

        expect(response.status).toBe(204)
        expect(revokeTenantRefreshToken).not.toHaveBeenCalled()
    })

    it('skips tenant revoke when host cookie is missing', async () => {
        const request = new Request('http://localhost/api/auth/logout', {
            method: 'POST',
            headers: {
                cookie: 'dw_admin_tenant_refresh=tenant-rt',
            },
        })

        const response = await POST(request)

        expect(response.status).toBe(204)
        expect(revokePlatformRefreshToken).not.toHaveBeenCalled()
        expect(revokeTenantRefreshToken).not.toHaveBeenCalled()
    })
})
