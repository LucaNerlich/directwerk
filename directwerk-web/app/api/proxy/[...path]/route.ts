import {createTenantProxyRouteHandler} from '@directwerk/api/proxy'
import {directwerkFetch} from '@/lib/server/api'

/**
 * Web BFF proxy: 16 KiB JSON request-body cap.
 */
const handlers = createTenantProxyRouteHandler({
    fetchUpstream: directwerkFetch,
    jsonBodyLimit: 16_384,
})

export const GET = handlers.GET
export const POST = handlers.POST
export const PUT = handlers.PUT
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
