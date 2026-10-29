import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'

import MiniPlayer from '@/components/MiniPlayer'
import EpisodeAudioPlayer from '@/components/EpisodeAudioPlayer'
import {
    AudioPlayerProvider,
    useAudioPlayer,
    type PlayerTrack,
} from '@/lib/player/AudioPlayerContext'
import {mockHtmlMedia} from '@/lib/player/mockHtmlMedia'
import {TestLocale} from '@/lib/i18n/testWrapper'

const TRACK: PlayerTrack = {
    id: 11,
    slug: 'demo-folge',
    title: 'Demo Folge',
    episodeTitle: 'Demo Folge',
    audioUrl: 'https://cdn.example.com/demo.mp3',
    coverImageUrl: null,
    href: '/de/episodes/demo-folge',
    seriesSlug: 'demo-serie',
}

function Harness({
    showDetail,
    track = TRACK,
}: {
    showDetail: boolean
    track?: PlayerTrack
}): React.JSX.Element {
    return (
        <AudioPlayerProvider>
            {showDetail ? <EpisodeAudioPlayer track={track} /> : null}
            <MiniPlayer />
            <ActiveSlug />
            <ActiveUrl />
            <PlayingFlag />
        </AudioPlayerProvider>
    )
}

function ActiveSlug(): React.JSX.Element {
    const {track} = useAudioPlayer()
    return <p data-testid="active-slug">{track?.slug ?? 'none'}</p>
}

function ActiveUrl(): React.JSX.Element {
    const {track} = useAudioPlayer()
    return <p data-testid="active-url">{track?.audioUrl ?? 'none'}</p>
}

function PlayingFlag(): React.JSX.Element {
    const {isPlaying} = useAudioPlayer()
    return <p data-testid="is-playing">{isPlaying ? 'yes' : 'no'}</p>
}

afterEach(cleanup)

describe('MiniPlayer', () => {
    it('stays hidden until playback starts, then shows title and dismiss', async () => {
        const media = mockHtmlMedia()
        try {
            render(
                <TestLocale>
                    <Harness showDetail />
                </TestLocale>,
            )

            expect(screen.queryByRole('region', {name: 'Mini-Player'})).toBeNull()

            fireEvent.click(screen.getByRole('button', {name: 'Abspielen'}))

            await waitFor(() =>
                expect(
                    screen.getByRole('region', {name: 'Mini-Player'}),
                ).toBeInTheDocument(),
            )
            expect(
                screen.getByRole('link', {name: 'Demo Folge'}),
            ).toHaveAttribute('href', '/de/episodes/demo-folge')

            fireEvent.click(screen.getByRole('button', {name: 'Player schließen'}))

            await waitFor(() =>
                expect(screen.queryByRole('region', {name: 'Mini-Player'})).toBeNull(),
            )
        } finally {
            media.restore()
        }
    })

    it('keeps the active track after the detail player unmounts (route change)', async () => {
        const media = mockHtmlMedia()
        try {
            const {rerender} = render(
                <TestLocale>
                    <Harness showDetail />
                </TestLocale>,
            )

            fireEvent.click(screen.getByRole('button', {name: 'Abspielen'}))
            await waitFor(() =>
                expect(screen.getByTestId('active-slug')).toHaveTextContent(
                    'demo-folge',
                ),
            )

            // Drop the detail player (simulates leaving /episodes/[slug]) while
            // keeping the layout-level provider mounted.
            rerender(
                <TestLocale>
                    <Harness showDetail={false} />
                </TestLocale>,
            )

            expect(screen.getByTestId('active-slug')).toHaveTextContent('demo-folge')
            expect(
                screen.getByRole('region', {name: 'Mini-Player'}),
            ).toBeInTheDocument()
        } finally {
            media.restore()
        }
    })

    it('reloads audio.src when the same slug returns a rotated entitled URL', async () => {
        const media = mockHtmlMedia()
        try {
            const rotated: PlayerTrack = {
                ...TRACK,
                audioUrl: 'https://cdn.example.com/demo.mp3?sig=rotated',
            }
            const {rerender} = render(
                <TestLocale>
                    <Harness showDetail />
                </TestLocale>,
            )

            fireEvent.click(screen.getByRole('button', {name: 'Abspielen'}))
            await waitFor(() =>
                expect(screen.getByTestId('active-url')).toHaveTextContent(
                    TRACK.audioUrl,
                ),
            )

            fireEvent.click(screen.getAllByRole('button', {name: 'Pause'})[0]!)
            await waitFor(() =>
                expect(screen.getByTestId('is-playing')).toHaveTextContent('no'),
            )

            rerender(
                <TestLocale>
                    <Harness showDetail track={rotated} />
                </TestLocale>,
            )

            fireEvent.click(screen.getAllByRole('button', {name: 'Abspielen'})[0]!)
            await waitFor(() =>
                expect(screen.getByTestId('active-url')).toHaveTextContent(
                    rotated.audioUrl,
                ),
            )
            expect(media.play).toHaveBeenCalled()
        } finally {
            media.restore()
        }
    })

    it('keeps isPlaying true when a superseded play() rejects after a later play starts', async () => {
        const media = mockHtmlMedia()
        try {
            const firstPlay = {
                reject: null as ((err: Error) => void) | null,
            }
            let playCalls = 0
            media.play.mockImplementation(function (this: HTMLMediaElement) {
                playCalls += 1
                if (playCalls === 1) {
                    return new Promise<void>((_resolve, reject) => {
                        firstPlay.reject = reject
                    })
                }
                Object.defineProperty(this, 'paused', {
                    configurable: true,
                    get: () => false,
                })
                this.dispatchEvent(new Event('play'))
                return Promise.resolve()
            })

            const second: PlayerTrack = {
                ...TRACK,
                slug: 'andere-folge',
                title: 'Andere Folge',
                audioUrl: 'https://cdn.example.com/andere.mp3',
                href: '/de/episodes/andere-folge',
            }

            function DualHarness(): React.JSX.Element {
                return (
                    <AudioPlayerProvider>
                        <EpisodeAudioPlayer track={TRACK} />
                        <EpisodeAudioPlayer track={second} />
                        <PlayingFlag />
                    </AudioPlayerProvider>
                )
            }

            render(
                <TestLocale>
                    <DualHarness />
                </TestLocale>,
            )

            const playButtons = screen.getAllByRole('button', {name: 'Abspielen'})
            fireEvent.click(playButtons[0]!)
            fireEvent.click(playButtons[1]!)

            await waitFor(() =>
                expect(screen.getByTestId('is-playing')).toHaveTextContent('yes'),
            )

            firstPlay.reject?.(
                Object.assign(new Error('aborted'), {name: 'AbortError'}),
            )
            await waitFor(() => expect(playCalls).toBe(2))
            // Superseded rejection must not clear playing while audio is live.
            expect(screen.getByTestId('is-playing')).toHaveTextContent('yes')
        } finally {
            media.restore()
        }
    })
})
