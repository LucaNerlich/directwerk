import {describe, expect, it} from 'vitest'

import {AUTH_REQUIRED} from '../src/constants'
import {
    extractApiErrorMessage,
    parseApiEnvelope,
    parsePaginatedApiEnvelope,
} from '../src/envelope'

describe('parseApiEnvelope', () => {
    it('unwraps data payloads', () => {
        expect(parseApiEnvelope({data: {id: 7}})).toEqual({id: 7})
    })

    it('rejects malformed envelopes with the contract error code', () => {
        expect(() => parseApiEnvelope({nope: true})).toThrow(AUTH_REQUIRED && 'API_CONTRACT_ERROR')
        expect(() => parseApiEnvelope(null)).toThrow()
        expect(() =>
            parseApiEnvelope({data: {id: 1}}, (d): d is {id: number} =>
                typeof d === 'object' && d !== null && 'id' in d,
            ),
        ).not.toThrow()
    })
})

describe('parsePaginatedApiEnvelope', () => {
    it('requires metadata totals', () => {
        const page = parsePaginatedApiEnvelope({
            data: ['a'],
            metadata: {total: 1, offset: 0, limit: 25},
        })
        expect(page).toEqual({items: ['a'], total: 1, offset: 0, limit: 25})

        expect(() =>
            parsePaginatedApiEnvelope({data: ['a'], metadata: {total: 1}}),
        ).toThrow()
    })
})

describe('extractApiErrorMessage', () => {
    const catalog = {
        invalidGrant: 'E-Mail oder Passwort falsch.',
        unauthorized: 'E-Mail oder Passwort falsch.',
        fallback: (status: number) => `Anfrage fehlgeschlagen (${status}).`,
    }

    it('maps invalid_grant and structured errors', () => {
        expect(extractApiErrorMessage({error: 'invalid_grant'}, 400, catalog)).toBe(
            'E-Mail oder Passwort falsch.',
        )
        expect(
            extractApiErrorMessage(
                {errors: [{message: 'Slug ist bereits vergeben.'}]},
                409,
                catalog,
            ),
        ).toBe('Slug ist bereits vergeben.')
    })

    it('falls back per status', () => {
        expect(extractApiErrorMessage({}, 404, catalog)).toBe(
            'Anfrage fehlgeschlagen (404).',
        )
        expect(extractApiErrorMessage(null, 401, catalog)).toBe(
            'E-Mail oder Passwort falsch.',
        )
    })

    it('ignores unbounded error strings', () => {
        expect(extractApiErrorMessage({error: ''}, 500, catalog)).toBe(
            'Anfrage fehlgeschlagen (500).',
        )
        expect(extractApiErrorMessage({error: 'x'.repeat(256)}, 500, catalog)).toBe(
            'Anfrage fehlgeschlagen (500).',
        )
    })
})
