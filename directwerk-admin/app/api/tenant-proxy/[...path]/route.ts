import {PROXY_POLICIES} from '@directwerk/api/proxy'
import {createAdminTenantProxyRouteHandler} from '@directwerk/api/proxy/platformRouteHandler'
import {requestTenantApi} from '@/lib/server/api'

const handlers = createAdminTenantProxyRouteHandler({
    fetchUpstream: async (pathWithQuery, tenantHost, method, authorization, body) =>
        requestTenantApi(
            pathWithQuery,
            tenantHost,
            method,
            authorization,
            body,
        ),
    ...PROXY_POLICIES.adminTenant,
})

export const GET = handlers.GET
export const HEAD = handlers.HEAD
export const POST = handlers.POST
export const PUT = handlers.PUT
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
