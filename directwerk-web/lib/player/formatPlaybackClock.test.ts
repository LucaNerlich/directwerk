import {describe, expect, it} from 'vitest'

import {formatPlaybackClock} from './formatPlaybackClock'

describe('formatPlaybackClock', () => {
    it('shows zero as 0:00', () => {
        expect(formatPlaybackClock(0)).toBe('0:00')
    })

    it('formats minutes and seconds', () => {
        expect(formatPlaybackClock(65)).toBe('1:05')
    })

    it('formats hours', () => {
        expect(formatPlaybackClock(3661)).toBe('1:01:01')
    })

    it('guards non-finite input', () => {
        expect(formatPlaybackClock(Number.NaN)).toBe('0:00')
        expect(formatPlaybackClock(-3)).toBe('0:00')
    })
})
