import {createPlatformFetchUpstream, createPlatformTokenRoute} from '@directwerk/api/server'
import {
    createConfiguredPlatformTokenRequest,
    PLATFORM_REFRESH_COOKIE,
} from '@/lib/server/api'
import {validateLoginInput} from '@/lib/validation'

export const POST = createPlatformTokenRoute({
    refreshCookie: PLATFORM_REFRESH_COOKIE,
    validate: validateLoginInput,
    upstream: createPlatformFetchUpstream(createConfiguredPlatformTokenRequest),
    messages: {missingBody: 'Invalid request body.'},
})
