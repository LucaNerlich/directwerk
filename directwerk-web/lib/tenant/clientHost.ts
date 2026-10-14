'use client'

import {parseTenantHost} from '@directwerk/api/proxy'
import {readTenantHostCookieFromDocument} from '@directwerk/api/tenant'

/**
 * Tenant host for browser API calls on tenant-bound `directwerk-web` domains.
 *
 * Issue #342: the `dw-tenant-host` cookie is client-writable studio workspace state. Trusting it
 * here let a cookie value point the tenant-bound public site (including subscriber credentials and
 * every /api/proxy call) at a different tenant than the page host. The page host is authoritative;
 * the cookie is only accepted when it matches it, which preserves deployments that set it for the
 * same host.
 */
export function getWebClientTenantHost(): string {
    if (typeof window === 'undefined') {
        return ''
    }

    const fromLocation = parseTenantHost(window.location.hostname)
    if (fromLocation === null) {
        return ''
    }

    const fromCookie = readTenantHostCookieFromDocument()
    return fromCookie !== null && fromCookie === fromLocation ? fromCookie : fromLocation
}
