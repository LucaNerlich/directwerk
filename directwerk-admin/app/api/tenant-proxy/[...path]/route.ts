import {createAdminTenantProxyRouteHandler} from '@directwerk/api/proxy/platformRouteHandler'
import {requestTenantApi} from '@/lib/server/api'

const MAX_PROXY_BODY_SIZE = 64 * 1024

const handlers = createAdminTenantProxyRouteHandler({
    jsonBodyLimit: MAX_PROXY_BODY_SIZE,
    fetchUpstream: async (pathWithQuery, tenantHost, method, authorization, body) =>
        requestTenantApi(
            pathWithQuery,
            tenantHost,
            method,
            authorization,
            body,
        ),
})

export const GET = handlers.GET
export const HEAD = handlers.HEAD
export const POST = handlers.POST
export const PUT = handlers.PUT
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
