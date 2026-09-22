import {createPlatformFetchUpstream, createPlatformTokenRoute} from '@directwerk/api/server'
import {
    createConfiguredPlatformTokenRequest,
    PLATFORM_REFRESH_COOKIE,
} from '@/lib/server/api'
import {validateLoginInput} from '@/lib/validation'

// No BFF-side throttling on purpose: this route proxies the upstream
// `/oauth2/token` password grant, which the API's `AuthRateLimitFilter`
// throttles per source IP *and* per username
// (`directwerk.security.oauth-token-rate-limit-per-minute`, default 10/min),
// so credential spraying is bounded regardless of how many Next.js instances
// serve the BFF. A per-instance in-memory limiter here would be ineffective
// (each instance counts separately) while risking lockouts of legitimate
// admins, so the backend limiter is the single source of throttling.
export const POST = createPlatformTokenRoute({
    refreshCookie: PLATFORM_REFRESH_COOKIE,
    validate: validateLoginInput,
    upstream: createPlatformFetchUpstream(createConfiguredPlatformTokenRequest),
    messages: {missingBody: 'Invalid request body.'},
})
