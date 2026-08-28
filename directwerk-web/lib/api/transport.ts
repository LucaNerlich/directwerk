import {createAuthedRequest, createJsonRequest} from '@directwerk/api/client'
import {subscriberPortalPolicy, SUBSCRIBER_PORTAL_CATALOG} from '@directwerk/api/client/policies'
import {extractApiErrorMessage} from '@directwerk/api/envelope'
import type {ErrorMessageCatalog} from '@directwerk/api/envelope'
import type {ApiEnvelope} from '@directwerk/api/types'
import {clearTokens} from '@/lib/auth/tokenStore'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {getValidAccessToken, refreshAccessToken} from '@/lib/auth/session'

export const INVALID_RESPONSE = subscriberPortalPolicy.invalidResponseMessage!

export const ERROR_CATALOG: ErrorMessageCatalog = SUBSCRIBER_PORTAL_CATALOG

export const jsonRequest = createJsonRequest({
    baseHeaders: () => ({'X-Tenant-Host': getClientTenantHost()}),
    invalidResponseMessage: INVALID_RESPONSE,
    catalog: ERROR_CATALOG,
})

export const authedFetch = createAuthedRequest({
    session: {getValidAccessToken, refreshAccessToken},
    clearTokens,
    baseHeaders: () => ({'X-Tenant-Host': getClientTenantHost()}),
    ...subscriberPortalPolicy,
    catalog: ERROR_CATALOG,
})

export async function parseJsonResponse(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error(INVALID_RESPONSE)
    }

    return response.json()
}

export async function request(
    path: string,
    tenantHost: string | null,
    init?: RequestInit,
): Promise<unknown> {
    const response = await fetch(path, {
        ...init,
        headers: {
            Accept: 'application/json',
            ...(tenantHost === null ? {} : {'X-Tenant-Host': tenantHost}),
            ...init?.headers,
        },
    })
    const value = await parseJsonResponse(response)
    if (!response.ok) {
        throw new Error(extractApiErrorMessage(value, response.status, ERROR_CATALOG))
    }

    return value
}

export function authenticatedRequest(
    path: string,
    _tenantHost: string,
    init?: RequestInit,
): Promise<unknown> {
    return authedFetch(path, init)
}

export async function postJson(
    path: string,
    tenantHost: string | null,
    body: unknown,
): Promise<unknown> {
    return request(path, tenantHost, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    })
}

export function envelopeResult<T>(
    parser: (value: unknown) => ApiEnvelope<T> | null,
    value: unknown,
    invalidMessage: string,
): ApiEnvelope<T> {
    const parsed = parser(value)
    if (parsed === null) {
        throw new Error(invalidMessage)
    }

    return parsed
}

