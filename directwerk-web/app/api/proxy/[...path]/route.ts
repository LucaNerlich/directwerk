import {createTenantProxyRouteHandler, PROXY_POLICIES} from '@directwerk/api/proxy'
import {directwerkFetch} from '@/lib/server/api'

/**
 * Web BFF proxy: 16 KiB JSON request-body cap. Limits come from
 * PROXY_POLICIES.
 */
const handlers = createTenantProxyRouteHandler({
    fetchUpstream: directwerkFetch,
    ...PROXY_POLICIES.webTenant,
})

export const GET = handlers.GET
export const HEAD = handlers.HEAD
export const POST = handlers.POST
export const PUT = handlers.PUT
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
