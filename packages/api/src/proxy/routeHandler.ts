import type {HttpMethod} from '../server/transport'
import {readJsonBody} from './boundedBody'
import {
    buildProxyPath,
    buildSafeProxyQuery,
    hasUnsupportedProxyQuery,
    readBearerToken,
} from './path'
import {parseTenantHost} from './tenantHost'
import {jsonError, toClientResponse} from './upstreamResponse'

export interface UpstreamFetchRequest {
    path: string
    tenantHost: string
    method: HttpMethod
    bearerToken?: string
    body?: string
    contentType?: 'application/json' | 'application/x-www-form-urlencoded'
    /**
     * Canonical `?…` query for allowlisted paths (feed-builder previews,
     * media library list/delete — built by {@link buildSafeProxyQuery});
     * undefined everywhere else.
     */
    query?: string
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

type ProxyMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type TenantProxyRouteHandlers = Record<
    'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    (request: Request, context: ProxyRouteContext) => Promise<Response>
>

/**
 * Builds the catch-all BFF proxy route handlers (`app/api/proxy/[...path]`).
 *
 * Behaviour (identical across apps):
 * - requires a valid `X-Tenant-Host` header
 * - rejects unsafe path segments and query strings except the allowlisted
 *   feed-builder preview id lists (`formatIds` / `categoryIds`) and the
 *   media-library list/delete filter params
 * - requires a bearer token unless the path is public (`/api/v1/public/…`)
 * - enforces a JSON-only request body within the configured byte limit
 * - normalizes upstream failures into JSON error responses
 */
export function createTenantProxyRouteHandler(
    config: TenantProxyRouteHandlerConfig,
): TenantProxyRouteHandlers {
    async function proxyUpstream(
        request: Request,
        resolved: {
            tenantHost: string
            apiPath: string
            method: ProxyMethod
            bearerToken: string | undefined
            query?: string
        },
    ): Promise<Response> {
        const {tenantHost, apiPath, method, bearerToken, query} = resolved
        let body: string | undefined
        // HEAD is treated exactly like GET: no body is read; the method is
        // forwarded as HEAD (PROXY_POLICIES rows set allowHead: true).
        if (method !== 'GET' && method !== 'HEAD') {
            // Never trust Content-Length for the size gate — chunked/streamed
            // bodies can lie. readJsonBody reads the stream with a hard byte
            // cap instead (oversize -> 413).
            const parsed = await readJsonBody(request, {
                jsonBodyLimit: config.jsonBodyLimit,
                allowMissingBody: config.allowMissingBody === true,
            })
            if (!parsed.ok) {
                if (parsed.status === 413) {
                    return jsonError('The request body is too large.', 413)
                }
                if (parsed.status === 415) {
                    return jsonError(
                        'Content-Type must be application/json.',
                        415,
                    )
                }
                return jsonError(
                    'A valid JSON request body is required.',
                    400,
                )
            }
            body = parsed.text
        }

        try {
            const response = await config.fetchUpstream({
                path: apiPath,
                tenantHost,
                method,
                bearerToken,
                body,
                contentType: body === undefined ? undefined : 'application/json',
                query,
            })

            return toClientResponse(response)
        } catch {
            return jsonError('The upstream service is unavailable.', 502)
        }
    }

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

        const isPublicPath = apiPath.startsWith('/api/v1/public/')
        const bearerToken = isPublicPath
            ? undefined
            : readBearerToken(request.headers.get('authorization'))
        if (!isPublicPath && bearerToken === null) {
            return jsonError('A valid bearer token is required.', 401)
        }

        if (hasUnsupportedProxyQuery(request.url)) {
            // Only the feed-builder previews and the media-library
            // list/delete endpoints carry query strings; anything else
            // (or a malformed query) keeps the blanket rejection. HEAD is
            // validated like GET but still forwarded as HEAD.
            const query = buildSafeProxyQuery(
                apiPath,
                method === 'HEAD' ? 'GET' : method,
                new URL(request.url).searchParams,
            )
            if (query === null) {
                return jsonError('Query parameters are not supported.', 400)
            }
            return proxyUpstream(request, {
                tenantHost,
                apiPath,
                method,
                bearerToken: bearerToken ?? undefined,
                query,
            })
        }

        return proxyUpstream(request, {
            tenantHost,
            apiPath,
            method,
            bearerToken: bearerToken ?? undefined,
        })
    }

    return {
        GET: (request, context) => handleProxy(request, context, 'GET'),
        HEAD: (request, context) => handleProxy(request, context, 'HEAD'),
        POST: (request, context) => handleProxy(request, context, 'POST'),
        PUT: (request, context) => handleProxy(request, context, 'PUT'),
        PATCH: (request, context) => handleProxy(request, context, 'PATCH'),
        DELETE: (request, context) => handleProxy(request, context, 'DELETE'),
    }
}
