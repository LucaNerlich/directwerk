import {describe, expect, it} from 'vitest'

import {safeReturnTo} from './safeReturnTo'

describe('safeReturnTo', () => {
    it('allows known prefixes and localizes the fallback', () => {
        expect(safeReturnTo('/pricing', '/account', 'de')).toBe('/de/pricing')
        expect(safeReturnTo('/episodes/my-show', '/account', 'en')).toBe(
            '/en/episodes/my-show',
        )
    })

    it('rejects absolute / protocol-relative URLs', () => {
        expect(safeReturnTo('https://evil.test', '/account', 'de')).toBe('/de/account')
        expect(safeReturnTo('//evil.test', '/account', 'de')).toBe('/de/account')
    })

    it('rejects disallowed paths', () => {
        expect(safeReturnTo('/login', '/account', 'de')).toBe('/de/account')
        expect(safeReturnTo(null, '/pricing', 'en')).toBe('/en/pricing')
    })

    it('keeps query strings on allowed paths', () => {
        expect(safeReturnTo('/pricing?buy=pro-monat', '/account', 'de')).toBe(
            '/de/pricing?buy=pro-monat',
        )
        expect(
            safeReturnTo('/checkout/success?session_id=cs_test_123', '/account', 'de'),
        ).toBe('/de/checkout/success?session_id=cs_test_123')
    })

    it('preserves an explicit locale on returnTo', () => {
        expect(safeReturnTo('/en/account', '/account', 'de')).toBe('/en/account')
    })

    it('rejects path tricks', () => {
        expect(safeReturnTo('/pricing\\evil.test', '/account', 'de')).toBe('/de/account')
        expect(safeReturnTo('javascript:alert(1)', '/account', 'de')).toBe('/de/account')
    })
})
