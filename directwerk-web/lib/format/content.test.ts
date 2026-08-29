import {describe, expect, it} from 'vitest'

import {
    accessPolicyLabel,
    assetTypeLabel,
    formatDuration,
    formatFileSize,
} from '@/lib/format/content'

describe('content format helpers', () => {
    it('labels access policies in German', () => {
        expect(accessPolicyLabel('FREE')).toBe('Frei')
        expect(accessPolicyLabel('PAID')).toBe('Bezahlt')
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
