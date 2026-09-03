import {describe, expect, it} from 'vitest'

import {
    accessPolicyLabel,
    assetTypeLabel,
    entitlementLabel,
    entitlementState,
    formatDuration,
    formatFileSize,
} from '@/lib/format/content'

describe('content format helpers', () => {
    it('labels access policies in German', () => {
        expect(accessPolicyLabel('FREE')).toBe('Frei')
        expect(accessPolicyLabel('PAID')).toBe('Bezahlt')
    })

    it('derives entitlement states from policy and access', () => {
        expect(entitlementState('FREE', false)).toBe('free')
        expect(entitlementState('FREE', true)).toBe('free')
        expect(entitlementState('PAID', true)).toBe('included')
        expect(entitlementState('PAID', false)).toBe('locked')
    })

    it('labels entitlements instead of bare policy names', () => {
        expect(entitlementLabel('FREE')).toBe('Frei')
        expect(entitlementLabel('PAID', true)).toBe('Enthalten')
        expect(entitlementLabel('PAID', false)).toBe('Mitgliedschaft nötig')
        expect(entitlementLabel('PAID')).toBe('Mitgliedschaft nötig')
    })

    it('formats durations', () => {
        expect(formatDuration(null)).toBeNull()
        expect(formatDuration(95)).toBe('1:35')
        expect(formatDuration(3661)).toBe('1:01:01')
    })

    it('formats file sizes', () => {
        expect(formatFileSize(512)).toBe('512 B')
        expect(formatFileSize(2048)).toBe('2 KB')
        expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
    })

    it('labels asset types', () => {
        expect(assetTypeLabel('PDF')).toBe('PDF')
        expect(assetTypeLabel('image')).toBe('Bild')
    })
})
