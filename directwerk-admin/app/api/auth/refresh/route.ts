import {safeUpstreamResponse} from '@directwerk/api/server'
import {createConfiguredPlatformRefreshRequest} from '@/lib/server/api'
import {PLATFORM_REFRESH_COOKIE} from '@/lib/server/api'
import {readRequestCookie, sealRefreshToken} from '@directwerk/api/auth/cookies'

const UPSTREAM_TIMEOUT_MS = 10000

export async function POST(request: Request): Promise<Response> {
    const refreshToken = readRequestCookie(request, PLATFORM_REFRESH_COOKIE)
    if (!refreshToken) {
        return Response.json(
            {error: 'A valid refresh token is required.'},
            {status: 401}
        )
    }

    try {
        const upstreamRequest = createConfiguredPlatformRefreshRequest(refreshToken)
        const abortController = new AbortController()
        const timeoutId = setTimeout(() => abortController.abort(), UPSTREAM_TIMEOUT_MS)

        try {
            const upstream = await fetch(upstreamRequest.url, {
                ...upstreamRequest.init,
                signal: abortController.signal,
            })
            clearTimeout(timeoutId)
            const sealed = await sealRefreshToken(
                await safeUpstreamResponse(upstream),
                PLATFORM_REFRESH_COOKIE
            )
            const headers = new Headers(sealed.headers)
            headers.set('Cache-Control', 'no-store')
            headers.set('Pragma', 'no-cache')
            return new Response(sealed.body, {
                status: sealed.status,
                statusText: sealed.statusText,
                headers,
            })
        } catch (error) {
            clearTimeout(timeoutId)
            throw error
        }
    } catch {
        return Response.json(
            {error: 'Authentication service is unavailable.'},
            {status: 502}
        )
    }
}
