import {createBrowserTransport} from '@directwerk/api/client'
import {studioCreatorPolicy} from '@directwerk/api/client/policies'
import type {ErrorMessageCatalog} from '@directwerk/api/envelope'
import {getValidAccessToken, refreshAccessToken} from '@/lib/auth/session'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

const transport = createBrowserTransport({
    policy: studioCreatorPolicy,
    session: {getValidAccessToken, refreshAccessToken},
    clearTokens: () => {},
    resolveTenantHost: getClientTenantHost,
    bindableTenantHost: true,
    includeProxyRequest: true,
    jsonInitMethods: ['POST', 'PUT'],
})

export const INVALID_RESPONSE = transport.INVALID_RESPONSE
export const ERROR_CATALOG: ErrorMessageCatalog = transport.ERROR_CATALOG
export const jsonRequest = transport.jsonRequest
export const authedFetch = transport.authedFetch
export const request = transport.request
export const authenticatedRequest = transport.authenticatedRequest
export const postJson = transport.postJson
export const jsonInit = transport.jsonInit
export const proxyRequest = transport.proxyRequest!

export function bindTenantHost(getHost: () => string): void {
    transport.bindTenantHost?.(getHost)
}
