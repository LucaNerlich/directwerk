import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {AUTH_REQUIRED, AUTH_TRANSIENT} from '@directwerk/api/constants'

import {loginTenantSession, refreshTenantAccessToken} from './tenantSession'

const accessTokenKey = 'publish_admin_tenant_access'
const tenantHostKey = 'publish_admin_tenant_host'

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((res) => {
        resolve = res
    })
    return {promise, resolve}
}

describe('refreshTenantAccessToken', () => {
    beforeEach(() => {
        sessionStorage.clear()
    })

    afterEach(() => {
        vi.restoreAllMocks()
        sessionStorage.clear()
    })

    it('invalidates an in-flight refresh when the tenant host is missing', async () => {
        const gate = deferred<Response>()
        sessionStorage.setItem(accessTokenKey, 'old-token')
        sessionStorage.setItem(tenantHostKey, 'tenant.example.test')
        vi.spyOn(globalThis, 'fetch').mockImplementation(
            () => gate.promise as Promise<Response>,
        )

        const pendingRefresh = refreshTenantAccessToken()
        sessionStorage.removeItem(tenantHostKey)
        window.dispatchEvent(
            new StorageEvent('storage', {
                key: tenantHostKey,
                storageArea: sessionStorage,
            }),
        )

        await expect(refreshTenantAccessToken()).rejects.toThrow(AUTH_REQUIRED)
        expect(sessionStorage.getItem(accessTokenKey)).toBeNull()

        gate.resolve(
            new Response(JSON.stringify({access_token: 'stale-token'}), {
                status: 200,
            }),
        )

        await expect(pendingRefresh).rejects.toThrow(AUTH_TRANSIENT)
        expect(sessionStorage.getItem(accessTokenKey)).toBeNull()
    })

    it('keeps the tenant login when a refresh started before it resolves later', async () => {
        const loginGate = deferred<Response>()
        const refreshGate = deferred<Response>()
        sessionStorage.setItem(accessTokenKey, 'old-token')
        sessionStorage.setItem(tenantHostKey, 'tenant-a.example.test')
        vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
            const url = String(input)
            return (url.includes('tenant-login') ? loginGate.promise : refreshGate.promise) as Promise<Response>
        })

        const login = loginTenantSession({
            email: 'admin@example.com',
            password: 'secret',
            tenantHost: 'tenant-b.example.test',
        })
        const pendingRefresh = refreshTenantAccessToken()

        loginGate.resolve(new Response(
            JSON.stringify({access_token: 'fresh-token', expires_in: 900}),
            {status: 200},
        ))
        await login

        refreshGate.resolve(new Response(
            JSON.stringify({access_token: 'stale-token', expires_in: 900}),
            {status: 200},
        ))
        await expect(pendingRefresh).rejects.toThrow(AUTH_TRANSIENT)
        expect(sessionStorage.getItem(accessTokenKey)).toBe('fresh-token')
        expect(sessionStorage.getItem(tenantHostKey)).toBe('tenant-b.example.test')
    })
})
