import {describe, expect, it} from 'vitest'

import {defaultLocale, locales} from './locale'

import {
    localeFromPathname,
    matchAcceptLanguage,
    matchLocale,
    resolveLocalePreference,
    splitPathSuffix,
    stripLocalePrefix,
    writeLocaleCookie,
} from './i18n'

describe('matchLocale', () => {
    it('defaults to de when the header is missing or empty', () => {
        expect(matchLocale(null)).toBe('de')
        expect(matchLocale('')).toBe('de')
        expect(matchLocale('fr-FR,fr;q=0.9')).toBe('de')
    })

    it('prefers the highest-quality supported tag', () => {
        expect(matchLocale('en-US,en;q=0.9,de;q=0.8')).toBe('en')
        expect(matchLocale('de-DE,de;q=0.9,en;q=0.8')).toBe('de')
    })

    it('matches primary subtags', () => {
        expect(matchLocale('en-GB')).toBe('en')
        expect(matchLocale('de-AT,de;q=0.9')).toBe('de')
    })

    it('drops ranges with q=0', () => {
        expect(matchLocale('en;q=0,de;q=0.5')).toBe('de')
    })

    it('resolves a wildcard to the fallback', () => {
        expect(matchLocale('*')).toBe('de')
    })
})

describe('matchAcceptLanguage', () => {
    it('honours a custom supported set and fallback', () => {
        expect(matchAcceptLanguage('fr;q=0.9,es;q=0.8', ['es', 'fr'], 'es')).toBe('fr')
        expect(matchAcceptLanguage('xx', ['es', 'fr'], 'es')).toBe('es')
    })
})

describe('path helpers', () => {
    it('reads the locale segment', () => {
        expect(localeFromPathname('/de/podcast')).toBe('de')
        expect(localeFromPathname('/write')).toBeNull()
    })

    it('strips a locale prefix', () => {
        expect(stripLocalePrefix('/de/write/articles')).toBe('/write/articles')
        expect(stripLocalePrefix('/en')).toBe('/')
        expect(stripLocalePrefix('/write')).toBe('/write')
    })

    it('splits query/hash suffixes', () => {
        expect(splitPathSuffix('/a?b=1#c')).toEqual({pathname: '/a', suffix: '?b=1#c'})
        expect(splitPathSuffix('/a#c?b=1')).toEqual({pathname: '/a', suffix: '#c?b=1'})
        expect(splitPathSuffix('/a')).toEqual({pathname: '/a', suffix: ''})
    })
})

describe('resolveLocalePreference', () => {
    it('prefers a valid cookie over the Accept-Language header', () => {
        expect(resolveLocalePreference('en', 'de-DE,de;q=0.9', locales, defaultLocale)).toBe('en')
    })

    it('falls back to the header when the cookie is missing or unsupported', () => {
        expect(resolveLocalePreference(undefined, 'en-US,en;q=0.9', locales, defaultLocale)).toBe('en')
        expect(resolveLocalePreference('fr', 'de-AT,de;q=0.9', locales, defaultLocale)).toBe('de')
    })

    it('falls back to the default when neither is usable', () => {
        expect(resolveLocalePreference(null, null, locales, defaultLocale)).toBe(defaultLocale)
    })
})

describe('writeLocaleCookie', () => {
    it('writes path-wide, one-year, SameSite=Lax locale cookies', () => {
        document.cookie = 'dw_locale=; max-age=0; path=/'

        writeLocaleCookie('dw_locale', 'en')

        expect(document.cookie).toContain('dw_locale=en')
    })
})
