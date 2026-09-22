import {createBrowserTransport} from '@directwerk/api/client/createBrowserTransport'
import {subscriberPortalPolicy} from '@directwerk/api/client/policies'
import {envelopeResult} from '@directwerk/api/envelope'
import {clearSessionTokens, getValidAccessToken, refreshAccessToken} from '@/lib/auth/session'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'

export {envelopeResult}

const transport = createBrowserTransport({
    policy: subscriberPortalPolicy,
    session: {getValidAccessToken, refreshAccessToken},
    clearTokens: clearSessionTokens,
    resolveTenantHost: getWebClientTenantHost,
    jsonInitMethods: ['POST', 'PUT', 'PATCH'],
})

export const jsonRequest = transport.jsonRequest
export const authedFetch = transport.authedFetch
export const authenticatedRequest = transport.authenticatedRequest
export const postJson = transport.postJson
export const jsonInit = transport.jsonInit
