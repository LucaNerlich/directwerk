import {describe, expect, it} from 'vitest'

import {hrefFor, localeAlternates, stripLangPrefix, swapLangPath} from './pathname'

describe('pathname helpers', () => {
    it('prefixes locale paths', () => {
        expect(hrefFor('de', '/')).toBe('/de')
        expect(hrefFor('en', '/developers')).toBe('/en/developers')
        expect(hrefFor('de', '/#contact')).toBe('/de/#contact')
        expect(hrefFor('en', 'https://docs.directwerk.org')).toBe(
            'https://docs.directwerk.org',
        )
    })

    it('builds hreflang alternates for a path', () => {
        expect(localeAlternates('/developers')).toEqual({
            de: '/de/developers',
            en: '/en/developers',
            'x-default': '/de/developers',
        })
    })

    it('strips and swaps locale segments', () => {
        expect(stripLangPrefix('/de/developers')).toBe('/developers')
        expect(stripLangPrefix('/en')).toBe('/')
        expect(swapLangPath('/de/privacy', 'en')).toBe('/en/privacy')
        expect(swapLangPath('/en/developers', 'de')).toBe('/de/developers')
    })
})
