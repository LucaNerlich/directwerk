import {afterEach, describe, expect, it, vi} from 'vitest'

import {
    EPISODE_PLAY_EVENT,
    EPISODE_PLAY_SOURCE,
    trackEpisodePlay,
} from './umamiTrack'

afterEach(() => {
    Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'umami')
    vi.unstubAllGlobals()
})

describe('trackEpisodePlay', () => {
    it('returns false without a tracker and never throws', () => {
        expect(trackEpisodePlay({slug: 'folge-1'})).toBe(false)
    })

    it('returns false for an empty slug even with a tracker', () => {
        const track = vi.fn()
        ;(window as unknown as {umami: unknown}).umami = {track}
        expect(trackEpisodePlay({slug: ''})).toBe(false)
        expect(track).not.toHaveBeenCalled()
    })

    it('reports episode-play with download-aligned identity props', () => {
        const track = vi.fn()
        ;(window as unknown as {umami: unknown}).umami = {track}
        expect(
            trackEpisodePlay({
                slug: 'folge-1',
                episodeId: 42,
                seriesSlug: 'main-show',
                title: 'Folge 1',
            }),
        ).toBe(true)
        expect(track).toHaveBeenCalledWith(EPISODE_PLAY_EVENT, {
            url: '/episodes/folge-1',
            slug: 'folge-1',
            episodeSlug: 'folge-1',
            episodeId: '42',
            seriesSlug: 'main-show',
            title: 'Folge 1',
            episodeTitle: 'Folge 1',
            source: EPISODE_PLAY_SOURCE,
        })
    })

    it('omits optional identity fields when absent', () => {
        const track = vi.fn()
        ;(window as unknown as {umami: unknown}).umami = {track}
        expect(trackEpisodePlay({slug: 'folge-1'})).toBe(true)
        expect(track).toHaveBeenCalledWith(EPISODE_PLAY_EVENT, {
            url: '/episodes/folge-1',
            slug: 'folge-1',
            episodeSlug: 'folge-1',
            source: EPISODE_PLAY_SOURCE,
        })
    })

    it('returns false when the tracker throws', () => {
        ;(window as unknown as {umami: unknown}).umami = {
            track: () => {
                throw new Error('blocked')
            },
        }
        expect(trackEpisodePlay({slug: 'folge-1'})).toBe(false)
    })

    it('returns true when the tracker promise rejects', async () => {
        const track = vi.fn().mockRejectedValue(new Error('blocked'))
        ;(window as unknown as {umami: unknown}).umami = {track}

        expect(trackEpisodePlay({slug: 'folge-1'})).toBe(true)
        await Promise.resolve()
        expect(track).toHaveBeenCalledOnce()
    })

    it('returns false when window.umami has no track function', () => {
        ;(window as unknown as {umami: unknown}).umami = {}
        expect(trackEpisodePlay({slug: 'folge-1'})).toBe(false)
    })
})
