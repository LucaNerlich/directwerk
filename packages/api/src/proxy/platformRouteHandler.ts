import type {HttpMethod} from '../server/transport'
import {buildPlatformApiPath, buildSafePlatformQueryString, buildTenantApiPath} from '../server/platform'
import {parseBearerAuthorization, safeUpstreamResponse} from '../server/platform'
import {readJsonBody} from './boundedBody'
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

/**
 * Maps a shared {@link readJsonBody} rejection to the platform JSON error
 * shape. Bodyless DELETE is allowed by passing `allowMissingBody: true`
 * for DELETE at the call sites below.
 */
function jsonBodyError(status: 400 | 413 | 415): Response {
    if (status === 413) {
        return jsonError('Request body is too large.', 413)
    }
    if (status === 415) {
        return jsonError('Content-Type must be application/json.', 415)
    }
    return jsonError('Invalid JSON request.', 400)
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

        if (method === 'GET' || method === 'HEAD') {
            try {
                buildSafePlatformQueryString(new URL(request.url).searchParams)
            } catch (error: unknown) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Invalid platform API query.'
                return jsonError(message, 400)
            }
        }

        let body: string | undefined
        if (method !== 'GET' && method !== 'HEAD') {
            const read = await readJsonBody(request, {
                jsonBodyLimit: config.jsonBodyLimit,
                allowMissingBody: method === 'DELETE',
            })
            if (!read.ok) {
                return jsonBodyError(read.status)
            }
            body = read.text
        }

        const upstreamRequest = new Request(request.url, {
            method,
            headers: request.headers,
            body: body ?? null,
        })

        try {
            const upstream = await config.fetchUpstream(path, upstreamRequest, authorization)
            return safeUpstreamResponse(upstream, method)
        } catch (error: unknown) {
            if (
                error instanceof Error &&
                (error.message.includes('Invalid platform API') ||
                    error.message.includes('Invalid Directwerk API URL'))
            ) {
                return jsonError(error.message, 400)
            }
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
            // No Content-Length pre-check: readJsonBody enforces the byte
            // cap on the stream itself, so a lying header cannot bypass it
            // (same 413 outcome via the bounded read).
            const read = await readJsonBody(request, {
                jsonBodyLimit: config.jsonBodyLimit,
                allowMissingBody: method === 'DELETE',
            })
            if (!read.ok) {
                return jsonBodyError(read.status)
            }
            body = read.text
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
