import {describe, expect, it} from 'vitest'

import {
    exceedsMediaLimit,
    exceedsMediaLimitFor,
    formatLimitLabel,
    mediaLimitLabel,
    mediaLimitLabelFor,
    resolveMediaLimits,
    MEDIA_TYPE_LIMITS,
} from '@/lib/media/limits'

describe('media limits', () => {
    it('mirrors the Directwerk per-type upload limits', () => {
        expect(MEDIA_TYPE_LIMITS.AUDIO.maxBytes).toBe(5 * 1024 * 1024 * 1024)
        expect(MEDIA_TYPE_LIMITS.IMAGE.maxBytes).toBe(10 * 1024 * 1024)
        expect(MEDIA_TYPE_LIMITS.VIDEO.maxBytes).toBe(5 * 1024 * 1024 * 1024)
        expect(MEDIA_TYPE_LIMITS.DOCUMENT.maxBytes).toBe(50 * 1024 * 1024)
    })

    it('formats labels and checks the limit', () => {
        expect(mediaLimitLabel('AUDIO')).toBe('5 GB')
        expect(mediaLimitLabel('VIDEO')).toBe('5 GB')
        expect(exceedsMediaLimit('IMAGE', 10 * 1024 * 1024)).toBe(false)
        expect(exceedsMediaLimit('IMAGE', 10 * 1024 * 1024 + 1)).toBe(true)
    })

    it('resolves tenant overrides into labels and checks', () => {
        const limits = resolveMediaLimits({
            maxAudioBytes: 100 * 1024 * 1024,
            maxImageBytes: 20 * 1024 * 1024,
            maxVideoBytes: 1024 * 1024 * 1024,
            maxDocumentBytes: 50 * 1024 * 1024,
        })

        expect(mediaLimitLabelFor(limits, 'AUDIO')).toBe('100 MB')
        expect(mediaLimitLabelFor(limits, 'VIDEO')).toBe('1 GB')
        expect(exceedsMediaLimitFor(limits, 'AUDIO', 100 * 1024 * 1024)).toBe(false)
        expect(exceedsMediaLimitFor(limits, 'AUDIO', 100 * 1024 * 1024 + 1)).toBe(true)
    })

    it('falls back to platform defaults without overrides', () => {
        expect(resolveMediaLimits(null)).toBe(MEDIA_TYPE_LIMITS)
    })

    it('formats whole gigabytes and megabytes', () => {
        expect(formatLimitLabel(5 * 1024 ** 3)).toBe('5 GB')
        expect(formatLimitLabel(500 * 1024 ** 2)).toBe('500 MB')
    })
})
