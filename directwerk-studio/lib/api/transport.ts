import {createBrowserTransport} from '@directwerk/api/client/createBrowserTransport'
import {studioCreatorPolicy} from '@directwerk/api/client/policies'
import {getValidAccessToken, refreshAccessToken} from '@/lib/auth/session'
import {getClientTenantHost} from '@directwerk/api/tenant'

const transport = createBrowserTransport({
    policy: studioCreatorPolicy,
    session: {getValidAccessToken, refreshAccessToken},
    clearTokens: () => {},
    resolveTenantHost: getClientTenantHost,
    bindableTenantHost: true,
    includeProxyRequest: true,
    jsonInitMethods: ['POST', 'PUT'],
})

export const request = transport.request
export const authenticatedRequest = transport.authenticatedRequest
export const postJson = transport.postJson
export const jsonInit = transport.jsonInit
export const proxyRequest = transport.proxyRequest!
