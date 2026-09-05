import {readRequestCookie, sealRefreshToken} from '../auth/cookies'
import {readBoundedBody} from '../proxy/boundedBody'
import {parseTenantHost} from '../proxy/tenantHost'
import {jsonError, toClientResponse} from '../proxy/upstreamResponse'
import {parseJsonText} from '../validation/json'
import {parseLoginInput, parseRefreshTokenInput, type LoginInputOptions, type RefreshTokenInputOptions} from '../validation/input'
import type {DirectwerkFetchRequest} from './upstream'

export interface TenantOAuthFetchRequest {
    path: string
    tenantHost: string
    method: 'POST'
    body: string
    contentType: 'application/x-www-form-urlencoded'
    useOAuthClient: true
}

export interface TenantAuthRouteConfig {
    directwerkFetch: (request: TenantOAuthFetchRequest) => Promise<Response>
    getOAuthClientId: () => string
    refreshCookie: string
}

export interface TenantLoginRouteConfig extends TenantAuthRouteConfig {
    parseLoginOptions?: LoginInputOptions
}

export interface TenantRefreshRouteConfig extends TenantAuthRouteConfig {
    parseRefreshOptions?: RefreshTokenInputOptions
}

export interface PassthroughAuthRouteCodes {
    /** Structured `code` for the unreadable-body (400) response. */
    body?: string
    /** Structured `code` for the invalid-input (400) response. */
    invalidInput?: string
    /** Structured `code` for the upstream-failure (502) response. */
    upstream?: string
}

export interface TenantPassthroughAuthRouteConfig<TParsed> {
    /** The app's configured SSRF-guarded upstream client. */
    directwerkFetch: (request: DirectwerkFetchRequest) => Promise<Response>
    /** Upstream API path, e.g. `/api/v1/auth/register`. */
    path: string
    /** Validates the parsed JSON body; `null` rejects the request. */
    parse: (value: unknown) => TParsed | null
    /** User-facing message for the invalid-input (400) response. */
    invalidInputMessage: string
    /** Optional structured error codes. */
    codes?: PassthroughAuthRouteCodes
    /**
     * When true, require a valid `X-Tenant-Host` header and forward it
     * upstream (e.g. registration). Token-mediated flows (accept-invite,
     * password reset) omit it.
     */
    requireTenantHost?: boolean
    /** Maps validated input to the upstream JSON body. Defaults to identity. */
    toUpstreamBody?: (input: TParsed) => unknown
}

function applyNoStoreHeaders(response: Response): Response {
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Pragma', 'no-cache')
    return response
}

export function createTenantLoginRoute(
    config: TenantLoginRouteConfig,
): (request: Request) => Promise<Response> {
    return async function POST(request: Request): Promise<Response> {
        const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
        if (tenantHost === null) {
            return jsonError('A valid tenant is required.', 400)
        }

        const bodyText = await readBoundedBody(request.body)
        if (bodyText === null) {
            return jsonError('The request body is invalid.', 400)
        }

        const input = parseLoginInput(parseJsonText(bodyText), config.parseLoginOptions)
        if (input === null) {
            return jsonError('A valid email and password are required.', 400)
        }

        try {
            const body = new URLSearchParams({
                grant_type: 'password',
                username: input.email,
                password: input.password,
                client_id: config.getOAuthClientId(),
            })
            const response = await config.directwerkFetch({
                path: '/oauth2/token',
                tenantHost,
                method: 'POST',
                body: body.toString(),
                contentType: 'application/x-www-form-urlencoded',
                useOAuthClient: true,
            })

            const clientResponse = await sealRefreshToken(
                await toClientResponse(response),
                config.refreshCookie,
            )
            return applyNoStoreHeaders(clientResponse)
        } catch {
            return jsonError('The upstream service is unavailable.', 502)
        }
    }
}

export function createTenantRefreshRoute(
    config: TenantRefreshRouteConfig,
): (request: Request) => Promise<Response> {
    return async function POST(request: Request): Promise<Response> {
        const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
        if (tenantHost === null) {
            return jsonError('A valid tenant is required.', 400)
        }

        let refreshToken = readRequestCookie(request, config.refreshCookie)

        if (refreshToken === null && config.parseRefreshOptions !== undefined) {
            const bodyText = await readBoundedBody(request.body)
            if (bodyText === null) {
                return jsonError('The request body is invalid.', 400)
            }

            const input = parseRefreshTokenInput(
                parseJsonText(bodyText),
                config.parseRefreshOptions,
            )
            if (input === null) {
                return jsonError('A valid refresh token is required.', 400)
            }
            refreshToken = input.refresh_token
        }

        if (refreshToken === null) {
            return jsonError('A valid refresh token is required.', 401)
        }

        try {
            const body = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: config.getOAuthClientId(),
            })
            const response = await config.directwerkFetch({
                path: '/oauth2/token',
                tenantHost,
                method: 'POST',
                body: body.toString(),
                contentType: 'application/x-www-form-urlencoded',
                useOAuthClient: true,
            })

            const clientResponse = await sealRefreshToken(
                await toClientResponse(response),
                config.refreshCookie,
            )
            return applyNoStoreHeaders(clientResponse)
        } catch {
            return jsonError('The upstream service is unavailable.', 502)
        }
    }
}

/**
 * Builds a JSON-validating passthrough BFF auth route (`accept-invite`,
 * `forgot-password`, `register`, `reset-password`, studio `workspaces`).
 *
 * Behaviour (identical across call sites):
 * - optionally requires a valid `X-Tenant-Host` header and forwards it
 *   upstream (registration); token-mediated flows omit it
 * - rejects unreadable bodies (400), invalid input (400, caller message),
 *   and normalizes upstream failures into JSON error responses
 */
export function createTenantPassthroughAuthRoute<TParsed>(
    config: TenantPassthroughAuthRouteConfig<TParsed>,
): (request: Request) => Promise<Response> {
    return async function POST(request: Request): Promise<Response> {
        let tenantHost: string | undefined
        if (config.requireTenantHost === true) {
            const parsed = parseTenantHost(request.headers.get('x-tenant-host'))
            if (parsed === null) {
                return jsonError('A valid tenant is required.', 400)
            }
            tenantHost = parsed
        }

        const bodyText = await readBoundedBody(request.body)
        if (bodyText === null) {
            return jsonError(
                'The request body is invalid.',
                400,
                config.codes?.body,
            )
        }

        const input = config.parse(parseJsonText(bodyText))
        if (input === null) {
            return jsonError(
                config.invalidInputMessage,
                400,
                config.codes?.invalidInput,
            )
        }

        try {
            const response = await config.directwerkFetch({
                path: config.path,
                ...(tenantHost === undefined ? {} : {tenantHost}),
                method: 'POST',
                body: JSON.stringify(
                    config.toUpstreamBody === undefined
                        ? input
                        : config.toUpstreamBody(input),
                ),
                contentType: 'application/json',
            })

            return toClientResponse(response)
        } catch {
            return jsonError(
                'The upstream service is unavailable.',
                502,
                config.codes?.upstream,
            )
        }
    }
}
