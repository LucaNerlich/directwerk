import {
    buildSafePlatformQueryString,
    buildTenantApiPath,
    jsonError,
    parseBearerAuthorization,
    safeUpstreamResponse,
} from '@directwerk/api/server'
import {requestTenantApi} from '@/lib/server/api'
import {readBoundedRequestBody} from '@directwerk/api/proxy'
import {parseTenantHost} from '@directwerk/api/proxy'

interface RouteContext {
    params: Promise<{path: string[]}>
}

const MAX_PROXY_BODY_SIZE = 64 * 1024

async function proxy(request: Request, context: RouteContext): Promise<Response> {
    const authorization = parseBearerAuthorization(
        request.headers.get('authorization')
    )
    if (!authorization) {
        return jsonError('Authentication required.', 401)
    }

    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        return jsonError('A valid tenant host is required.', 400)
    }

    const {path} = await context.params

    let apiPath: string
    try {
        apiPath = buildTenantApiPath(path)
    } catch {
        return jsonError('Invalid tenant API path.', 400)
    }

    let queryString = ''
    try {
        queryString = buildSafePlatformQueryString(
            new URL(request.url).searchParams
        )
    } catch {
        return jsonError('Invalid tenant API query.', 400)
    }

    let body: string | undefined
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        const contentLength = request.headers.get('content-length')
        if (contentLength && Number(contentLength) > MAX_PROXY_BODY_SIZE) {
            return jsonError('Request body is too large.', 413)
        }

        const bounded = await readBoundedRequestBody(
            request,
            MAX_PROXY_BODY_SIZE
        )
        if (!bounded.ok) {
            return jsonError(bounded.error, bounded.status)
        }

        body = bounded.text
        const isBodylessDelete =
            request.method === 'DELETE' && body.length === 0

        if (!isBodylessDelete) {
            if (!request.headers.get('content-type')?.includes('application/json')) {
                return jsonError('Content-Type must be application/json.', 415)
            }

            try {
                JSON.parse(body)
            } catch {
                return jsonError('Invalid JSON request.', 400)
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
        return jsonError('Directwerk service is unavailable.', 502)
    }
}

export const GET = proxy
export const HEAD = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
