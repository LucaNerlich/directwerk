import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import MediaAudioPreview, {
    requestMediaPreviewUrl,
    resetMediaPreviewFetchQueueForTests,
} from '@/components/media/MediaAudioPreview'
import {getMediaPreviewUrl} from '@/lib/api/mediaApi'

vi.mock('@/lib/api/mediaApi', () => ({
    getMediaPreviewUrl: vi.fn(),
}))

describe('MediaAudioPreview', () => {
    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    beforeEach(() => {
        resetMediaPreviewFetchQueueForTests()
        vi.mocked(getMediaPreviewUrl).mockReset()
        vi.mocked(getMediaPreviewUrl).mockResolvedValue('https://cdn.example/signed.mp3')
    })

    it('plays public CDN audio immediately', () => {
        const {container} = render(
            <MediaAudioPreview
                assetId={1}
                cdnUrl="https://cdn.example/track.mp3"
                status="READY"
            />,
        )

        const audio = container.querySelector('audio')
        expect(audio).not.toBeNull()
        expect(audio).toHaveAttribute('src', 'https://cdn.example/track.mp3')
        expect(audio).toHaveAttribute('preload', 'metadata')
        expect(getMediaPreviewUrl).not.toHaveBeenCalled()
    })

    it('fetches a preview URL when the user loads a private READY asset', async () => {
        const onPreviewUrl = vi.fn()
        const {container} = render(
            <MediaAudioPreview
                assetId={9}
                cdnUrl={null}
                onPreviewUrl={onPreviewUrl}
                status="READY"
            />,
        )

        expect(container.querySelector('audio')).toBeNull()
        fireEvent.click(screen.getByRole('button', {name: 'Vorschau laden'}))

        await waitFor(() => {
            expect(container.querySelector('audio')).toHaveAttribute(
                'src',
                'https://cdn.example/signed.mp3',
            )
        })
        expect(getMediaPreviewUrl).toHaveBeenCalledWith(9)
        expect(onPreviewUrl).toHaveBeenCalledWith(9, 'https://cdn.example/signed.mp3')
    })

    it('does not fetch preview URLs for non-READY private audio', () => {
        render(
            <MediaAudioPreview assetId={3} cdnUrl={null} status="PENDING" />,
        )

        expect(screen.getByText('Audio noch nicht bereit.')).toBeInTheDocument()
        expect(screen.queryByRole('button', {name: 'Vorschau laden'})).not.toBeInTheDocument()
        expect(getMediaPreviewUrl).not.toHaveBeenCalled()
    })

    it('pools concurrent private preview fetches', async () => {
        const resolvers: Array<(url: string) => void> = []
        vi.mocked(getMediaPreviewUrl).mockImplementation(
            () =>
                new Promise<string>((resolve) => {
                    resolvers.push(resolve)
                }),
        )

        const first = requestMediaPreviewUrl(101)
        const second = requestMediaPreviewUrl(102)
        const duplicate = requestMediaPreviewUrl(101)
        const third = requestMediaPreviewUrl(103)
        const fourth = requestMediaPreviewUrl(104)
        const fifth = requestMediaPreviewUrl(105)

        await waitFor(() => expect(getMediaPreviewUrl).toHaveBeenCalledTimes(4))
        expect(getMediaPreviewUrl).toHaveBeenCalledWith(101)
        expect(getMediaPreviewUrl).toHaveBeenCalledWith(102)
        expect(getMediaPreviewUrl).toHaveBeenCalledWith(103)
        expect(getMediaPreviewUrl).toHaveBeenCalledWith(104)
        expect(getMediaPreviewUrl).not.toHaveBeenCalledWith(105)

        resolvers[0]?.('https://cdn.example/a.mp3')
        await expect(first).resolves.toBe('https://cdn.example/a.mp3')
        await expect(duplicate).resolves.toBe('https://cdn.example/a.mp3')

        await waitFor(() => expect(getMediaPreviewUrl).toHaveBeenCalledWith(105))
        resolvers[1]?.('https://cdn.example/b.mp3')
        resolvers[2]?.('https://cdn.example/c.mp3')
        resolvers[3]?.('https://cdn.example/d.mp3')
        resolvers[4]?.('https://cdn.example/e.mp3')

        await expect(second).resolves.toBe('https://cdn.example/b.mp3')
        await expect(third).resolves.toBe('https://cdn.example/c.mp3')
        await expect(fourth).resolves.toBe('https://cdn.example/d.mp3')
        await expect(fifth).resolves.toBe('https://cdn.example/e.mp3')
    })

    it('fetches when an intersecting observer reports the card is visible', async () => {
        type ObserverCallback = IntersectionObserverCallback
        let observerCallback: ObserverCallback | null = null
        vi.stubGlobal(
            'IntersectionObserver',
            class {
                constructor(callback: ObserverCallback) {
                    observerCallback = callback
                }
                observe(): void {
                    observerCallback?.(
                        [{isIntersecting: true} as IntersectionObserverEntry],
                        this as unknown as IntersectionObserver,
                    )
                }
                disconnect(): void {}
                unobserve(): void {}
                takeRecords(): IntersectionObserverEntry[] {
                    return []
                }
                root = null
                rootMargin = ''
                thresholds = []
            },
        )

        const {container} = render(
            <MediaAudioPreview assetId={44} cdnUrl={null} status="READY" />,
        )

        await waitFor(() => {
            expect(container.querySelector('audio')).toHaveAttribute(
                'src',
                'https://cdn.example/signed.mp3',
            )
        })
        expect(getMediaPreviewUrl).toHaveBeenCalledWith(44)
    })
})
