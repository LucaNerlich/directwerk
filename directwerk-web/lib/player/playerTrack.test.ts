import {describe, expect, it} from 'vitest'

import {playerTrackFromEpisode} from './playerTrack'

describe('playerTrackFromEpisode', () => {
    it('returns null without a CDN URL', () => {
        expect(
            playerTrackFromEpisode(
                {
                    id: 1,
                    slug: 'x',
                    title: 'X',
                    episodeNumber: null,
                    audioCdnUrl: null,
                    coverImageUrl: null,
                    seriesSlug: 's',
                },
                '/de/episodes/x',
            ),
        ).toBeNull()
    })

    it('maps catalog identity onto the player track', () => {
        expect(
            playerTrackFromEpisode(
                {
                    id: 9,
                    slug: 'folge',
                    title: 'Titel',
                    episodeNumber: 3,
                    audioCdnUrl: 'https://cdn.example.com/a.mp3',
                    coverImageUrl: 'https://cdn.example.com/c.jpg',
                    seriesSlug: 'show',
                },
                '/en/episodes/folge',
            ),
        ).toEqual({
            id: 9,
            slug: 'folge',
            title: '#3 Titel',
            episodeTitle: 'Titel',
            audioUrl: 'https://cdn.example.com/a.mp3',
            coverImageUrl: 'https://cdn.example.com/c.jpg',
            href: '/en/episodes/folge',
            seriesSlug: 'show',
        })
    })
})
