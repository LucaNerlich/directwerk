'use client'

import {parseTenantHost} from '@directwerk/api/proxy'
import {readTenantHostCookieFromDocument} from '@directwerk/api/tenant/tenantHostCookie'

/**
 * Tenant host for browser API calls on tenant-bound `directwerk-web` domains.
 * Falls back to the page hostname when no studio workspace cookie is present.
 */
export function getWebClientTenantHost(): string {
    const fromCookie = readTenantHostCookieFromDocument()
    if (fromCookie !== null) {
        return fromCookie
    }

    if (typeof window !== 'undefined') {
        const fromLocation = parseTenantHost(window.location.hostname)
        if (fromLocation !== null) {
            return fromLocation
        }
    }

    return ''
}

/** Alias kept for call sites that mirror the shared API naming. */
export const getClientTenantHost = getWebClientTenantHost
