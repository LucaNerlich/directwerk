import {describe, expect, it} from 'vitest'

import {safeReturnTo} from './safeReturnTo'

describe('safeReturnTo', () => {
    it('allows known in-app paths', () => {
        expect(safeReturnTo('/pricing')).toBe('/pricing')
        expect(safeReturnTo('/episodes/my-show')).toBe('/episodes/my-show')
    })

    it('rejects external and protocol-relative URLs', () => {
        expect(safeReturnTo('https://evil.test')).toBe('/account')
        expect(safeReturnTo('//evil.test')).toBe('/account')
    })

    it('falls back when path is not allow-listed', () => {
        expect(safeReturnTo('/login')).toBe('/account')
        expect(safeReturnTo(null, '/pricing')).toBe('/pricing')
    })
})
