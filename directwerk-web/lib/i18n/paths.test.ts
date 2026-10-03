import {describe, expect, it} from 'vitest'

import {
    localeFromPathname,
    localizedPath,
    stripLocalePrefix,
    swapLocalePath,
} from './paths'

describe('i18n paths', () => {
    it('prefixes paths with the locale', () => {
        expect(localizedPath('de', '/')).toBe('/de')
        expect(localizedPath('en', '/account')).toBe('/en/account')
        expect(localizedPath('de', '/pricing?buy=pro')).toBe('/de/pricing?buy=pro')
    })

    it('strips and detects locale prefixes', () => {
        expect(stripLocalePrefix('/de/account')).toBe('/account')
        expect(stripLocalePrefix('/en')).toBe('/')
        expect(stripLocalePrefix('/episodes')).toBe('/episodes')
        expect(localeFromPathname('/en/login')).toBe('en')
        expect(localeFromPathname('/login')).toBeNull()
    })

    it('swaps locales while keeping the rest of the path', () => {
        expect(swapLocalePath('/de/episodes/foo', 'en')).toBe('/en/episodes/foo')
        expect(swapLocalePath('/account', 'en')).toBe('/en/account')
    })
})
