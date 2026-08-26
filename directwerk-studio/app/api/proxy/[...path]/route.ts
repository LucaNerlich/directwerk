import {createTenantProxyRouteHandler} from '@directwerk/api/proxy'
import {directwerkFetch} from '@/lib/server/api'

/**
 * Studio BFF proxy: 1 MiB JSON request-body cap, empty bodies allowed
 * (some clients POST without a body).
 */
const handlers = createTenantProxyRouteHandler({
    fetchUpstream: directwerkFetch,
    jsonBodyLimit: 1_048_576,
    allowMissingBody: true,
})

export const GET = handlers.GET
export const POST = handlers.POST
export const PUT = handlers.PUT
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
