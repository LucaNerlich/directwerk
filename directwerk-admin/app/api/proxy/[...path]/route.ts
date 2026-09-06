import {PROXY_POLICIES} from '@directwerk/api/proxy'
import {createPlatformProxyRouteHandler} from '@directwerk/api/proxy/platformRouteHandler'
import {createConfiguredPlatformApiRequest} from '@/lib/server/api'

const handlers = createPlatformProxyRouteHandler({
    fetchUpstream: async (segments, request, authorization) => {
        const upstreamRequest = createConfiguredPlatformApiRequest(
            segments,
            request,
            authorization,
        )
        return fetch(upstreamRequest.url, upstreamRequest.init)
    },
    ...PROXY_POLICIES.platform,
})

export const GET = handlers.GET
export const HEAD = handlers.HEAD
export const POST = handlers.POST
export const PUT = handlers.PUT
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
