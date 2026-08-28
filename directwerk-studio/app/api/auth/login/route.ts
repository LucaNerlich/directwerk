import {createTenantLoginRoute} from '@directwerk/api/server'
import {directwerkFetch, getOAuthClientId, REFRESH_COOKIE} from '@/lib/server/api'

export const POST = createTenantLoginRoute({
    directwerkFetch,
    getOAuthClientId,
    refreshCookie: REFRESH_COOKIE,
})
