import {describe, expect, it, vi} from 'vitest'

import {createAuthedRequest} from '../src/client/authedRequest'

function jsonResponse(status: number): Response {
    return new Response(JSON.stringify({ok: true}), {
        status,
        headers: {'Content-Type': 'application/json'},
    })
}

describe('createAuthedRequest fixed-message mode', () => {
    it('clears tokens and throws AUTH_REQUIRED on a retried 401', async () => {
        const fetchMock = vi.fn(async () => jsonResponse(401))
        const refreshAccessToken = vi.fn(async () => 'token')
        vi.stubGlobal(
            'fetch',
            fetchMock,
        )
        try {
            let cleared = 0
            const request = createAuthedRequest({
                session: {
                    getValidAccessToken: async () => 'token',
                    refreshAccessToken,
                },
                clearTokens: () => {
                    cleared += 1
                },
                authFailureMode: 'auth-required',
                finalUnauthorized: 'clear-and-auth-required',
                fixedErrorMessagesOnly: true,
                fixedErrorMessage: 'REQUEST_FAILED',
            })

            await expect(request('/api/admin/things')).rejects.toThrow('AUTH_REQUIRED')
            expect(cleared).toBe(1)
            expect(refreshAccessToken).toHaveBeenCalledOnce()
            expect(fetchMock).toHaveBeenCalledTimes(2)
        } finally {
            vi.unstubAllGlobals()
        }
    })
})
