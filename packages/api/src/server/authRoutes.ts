import {readRequestCookie, sealRefreshToken} from '../auth/cookies'
import {readBoundedBody} from '../proxy/boundedBody'
import {parseTenantHost} from '../proxy/tenantHost'
import {jsonError, toClientResponse} from '../proxy/upstreamResponse'
import {parseJsonText} from '../validation/json'
import {parseLoginInput, parseRefreshTokenInput, type LoginInputOptions, type RefreshTokenInputOptions} from '../validation/input'

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
