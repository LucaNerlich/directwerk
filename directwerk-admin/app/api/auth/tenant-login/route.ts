import {safeUpstreamResponse} from '@/lib/directwerk'
import {requestTenantToken} from '@/lib/directwerkServer'
import {readBoundedRequestBody} from '@/lib/http/readBoundedRequestBody'
import {parseTenantHost} from '@/lib/tenant/parseTenantHost'
import {validateLoginInput} from '@/lib/validation'

const MAX_LOGIN_BODY_SIZE = 16 * 1024

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
        const response = await safeUpstreamResponse(upstream)
        const headers = new Headers(response.headers)
        headers.set('Cache-Control', 'no-store')
        headers.set('Pragma', 'no-cache')
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        })
    } catch {
        return Response.json(
            {error: 'Authentication service is unavailable.'},
            {status: 502}
        )
    }
}
