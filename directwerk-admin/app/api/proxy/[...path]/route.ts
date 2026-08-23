import {
    buildPlatformApiPath,
    jsonError,
    parseBearerAuthorization,
    safeUpstreamResponse,
} from '@/lib/directwerk'
import {createConfiguredPlatformApiRequest} from '@/lib/directwerkServer'
import {readBoundedRequestBody} from '@/lib/http/readBoundedRequestBody'

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

    const {path} = await context.params

    try {
        buildPlatformApiPath(path)
    } catch {
        return jsonError('Invalid platform API path.', 400)
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        const bounded = await readBoundedRequestBody(request, MAX_PROXY_BODY_SIZE)
        const body = bounded.ok ? bounded.text : ''
        const isBodylessDelete =
            request.method === 'DELETE' && body.length === 0

        if (!isBodylessDelete) {
            if (!bounded.ok) {
                return jsonError(bounded.error, bounded.status)
            }

            if (!request.headers.get('content-type')?.includes('application/json')) {
                return jsonError('Content-Type must be application/json.', 415)
            }

            try {
                JSON.parse(body)
            } catch {
                return jsonError('Invalid JSON request.', 400)
            }
        }
    }

    try {
        const upstreamRequest = createConfiguredPlatformApiRequest(
            path,
            request,
            authorization
        )
        const upstream = await fetch(upstreamRequest.url, upstreamRequest.init)
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
