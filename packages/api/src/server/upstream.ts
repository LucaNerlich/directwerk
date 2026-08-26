import 'server-only'

import type {ServerTransportRequest} from './transport'

export type {HttpMethod, ServerTransportConfig, ServerTransportRequest} from './transport'
export {createServerTransport} from './transport'

type DirectwerkMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface DirectwerkServerClientConfig {
    transport: (request: ServerTransportRequest) => Promise<Response>
    /**
     * Environment variable holding the upstream API origin.
     * Defaults to `DIRECTWERK_API_URL`.
     */
    apiUrlEnv?: string
    /** Environment variable holding the OAuth client id. */
    clientIdEnv?: string
    /** Environment variable holding the OAuth client secret. */
    clientSecretEnv?: string
}

export interface DirectwerkFetchRequest {
    path: string
    tenantHost?: string
    method: DirectwerkMethod
    bearerToken?: string
    body?: string
    contentType?: 'application/json' | 'application/x-www-form-urlencoded'
    useOAuthClient?: boolean
}

function getApiUrl(apiUrlEnv: string): URL {
    const configuredUrl = process.env[apiUrlEnv]
    if (configuredUrl === undefined || configuredUrl.length === 0) {
        throw new Error(`${apiUrlEnv} is not configured`)
    }

    const apiUrl = new URL(configuredUrl)
    const isLoopback =
        apiUrl.hostname === 'localhost' ||
        apiUrl.hostname === '127.0.0.1' ||
        apiUrl.hostname === '[::1]'
    // Plain HTTP is limited to loopback for the documented local Directwerk setup.
    // Any non-local deployment must provide an HTTPS API URL.
    const usesAllowedProtocol =
        apiUrl.protocol === 'https:' || (apiUrl.protocol === 'http:' && isLoopback)

    if (
        !usesAllowedProtocol ||
        apiUrl.username !== '' ||
        apiUrl.password !== '' ||
        apiUrl.search !== '' ||
        apiUrl.hash !== '' ||
        (apiUrl.pathname !== '' && apiUrl.pathname !== '/')
    ) {
        throw new Error(`${apiUrlEnv} is invalid`)
    }

    return apiUrl
}

function getOAuthAuthorization(clientIdEnv: string, clientSecretEnv: string): string {
    const clientId = process.env[clientIdEnv]
    const clientSecret = process.env[clientSecretEnv]
    if (
        clientId === undefined ||
        clientId.length === 0 ||
        clientSecret === undefined ||
        clientSecret.length === 0
    ) {
        throw new Error('OAuth client credentials are not configured')
    }

    return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')}`
}

export interface DirectwerkServerClient {
    fetch(request: DirectwerkFetchRequest): Promise<Response>
    getOAuthClientId(): string
}

/**
 * Builds the SSRF-guarded upstream API client used by BFF route handlers.
 * Paths must be exactly `/oauth2/token` or start with `/api/v1/`; the target
 * origin must match the configured API origin.
 */
export function createDirectwerkServerClient(
    config: DirectwerkServerClientConfig,
): DirectwerkServerClient {
    const apiUrlEnv = config.apiUrlEnv ?? 'DIRECTWERK_API_URL'
    const clientIdEnv = config.clientIdEnv ?? 'OAUTH_CLIENT_ID'
    const clientSecretEnv = config.clientSecretEnv ?? 'OAUTH_CLIENT_SECRET'

    return {
        getOAuthClientId(): string {
            const clientId = process.env[clientIdEnv]
            if (clientId === undefined || clientId.length === 0) {
                throw new Error(`${clientIdEnv} is not configured`)
            }

            return clientId
        },

        async fetch({
            path,
            tenantHost,
            method,
            bearerToken,
            body,
            contentType,
            useOAuthClient = false,
        }: DirectwerkFetchRequest): Promise<Response> {
            if (
                !(path === '/oauth2/token' || path.startsWith('/api/v1/')) ||
                path.includes('#')
            ) {
                throw new Error('Directwerk request path is invalid')
            }

            const apiUrl = getApiUrl(apiUrlEnv)
            const targetUrl = new URL(path, apiUrl)
            if (targetUrl.origin !== apiUrl.origin) {
                throw new Error('Directwerk request target is invalid')
            }

            return config.transport({
                targetUrl,
                tenantHost,
                method,
                authorization:
                    bearerToken === undefined
                        ? useOAuthClient
                            ? getOAuthAuthorization(clientIdEnv, clientSecretEnv)
                            : undefined
                        : `Bearer ${bearerToken}`,
                body,
                contentType,
            })
        },
    }
}
