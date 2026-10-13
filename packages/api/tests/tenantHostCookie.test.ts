import {afterEach, describe, expect, it} from 'vitest'

import {
    readTenantHostCookieFromDocument,
    TENANT_HOST_COOKIE,
} from '../src/tenant/tenantHostCookie'

describe('readTenantHostCookieFromDocument', () => {
    afterEach(() => {
        document.cookie = `${TENANT_HOST_COOKIE}=; Max-Age=0; path=/`
    })

    it('reads and normalizes a valid tenant host', () => {
        document.cookie = `${TENANT_HOST_COOKIE}=Example.COM`

        expect(readTenantHostCookieFromDocument()).toBe('example.com')
    })

    it('returns null on a malformed percent-encoding instead of throwing', () => {
        // #333: a stray '%' made decodeURIComponent throw URIError, which escaped
        // getClientTenantHost -> baseHeaders and broke every browser API call.
        document.cookie = `${TENANT_HOST_COOKIE}=%`

        expect(readTenantHostCookieFromDocument()).toBeNull()
    })

    it('returns null when the cookie is absent', () => {
        expect(readTenantHostCookieFromDocument()).toBeNull()
    })
})
