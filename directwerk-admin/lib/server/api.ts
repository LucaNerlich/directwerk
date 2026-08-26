import 'server-only'

import {
    createPlatformApiRequest,
    createPlatformRefreshRequest,
    createPlatformTokenRequest,
    createServerTransport,
    normalizeDirectwerkApiUrl,
    type DirectwerkEnvironment,
    type HttpMethod,
} from '@directwerk/api/server'

/**
 * Admin BFF upstream configuration.
 *
 * - `requireTenantHost`: tenant requests must carry the tenant host verbatim
 *   as the upstream Host header.
 * - `forwardContentLength`: explicit Content-Length for bodies.
 * - 1 MiB response cap and 10 s timeouts, as before the consolidation.
 */
const transport = createServerTransport({
    requireTenantHost: true,
    forwardContentLength: true,
})

export const PLATFORM_REFRESH_COOKIE = 'dw_admin_refresh'
export const TENANT_REFRESH_COOKIE = 'dw_admin_tenant_refresh'

function getPlatformEnvironment(): DirectwerkEnvironment {
    const apiUrl = process.env.DIRECTWERK_API_URL
    const clientId = process.env.OAUTH_CLIENT_ID
    const clientSecret = process.env.OAUTH_CLIENT_SECRET

    if (!apiUrl || !clientId || !clientSecret) {
        throw new Error('Directwerk server configuration is incomplete.')
    }

    return {apiUrl, clientId, clientSecret}
}

function getTenantEnvironment(): DirectwerkEnvironment {
    const apiUrl = process.env.DIRECTWERK_API_URL
    const clientId = process.env.TENANT_OAUTH_CLIENT_ID
    const clientSecret = process.env.TENANT_OAUTH_CLIENT_SECRET

    if (!apiUrl || !clientId || !clientSecret) {
        throw new Error('Directwerk tenant OAuth configuration is incomplete.')
    }

    return {apiUrl, clientId, clientSecret}
}

export function createConfiguredPlatformTokenRequest(
    credentials: {email: string; password: string},
): ReturnType<typeof createPlatformTokenRequest> {
    return createPlatformTokenRequest(credentials, getPlatformEnvironment())
}

export function createConfiguredPlatformRefreshRequest(
    refreshToken: string,
): ReturnType<typeof createPlatformRefreshRequest> {
    return createPlatformRefreshRequest(refreshToken, getPlatformEnvironment())
}

export function createConfiguredPlatformApiRequest(
    segments: string[],
    request: Request,
    authorization: string,
): ReturnType<typeof createPlatformApiRequest> {
    return createPlatformApiRequest(
        segments,
        request,
        authorization,
        getPlatformEnvironment(),
    )
}

export async function requestTenantToken(
    credentials: {email: string; password: string},
    tenantHost: string,
): Promise<Response> {
    const environment = getTenantEnvironment()
    const apiUrl = normalizeDirectwerkApiUrl(environment.apiUrl)
    const body = new URLSearchParams({
        grant_type: 'password',
        username: credentials.email,
        password: credentials.password,
        client_id: environment.clientId,
    }).toString()
    const basicCredentials = Buffer.from(
        `${environment.clientId}:${environment.clientSecret}`,
        'utf8',
    ).toString('base64')

    return transport({
        targetUrl: new URL('/oauth2/token', apiUrl),
        tenantHost,
        method: 'POST',
        authorization: `Basic ${basicCredentials}`,
        body,
        contentType: 'application/x-www-form-urlencoded',
    })
}

export async function requestTenantRefresh(
    refreshToken: string,
    tenantHost: string,
): Promise<Response> {
    const environment = getTenantEnvironment()
    const apiUrl = normalizeDirectwerkApiUrl(environment.apiUrl)
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: environment.clientId,
    }).toString()
    const basicCredentials = Buffer.from(
        `${environment.clientId}:${environment.clientSecret}`,
        'utf8',
    ).toString('base64')

    return transport({
        targetUrl: new URL('/oauth2/token', apiUrl),
        tenantHost,
        method: 'POST',
        authorization: `Basic ${basicCredentials}`,
        body,
        contentType: 'application/x-www-form-urlencoded',
    })
}

export async function requestTenantApi(
    path: string,
    tenantHost: string,
    method: HttpMethod,
    authorization: string,
    body?: string,
): Promise<Response> {
    const environment = getTenantEnvironment()
    const apiUrl = normalizeDirectwerkApiUrl(environment.apiUrl)

    return transport({
        targetUrl: new URL(path, apiUrl),
        tenantHost,
        method,
        authorization,
        body,
        contentType: body === undefined ? undefined : 'application/json',
    })
}
