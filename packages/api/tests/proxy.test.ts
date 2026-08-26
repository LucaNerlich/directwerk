import {describe, expect, it} from 'vitest'

import {buildProxyPath, readBearerToken} from '../src/proxy/path'
import {parseTenantHost} from '../src/proxy/tenantHost'
import {readBoundedRequestBody} from '../src/proxy/boundedBody'

describe('buildProxyPath', () => {
    it('joins safe segments under /api/v1', () => {
        expect(buildProxyPath(['articles', '12'])).toBe('/api/v1/articles/12')
        // '.' is allowed inside segments so domain hosts can appear.
        expect(buildProxyPath(['podcast.example.com'])).toBe(
            '/api/v1/podcast.example.com',
        )
    })

    it('rejects traversal and empty segments', () => {
        expect(buildProxyPath([])).toBeNull()
        expect(buildProxyPath(['..'])).toBeNull()
        expect(buildProxyPath([''])).toBeNull()
        expect(buildProxyPath(['a/b'])).toBeNull()
    })
})

describe('readBearerToken', () => {
    it('accepts bounded bearer tokens only (returns the bare token)', () => {
        expect(readBearerToken('Bearer abc')).toBe('abc')
        expect(readBearerToken('bearer abc')).toBeNull()
        expect(readBearerToken('Bearer spaced token')).toBeNull()
        expect(readBearerToken(`Bearer ${'x'.repeat(9000)}`)).toBeNull()
        expect(readBearerToken(null)).toBeNull()
    })
})

describe('parseTenantHost', () => {
    it('normalizes case and strips ports', () => {
        expect(parseTenantHost('Podcast.Example.com:8443')).toBe('podcast.example.com')
        expect(parseTenantHost('localhost')).toBe('localhost')
    })

    it('rejects garbage', () => {
        expect(parseTenantHost(null)).toBeNull()
        expect(parseTenantHost('')).toBeNull()
        expect(parseTenantHost('-bad-.com')).toBeNull()
        expect(parseTenantHost('under_score.com')).toBeNull()
    })
})

describe('readBoundedRequestBody', () => {
    it('reads bodies within the cap', async () => {
        const request = new Request('http://local/', {
            method: 'POST',
            body: '{"a":1}',
        })
        const result = await readBoundedRequestBody(request, 1024)
        expect(result).toEqual({ok: true, text: '{"a":1}'})
    })

    it('rejects bodies exceeding the cap with 413', async () => {
        const request = new Request('http://local/', {
            method: 'POST',
            body: 'x'.repeat(100),
        })
        const result = await readBoundedRequestBody(request, 10)
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.status).toBe(413)
        }
    })

    it('treats a null body as empty (bodyless DELETE)', async () => {
        const request = new Request('http://local/', {method: 'DELETE'})
        const result = await readBoundedRequestBody(request, 1024)
        expect(result).toEqual({ok: true, text: ''})
    })
})
