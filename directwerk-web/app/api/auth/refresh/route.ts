import {createTenantRefreshRoute} from '@directwerk/api/server'
import {directwerkFetch, getOAuthClientId, REFRESH_COOKIE} from '@/lib/server/api'

export const POST = createTenantRefreshRoute({
    directwerkFetch,
    getOAuthClientId,
    refreshCookie: REFRESH_COOKIE,
})
