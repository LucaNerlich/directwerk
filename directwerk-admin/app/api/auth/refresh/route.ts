import {safeUpstreamResponse} from '@/lib/directwerk'
import {createConfiguredPlatformRefreshRequest} from '@/lib/directwerkServer'
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
                return Response.json({error: 'Request body is too large.'}, {status: 413})
            }
            chunks.push(value)
        }

        const bodyBytes = new Uint8Array(totalBytes)
        let offset = 0
        for (const chunk of chunks) {
            bodyBytes.set(chunk, offset)
            offset += chunk.byteLength
        }

        const body = new TextDecoder().decode(bodyBytes)

        let input: unknown

        try {
            input = JSON.parse(body)
        } catch {
            return Response.json({error: 'Invalid JSON request.'}, {status: 400})
        }

        const validation = validateRefreshTokenInput(input)

        if (!validation.success) {
            return Response.json({error: validation.error}, {status: 400})
        }

        const upstreamRequest = createConfiguredPlatformRefreshRequest(
            validation.data.refresh_token
        )
        const abortController = new AbortController()
        const timeoutId = setTimeout(() => abortController.abort(), UPSTREAM_TIMEOUT_MS)

        try {
            const upstream = await fetch(upstreamRequest.url, {
                ...upstreamRequest.init,
                signal: abortController.signal,
            })
            clearTimeout(timeoutId)
            const response = await safeUpstreamResponse(upstream)
            const headers = new Headers(response.headers)
            headers.set('Cache-Control', 'no-store')
            headers.set('Pragma', 'no-cache')
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
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
