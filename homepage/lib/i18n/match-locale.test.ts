import {describe, expect, it} from 'vitest'

import {matchAcceptLanguage} from './match-locale'

describe('matchAcceptLanguage', () => {
    const locales = ['de', 'en'] as const

    it('falls back to default when header is missing', () => {
        expect(matchAcceptLanguage(null, locales, 'de')).toBe('de')
        expect(matchAcceptLanguage('', locales, 'de')).toBe('de')
    })

    it('matches an exact tag', () => {
        expect(matchAcceptLanguage('en', locales, 'de')).toBe('en')
        expect(matchAcceptLanguage('de', locales, 'de')).toBe('de')
    })

    it('matches a primary language from a regional tag', () => {
        expect(matchAcceptLanguage('en-US,en;q=0.9', locales, 'de')).toBe('en')
        expect(matchAcceptLanguage('de-DE,de;q=0.8,en;q=0.5', locales, 'de')).toBe('de')
    })

    it('respects quality ordering', () => {
        expect(matchAcceptLanguage('fr;q=0.9,en;q=0.8,de;q=0.1', locales, 'de')).toBe('en')
    })

    it('uses default when nothing matches', () => {
        expect(matchAcceptLanguage('fr-FR,fr;q=0.9', locales, 'de')).toBe('de')
    })
})
