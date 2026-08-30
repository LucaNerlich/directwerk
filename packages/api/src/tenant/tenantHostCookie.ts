import {parseTenantHost} from '../proxy/tenantHost'

/** Cookie storing the tenant domain chosen after studio workspace login. */
export const TENANT_HOST_COOKIE = 'dw-tenant-host'

/** Reads the selected tenant host from `document.cookie` (client only). */
export function readTenantHostCookieFromDocument(): string | null {
    if (typeof document === 'undefined') {
        return null
    }

    const prefix = `${TENANT_HOST_COOKIE}=`
    for (const part of document.cookie.split(';')) {
        const trimmed = part.trim()
        if (trimmed.startsWith(prefix)) {
            const value = decodeURIComponent(trimmed.slice(prefix.length))
            return parseTenantHost(value)
        }
    }

    return null
}

/** Clears the tenant-host cookie in the browser. */
export function clearTenantHostCookieInDocument(): void {
    if (typeof document === 'undefined') {
        return
    }

    document.cookie = `${TENANT_HOST_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`
}
