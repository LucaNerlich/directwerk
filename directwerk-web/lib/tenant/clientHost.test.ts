// @vitest-environment jsdom

import {afterEach, describe, expect, it} from 'vitest'

import {TENANT_HOST_COOKIE} from '@directwerk/api/tenant'

import {getWebClientTenantHost} from './clientHost'

/**
 * `getWebClientTenantHost` decides which tenant every browser API call on `directwerk-web` is
 * scoped to — it backs the transport's `resolveTenantHost`, so an error here is a cross-tenant
 * bug, not a cosmetic one. It had no test, and #342 changed its precedence (the page host now
 * wins over the client-writable studio cookie), so this pins the rule.
 */
function withHostname(hostname: string, fn: () => void): void {
    const original = window.location
    Object.defineProperty(window, 'location', {configurable: true, value: {hostname}})
    try {
        fn()
    } finally {
        Object.defineProperty(window, 'location', {configurable: true, value: original})
    }
}

afterEach(() => {
    document.cookie = `${TENANT_HOST_COOKIE}=; Max-Age=0; path=/`
})

describe('getWebClientTenantHost', () => {
    it('uses the page host', () => {
        withHostname('alpha.example.com', () => {
            expect(getWebClientTenantHost()).toBe('alpha.example.com')
        })
    })

    it('ignores a studio cookie that points at a different tenant', () => {
        document.cookie = `${TENANT_HOST_COOKIE}=other-tenant.example.com`

        withHostname('alpha.example.com', () => {
            // The whole point of #342: a cookie from a shared studio domain must not re-point the
            // tenant-bound public site (and the subscriber credentials it sends) at another tenant.
            expect(getWebClientTenantHost()).toBe('alpha.example.com')
        })
    })

    it('accepts a cookie that matches the page host', () => {
        document.cookie = `${TENANT_HOST_COOKIE}=alpha.example.com`

        withHostname('alpha.example.com', () => {
            expect(getWebClientTenantHost()).toBe('alpha.example.com')
        })
    })

    it('returns an empty host when the page hostname is not a valid host', () => {
        // parseTenantHost rejects an empty/invalid hostname, and the function must not fall back
        // to the cookie in that case — an unbound host is safer than a cookie-chosen tenant.
        document.cookie = `${TENANT_HOST_COOKIE}=other-tenant.example.com`

        withHostname('', () => {
            expect(getWebClientTenantHost()).toBe('')
        })
    })
})
