'use client'

import {readTenantHostCookieFromDocument} from './tenantHostCookie'

/** Tenant host for browser API calls — set after studio workspace selection. */
export function getClientTenantHost(): string {
    return readTenantHostCookieFromDocument() ?? ''
}
