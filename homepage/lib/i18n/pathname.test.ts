import {describe, expect, it} from 'vitest'

import {hrefFor, langFromPathname, stripLangPrefix, swapLangPath} from './pathname'

describe('pathname helpers', () => {
    it('prefixes locale paths', () => {
        expect(hrefFor('de', '/')).toBe('/de')
        expect(hrefFor('en', '/developers')).toBe('/en/developers')
        expect(hrefFor('de', '/#contact')).toBe('/de/#contact')
        expect(hrefFor('en', 'https://docs.directwerk.org')).toBe(
            'https://docs.directwerk.org',
        )
    })

    it('strips and swaps locale segments', () => {
        expect(stripLangPrefix('/de/developers')).toBe('/developers')
        expect(stripLangPrefix('/en')).toBe('/')
        expect(swapLangPath('/de/privacy', 'en')).toBe('/en/privacy')
        expect(swapLangPath('/en/developers', 'de')).toBe('/de/developers')
        expect(langFromPathname('/en/foo')).toBe('en')
        expect(langFromPathname('/unknown')).toBe('de')
    })
})
