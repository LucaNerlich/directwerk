import {NextResponse} from 'next/server'

const JSON_CONTENT_TYPE = 'application/json'
const NO_STORE_HEADERS = {
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
}

export function jsonError(
    message: string,
    status: number,
    code?: string,
): NextResponse {
    return NextResponse.json(
        code === undefined ? {error: message} : {error: message, code},
        {status, headers: NO_STORE_HEADERS},
    )
}

function invalidUpstreamResponse(response: Response): NextResponse {
    if (response.status >= 400 && response.status < 500) {
        return jsonError('The upstream service rejected the request.', response.status)
    }

    return jsonError('The upstream service returned an invalid response.', 502)
}

export async function toClientResponse(response: Response): Promise<NextResponse> {
    if (response.status >= 500 && response.status <= 599) {
        return invalidUpstreamResponse(response)
    }

    if (response.status === 204 || response.status === 205) {
        return new NextResponse(null, {status: response.status, headers: NO_STORE_HEADERS})
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes(JSON_CONTENT_TYPE)) {
        return invalidUpstreamResponse(response)
    }

    const body = await response.text()
    try {
        const data: unknown = JSON.parse(body)
        return NextResponse.json(data, {status: response.status, headers: NO_STORE_HEADERS})
    } catch {
        return invalidUpstreamResponse(response)
    }
}
