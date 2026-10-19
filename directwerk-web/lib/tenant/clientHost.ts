'use client'

import {parseTenantHost} from '@directwerk/api/proxy'

/**
 * Tenant host for browser API calls on tenant-bound `directwerk-web` domains.
 *
 * Issue #342: the page host is authoritative. The `dw-tenant-host` cookie is client-writable
 * studio workspace state and is never read here (issue #570 removed the no-op read: after #342
 * both branches of the old ternary returned the page host anyway).
 */
export function getWebClientTenantHost(): string {
    if (typeof window === 'undefined') {
        return ''
    }

    const fromLocation = parseTenantHost(window.location.hostname)
    if (fromLocation === null) {
        return ''
    }

    return fromLocation
}
