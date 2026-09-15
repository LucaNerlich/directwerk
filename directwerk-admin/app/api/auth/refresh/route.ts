import {createPlatformFetchUpstream, createPlatformRefreshRoute} from '@directwerk/api/server'
import {
    createConfiguredPlatformRefreshRequest,
    PLATFORM_REFRESH_COOKIE,
} from '@/lib/server/api'

export const POST = createPlatformRefreshRoute({
    refreshCookie: PLATFORM_REFRESH_COOKIE,
    upstream: createPlatformFetchUpstream(createConfiguredPlatformRefreshRequest),
})
