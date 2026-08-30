import 'server-only'

import {cookies} from 'next/headers'

import {safeUpstreamResponse} from '@directwerk/api/server'
import {parseApiEnvelope} from '@directwerk/api/envelope'
import {sealRefreshToken} from '@directwerk/api/auth/cookies'
import {parseTokenResponse} from '@directwerk/api/validation/token'

import {
    createConfiguredPlatformApiRequest,
    createConfiguredPlatformRefreshRequest,
    PLATFORM_REFRESH_COOKIE,
} from '@/lib/server/api'

const UPSTREAM_TIMEOUT_MS = 10000

interface PlatformApiSuccess<T> {
    ok: true
    data: T
}

interface PlatformApiFailure {
    ok: false
    /** Upstream (or session) failure status, e.g. 401/403/409/502. */
    status: number
}

export type PlatformApiResult<T> = PlatformApiSuccess<T> | PlatformApiFailure

/**
 * Exchanges the sealed refresh cookie for a fresh platform access token and
 * re-seals the (reused) refresh cookie. Server actions cannot read the
 * browser-side token store, so they authenticate through the cookie instead.
 */
export async function resolvePlatformAuthorization(): Promise<
    {ok: true; authorization: string} | {ok: false; status: number}
> {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get(PLATFORM_REFRESH_COOKIE)?.value

    if (!refreshToken) {
        return {ok: false, status: 401}
    }

    let upstreamRequest
    try {
        upstreamRequest = createConfiguredPlatformRefreshRequest(refreshToken)
    } catch {
        return {ok: false, status: 502}
    }

    let upstream: Response
    try {
        upstream = await fetch(upstreamRequest.url, {
            ...upstreamRequest.init,
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        })
    } catch {
        return {ok: false, status: 502}
    }

    const sealed = await sealRefreshToken(
        await safeUpstreamResponse(upstream),
        PLATFORM_REFRESH_COOKIE
    )

    if (!sealed.ok) {
        return {ok: false, status: sealed.status}
    }

    const payload = parseTokenResponse(await sealed.json().catch(() => null))
    if (payload === null) {
        return {ok: false, status: 502}
    }
    await storeSealedRefreshCookie(sealed.headers.get('set-cookie'))
    return {ok: true, authorization: `Bearer ${payload.access_token}`}
}

/**
 * Moves the refresh cookie produced by `sealRefreshToken` into the mutable
 * cookie store (server actions cannot return `Set-Cookie` headers directly).
 */
export async function storeSealedRefreshCookie(
    setCookie: string | null
): Promise<void> {
    if (setCookie === null) {
        return
    }

    const pair = setCookie.split(';')[0] ?? ''
    const separator = pair.indexOf('=')
    if (separator <= 0) {
        return
    }

    const name = pair.slice(0, separator).trim()
    let value = pair.slice(separator + 1).trim()
    try {
        value = decodeURIComponent(value)
    } catch {
        // Keep the raw value; the cookie store re-encodes safely.
    }

    const cookieStore = await cookies()
    cookieStore.set(name, value, {
        httpOnly: true,
        path: '/',
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production'
    })
}

/**
 * Performs an authenticated platform API mutation for server actions.
 * Authenticates via the sealed refresh cookie, unwraps the `{data}` envelope,
 * and reports failures as structured statuses instead of throwing.
 */
export async function callPlatformApi<T>(
    segments: string[],
    init: {
        method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'
        body?: object
    }
): Promise<PlatformApiResult<T>> {
    const auth = await resolvePlatformAuthorization()
    if (!auth.ok) {
        return auth
    }

    let upstreamRequest
    try {
        upstreamRequest = createConfiguredPlatformApiRequest(
            segments,
            new Request('http://admin.local/api/internal', {
                method: init.method,
                headers:
                    init.body === undefined
                        ? undefined
                        : {'Content-Type': 'application/json'},
                body:
                    init.body === undefined
                        ? undefined
                        : JSON.stringify(init.body),
            }),
            auth.authorization
        )
    } catch {
        return {ok: false, status: 502}
    }

    let upstream: Response
    try {
        upstream = await fetch(upstreamRequest.url, {
            ...upstreamRequest.init,
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        })
    } catch {
        return {ok: false, status: 502}
    }

    if (!upstream.ok) {
        return {ok: false, status: upstream.status}
    }

    if (upstream.status === 204 || upstream.status === 205) {
        return {ok: true, data: null as T}
    }

    try {
        const payload: unknown = await upstream.json()
        return {ok: true, data: parseApiEnvelope<T>(payload)}
    } catch {
        return {ok: false, status: 502}
    }
}

/**
 * Maps a platform API failure status to the admin's localized form message,
 * mirroring the client-side catalog (`AUTH_REQUIRED`/`FORBIDDEN`/`CONFLICT`).
 */
export function statusToFormError(
    status: number,
    messages: {conflict: string; fallback: string}
): string {
    switch (status) {
        case 401:
            return 'Your session expired. Sign in again.'
        case 403:
            return 'You do not have permission for this action.'
        case 409:
            return messages.conflict
        case 503:
            return 'Directwerk is misconfigured for this action (often email delivery). Check API logs and env vars.'
        case 500:
            return 'Directwerk returned an unexpected error. Check API logs and try again.'
        default:
            return messages.fallback
    }
}
