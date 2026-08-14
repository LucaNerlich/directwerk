import 'server-only'

import {requestWithTenantHost} from '@/lib/server/http'
import type {TenantHost} from '@/lib/tenants'

type DirectwerkMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface DirectwerkRequest {
    path: string
    tenantHost?: TenantHost
    method: DirectwerkMethod
    bearerToken?: string
    body?: string
    contentType?: 'application/json' | 'application/x-www-form-urlencoded'
    useOAuthClient?: boolean
}

function getApiUrl(): URL {
    const configuredUrl = process.env.DIRECTWERK_API_URL
    if (configuredUrl === undefined || configuredUrl.length === 0) {
        throw new Error('DIRECTWERK_API_URL is not configured')
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
        throw new Error('DIRECTWERK_API_URL is invalid')
    }

    return apiUrl
}

function getOAuthAuthorization(): string {
    const clientId = process.env.OAUTH_CLIENT_ID
    const clientSecret = process.env.OAUTH_CLIENT_SECRET
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

export function getOAuthClientId(): string {
    const clientId = process.env.OAUTH_CLIENT_ID
    if (clientId === undefined || clientId.length === 0) {
        throw new Error('OAUTH_CLIENT_ID is not configured')
    }

    return clientId
}

export async function directwerkFetch({
    path,
    tenantHost,
    method,
    bearerToken,
    body,
    contentType,
    useOAuthClient = false,
}: DirectwerkRequest): Promise<Response> {
    if (
        !(path === '/oauth2/token' || path.startsWith('/api/v1/')) ||
        path.includes('#')
    ) {
        throw new Error('Directwerk request path is invalid')
    }

    const apiUrl = getApiUrl()
    const targetUrl = new URL(path, apiUrl)
    if (targetUrl.origin !== apiUrl.origin) {
        throw new Error('Directwerk request target is invalid')
    }

    return requestWithTenantHost({
        targetUrl,
        tenantHost,
        method,
        authorization:
            bearerToken === undefined
                ? useOAuthClient
                    ? getOAuthAuthorization()
                    : undefined
                : `Bearer ${bearerToken}`,
        body,
        contentType,
    })
}
