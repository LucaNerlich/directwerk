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
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => jsonResponse(401)),
        )
        try {
            let cleared = 0
            const request = createAuthedRequest({
                session: {
                    getValidAccessToken: async () => 'token',
                    refreshAccessToken: async () => 'token',
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
        } finally {
            vi.unstubAllGlobals()
        }
    })
})
