import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'

import MiniPlayer from '@/components/MiniPlayer'
import EpisodeAudioPlayer from '@/components/EpisodeAudioPlayer'
import {
    AudioPlayerProvider,
    useAudioPlayer,
} from '@/lib/player/AudioPlayerContext'
import {mockHtmlMedia} from '@/lib/player/mockHtmlMedia'
import {TestLocale} from '@/lib/i18n/testWrapper'

const TRACK = {
    slug: 'demo-folge',
    title: 'Demo Folge',
    audioUrl: 'https://cdn.example.com/demo.mp3',
    coverImageUrl: null as string | null,
    href: '/de/episodes/demo-folge',
}

function Harness({showDetail}: {showDetail: boolean}): React.JSX.Element {
    return (
        <AudioPlayerProvider>
            {showDetail ? <EpisodeAudioPlayer track={TRACK} /> : null}
            <MiniPlayer />
            <ActiveSlug />
        </AudioPlayerProvider>
    )
}

function ActiveSlug(): React.JSX.Element {
    const {track} = useAudioPlayer()
    return <p data-testid="active-slug">{track?.slug ?? 'none'}</p>
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
})
