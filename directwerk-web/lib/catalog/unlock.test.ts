import {describe, expect, it} from 'vitest'

import {unlockHref} from '@/lib/catalog/unlock'

describe('unlockHref', () => {
    it('always lands on the localized pricing page', () => {
        expect(unlockHref('de')).toBe('/de/pricing')
        expect(unlockHref('en')).toBe('/en/pricing')
    })
})
