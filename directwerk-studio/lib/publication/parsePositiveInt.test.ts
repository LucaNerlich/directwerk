import {describe, expect, it} from 'vitest'

import {parseOptionalInt} from '@/lib/publication/parsePositiveInt'

describe('parseOptionalInt', () => {
    it('returns undefined for empty input', () => {
        expect(parseOptionalInt('', 1)).toBeUndefined()
        expect(parseOptionalInt('   ', 1)).toBeUndefined()
    })

    it('parses plain integers at or above the minimum', () => {
        expect(parseOptionalInt('3', 1)).toBe(3)
        expect(parseOptionalInt(' 12 ', 1)).toBe(12)
        expect(parseOptionalInt('007', 1)).toBe(7)
        expect(parseOptionalInt('0', 0)).toBe(0)
    })

    it('rejects values below the minimum', () => {
        expect(parseOptionalInt('0', 1)).toBeUndefined()
    })

    it('rejects trailing garbage instead of truncating like parseInt', () => {
        expect(parseOptionalInt('12abc', 1)).toBeUndefined()
        expect(parseOptionalInt('3.5', 1)).toBeUndefined()
        expect(parseOptionalInt('3,5', 1)).toBeUndefined()
        expect(parseOptionalInt('-3', 1)).toBeUndefined()
        expect(parseOptionalInt('+3', 1)).toBeUndefined()
        expect(parseOptionalInt('0x10', 1)).toBeUndefined()
        expect(parseOptionalInt('1e3', 1)).toBeUndefined()
    })
})
