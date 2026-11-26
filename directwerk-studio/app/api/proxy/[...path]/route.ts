import {createTenantProxyRouteHandler, PROXY_POLICIES} from '@directwerk/api/proxy'
import {directwerkFetch, longRunningDirectwerkFetch} from '@/lib/server/api'

/**
 * Studio BFF proxy: 1 MiB JSON request-body cap, empty bodies allowed
 * (some clients POST without a body). Limits come from PROXY_POLICIES.
 */
// Only the import endpoints may occupy a request for the ingest deadline (#1051).
const IMPORT_PATH_PREFIXES = ['/api/v1/podcast/import/', '/api/v1/articles/import/']

const handlers = createTenantProxyRouteHandler({
    fetchUpstream: (request) =>
        IMPORT_PATH_PREFIXES.some((prefix) => request.path.startsWith(prefix))
            ? longRunningDirectwerkFetch(request)
            : directwerkFetch(request),
    ...PROXY_POLICIES.studioTenant,
})

export const GET = handlers.GET
export const HEAD = handlers.HEAD
export const POST = handlers.POST
export const PUT = handlers.PUT
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
