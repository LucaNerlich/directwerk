import {readRequestCookie, sealRefreshToken} from '../auth/cookies'
import {readBoundedBody} from '../proxy/boundedBody'
import {parseTenantHost} from '../proxy/tenantHost'
import {jsonError, toClientResponse} from '../proxy/upstreamResponse'
import {parseJsonText} from '../validation/json'
import {parseLoginInput, parseRefreshTokenInput, type LoginInputOptions, type RefreshTokenInputOptions} from '../validation/input'
import {readAuthJsonBody} from './authBody'
import {safeUpstreamResponse, type DirectwerkRequest} from './platform'
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
    /** Upstream API path, or a builder from validated input. */
    path: string | ((input: TParsed) => string)
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
            const path =
                typeof config.path === 'function' ? config.path(input) : config.path
            const response = await config.directwerkFetch({
                path,
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

// ---------------------------------------------------------------------------
// Platform auth routes (directwerk-admin BFF)
// ---------------------------------------------------------------------------

/** Structured result of validating a platform login body. */
export type PlatformInputValidation<TInput> =
    | {success: true; data: TInput}
    | {success: false; error: string}

/** Result of a platform-session / configuration gate. */
export type PlatformAuthGateResult = {ok: true} | {ok: false; status: number}

/**
 * Pre-body gate executed before any body parsing (e.g. a server-side platform
 * admin session check). Returning `{ok:false, status}` short-circuits with the
 * configured gate message and that status.
 */
export type PlatformAuthGate = () =>
    | PlatformAuthGateResult
    | Promise<PlatformAuthGateResult>

export interface PlatformTokenRouteMessages {
    /** 415: request `Content-Type` is not JSON. */
    contentType?: string
    /** 400: the request has no body stream at all. */
    missingBody?: string
    /** 413: the body exceeds `jsonBodyLimit`. */
    tooLarge?: string
    /** 400: the body is not valid JSON. */
    invalidJson?: string
    /** 502: upstream request failed (including missing upstream config). */
    upstream?: string
    /** 401/502: the `gate` rejected the request. */
    gate?: string
}

export interface PlatformRefreshRouteMessages {
    /** 401: no refresh cookie was presented. */
    tokenRequired?: string
    /** 502: upstream request failed (including missing upstream config). */
    upstream?: string
    /** 401/502: the `gate` rejected the request. */
    gate?: string
}

/**
 * Performs the upstream token/refresh call for validated input. Receives the
 * original `Request` so tenant routes can bind the upstream Host; may throw
 * when upstream configuration is missing (mapped to 502 by the factory).
 *
 * Platform routes use `createPlatformFetchUpstream` (fetch + abort deadline);
 * admin tenant routes use their node-http transport, which enforces its own
 * timeout and tenant Host.
 */
export type PlatformUpstreamRequest<TInput> = (
    input: TInput,
    request: Request,
) => Response | Promise<Response>

export interface PlatformTokenRouteConfig<TInput> {
    /** httpOnly cookie that receives the sealed refresh token. */
    refreshCookie: string
    /** Validates the parsed JSON login body. */
    validate: (value: unknown) => PlatformInputValidation<TInput>
    /** Performs the upstream token call. */
    upstream: PlatformUpstreamRequest<TInput>
    /** Optional pre-body gate, e.g. require a live platform admin session. */
    gate?: PlatformAuthGate
    /**
     * Optional pre-body check returning a `Response` to short-circuit
     * (e.g. require a valid `X-Tenant-Host`), or null/undefined to continue.
     */
    preflight?: (request: Request) => Response | null | undefined
    /**
     * Optional post-seal decorator, e.g. append the tenant replay-scope
     * cookie. Runs before the no-store headers are applied.
     */
    finalize?: (response: Response, request: Request) => Response
    /** Hard body-byte cap. Defaults to 16 384 (matches the tenant factories). */
    jsonBodyLimit?: number
    /** Overrides for the default response messages. */
    messages?: PlatformTokenRouteMessages
}

export interface PlatformRefreshRouteConfig {
    /** httpOnly cookie holding the sealed refresh token. */
    refreshCookie: string
    /** Performs the upstream refresh call. */
    upstream: PlatformUpstreamRequest<string>
    /** Optional pre-cookie gate, e.g. require a live platform admin session. */
    gate?: PlatformAuthGate
    /**
     * Optional pre-cookie check returning a `Response` to short-circuit
     * (e.g. tenant host + replay-scope binding checks).
     */
    preflight?: (request: Request) => Response | null | undefined
    /** Overrides for the default response messages. */
    messages?: PlatformRefreshRouteMessages
}

const DEFAULT_PLATFORM_TOKEN_MESSAGES = {
    contentType: 'Content-Type must be application/json.',
    tooLarge: 'Request body is too large.',
    invalidJson: 'Invalid JSON request.',
    upstream: 'Authentication service is unavailable.',
    gate: 'A platform admin session is required.',
}

const DEFAULT_PLATFORM_REFRESH_MESSAGES = {
    tokenRequired: 'A valid refresh token is required.',
    upstream: 'Authentication service is unavailable.',
    gate: 'A platform admin session is required.',
}

async function applyPlatformGate(
    gate: PlatformAuthGate | undefined,
    message: string,
): Promise<Response | null> {
    if (gate === undefined) {
        return null
    }

    const result = await gate()
    return result.ok ? null : jsonError(message, result.status)
}

/** Fetches with an `AbortController` deadline (no-store upstream request). */
async function fetchWithTimeout(
    request: DirectwerkRequest,
    timeoutMs: number,
): Promise<Response> {
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs)
    try {
        return await fetch(request.url, {
            ...request.init,
            signal: abortController.signal,
        })
    } finally {
        clearTimeout(timeoutId)
    }
}

/**
 * Adapts a `DirectwerkRequest` builder (e.g. `createPlatformTokenRequest`) to a
 * `PlatformUpstreamRequest` with the platform BFF's 10 s abort deadline.
 */
export function createPlatformFetchUpstream<TInput>(
    buildRequest: (input: TInput) => DirectwerkRequest,
    timeoutMs = 10_000,
): PlatformUpstreamRequest<TInput> {
    return (input) => fetchWithTimeout(buildRequest(input), timeoutMs)
}

/**
 * Builds a platform login BFF route (`/api/auth/login`,
 * `/api/auth/tenant-login`): JSON body gate → validation → upstream token
 * request → seal the refresh token into an httpOnly cookie → no-store.
 *
 * The `gate`/`preflight`/`finalize` hooks cover the tenant variant's platform
 * session check, `X-Tenant-Host` requirement, and replay-scope cookie binding
 * without weakening the shared 415/413/400/502 choreography.
 */
export function createPlatformTokenRoute<TInput>(
    config: PlatformTokenRouteConfig<TInput>,
): (request: Request) => Promise<Response> {
    const jsonBodyLimit = config.jsonBodyLimit ?? 16_384
    const messages = {...DEFAULT_PLATFORM_TOKEN_MESSAGES, ...config.messages}

    return async function POST(request: Request): Promise<Response> {
        const gated = await applyPlatformGate(config.gate, messages.gate)
        if (gated !== null) {
            return gated
        }

        const preflight = config.preflight?.(request)
        if (preflight !== undefined && preflight !== null) {
            return preflight
        }

        const body = await readAuthJsonBody(request, {
            jsonBodyLimit,
            messages: {
                contentType: messages.contentType,
                tooLarge: messages.tooLarge,
                invalidJson: messages.invalidJson,
                ...(messages.missingBody === undefined
                    ? {}
                    : {missingBody: messages.missingBody}),
            },
        })
        if (!body.ok) {
            return body.response
        }

        const validation = config.validate(body.value)
        if (!validation.success) {
            return jsonError(validation.error, 400)
        }

        try {
            const upstream = await config.upstream(validation.data, request)
            const sealed = await sealRefreshToken(
                await safeUpstreamResponse(upstream),
                config.refreshCookie,
            )
            const finalized =
                config.finalize === undefined
                    ? sealed
                    : config.finalize(sealed, request)
            return applyNoStoreHeaders(finalized)
        } catch {
            return jsonError(messages.upstream, 502)
        }
    }
}

/**
 * Builds a platform refresh BFF route (`/api/auth/refresh`,
 * `/api/auth/tenant-refresh`): optional gate/preflight → read the sealed
 * refresh cookie → upstream refresh → re-seal → no-store.
 */
export function createPlatformRefreshRoute(
    config: PlatformRefreshRouteConfig,
): (request: Request) => Promise<Response> {
    const messages = {...DEFAULT_PLATFORM_REFRESH_MESSAGES, ...config.messages}

    return async function POST(request: Request): Promise<Response> {
        const gated = await applyPlatformGate(config.gate, messages.gate)
        if (gated !== null) {
            return gated
        }

        const preflight = config.preflight?.(request)
        if (preflight !== undefined && preflight !== null) {
            return preflight
        }

        const refreshToken = readRequestCookie(request, config.refreshCookie)
        if (refreshToken === null) {
            return jsonError(messages.tokenRequired, 401)
        }

        try {
            const upstream = await config.upstream(refreshToken, request)
            const sealed = await sealRefreshToken(
                await safeUpstreamResponse(upstream),
                config.refreshCookie,
            )
            return applyNoStoreHeaders(sealed)
        } catch {
            return jsonError(messages.upstream, 502)
        }
    }
}
