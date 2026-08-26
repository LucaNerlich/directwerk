import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest'

import {AUTH_REQUIRED, AUTH_TRANSIENT} from '@directwerk/api/constants'
import {getAccessToken, setTokens} from '@/lib/auth/tokenStore'
import {refreshAccessToken} from '@/lib/auth/session'

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {'Content-Type': 'application/json'},
    })
}

describe('refreshAccessToken transient-failure semantics', () => {
    beforeEach(() => {
        sessionStorage.clear()
        setTokens({access_token: 'stale-token', token_type: 'Bearer', expires_in: 900})
        vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('keeps the session on a transient upstream outage (502)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(502, {
            error: 'The upstream service is unavailable.',
        })))

        await expect(refreshAccessToken()).rejects.toThrow(AUTH_TRANSIENT)
        expect(getAccessToken()).toBe('stale-token')
    })

    it('classifies fetch rejections as transient and keeps the session', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

        await expect(refreshAccessToken()).rejects.toThrow(AUTH_TRANSIENT)
        expect(getAccessToken()).toBe('stale-token')
    })

    it('ends the session only on definitive auth failures (400/401)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(400, {
            error: 'invalid_grant',
        })))

        await expect(refreshAccessToken()).rejects.toThrow(AUTH_REQUIRED)
        expect(getAccessToken()).toBeNull()
    })

    it('treats a non-JSON success reply as transient, not as logout', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(new Response('<html>gateway error</html>', {status: 200})),
        )

        await expect(refreshAccessToken()).rejects.toThrow(AUTH_TRANSIENT)
        expect(getAccessToken()).toBe('stale-token')
    })

    it('stores fresh tokens on a successful refresh', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, {
            access_token: 'fresh-token',
            token_type: 'Bearer',
            expires_in: 900,
        })))

        const accessToken = await refreshAccessToken()
        expect(accessToken).toBe('fresh-token')
        expect(getAccessToken()).toBe('fresh-token')
    })
})
