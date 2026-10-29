import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import type {PublicEpisode} from '@directwerk/api/types'

import EpisodeListenButton from '@/components/EpisodeListenButton'
import MiniPlayer from '@/components/MiniPlayer'
import {AudioPlayerProvider} from '@/lib/player/AudioPlayerContext'
import {mockHtmlMedia} from '@/lib/player/mockHtmlMedia'
import {TestLocale} from '@/lib/i18n/testWrapper'

function buildEpisode(
    overrides: Partial<PublicEpisode> = {},
): PublicEpisode {
    return {
        id: 42,
        seriesId: 3,
        seriesSlug: 'main-show',
        episodeNumber: 1,
        slug: 'folge-1',
        title: 'Folge 1',
        description: null,
        durationSeconds: 120,
        accessPolicy: 'FREE',
        requiredLevelSortOrder: null,
        publishedAt: null,
        audioCdnUrl: 'https://cdn.example.com/folge-1.mp3',
        coverImageUrl: null,
        formats: [],
        categories: [],
        ...overrides,
    }
}

afterEach(cleanup)

describe('EpisodeListenButton', () => {
    it('starts playback and reports episode-play once', async () => {
        const track = vi.fn()
        ;(window as unknown as {umami: unknown}).umami = {track}
        const media = mockHtmlMedia()
        try {
            render(
                <TestLocale>
                    <AudioPlayerProvider>
                        <EpisodeListenButton episode={buildEpisode()} />
                        <MiniPlayer />
                    </AudioPlayerProvider>
                </TestLocale>,
            )

            fireEvent.click(screen.getByRole('button', {name: 'Abspielen'}))

            await waitFor(() =>
                expect(track).toHaveBeenCalledWith('episode-play', {
                    url: '/episodes/folge-1',
                    slug: 'folge-1',
                    episodeSlug: 'folge-1',
                    episodeId: '42',
                    seriesSlug: 'main-show',
                    title: 'Folge 1',
                    episodeTitle: 'Folge 1',
                    source: 'web-player',
                }),
            )
            expect(
                screen.getByRole('region', {name: 'Mini-Player'}),
            ).toBeInTheDocument()

            fireEvent.click(screen.getAllByRole('button', {name: 'Pause'})[0]!)
            await waitFor(() =>
                expect(
                    screen.getAllByRole('button', {name: 'Abspielen'}).length,
                ).toBeGreaterThan(0),
            )
            fireEvent.click(
                screen.getAllByRole('button', {name: 'Abspielen'})[0]!,
            )
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

    it('renders nothing without a playable audio URL', () => {
        render(
            <TestLocale>
                <AudioPlayerProvider>
                    <EpisodeListenButton
                        episode={buildEpisode({audioCdnUrl: null})}
                    />
                </AudioPlayerProvider>
            </TestLocale>,
        )
        expect(screen.queryByRole('button')).toBeNull()
    })

    it('pauses without a second episode-play when the entitled URL rotated', async () => {
        const track = vi.fn()
        ;(window as unknown as {umami: unknown}).umami = {track}
        const media = mockHtmlMedia()
        try {
            // Two surfaces (list vs detail) with independent fresh presigns.
            render(
                <TestLocale>
                    <AudioPlayerProvider>
                        <EpisodeListenButton
                            episode={buildEpisode({
                                audioCdnUrl:
                                    'https://cdn.example.com/folge-1-a.mp3',
                            })}
                        />
                        <EpisodeListenButton
                            episode={buildEpisode({
                                audioCdnUrl:
                                    'https://cdn.example.com/folge-1-b.mp3',
                            })}
                            variant="outline"
                        />
                        <MiniPlayer />
                    </AudioPlayerProvider>
                </TestLocale>,
            )

            const listenButtons = screen.getAllByRole('button', {
                name: 'Abspielen',
            })
            fireEvent.click(listenButtons[0]!)
            await waitFor(() => expect(track).toHaveBeenCalledTimes(1))

            const pauseButtons = screen.getAllByRole('button', {
                name: 'Pause',
            })
            // Click the other surface's Pause (different audioUrl, same slug).
            fireEvent.click(pauseButtons[pauseButtons.length - 1]!)
            await waitFor(() =>
                expect(
                    screen.getAllByRole('button', {name: 'Abspielen'}).length,
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
})
