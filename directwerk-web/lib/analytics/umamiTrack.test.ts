import {afterEach, describe, expect, it, vi} from 'vitest'

import {EPISODE_PLAY_EVENT, trackEpisodePlay} from './umamiTrack'

afterEach(() => {
    Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'umami')
    vi.unstubAllGlobals()
})

describe('trackEpisodePlay', () => {
    it('returns false without a tracker and never throws', () => {
        expect(trackEpisodePlay('folge-1')).toBe(false)
    })

    it('returns false for an empty slug even with a tracker', () => {
        const track = vi.fn()
        ;(window as unknown as {umami: unknown}).umami = {track}
        expect(trackEpisodePlay('')).toBe(false)
        expect(track).not.toHaveBeenCalled()
    })

    it('reports the episode-play event with slug and url', () => {
        const track = vi.fn()
        ;(window as unknown as {umami: unknown}).umami = {track}
        expect(trackEpisodePlay('folge-1')).toBe(true)
        expect(track).toHaveBeenCalledWith(EPISODE_PLAY_EVENT, {
            url: '/episodes/folge-1',
            episodeSlug: 'folge-1',
        })
    })

    it('returns false when the tracker throws', () => {
        ;(window as unknown as {umami: unknown}).umami = {
            track: () => {
                throw new Error('blocked')
            },
        }
        expect(trackEpisodePlay('folge-1')).toBe(false)
    })

    it('returns false when window.umami has no track function', () => {
        ;(window as unknown as {umami: unknown}).umami = {}
        expect(trackEpisodePlay('folge-1')).toBe(false)
    })
})
