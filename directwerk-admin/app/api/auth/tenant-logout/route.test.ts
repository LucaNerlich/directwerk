import {describe, expect, it, vi} from 'vitest'

import {POST} from './route'

vi.mock('server-only', () => ({}))

const revokeTenantRefreshToken = vi.fn()

vi.mock('@/lib/server/api', () => ({
    TENANT_HOST_COOKIE: 'dw_admin_tenant_host',
    TENANT_REFRESH_COOKIE: 'dw_admin_tenant_refresh',
    revokeTenantRefreshToken: (...args: unknown[]) => revokeTenantRefreshToken(...args),
}))

describe('tenant logout route', () => {
    it('revokes the tenant token and clears both tenant cookies', async () => {
        revokeTenantRefreshToken.mockResolvedValue(new Response(null, {status: 200}))
        const request = new Request('http://localhost/api/auth/tenant-logout', {
            method: 'POST',
            headers: {
                cookie: 'dw_admin_tenant_refresh=tenant-rt; dw_admin_tenant_host=acme.test',
            },
        })

        const response = await POST(request)
        const setCookie = response.headers.getSetCookie().join('\n')

        expect(response.status).toBe(204)
        expect(revokeTenantRefreshToken).toHaveBeenCalledWith('tenant-rt', 'acme.test')
        expect(setCookie).toContain('dw_admin_tenant_refresh=')
        expect(setCookie).toContain('dw_admin_tenant_host=')
        expect(setCookie).toContain('Max-Age=0')
    })
})
