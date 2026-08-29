import {describe, expect, it} from 'vitest'

import {formatMoney} from '../src/format/money'
import {formatPublishedAt} from '../src/format/datetime'

describe('formatMoney', () => {
    it('formats EUR amounts with German locale', () => {
        expect(formatMoney(1999, 'EUR')).toBe('19,99\u00a0€')
    })

    it('uses configurable null labels', () => {
        expect(formatMoney(null, 'EUR')).toBe('Kein Preis')
        expect(formatMoney(undefined, 'EUR', null, {nullLabel: 'Preis folgt'})).toBe(
            'Preis folgt',
        )
    })
})


describe('formatPublishedAt', () => {
    it('returns fallback for null', () => {
        expect(formatPublishedAt(null)).toBe('Unknown date')
    })

    it('returns original string for invalid dates', () => {
        expect(formatPublishedAt('not-a-date')).toBe('not-a-date')
    })

    it('formats valid ISO timestamps', () => {
        const formatted = formatPublishedAt('2024-06-01T12:00:00.000Z')
        expect(formatted).not.toBe('Unknown date')
        expect(formatted).not.toBe('2024-06-01T12:00:00.000Z')
    })
})
