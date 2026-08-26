import {safeUpstreamResponse} from '@directwerk/api/server'
import {createConfiguredPlatformRefreshRequest} from '@/lib/server/api'
import {PLATFORM_REFRESH_COOKIE} from '@/lib/server/api'
import {readRequestCookie, sealRefreshToken} from '@directwerk/api/auth/cookies'
import {validateRefreshTokenInput} from '@/lib/validation'

const MAX_REFRESH_BODY_SIZE = 16 * 1024
const UPSTREAM_TIMEOUT_MS = 10000

export async function POST(request: Request): Promise<Response> {
    if (!request.headers.get('content-type')?.includes('application/json')) {
        return Response.json(
            {error: 'Content-Type must be application/json.'},
            {status: 415}
        )
    }

    const contentLength = request.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_REFRESH_BODY_SIZE) {
        return Response.json({error: 'Request body is too large.'}, {status: 413})
    }

    try {
        // Prefer the httpOnly refresh cookie set by login/refresh; the JSON body is
        // only a fallback for clients that predate cookie-based refresh.
        let refreshToken = readRequestCookie(request, PLATFORM_REFRESH_COOKIE)

        if (!refreshToken) {
            const reader = request.body?.getReader()
            if (!reader) {
                return Response.json({error: 'Invalid request body.'}, {status: 400})
            }

            const chunks: Uint8Array[] = []
            let totalBytes = 0

            while (true) {
                const {done, value} = await reader.read()
                if (done) break

                totalBytes += value.byteLength
                if (totalBytes > MAX_REFRESH_BODY_SIZE) {
                    reader.cancel()
                    return Response.json(
                        {error: 'Request body is too large.'},
                        {status: 413}
                    )
                }
                chunks.push(value)
            }

            const bodyBytes = new Uint8Array(totalBytes)
            let offset = 0
            for (const chunk of chunks) {
                bodyBytes.set(chunk, offset)
                offset += chunk.byteLength
            }

            let input: unknown
            try {
                input = JSON.parse(new TextDecoder().decode(bodyBytes))
            } catch {
                return Response.json({error: 'Invalid JSON request.'}, {status: 400})
            }

            const validation = validateRefreshTokenInput(input)
            if (!validation.success) {
                return Response.json({error: validation.error}, {status: 400})
            }
            refreshToken = validation.data.refresh_token
        }

        if (!refreshToken) {
            return Response.json(
                {error: 'A valid refresh token is required.'},
                {status: 401}
            )
        }

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
