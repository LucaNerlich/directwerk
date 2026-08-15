import {describe, expect, it} from 'vitest'

import {exceedsMediaLimit, mediaLimitLabel, MEDIA_TYPE_LIMITS} from '@/lib/media/limits'

describe('media limits', () => {
    it('mirrors the Directwerk per-type upload limits', () => {
        expect(MEDIA_TYPE_LIMITS.AUDIO.maxBytes).toBe(500 * 1024 * 1024)
        expect(MEDIA_TYPE_LIMITS.IMAGE.maxBytes).toBe(10 * 1024 * 1024)
        expect(MEDIA_TYPE_LIMITS.VIDEO.maxBytes).toBe(1024 * 1024 * 1024)
        expect(MEDIA_TYPE_LIMITS.DOCUMENT.maxBytes).toBe(50 * 1024 * 1024)
    })

    it('formats labels and checks the limit', () => {
        expect(mediaLimitLabel('AUDIO')).toBe('500 MB')
        expect(mediaLimitLabel('VIDEO')).toBe('1 GB')
        expect(exceedsMediaLimit('IMAGE', 10 * 1024 * 1024)).toBe(false)
        expect(exceedsMediaLimit('IMAGE', 10 * 1024 * 1024 + 1)).toBe(true)
    })
})
