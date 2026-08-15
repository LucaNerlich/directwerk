import {
    buildSafePlatformQueryString,
    buildTenantApiPath,
    parseBearerAuthorization,
    safeUpstreamResponse,
} from '@/lib/directwerk'
import {requestTenantApi} from '@/lib/directwerkServer'
import {readBoundedRequestBody} from '@/lib/http/readBoundedRequestBody'
import {parseTenantHost} from '@/lib/tenant/parseTenantHost'

interface RouteContext {
    params: Promise<{path: string[]}>
}

const MAX_PROXY_BODY_SIZE = 64 * 1024

async function proxy(request: Request, context: RouteContext): Promise<Response> {
    const authorization = parseBearerAuthorization(
        request.headers.get('authorization')
    )
    if (!authorization) {
        return Response.json({error: 'Authentication required.'}, {status: 401})
    }

    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        return Response.json(
            {error: 'A valid tenant host is required.'},
            {status: 400}
        )
    }

    const {path} = await context.params

    let apiPath: string
    try {
        apiPath = buildTenantApiPath(path)
    } catch {
        return Response.json({error: 'Invalid tenant API path.'}, {status: 400})
    }

    let queryString = ''
    if (request.method === 'GET' || request.method === 'HEAD') {
        try {
            queryString = buildSafePlatformQueryString(
                new URL(request.url).searchParams
            )
        } catch {
            return Response.json(
                {error: 'Invalid tenant API query.'},
                {status: 400}
            )
        }
    }

    let body: string | undefined
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        const contentLength = request.headers.get('content-length')
        if (contentLength && Number(contentLength) > MAX_PROXY_BODY_SIZE) {
            return Response.json(
                {error: 'Request body is too large.'},
                {status: 413}
            )
        }

        const bounded = await readBoundedRequestBody(
            request,
            MAX_PROXY_BODY_SIZE
        )
        if (!bounded.ok) {
            return Response.json(
                {error: bounded.error},
                {status: bounded.status}
            )
        }

        body = bounded.text
        const isBodylessDelete =
            request.method === 'DELETE' && body.length === 0

        if (!isBodylessDelete) {
            if (!request.headers.get('content-type')?.includes('application/json')) {
                return Response.json(
                    {error: 'Content-Type must be application/json.'},
                    {status: 415}
                )
            }

            try {
                JSON.parse(body)
            } catch {
                return Response.json({error: 'Invalid JSON request.'}, {status: 400})
            }
        } else {
            body = undefined
        }
    }

    try {
        const upstream = await requestTenantApi(
            `${apiPath}${queryString}`,
            tenantHost,
            request.method as 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
            authorization,
            body
        )
        return safeUpstreamResponse(upstream, request.method)
    } catch {
        return Response.json(
            {error: 'Directwerk service is unavailable.'},
            {status: 502}
        )
    }
}

export const GET = proxy
export const HEAD = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
