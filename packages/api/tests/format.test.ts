import {describe, expect, it} from 'vitest'

import {formatMoney} from '../src/format/money'

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
