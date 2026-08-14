import {
    buildProxyPath,
    hasUnsupportedProxyQuery,
    readBearerToken,
} from '@/lib/api/proxy'
import {jsonError, toClientResponse} from '@/lib/api/upstream'
import {parseJsonText} from '@/lib/api/validation'
import {directwerkFetch} from '@/lib/directwerk'
import {parseTenantHost} from '@/lib/tenant/parseTenantHost'

interface RouteContext {
    params: Promise<{path: string[]}>
}

type ProxyMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

async function handleProxy(
    request: Request,
    context: RouteContext,
    method: ProxyMethod,
): Promise<Response> {
    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        return jsonError('A valid tenant is required.', 400)
    }

    const {path: segments} = await context.params
    const apiPath = buildProxyPath(segments)
    if (apiPath === null) {
        return jsonError('The requested API path is invalid.', 400)
    }

    if (hasUnsupportedProxyQuery(request.url)) {
        return jsonError('Query parameters are not supported.', 400)
    }

    const isPublicPath = apiPath.startsWith('/api/v1/public/')
    const bearerToken = isPublicPath
        ? undefined
        : readBearerToken(request.headers.get('authorization'))
    if (!isPublicPath && bearerToken === null) {
        return jsonError('A valid bearer token is required.', 401)
    }

    let body: string | undefined
    if (method !== 'GET') {
        const contentType = request.headers.get('content-type') ?? ''
        const contentLength = Number(request.headers.get('content-length') ?? 0)
        if (
            !contentType.toLowerCase().includes('application/json') ||
            !Number.isFinite(contentLength) ||
            contentLength > 16_384
        ) {
            return jsonError('A valid JSON request body is required.', 400)
        }

        body = await request.text()
        if (parseJsonText(body) === null) {
            return jsonError('A valid JSON request body is required.', 400)
        }
    }

    try {
        const response = await directwerkFetch({
            path: apiPath,
            tenantHost,
            method,
            bearerToken: bearerToken ?? undefined,
            body,
            contentType: body === undefined ? undefined : 'application/json',
        })

        return toClientResponse(response)
    } catch {
        return jsonError('The upstream service is unavailable.', 502)
    }
}

export function GET(request: Request, context: RouteContext): Promise<Response> {
    return handleProxy(request, context, 'GET')
}

export function POST(request: Request, context: RouteContext): Promise<Response> {
    return handleProxy(request, context, 'POST')
}

export function PUT(request: Request, context: RouteContext): Promise<Response> {
    return handleProxy(request, context, 'PUT')
}

export function PATCH(request: Request, context: RouteContext): Promise<Response> {
    return handleProxy(request, context, 'PATCH')
}

export function DELETE(request: Request, context: RouteContext): Promise<Response> {
    return handleProxy(request, context, 'DELETE')
}
