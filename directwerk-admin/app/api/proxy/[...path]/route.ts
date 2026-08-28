import {createPlatformProxyRouteHandler} from '@directwerk/api/proxy/platformRouteHandler'
import {createConfiguredPlatformApiRequest} from '@/lib/server/api'

const MAX_PROXY_BODY_SIZE = 64 * 1024

const handlers = createPlatformProxyRouteHandler({
    jsonBodyLimit: MAX_PROXY_BODY_SIZE,
    fetchUpstream: async (segments, request, authorization) => {
        const upstreamRequest = createConfiguredPlatformApiRequest(
            segments,
            request,
            authorization,
        )
        return fetch(upstreamRequest.url, upstreamRequest.init)
    },
})

export const GET = handlers.GET
export const HEAD = handlers.HEAD
export const POST = handlers.POST
export const PUT = handlers.PUT
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
