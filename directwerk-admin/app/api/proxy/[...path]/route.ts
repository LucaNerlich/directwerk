import {
    buildPlatformApiPath,
    parseBearerAuthorization,
    safeUpstreamResponse,
} from '@/lib/directwerk'
import {createConfiguredPlatformApiRequest} from '@/lib/directwerkServer'

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

    const {path} = await context.params

    try {
        buildPlatformApiPath(path)
    } catch {
        return Response.json({error: 'Invalid platform API path.'}, {status: 400})
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        const body = await request.clone().text()
        const isBodylessDelete =
            request.method === 'DELETE' && body.length === 0

        if (!isBodylessDelete) {
            if (!request.headers.get('content-type')?.includes('application/json')) {
                return Response.json(
                    {error: 'Content-Type must be application/json.'},
                    {status: 415}
                )
            }

            if (body.length > MAX_PROXY_BODY_SIZE) {
                return Response.json(
                    {error: 'Request body is too large.'},
                    {status: 413}
                )
            }

            try {
                JSON.parse(body)
            } catch {
                return Response.json({error: 'Invalid JSON request.'}, {status: 400})
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
