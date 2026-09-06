import {createTenantProxyRouteHandler, PROXY_POLICIES} from '@directwerk/api/proxy'
import {directwerkFetch} from '@/lib/server/api'

/**
 * Studio BFF proxy: 1 MiB JSON request-body cap, empty bodies allowed
 * (some clients POST without a body). Limits come from PROXY_POLICIES.
 */
const handlers = createTenantProxyRouteHandler({
    fetchUpstream: directwerkFetch,
    ...PROXY_POLICIES.studioTenant,
})

export const GET = handlers.GET
export const HEAD = handlers.HEAD
export const POST = handlers.POST
export const PUT = handlers.PUT
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
