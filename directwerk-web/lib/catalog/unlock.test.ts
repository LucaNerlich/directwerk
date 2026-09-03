import {describe, expect, it} from 'vitest'

import type {PublicProduct} from '@directwerk/api/types'

import {findUnlockProduct, unlockHref} from '@/lib/catalog/unlock'

function buildProduct(
    overrides: Partial<PublicProduct> & {slug: string},
): PublicProduct {
    return {
        title: overrides.slug,
        offeringType: 'LEVEL',
        sortOrder: 0,
        description: null,
        priceCents: 500,
        currency: 'EUR',
        billingInterval: 'MONTH',
        ...overrides,
    }
}

describe('catalog unlock links', () => {
    it('falls back to plain /pricing without products', () => {
        expect(findUnlockProduct([])).toBeNull()
        expect(unlockHref(null)).toBe('/pricing')
    })

    it('prefers the entry-level LEVEL product', () => {
        const products = [
            buildProduct({slug: 'pro', offeringType: 'LEVEL', sortOrder: 20}),
            buildProduct({slug: 'basis', offeringType: 'LEVEL', sortOrder: 10}),
            buildProduct({slug: 'paket', offeringType: 'PACKAGE', sortOrder: 1}),
        ]
        expect(findUnlockProduct(products)?.slug).toBe('basis')
        expect(unlockHref(findUnlockProduct(products))).toBe('/pricing#basis')
    })

    it('uses the first product when no LEVEL product exists', () => {
        const products = [buildProduct({slug: 'paket', offeringType: 'PACKAGE'})]
        expect(findUnlockProduct(products)?.slug).toBe('paket')
        expect(unlockHref(findUnlockProduct(products))).toBe('/pricing#paket')
    })
})
