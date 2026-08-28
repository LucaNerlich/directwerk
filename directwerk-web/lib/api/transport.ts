import {createAuthedRequest, createJsonRequest} from '@directwerk/api/client'
import {subscriberPortalPolicy, SUBSCRIBER_PORTAL_CATALOG} from '@directwerk/api/client/policies'
import {envelopeResult} from '@directwerk/api/envelope'
import type {ErrorMessageCatalog} from '@directwerk/api/envelope'
import {clearTokens} from '@/lib/auth/tokenStore'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {getValidAccessToken, refreshAccessToken} from '@/lib/auth/session'

export {envelopeResult}

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

/**
 * Unauthenticated JSON request.
 *
 * @param _tenantHost Deprecated — ignored; tenant binding comes from getClientTenantHost.
 */
export function request(
    path: string,
    _tenantHost: string | null,
    init?: RequestInit,
): Promise<unknown> {
    return jsonRequest(path, init)
}

/**
 * Authenticated JSON request.
 *
 * @param _tenantHost Deprecated — ignored; tenant binding comes from getClientTenantHost.
 */
export function authenticatedRequest(
    path: string,
    _tenantHost: string,
    init?: RequestInit,
): Promise<unknown> {
    return authedFetch(path, init)
}

/**
 * @param tenantHost Deprecated — ignored; tenant binding comes from getClientTenantHost.
 */
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

export function jsonInit(method: 'POST' | 'PUT' | 'PATCH', body: unknown): RequestInit {
    return {
        method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    }
}
