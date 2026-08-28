import {createAuthedRequest, createJsonRequest} from '@directwerk/api/client'
import {studioCreatorPolicy} from '@directwerk/api/client/policies'
import type {ErrorMessageCatalog} from '@directwerk/api/envelope'
import {getValidAccessToken, refreshAccessToken} from '@/lib/auth/session'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

export const INVALID_RESPONSE = studioCreatorPolicy.invalidResponseMessage!

export const ERROR_CATALOG: ErrorMessageCatalog = studioCreatorPolicy.catalog!

function baseHeaders(): Record<string, string> {
    return {'X-Tenant-Host': getClientTenantHost()}
}

export const jsonRequest = createJsonRequest({
    baseHeaders,
    invalidResponseMessage: INVALID_RESPONSE,
    catalog: ERROR_CATALOG,
})

export const authedFetch = createAuthedRequest({
    session: {getValidAccessToken, refreshAccessToken},
    clearTokens: () => {},
    baseHeaders,
    ...studioCreatorPolicy,
})

export function request(
    path: string,
    _tenantHost: string,
    init?: RequestInit,
): Promise<unknown> {
    return jsonRequest(path, init)
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
    tenantHost: string,
    body: unknown,
): Promise<unknown> {
    return request(path, tenantHost, jsonInit('POST', body))
}

export function jsonInit(method: 'POST' | 'PUT', body: unknown): RequestInit {
    return {
        method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    }
}

export async function proxyRequest<T>(
    path: string,
    tenantHost: string,
    init: RequestInit | undefined,
    parser: (value: unknown) => {data: T} | null,
    errorMessage: string,
): Promise<T> {
    const parsed = parser(await authenticatedRequest(path, tenantHost, init))
    if (parsed === null) {
        throw new Error(errorMessage)
    }

    return parsed.data
}

