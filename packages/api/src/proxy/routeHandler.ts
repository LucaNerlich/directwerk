import type {HttpMethod} from '../server/transport'
import {parseJsonText} from '../validation/json'
import {buildProxyPath, hasUnsupportedProxyQuery, readBearerToken} from './path'
import {parseTenantHost} from './tenantHost'
import {jsonError, toClientResponse} from './upstreamResponse'

export {buildProxyPath, hasUnsupportedProxyQuery, readBearerToken} from './path'
export {parseTenantHost} from './tenantHost'
export {jsonError, toClientResponse, NO_STORE_HEADERS} from './upstreamResponse'
export {readBoundedBody, readBoundedRequestBody} from './boundedBody'

export type {HttpMethod}

export interface UpstreamFetchRequest {
    path: string
    tenantHost: string
    method: HttpMethod
    bearerToken?: string
    body?: string
    contentType?: 'application/json' | 'application/x-www-form-urlencoded'
}

export interface TenantProxyRouteHandlerConfig {
    /** The app's configured SSRF-guarded upstream client. */
    fetchUpstream: (request: UpstreamFetchRequest) => Promise<Response>
    /**
     * Maximum accepted JSON request-body size in bytes.
     * directwerk-studio uses 1 MiB, directwerk-web 16 KiB.
     */
    jsonBodyLimit: number
    /**
     * Treat a missing/zero Content-Length as an absent body
     * (directwerk-studio behaviour).
     */
    allowMissingBody?: boolean
}

export interface ProxyRouteContext {
    params: Promise<{path: string[]}>
}

type ProxyMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type TenantProxyRouteHandlers = Record<
    'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    (request: Request, context: ProxyRouteContext) => Promise<Response>
>

/**
 * Builds the catch-all BFF proxy route handlers (`app/api/proxy/[...path]`).
 *
 * Behaviour (identical across apps):
 * - requires a valid `X-Tenant-Host` header
 * - rejects unsafe path segments and any query string
 * - requires a bearer token unless the path is public (`/api/v1/public/…`)
 * - enforces a JSON-only request body within the configured byte limit
 * - normalizes upstream failures into JSON error responses
 */
export function createTenantProxyRouteHandler(
    config: TenantProxyRouteHandlerConfig,
): TenantProxyRouteHandlers {
    async function handleProxy(
        request: Request,
        context: ProxyRouteContext,
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
            if (config.allowMissingBody === true && contentLength === 0) {
                body = undefined
            } else if (
                !contentType.toLowerCase().includes('application/json') ||
                !Number.isFinite(contentLength) ||
                contentLength > config.jsonBodyLimit
            ) {
                return jsonError('A valid JSON request body is required.', 400)
            } else {
                body = await request.text()
                if (parseJsonText(body) === null) {
                    return jsonError('A valid JSON request body is required.', 400)
                }
            }
        }

        try {
            const response = await config.fetchUpstream({
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

    return {
        GET: (request, context) => handleProxy(request, context, 'GET'),
        POST: (request, context) => handleProxy(request, context, 'POST'),
        PUT: (request, context) => handleProxy(request, context, 'PUT'),
        PATCH: (request, context) => handleProxy(request, context, 'PATCH'),
        DELETE: (request, context) => handleProxy(request, context, 'DELETE'),
    }
}
