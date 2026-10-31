import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('next/navigation', () => ({
    usePathname: () => '/de/episodes/sichere-folge',
}))

import type {PublicEpisode} from '@directwerk/api/types'

import {AudioPlayerProvider} from '@/lib/player/AudioPlayerContext'
import {mockHtmlMedia} from '@/lib/player/mockHtmlMedia'
import {TestLocale} from '@/lib/i18n/testWrapper'

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
        coverImageUrl: null,
        formats: [],
        categories: [],
    }
}

function renderDetail(
    ui: React.ReactElement,
): ReturnType<typeof render> {
    return render(
        <TestLocale>
            <AudioPlayerProvider>{ui}</AudioPlayerProvider>
        </TestLocale>,
    )
}

afterEach(cleanup)

describe('EpisodeDetailClient content rendering', () => {
    it('renders the dedicated empty-slug message', async () => {
        renderDetail(<EpisodeDetailClient slug="" />)

        await waitFor(() =>
            expect(screen.getByText('Folge nicht gefunden.')).toBeInTheDocument(),
        )
        expect(screen.queryByText('Folge nicht verfügbar')).not.toBeInTheDocument()
    })

    it('sanitizes stored episode HTML before injecting it into the DOM', () => {
        const {container} = renderDetail(
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

    it('reports an episode-play event when playback starts', async () => {
        const track = vi.fn()
        ;(window as unknown as {umami: unknown}).umami = {track}
        const media = mockHtmlMedia()
        try {
            renderDetail(
                <EpisodeDetailClient
                    slug="sichere-folge"
                    initialPublicEpisode={{
                        ...buildEpisode('<p>Hallo</p>'),
                        audioCdnUrl: 'https://cdn.example.com/folge.mp3',
                    }}
                />,
            )

            fireEvent.click(screen.getByRole('button', {name: 'Abspielen'}))

            await waitFor(() =>
                expect(track).toHaveBeenCalledWith('episode-play', {
                    url: '/episodes/sichere-folge',
                    slug: 'sichere-folge',
                    episodeSlug: 'sichere-folge',
                    episodeId: '7',
                    seriesSlug: 'sichere-serie',
                    title: 'Sichere Folge',
                    episodeTitle: 'Sichere Folge',
                    source: 'web-player',
                }),
            )

            // Pause/resume must not fire a second episode-play for the same load.
            fireEvent.click(screen.getAllByRole('button', {name: 'Pause'})[0]!)
            await waitFor(() =>
                expect(
                    screen.getAllByRole('button', {name: 'Abspielen'}).length,
                ).toBeGreaterThan(0),
            )
            fireEvent.click(screen.getAllByRole('button', {name: 'Abspielen'})[0]!)
            await waitFor(() =>
                expect(
                    screen.getAllByRole('button', {name: 'Pause'}).length,
                ).toBeGreaterThan(0),
            )
            expect(track).toHaveBeenCalledTimes(1)
        } finally {
            media.restore()
            Reflect.deleteProperty(
                window as unknown as Record<string, unknown>,
                'umami',
            )
        }
    })

    it('plays fine without a tracker (adblocker / analytics off)', async () => {
        const media = mockHtmlMedia()
        try {
            renderDetail(
                <EpisodeDetailClient
                    slug="sichere-folge"
                    initialPublicEpisode={{
                        ...buildEpisode('<p>Hallo</p>'),
                        audioCdnUrl: 'https://cdn.example.com/folge.mp3',
                    }}
                />,
            )

            expect(() =>
                fireEvent.click(screen.getByRole('button', {name: 'Abspielen'})),
            ).not.toThrow()
            await waitFor(() =>
                expect(
                    screen.getAllByRole('button', {name: 'Pause'}).length,
                ).toBeGreaterThan(0),
            )
        } finally {
            media.restore()
        }
    })

    it('preserves returnTo on locked-description sign-in link', () => {
        renderDetail(
            <EpisodeDetailClient
                slug="sichere-folge"
                initialPublicEpisode={{
                    ...buildEpisode('<p>Teaser</p>'),
                    accessPolicy: 'PAID',
                    audioCdnUrl: null,
                }}
            />,
        )

        expect(screen.getByRole('link', {name: 'anmelden'})).toHaveAttribute(
            'href',
            '/de/login?returnTo=%2Fde%2Fepisodes%2Fsichere-folge',
        )
    })
})
