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
})
