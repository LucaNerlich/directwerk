const JSON_CONTENT_TYPE = 'application/json'

// Upstream responses may carry access/refresh tokens or signed asset URLs, and errors
// can leak upstream details. Never let them be stored by browsers or shared caches.
export const NO_STORE_HEADERS: Record<string, string> = {
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
}

export function jsonError(
    message: string,
    status: number,
    code?: string,
): Response {
    const body: Record<string, string> =
        code === undefined ? {error: message} : {error: message, code}
    return Response.json(body, {status, headers: {...NO_STORE_HEADERS}})
}

function invalidUpstreamResponse(response: Response): Response {
    if (response.status >= 400 && response.status < 500) {
        return jsonError('The upstream service rejected the request.', response.status)
    }

    return jsonError('The upstream service returned an invalid response.', 502)
}

/** Normalizes an upstream Response for the browser client (JSON-validated, no-store). */
export async function toClientResponse(response: Response): Promise<Response> {
    if (response.status >= 500 && response.status <= 599) {
        return invalidUpstreamResponse(response)
    }

    if (response.status === 204 || response.status === 205) {
        return new Response(null, {status: response.status, headers: {...NO_STORE_HEADERS}})
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes(JSON_CONTENT_TYPE)) {
        return invalidUpstreamResponse(response)
    }

    const body = await response.text()
    try {
        const data: unknown = JSON.parse(body)
        return Response.json(data, {status: response.status, headers: {...NO_STORE_HEADERS}})
    } catch {
        return invalidUpstreamResponse(response)
    }
}
