import {safeUpstreamResponse} from '@/lib/directwerk'
import {requestTenantRefresh} from '@/lib/directwerkServer'
import {readBoundedRequestBody} from '@/lib/http/readBoundedRequestBody'
import {parseTenantHost} from '@/lib/tenant/parseTenantHost'
import {TENANT_REFRESH_COOKIE, readRequestCookie, sealRefreshToken} from '@/lib/auth/cookies'
import {validateRefreshTokenInput} from '@/lib/validation'

const MAX_REFRESH_BODY_SIZE = 16 * 1024

export async function POST(request: Request): Promise<Response> {
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
    if (contentLength && Number(contentLength) > MAX_REFRESH_BODY_SIZE) {
        return Response.json({error: 'Request body is too large.'}, {status: 413})
    }

    try {
        // Prefer the httpOnly refresh cookie set by login/refresh; the JSON body
        // is only a fallback for clients that predate cookie-based refresh.
        let refreshToken = readRequestCookie(request, TENANT_REFRESH_COOKIE)

        if (!refreshToken) {
            if (!request.body) {
                return Response.json({error: 'Invalid request body.'}, {status: 400})
            }

            const bounded = await readBoundedRequestBody(
                request,
                MAX_REFRESH_BODY_SIZE
            )
            if (!bounded.ok) {
                return Response.json(
                    {error: bounded.error},
                    {status: bounded.status}
                )
            }

            let input: unknown
            try {
                input = JSON.parse(bounded.text)
            } catch {
                return Response.json({error: 'Invalid JSON request.'}, {status: 400})
            }

            const validation = validateRefreshTokenInput(input)
            if (!validation.success) {
                return Response.json({error: validation.error}, {status: 400})
            }
            refreshToken = validation.data.refresh_token
        }

        if (!refreshToken) {
            return Response.json(
                {error: 'A valid refresh token is required.'},
                {status: 401}
            )
        }

        const upstream = await requestTenantRefresh(refreshToken, tenantHost)
        const sealed = await sealRefreshToken(
            await safeUpstreamResponse(upstream),
            TENANT_REFRESH_COOKIE
        )
        const headers = new Headers(sealed.headers)
        headers.set('Cache-Control', 'no-store')
        headers.set('Pragma', 'no-cache')
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
