import {describe, expect, it} from 'vitest'

import {jsonError, toClientResponse} from './upstream'

describe('upstream response handling', () => {
    it('includes an optional structured error code', async () => {
        const response = jsonError('The request body is invalid.', 400, 'INVALID_REQUEST_BODY')

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
            error: 'The request body is invalid.',
            code: 'INVALID_REQUEST_BODY',
        })
    })

    it('marks error responses as uncacheable', () => {
        const response = jsonError('The upstream service is unavailable.', 502)

        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(response.headers.get('pragma')).toBe('no-cache')
    })

    it('preserves JSON responses and status codes', async () => {
        const response = await toClientResponse(
            new Response(JSON.stringify({code: 'USER_EXISTS'}), {
                status: 409,
                headers: {'content-type': 'application/json'},
            }),
        )

        expect(response.status).toBe(409)
        expect(response.headers.get('content-type')).toContain('application/json')
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(response.headers.get('pragma')).toBe('no-cache')
        expect(await response.json()).toEqual({code: 'USER_EXISTS'})
    })

    it('replaces non-JSON upstream responses with a generic gateway error', async () => {
        const response = await toClientResponse(
            new Response('<h1>Internal details</h1>', {
                status: 500,
                headers: {'content-type': 'text/html'},
            }),
        )

        expect(response.status).toBe(502)
        expect(await response.json()).toEqual({
            error: 'The upstream service returned an invalid response.',
        })
    })

    it('preserves a non-JSON upstream client error without exposing its body', async () => {
        const response = await toClientResponse(
            new Response('Sensitive authentication details', {status: 401}),
        )

        expect(response.status).toBe(401)
        expect(await response.json()).toEqual({
            error: 'The upstream service rejected the request.',
        })
    })
})
