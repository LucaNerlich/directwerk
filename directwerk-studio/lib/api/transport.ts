import {createAuthedRequest, createJsonRequest} from '@directwerk/api/client'
import {studioCreatorPolicy} from '@directwerk/api/client/policies'
import type {ErrorMessageCatalog} from '@directwerk/api/envelope'
import {getValidAccessToken, refreshAccessToken} from '@/lib/auth/session'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

export const INVALID_RESPONSE = studioCreatorPolicy.invalidResponseMessage!

export const ERROR_CATALOG: ErrorMessageCatalog = studioCreatorPolicy.catalog!

let resolveTenantHost: () => string = getClientTenantHost

/**
 * Binds the tenant host resolver used for `X-Tenant-Host` on every request.
 * Defaults to {@link getClientTenantHost}.
 */
export function bindTenantHost(getHost: () => string): void {
    resolveTenantHost = getHost
}

function baseHeaders(): Record<string, string> {
    return {'X-Tenant-Host': resolveTenantHost()}
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

/**
 * Unauthenticated JSON request.
 *
 * @param _tenantHost Deprecated — ignored; tenant binding comes from {@link bindTenantHost}.
 */
export function request(
    path: string,
    _tenantHost: string,
    init?: RequestInit,
): Promise<unknown> {
    return jsonRequest(path, init)
}

/**
 * Authenticated JSON request.
 *
 * @param _tenantHost Deprecated — ignored; tenant binding comes from {@link bindTenantHost}.
 */
export function authenticatedRequest(
    path: string,
    _tenantHost: string,
    init?: RequestInit,
): Promise<unknown> {
    return authedFetch(path, init)
}

/**
 * @param tenantHost Deprecated — ignored; tenant binding comes from {@link bindTenantHost}.
 */
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

/**
 * @param tenantHost Deprecated — ignored; tenant binding comes from {@link bindTenantHost}.
 */
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
