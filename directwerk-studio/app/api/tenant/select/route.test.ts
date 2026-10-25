import {describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))

import {DELETE, POST} from './route'

describe('POST /api/tenant/select (studio)', () => {
    it('rejects a foreign Origin', async () => {
        const response = await POST(
            new Request('http://localhost/api/tenant/select', {
                method: 'POST',
                headers: {
                    origin: 'https://evil.example',
                    host: 'localhost',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({host: 'acme.test'}),
            }),
        )

        expect(response.status).toBe(403)
    })

    it('rejects a non-JSON content type', async () => {
        const response = await POST(
            new Request('http://localhost/api/tenant/select', {
                method: 'POST',
                headers: {
                    origin: 'http://localhost',
                    host: 'localhost',
                    'content-type': 'text/plain',
                },
                body: JSON.stringify({host: 'acme.test'}),
            }),
        )

        expect(response.status).toBe(415)
    })

    it('sets the tenant host cookie for same-origin JSON', async () => {
        const response = await POST(
            new Request('http://localhost/api/tenant/select', {
                method: 'POST',
                headers: {
                    origin: 'http://localhost',
                    host: 'localhost',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({host: 'acme.test'}),
            }),
        )

        expect(response.status).toBe(200)
        expect(response.headers.getSetCookie().join('\n')).toContain('acme.test')
    })
})

describe('DELETE /api/tenant/select (studio)', () => {
    it('rejects a foreign Origin', async () => {
        const response = await DELETE(
            new Request('http://localhost/api/tenant/select', {
                method: 'DELETE',
                headers: {origin: 'https://evil.example', host: 'localhost'},
            }),
        )

        expect(response.status).toBe(403)
    })
})
