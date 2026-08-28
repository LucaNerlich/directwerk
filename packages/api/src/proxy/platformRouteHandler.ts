import type {HttpMethod} from '../server/transport'
import {buildPlatformApiPath, buildSafePlatformQueryString, buildTenantApiPath} from '../server/platform'
import {parseBearerAuthorization, safeUpstreamResponse} from '../server/platform'
import {readBoundedRequestBody} from './boundedBody'
import {parseTenantHost} from './tenantHost'
import {jsonError} from './upstreamResponse'
import type {ProxyRouteContext} from './routeHandler'

export {type ProxyRouteContext}

type ProxyMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type PlatformProxyRouteHandlers = Record<
    'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    (request: Request, context: ProxyRouteContext) => Promise<Response>
>

export interface PlatformProxyRouteHandlerConfig {
    fetchUpstream: (
        segments: string[],
        request: Request,
        authorization: string,
    ) => Promise<Response>
    jsonBodyLimit: number
}

export interface AdminTenantProxyRouteHandlerConfig {
    fetchUpstream: (
        pathWithQuery: string,
        tenantHost: string,
        method: HttpMethod,
        authorization: string,
        body?: string,
    ) => Promise<Response>
    jsonBodyLimit: number
}

function validateJsonBody(
    request: Request,
    body: string,
    method: string,
): Response | null {
    const isBodylessDelete = method === 'DELETE' && body.length === 0
    if (isBodylessDelete) {
        return null
    }

    if (!request.headers.get('content-type')?.includes('application/json')) {
        return jsonError('Content-Type must be application/json.', 415)
    }

    try {
        JSON.parse(body)
    } catch {
        return jsonError('Invalid JSON request.', 400)
    }

    return null
}

async function readProxyBody(
    request: Request,
    limit: number,
): Promise<{ok: true; text: string} | {ok: false; response: Response}> {
    const bounded = await readBoundedRequestBody(request, limit)
    if (!bounded.ok) {
        return {ok: false, response: jsonError(bounded.error, bounded.status)}
    }
    return {ok: true, text: bounded.text}
}

export function createPlatformProxyRouteHandler(
    config: PlatformProxyRouteHandlerConfig,
): PlatformProxyRouteHandlers {
    async function handleProxy(
        request: Request,
        context: ProxyRouteContext,
        method: ProxyMethod,
    ): Promise<Response> {
        const authorization = parseBearerAuthorization(
            request.headers.get('authorization'),
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

        let body: string | undefined
        if (method !== 'GET' && method !== 'HEAD') {
            const read = await readProxyBody(request, config.jsonBodyLimit)
            if (!read.ok) {
                return read.response
            }
            body = read.text
            const validation = validateJsonBody(request, body, method)
            if (validation !== null) {
                return validation
            }
            if (method === 'DELETE' && body.length === 0) {
                body = undefined
            }
        }

        const upstreamRequest = new Request(request.url, {
            method,
            headers: request.headers,
            body: body ?? null,
        })

        try {
            const upstream = await config.fetchUpstream(path, upstreamRequest, authorization)
            return safeUpstreamResponse(upstream, method)
        } catch {
            return jsonError('Directwerk service is unavailable.', 502)
        }
    }

    return {
        GET: (r, c) => handleProxy(r, c, 'GET'),
        HEAD: (r, c) => handleProxy(r, c, 'HEAD'),
        POST: (r, c) => handleProxy(r, c, 'POST'),
        PUT: (r, c) => handleProxy(r, c, 'PUT'),
        PATCH: (r, c) => handleProxy(r, c, 'PATCH'),
        DELETE: (r, c) => handleProxy(r, c, 'DELETE'),
    }
}

export function createAdminTenantProxyRouteHandler(
    config: AdminTenantProxyRouteHandlerConfig,
): PlatformProxyRouteHandlers {
    async function handleProxy(
        request: Request,
        context: ProxyRouteContext,
        method: ProxyMethod,
    ): Promise<Response> {
        const authorization = parseBearerAuthorization(
            request.headers.get('authorization'),
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
                new URL(request.url).searchParams,
            )
        } catch {
            return jsonError('Invalid tenant API query.', 400)
        }

        let body: string | undefined
        if (method !== 'GET' && method !== 'HEAD') {
            const contentLength = request.headers.get('content-length')
            if (contentLength && Number(contentLength) > config.jsonBodyLimit) {
                return jsonError('Request body is too large.', 413)
            }

            const read = await readProxyBody(request, config.jsonBodyLimit)
            if (!read.ok) {
                return read.response
            }
            body = read.text
            const validation = validateJsonBody(request, body, method)
            if (validation !== null) {
                return validation
            }
            if (method === 'DELETE' && body.length === 0) {
                body = undefined
            }
        }

        try {
            const upstream = await config.fetchUpstream(
                `${apiPath}${queryString}`,
                tenantHost,
                method,
                authorization,
                body,
            )
            return safeUpstreamResponse(upstream, method)
        } catch {
            return jsonError('Directwerk service is unavailable.', 502)
        }
    }

    return {
        GET: (r, c) => handleProxy(r, c, 'GET'),
        HEAD: (r, c) => handleProxy(r, c, 'HEAD'),
        POST: (r, c) => handleProxy(r, c, 'POST'),
        PUT: (r, c) => handleProxy(r, c, 'PUT'),
        PATCH: (r, c) => handleProxy(r, c, 'PATCH'),
        DELETE: (r, c) => handleProxy(r, c, 'DELETE'),
    }
}
