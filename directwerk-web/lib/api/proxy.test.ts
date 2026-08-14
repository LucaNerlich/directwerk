import {describe, expect, it} from 'vitest'

import {
    buildProxyPath,
    hasUnsupportedProxyQuery,
    readBearerToken,
} from './proxy'

describe('proxy path safety', () => {
    it('builds an API path from safe decoded segments', () => {
        expect(buildProxyPath(['me', 'access'])).toBe('/api/v1/me/access')
        expect(buildProxyPath(['public', 'site-config'])).toBe(
            '/api/v1/public/site-config',
        )
    })

    it.each([
        {segments: []},
        {segments: ['.']},
        {segments: ['..']},
        {segments: ['me/access']},
        {segments: ['me%2Faccess']},
        {segments: ['me?admin=true']},
        {segments: ['']},
    ])('rejects unsafe path segments $segments', ({segments}) => {
        expect(buildProxyPath(segments)).toBeNull()
    })
})

describe('proxy query safety', () => {
    it('rejects non-empty query strings', () => {
        expect(
            hasUnsupportedProxyQuery('http://localhost/api/proxy/me?include=all'),
        ).toBe(true)
        expect(hasUnsupportedProxyQuery('http://localhost/api/proxy/me')).toBe(false)
    })
})

describe('bearer token validation', () => {
    it('accepts a bounded token with no whitespace', () => {
        expect(readBearerToken('Bearer header.payload.signature')).toBe(
            'header.payload.signature',
        )
    })

    it.each([
        null,
        '',
        'Basic abc',
        'bearer abc',
        'Bearer token with spaces',
        `Bearer ${'a'.repeat(8193)}`,
    ])('rejects malformed authorization value %s', (value) => {
        expect(readBearerToken(value)).toBeNull()
    })
})
