import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import type {PublicEpisode} from '@directwerk/api/types'

import EpisodeDetailClient from './episode-detail-client'

const MALICIOUS_DESCRIPTION =
    '<p>Hörbarer Text</p>' +
    '<script>alert("stored-xss")</script>' +
    '<p onclick="alert(1)">Klick mich</p>' +
    '<svg onload="alert(2)"><circle r="10" /></svg>'

function buildEpisode(description: string): PublicEpisode {
    return {
        id: 7,
        seriesId: 3,
        seriesSlug: 'sichere-serie',
        episodeNumber: 1,
        slug: 'sichere-folge',
        title: 'Sichere Folge',
        description,
        durationSeconds: null,
        accessPolicy: 'FREE',
        requiredLevelSortOrder: null,
        publishedAt: null,
        audioCdnUrl: null,
    }
}

describe('EpisodeDetailClient content rendering', () => {
    it('renders the dedicated empty-slug message', async () => {
        render(<EpisodeDetailClient slug="" />)

        await waitFor(() =>
            expect(screen.getByText('Folge nicht gefunden.')).toBeInTheDocument(),
        )
        expect(screen.queryByText('Folge nicht verfügbar')).not.toBeInTheDocument()
    })

    it('sanitizes stored episode HTML before injecting it into the DOM', () => {
        const {container} = render(
            <EpisodeDetailClient
                slug="sichere-folge"
                initialPublicEpisode={buildEpisode(MALICIOUS_DESCRIPTION)}
            />,
        )

        expect(container.querySelector('script')).toBeNull()
        expect(container.querySelector('svg')).toBeNull()
        expect(container.innerHTML).not.toContain('onclick')
        expect(container.innerHTML).not.toContain('onload')
        expect(container.textContent).toContain('Hörbarer Text')
    })

    it('reports an episode-play event when playback starts', () => {
        const track = vi.fn()
        ;(window as unknown as {umami: unknown}).umami = {track}
        try {
            render(
                <EpisodeDetailClient
                    slug="sichere-folge"
                    initialPublicEpisode={{
                        ...buildEpisode('<p>Hallo</p>'),
                        audioCdnUrl: 'https://cdn.example.com/folge.mp3',
                    }}
                />,
            )

            const audio = document.querySelector('audio')
            expect(audio).not.toBeNull()
            fireEvent.play(audio as HTMLAudioElement)

            expect(track).toHaveBeenCalledWith('episode-play', {
                url: '/episodes/sichere-folge',
                episodeSlug: 'sichere-folge',
            })
        } finally {
            Reflect.deleteProperty(
                window as unknown as Record<string, unknown>,
                'umami',
            )
        }
    })

    it('plays fine without a tracker (adblocker / analytics off)', () => {
        render(
            <EpisodeDetailClient
                slug="sichere-folge"
                initialPublicEpisode={{
                    ...buildEpisode('<p>Hallo</p>'),
                    audioCdnUrl: 'https://cdn.example.com/folge.mp3',
                }}
            />,
        )

        const audio = document.querySelector('audio')
        expect(audio).not.toBeNull()
        expect(() =>
            fireEvent.play(audio as HTMLAudioElement),
        ).not.toThrow()
    })
})
