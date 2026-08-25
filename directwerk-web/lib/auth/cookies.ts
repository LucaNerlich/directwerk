import 'server-only'

export const REFRESH_COOKIE = 'dw_web_refresh'

function secureFlag(): string {
    return process.env.NODE_ENV === 'production' ? '; Secure' : ''
}

/**
 * Serializes an httpOnly, SameSite=Strict session cookie. The refresh token is
 * never exposed to client JavaScript; the BFF reads it on the refresh route.
 */
function serializeRefreshCookie(name: string, value: string): string {
    return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict${secureFlag()}`
}

export function serializeClearCookie(name: string): string {
    return `${name}=; Path=/; HttpOnly; SameSite=Strict${secureFlag()}; Max-Age=0`
}

export function readRequestCookie(request: Request, name: string): string | null {
    const cookieHeader = request.headers.get('cookie')
    if (!cookieHeader) {
        return null
    }
    for (const part of cookieHeader.split(';')) {
        const trimmed = part.trim()
        const separator = trimmed.indexOf('=')
        if (separator < 0) {
            continue
        }
        const key = trimmed.slice(0, separator)
        if (key === name) {
            try {
                return decodeURIComponent(trimmed.slice(separator + 1))
            } catch {
                return null
            }
        }
    }
    return null
}

/**
 * Reads the token JSON body, moves `refresh_token` into an httpOnly cookie and
 * returns the body without it. Passes non-OK responses through unchanged.
 */
export async function sealRefreshToken(
    response: Response,
    cookieName: string,
): Promise<Response> {
    if (!response.ok) {
        return response
    }

    const payload: unknown = await response.json().catch(() => null)
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        return response
    }

    const record = payload as Record<string, unknown>
    const refreshToken =
        typeof record.refresh_token === 'string' ? record.refresh_token : null

    const headers = new Headers(response.headers)
    if (refreshToken !== null) {
        headers.append('Set-Cookie', serializeRefreshCookie(cookieName, refreshToken))
        delete record.refresh_token
    }

    return Response.json(record, {status: response.status, statusText: response.statusText, headers})
}
