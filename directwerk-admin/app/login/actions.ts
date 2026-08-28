'use server'

import {safeUpstreamResponse} from '@directwerk/api/server'
import {sealRefreshToken} from '@directwerk/api/auth/cookies'

import type {OAuthTokenResponse} from '@directwerk/api/types'
import {
    createConfiguredPlatformTokenRequest,
    PLATFORM_REFRESH_COOKIE,
} from '@/lib/server/api'
import {storeSealedRefreshCookie} from '@/lib/server/platform'
import {validateLoginInput} from '@/lib/validation'

const UPSTREAM_TIMEOUT_MS = 10000

export interface LoginActionState {
    error: string | null
    /** OAuth token response without the refresh token (sealed into a cookie). */
    tokens: OAuthTokenResponse | null
}

export async function loginAction(
    _previousState: LoginActionState,
    formData: FormData
): Promise<LoginActionState> {
    const validation = validateLoginInput({
        email: formData.get('email'),
        password: formData.get('password'),
    })

    if (!validation.success) {
        return {error: 'Enter a valid email address and password.', tokens: null}
    }

    try {
        const upstreamRequest = createConfiguredPlatformTokenRequest(
            validation.data
        )
        const abortController = new AbortController()
        const timeoutId = setTimeout(
            () => abortController.abort(),
            UPSTREAM_TIMEOUT_MS
        )

        let upstream: Response
        try {
            upstream = await fetch(upstreamRequest.url, {
                ...upstreamRequest.init,
                signal: abortController.signal,
            })
        } finally {
            clearTimeout(timeoutId)
        }

        const sealed = await sealRefreshToken(
            await safeUpstreamResponse(upstream),
            PLATFORM_REFRESH_COOKIE
        )

        if (!sealed.ok) {
            return {error: 'Login failed. Check your credentials.', tokens: null}
        }

        const tokens = (await sealed.json()) as OAuthTokenResponse
        await storeSealedRefreshCookie(sealed.headers.get('set-cookie'))

        return {error: null, tokens}
    } catch {
        return {error: 'Login is unavailable. Try again later.', tokens: null}
    }
}
