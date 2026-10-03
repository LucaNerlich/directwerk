import {describe, expect, it} from 'vitest'

import {negotiateLocale} from './negotiate'

describe('negotiateLocale', () => {
    it('defaults to de when header missing or empty', () => {
        expect(negotiateLocale(null)).toBe('de')
        expect(negotiateLocale('')).toBe('de')
        expect(negotiateLocale('fr-FR,fr;q=0.9')).toBe('de')
    })

    it('prefers higher-quality English', () => {
        expect(negotiateLocale('en-US,en;q=0.9,de;q=0.8')).toBe('en')
        expect(negotiateLocale('de-DE,de;q=0.9,en;q=0.8')).toBe('de')
    })

    it('matches primary subtags', () => {
        expect(negotiateLocale('en-GB')).toBe('en')
        expect(negotiateLocale('de-AT,de;q=0.9')).toBe('de')
    })
})
