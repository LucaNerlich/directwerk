import {describe, expect, it} from 'vitest'

import {parsePriceEurosToCents} from '@/lib/manage/productPrice'

describe('parsePriceEurosToCents', () => {
    it('treats empty input as no price', () => {
        expect(parsePriceEurosToCents('')).toEqual({valid: true, priceCents: undefined})
        expect(parsePriceEurosToCents('   ')).toEqual({valid: true, priceCents: undefined})
    })

    it('parses German and English decimals', () => {
        expect(parsePriceEurosToCents('14,90')).toEqual({valid: true, priceCents: 1490})
        expect(parsePriceEurosToCents('14.90')).toEqual({valid: true, priceCents: 1490})
        expect(parsePriceEurosToCents('5')).toEqual({valid: true, priceCents: 500})
        expect(parsePriceEurosToCents('0')).toEqual({valid: true, priceCents: 0})
    })

    it('handles German thousand separators', () => {
        expect(parsePriceEurosToCents('1.234,56')).toEqual({
            valid: true,
            priceCents: 123456,
        })
    })

    it('rejects invalid or negative input instead of silently dropping it', () => {
        for (const raw of ['abc', '12,345', '14.901', '-5', '14,9a', '1,2,3']) {
            const result = parsePriceEurosToCents(raw)
            expect(result.valid).toBe(false)
        }
        const negative = parsePriceEurosToCents('-5')
        expect(negative.valid).toBe(false)
        if (!negative.valid) {
            expect(negative.message).toMatch(/gültigen Preis/)
        }
    })
})
