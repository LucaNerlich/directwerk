import {safeUpstreamResponse} from '@directwerk/api/server'
import {requestTenantToken} from '@/lib/server/api'
import {readBoundedRequestBody} from '@directwerk/api/proxy'
import {parseTenantHost} from '@directwerk/api/proxy'
import {TENANT_HOST_COOKIE, TENANT_REFRESH_COOKIE} from '@/lib/server/api'
import {sealRefreshToken} from '@directwerk/api/auth/cookies'
import {resolvePlatformAuthorization} from '@/lib/server/platform'
import {validateLoginInput} from '@/lib/validation'

const MAX_LOGIN_BODY_SIZE = 16 * 1024

export async function POST(request: Request): Promise<Response> {
    // Brokering tenant logins requires an authenticated platform admin
    // session. Cookie presence alone is client-forgeable, so validate the
    // platform session server-side (refresh round-trip upstream).
    const platform = await resolvePlatformAuthorization()
    if (!platform.ok) {
        return Response.json(
            {error: 'A platform admin session is required.'},
            {status: platform.status}
        )
    }
    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        return Response.json(
            {error: 'A valid tenant host is required.'},
            {status: 400}
        )
    }

    if (!request.headers.get('content-type')?.includes('application/json')) {
        return Response.json(
            {error: 'Content-Type must be application/json.'},
            {status: 415}
        )
    }

    const contentLength = request.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_LOGIN_BODY_SIZE) {
        return Response.json({error: 'Request body is too large.'}, {status: 413})
    }

    try {
        const bounded = await readBoundedRequestBody(request, MAX_LOGIN_BODY_SIZE)
        if (!bounded.ok) {
            return Response.json({error: bounded.error}, {status: bounded.status})
        }

        let input: unknown
        try {
            input = JSON.parse(bounded.text)
        } catch {
            return Response.json({error: 'Invalid JSON request.'}, {status: 400})
        }

        const validation = validateLoginInput(input)
        if (!validation.success) {
            return Response.json({error: validation.error}, {status: 400})
        }

        const upstream = await requestTenantToken(validation.data, tenantHost)
        const sealed = await sealRefreshToken(
            await safeUpstreamResponse(upstream),
            TENANT_REFRESH_COOKIE
        )
        const headers = new Headers(sealed.headers)
        headers.set('Cache-Control', 'no-store')
        headers.set('Pragma', 'no-cache')
        // Bind the tenant refresh cookie to the login host so a stolen
        // refresh token cannot be replayed against another tenant host.
        // Note: this cookie is a replay-scope hint, not a security boundary
        // on its own — the platform-session gate above is the enforcement.
        headers.append(
            'Set-Cookie',
            `${TENANT_HOST_COOKIE}=${encodeURIComponent(tenantHost)}; Path=/; HttpOnly; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
        )
        return new Response(sealed.body, {
            status: sealed.status,
            statusText: sealed.statusText,
            headers,
        })
    } catch {
        return Response.json(
            {error: 'Authentication service is unavailable.'},
            {status: 502}
        )
    }
}
