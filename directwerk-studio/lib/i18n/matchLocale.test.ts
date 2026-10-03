import {describe, expect, it} from 'vitest'

import {defaultLocale} from './config'
import {matchLocale, preferredLocale} from './matchLocale'
import {localeFromPathname, localizedPath, stripLangPrefix, swapLangInPath} from './paths'

describe('matchLocale', () => {
    it('falls back to de when header missing', () => {
        expect(matchLocale(null)).toBe(defaultLocale)
        expect(matchLocale('')).toBe('de')
    })

    it('prefers en from Accept-Language', () => {
        expect(matchLocale('en-US,en;q=0.9,de;q=0.8')).toBe('en')
    })

    it('matches regional tags to base locale', () => {
        expect(matchLocale('de-AT,de;q=0.9')).toBe('de')
    })

    it('honors cookie over Accept-Language', () => {
        expect(preferredLocale('en-US', 'de')).toBe('de')
        expect(preferredLocale('de-DE', 'en')).toBe('en')
    })
})

describe('paths', () => {
    it('prefixes logical paths', () => {
        expect(localizedPath('de', '/write')).toBe('/de/write')
        expect(localizedPath('en', '/')).toBe('/en')
        expect(localizedPath('en', '/login?reason=role')).toBe('/en/login?reason=role')
    })

    it('strips locale prefixes', () => {
        expect(stripLangPrefix('/de/write/articles')).toBe('/write/articles')
        expect(stripLangPrefix('/en')).toBe('/')
        expect(stripLangPrefix('/write')).toBe('/write')
    })

    it('swaps locale in path', () => {
        expect(swapLangInPath('/de/settings/branding', 'en')).toBe('/en/settings/branding')
        expect(swapLangInPath('/en/login?reason=role', 'de')).toBe('/de/login?reason=role')
    })

    it('reads locale from pathname', () => {
        expect(localeFromPathname('/de/podcast')).toBe('de')
        expect(localeFromPathname('/write')).toBeNull()
    })
})
