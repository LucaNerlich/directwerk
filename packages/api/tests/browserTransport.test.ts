import {describe, expect, it, vi} from 'vitest'

import {createBrowserTransport} from '../src/client/createBrowserTransport'

describe('createBrowserTransport tenant headers', () => {
    it('passes explicit tenantHost through authenticated proxy requests', async () => {
        const fetchMock = vi.fn(async (_path: string, init?: RequestInit) => {
            const headers = init?.headers as Record<string, string>
            expect(headers['X-Tenant-Host']).toBe('tenant.example.com')
            return new Response(JSON.stringify({data: {id: 1}}), {
                status: 200,
                headers: {'Content-Type': 'application/json'},
            })
        })

        vi.stubGlobal('fetch', fetchMock)

        const transport = createBrowserTransport({
            policy: {
                authFailureMode: 'preserve-transient',
                finalUnauthorized: 'localized-error',
                invalidResponseMessage: 'invalid',
                catalog: {fallback: () => 'failed'},
            },
            session: {
                getValidAccessToken: async () => 'token',
                refreshAccessToken: async () => 'token',
            },
            clearTokens: () => {},
            resolveTenantHost: () => '',
            includeProxyRequest: true,
        })

        await transport.proxyRequest!(
            '/api/proxy/me',
            'tenant.example.com',
            {method: 'GET'},
            (value) => value as {data: {id: number}},
            'invalid me',
        )

        vi.unstubAllGlobals()
    })

    it('passes explicit tenantHost through unauthenticated postJson calls', async () => {
        const fetchMock = vi.fn(async (_path: string, init?: RequestInit) => {
            const headers = init?.headers as Record<string, string>
            expect(headers['X-Tenant-Host']).toBe('tenant.example.com')
            return new Response(JSON.stringify({access_token: 'abc', expires_in: 900}), {
                status: 200,
                headers: {'Content-Type': 'application/json'},
            })
        })

        vi.stubGlobal('fetch', fetchMock)

        const transport = createBrowserTransport({
            policy: {
                authFailureMode: 'preserve-transient',
                finalUnauthorized: 'localized-error',
                invalidResponseMessage: 'invalid',
                catalog: {fallback: () => 'failed'},
            },
            session: {
                getValidAccessToken: async () => 'token',
                refreshAccessToken: async () => 'token',
            },
            clearTokens: () => {},
            resolveTenantHost: () => 'studio.example.com',
        })

        await transport.postJson('/api/auth/login', 'tenant.example.com', {
            email: 'a@example.com',
            password: 'passwordpassword',
        })

        vi.unstubAllGlobals()
    })

    /**
     * #428 removed the (always-redundant) tenantHost argument from ~100 studio API wrappers and
     * their call sites, so every one of those requests now relies on this fallback for tenant
     * scoping. Pin it: an omitted/empty host must still send X-Tenant-Host, taken from
     * resolveTenantHost (which reads the workspace cookie). Without this, a regression in the
     * fallback would silently send a tenant-scoped request with no tenant binding at all.
     */
    it('falls back to resolveTenantHost when no explicit tenantHost is passed', async () => {
        let seen: Record<string, string> = {}
        const fetchMock = vi.fn(async (_path: string, init?: RequestInit) => {
            seen = init?.headers as Record<string, string>
            return new Response(JSON.stringify({data: {id: 1}}), {
                status: 200,
                headers: {'Content-Type': 'application/json'},
            })
        })

        vi.stubGlobal('fetch', fetchMock)

        const transport = createBrowserTransport({
            policy: {
                authFailureMode: 'preserve-transient',
                finalUnauthorized: 'localized-error',
                invalidResponseMessage: 'invalid',
                catalog: {fallback: () => 'failed'},
            },
            session: {
                getValidAccessToken: async () => 'token',
                refreshAccessToken: async () => 'token',
            },
            clearTokens: () => {},
            resolveTenantHost: () => 'studio.example.com',
            includeProxyRequest: true,
        })

        await transport.proxyRequest!(
            '/api/proxy/me',
            '',
            {method: 'GET'},
            (value) => value as {data: {id: number}},
            'invalid me',
        )

        expect(seen['X-Tenant-Host']).toBe('studio.example.com')

        vi.unstubAllGlobals()
    })
})
