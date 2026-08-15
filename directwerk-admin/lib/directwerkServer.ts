import 'server-only'

import {
    createPlatformApiRequest,
    createPlatformRefreshRequest,
    createPlatformTokenRequest,
    normalizeDirectwerkApiUrl,
    type DirectwerkEnvironment,
} from '@/lib/directwerk'
import {requestWithTenantHost} from '@/lib/server/tenantHttp'
import type {LoginCredentials} from '@/lib/validation'

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
    credentials: LoginCredentials
): ReturnType<typeof createPlatformTokenRequest> {
    return createPlatformTokenRequest(credentials, getPlatformEnvironment())
}

export function createConfiguredPlatformRefreshRequest(
    refreshToken: string
): ReturnType<typeof createPlatformRefreshRequest> {
    return createPlatformRefreshRequest(refreshToken, getPlatformEnvironment())
}

export function createConfiguredPlatformApiRequest(
    segments: string[],
    request: Request,
    authorization: string
): ReturnType<typeof createPlatformApiRequest> {
    return createPlatformApiRequest(
        segments,
        request,
        authorization,
        getPlatformEnvironment()
    )
}

export async function requestTenantToken(
    credentials: LoginCredentials,
    tenantHost: string
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
        'utf8'
    ).toString('base64')

    return requestWithTenantHost({
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
    tenantHost: string
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
        'utf8'
    ).toString('base64')

    return requestWithTenantHost({
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
    method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    authorization: string,
    body?: string
): Promise<Response> {
    const environment = getTenantEnvironment()
    const apiUrl = normalizeDirectwerkApiUrl(environment.apiUrl)

    return requestWithTenantHost({
        targetUrl: new URL(path, apiUrl),
        tenantHost,
        method,
        authorization,
        body,
        contentType: body === undefined ? undefined : 'application/json',
    })
}
