import {createPlatformRefreshRoute} from '@directwerk/api/server'
import {jsonError, parseTenantHost} from '@directwerk/api/proxy'
import {readRequestCookie} from '@directwerk/api/auth/cookies'
import {
    requestTenantRefresh,
    TENANT_HOST_COOKIE,
    TENANT_REFRESH_COOKIE,
} from '@/lib/server/api'
import {resolvePlatformAuthorization} from '@/lib/server/platform'

/** Reads the validated `X-Tenant-Host`; `preflight` has already rejected null. */
function requireTenantHost(request: Request): string {
    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        throw new Error('A valid tenant host is required.')
    }
    return tenantHost
}

export const POST = createPlatformRefreshRoute({
    refreshCookie: TENANT_REFRESH_COOKIE,
    // Tenant refresh requires a live platform admin session so a stolen
    // tenant refresh token does not outlive platform logout/expiry.
    gate: async () => {
        const platform = await resolvePlatformAuthorization()
        return platform.ok ? {ok: true} : {ok: false, status: platform.status}
    },
    preflight: (request) => {
        const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
        if (tenantHost === null) {
            return jsonError('A valid tenant host is required.', 400)
        }

        // Replay-scope binding: the refresh cookie was issued for the login host.
        const boundHost = readRequestCookie(request, TENANT_HOST_COOKIE)
        if (boundHost !== null && boundHost !== tenantHost) {
            return jsonError('Tenant session does not match this host.', 401)
        }

        return null
    },
    upstream: (refreshToken, request) =>
        requestTenantRefresh(refreshToken, requireTenantHost(request)),
})
