import {parseTenantHost} from '@directwerk/api/proxy'

/**
 * Reads the validated `X-Tenant-Host` header. Shared by the tenant login and refresh BFF
 * routes, which previously carried byte-identical private copies (issue #437).
 *
 * The routes' `preflight` already rejects a missing header, so a null here is a programming
 * error rather than client input.
 */
export function requireTenantHost(request: Request): string {
    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        throw new Error('A valid tenant host is required.')
    }
    return tenantHost
}
