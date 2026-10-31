import {describe, expect, it} from 'vitest'

import {tenantBrandImageSrc} from './tenantBrandImageSrc'

describe('tenantBrandImageSrc', () => {
    it('prefers favicon over logo', () => {
        expect(
            tenantBrandImageSrc(
                'https://cdn.example.test/favicon.ico',
                'https://cdn.example.test/logo.png',
            ),
        ).toBe('https://cdn.example.test/favicon.ico')
    })

    it('falls back to logo when favicon is missing', () => {
        expect(tenantBrandImageSrc(null, 'https://cdn.example.test/logo.png')).toBe(
            'https://cdn.example.test/logo.png',
        )
    })

    it('returns null when neither URL is usable', () => {
        expect(tenantBrandImageSrc(null, null)).toBeNull()
        expect(tenantBrandImageSrc('http://insecure.test/f.ico', 'javascript:alert(1)')).toBeNull()
    })
})
