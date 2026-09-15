import {createPlatformTokenRoute} from '@directwerk/api/server'
import {jsonError, parseTenantHost} from '@directwerk/api/proxy'
import {
    requestTenantToken,
    TENANT_HOST_COOKIE,
    TENANT_REFRESH_COOKIE,
} from '@/lib/server/api'
import {resolvePlatformAuthorization} from '@/lib/server/platform'
import {validateLoginInput} from '@/lib/validation'

/** Reads the validated `X-Tenant-Host`; `preflight` has already rejected null. */
function requireTenantHost(request: Request): string {
    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        throw new Error('A valid tenant host is required.')
    }
    return tenantHost
}

export const POST = createPlatformTokenRoute({
    refreshCookie: TENANT_REFRESH_COOKIE,
    validate: validateLoginInput,
    // Brokering tenant logins requires an authenticated platform admin
    // session. Cookie presence alone is client-forgeable, so validate the
    // platform session server-side (refresh round-trip upstream).
    gate: async () => {
        const platform = await resolvePlatformAuthorization()
        return platform.ok ? {ok: true} : {ok: false, status: platform.status}
    },
    preflight: (request) =>
        parseTenantHost(request.headers.get('x-tenant-host')) === null
            ? jsonError('A valid tenant host is required.', 400)
            : null,
    upstream: (input, request) =>
        requestTenantToken(input, requireTenantHost(request)),
    finalize: (response, request) => {
        const tenantHost = requireTenantHost(request)
        const headers = new Headers(response.headers)
        // Bind the tenant refresh cookie to the login host so a stolen
        // refresh token cannot be replayed against another tenant host.
        // Note: this cookie is a replay-scope hint, not a security boundary
        // on its own — the platform-session gate above is the enforcement.
        headers.append(
            'Set-Cookie',
            `${TENANT_HOST_COOKIE}=${encodeURIComponent(tenantHost)}; Path=/; HttpOnly; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
        )
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        })
    },
})
