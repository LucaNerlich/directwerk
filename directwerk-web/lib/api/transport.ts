import {createBrowserTransport} from '@directwerk/api/client/createBrowserTransport'
import {subscriberPortalPolicy} from '@directwerk/api/client/policies'
import {envelopeResult} from '@directwerk/api/envelope'
import {clearTokens} from '@/lib/auth/tokenStore'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {getValidAccessToken, refreshAccessToken} from '@/lib/auth/session'

export {envelopeResult}

const transport = createBrowserTransport({
    policy: subscriberPortalPolicy,
    session: {getValidAccessToken, refreshAccessToken},
    clearTokens,
    resolveTenantHost: getClientTenantHost,
    jsonInitMethods: ['POST', 'PUT', 'PATCH'],
})

export const jsonRequest = transport.jsonRequest
export const authedFetch = transport.authedFetch
export const authenticatedRequest = transport.authenticatedRequest
export const postJson = transport.postJson
export const jsonInit = transport.jsonInit
