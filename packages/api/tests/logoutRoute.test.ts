import {describe, expect, it, vi} from 'vitest'

import {createLogoutRoute, createTenantRefreshTokenRevoker} from '../src/server/authRoutes'

describe('createLogoutRoute', () => {
    it('clears the configured cookies and answers 204 with no-store', async () => {
        const POST = createLogoutRoute({clearCookies: ['dw_refresh']})

        const response = await POST(new Request('http://localhost/api/auth/logout', {method: 'POST'}))

        expect(response.status).toBe(204)
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(response.headers.getSetCookie().join('\n')).toContain('dw_refresh=')
    })

    it('keeps the local logout when a revoke step fails', async () => {
        const POST = createLogoutRoute({
            clearCookies: ['dw_refresh'],
            revoke: [async () => Promise.reject(new Error('upstream down'))],
        })

        const response = await POST(new Request('http://localhost/api/auth/logout', {method: 'POST'}))

        expect(response.status).toBe(204)
    })

    it('runs a later revoke step even when an earlier one fails', async () => {
        const second = vi.fn().mockResolvedValue(undefined)
        const POST = createLogoutRoute({
            clearCookies: ['dw_refresh'],
            revoke: [
                async () => Promise.reject(new Error('first failed')),
                second,
            ],
        })

        const response = await POST(new Request('http://localhost/api/auth/logout', {method: 'POST'}))

        expect(response.status).toBe(204)
        expect(second).toHaveBeenCalled()
    })

    it('requires a tenant host when configured', async () => {
        const POST = createLogoutRoute({clearCookies: ['dw_refresh'], requireTenantHost: true})

        const response = await POST(new Request('http://localhost/api/auth/logout', {method: 'POST'}))

        expect(response.status).toBe(400)
    })

    it('rejects a foreign origin but allows a missing one', async () => {
        const POST = createLogoutRoute({clearCookies: ['dw_refresh'], guardSameOrigin: true})

        const foreign = await POST(
            new Request('http://localhost/api/auth/logout', {
                method: 'POST',
                headers: {origin: 'https://evil.example', host: 'localhost'},
            }),
        )
        const absent = await POST(new Request('http://localhost/api/auth/logout', {method: 'POST'}))
        const sameOrigin = await POST(
            new Request('http://localhost/api/auth/logout', {
                method: 'POST',
                headers: {origin: 'http://localhost', host: 'localhost'},
            }),
        )

        expect(foreign.status).toBe(403)
        expect(absent.status).toBe(204)
        // A guard that rejected every browser request would pass the two assertions above.
        expect(sameOrigin.status).toBe(204)
    })
})

describe('createTenantRefreshTokenRevoker', () => {
    it('posts the refresh token to /oauth2/revoke with the tenant host', async () => {
        const directwerkFetch = vi.fn().mockResolvedValue(new Response(null, {status: 200}))
        const revoke = createTenantRefreshTokenRevoker({
            directwerkFetch,
            refreshCookie: 'dw_refresh',
        })

        await revoke(
            new Request('http://localhost/api/auth/logout', {
                method: 'POST',
                headers: {cookie: 'dw_refresh=rt-1', 'x-tenant-host': 'acme.test'},
            }),
        )

        expect(directwerkFetch).toHaveBeenCalledWith({
            path: '/oauth2/revoke',
            tenantHost: 'acme.test',
            method: 'POST',
            body: 'token=rt-1&token_type_hint=refresh_token',
            contentType: 'application/x-www-form-urlencoded',
            useOAuthClient: true,
        })
    })

    it('does nothing without a cookie or tenant host', async () => {
        const directwerkFetch = vi.fn()
        const revoke = createTenantRefreshTokenRevoker({
            directwerkFetch,
            refreshCookie: 'dw_refresh',
        })

        await revoke(new Request('http://localhost/api/auth/logout', {method: 'POST'}))
        await revoke(
            new Request('http://localhost/api/auth/logout', {
                method: 'POST',
                headers: {cookie: 'dw_refresh=rt-1'},
            }),
        )

        expect(directwerkFetch).not.toHaveBeenCalled()
    })
})
