import {createTenantProxyRouteHandler, PROXY_POLICIES} from '@directwerk/api/proxy'
import {directwerkFetch, longRunningDirectwerkFetch} from '@/lib/server/api'

/**
 * Studio BFF proxy: 1 MiB JSON request-body cap, empty bodies allowed
 * (some clients POST without a body). Limits come from PROXY_POLICIES.
 */
// Only endpoints whose backend budget can reach the ingest deadline may use the long client
// (#1051): imports, domain verification (10s DNS deadline + DB work) and analytics (up to three
// sequential 8s Umami calls).
const LONG_RUNNING_PATH_PREFIXES = [
    '/api/v1/podcast/import/',
    '/api/v1/articles/import/',
    '/api/v1/tenant/analytics/stats/',
]
const isLongRunning = (apiPath: string): boolean =>
    LONG_RUNNING_PATH_PREFIXES.some((prefix) => apiPath.startsWith(prefix)) ||
    (apiPath.startsWith('/api/v1/tenant/domains/') && apiPath.endsWith('/verify'))

const handlers = createTenantProxyRouteHandler({
    fetchUpstream: (request) =>
        isLongRunning(request.path)
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
