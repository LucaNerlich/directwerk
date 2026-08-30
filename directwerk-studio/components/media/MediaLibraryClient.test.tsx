import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import MediaLibraryClient from '@/components/media/MediaLibraryClient'
import {deleteMedia, listMedia} from '@/lib/api/mediaApi'
import {uploadMediaFile} from '@/lib/media/upload'
import type {MediaAsset} from '@directwerk/api/types'

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/mediaApi', () => ({
    listMedia: vi.fn().mockResolvedValue([]),
    deleteMedia: vi.fn(),
}))
vi.mock('@/lib/media/upload', () => ({
    uploadMediaFile: vi.fn().mockResolvedValue({id: 8}),
}))

const coverAsset = {
    id: 7,
    s3Key: 'tenant/staging/cover.png',
    visibility: 'PUBLIC',
    scope: '',
    status: 'READY',
    assetType: 'IMAGE',
    mimeType: 'image/png',
    originalFilename: 'cover.png',
    sizeBytes: 2048,
    episodeId: null,
    ownerUserId: 1,
    cdnUrl: 'https://cdn.example/cover.png',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
}

describe('MediaLibraryClient', () => {
    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    beforeEach(() => {
        vi.mocked(listMedia).mockReset()
        vi.mocked(listMedia).mockResolvedValue([])
        vi.mocked(deleteMedia).mockReset()
        vi.mocked(deleteMedia).mockResolvedValue(coverAsset)
        vi.mocked(uploadMediaFile).mockReset()
        vi.mocked(uploadMediaFile).mockResolvedValue({
            ...coverAsset,
            id: 8,
            assetType: 'AUDIO',
            mimeType: 'audio/mpeg',
            originalFilename: 'folge.mp3',
            sizeBytes: 1024,
            cdnUrl: null,
        })
    })

    it('shows an empty state with upload action', async () => {
        render(<MediaLibraryClient />)

        await waitFor(() =>
            expect(screen.getByText('Noch keine Medien')).toBeInTheDocument(),
        )
        expect(screen.getAllByRole('button', {name: 'Datei hochladen'}).length).toBeGreaterThan(0)
    })

    it('renders a media grid and uploads a dropped file', async () => {
        vi.mocked(listMedia).mockResolvedValue([coverAsset])

        render(<MediaLibraryClient />)

        await waitFor(() =>
            expect(screen.getByRole('img', {name: 'cover.png'})).toHaveAttribute(
                'src',
                'https://cdn.example/cover.png',
            ),
        )

        const dropzone = screen.getByText('Datei hierher ziehen').parentElement
        expect(dropzone).not.toBeNull()
        const file = new File(['audio'], 'folge.mp3', {type: 'audio/mpeg'})
        fireEvent.drop(dropzone as HTMLElement, {
            dataTransfer: {files: [file]},
        })

        await waitFor(() =>
            expect(uploadMediaFile).toHaveBeenCalledWith(
                'tenant.test',
                file,
                expect.objectContaining({assetType: 'AUDIO', visibility: 'PRIVATE'}),
            ),
        )
        await waitFor(() =>
            expect(screen.getByRole('status')).toHaveTextContent('Hochgeladen: folge.mp3'),
        )
    })

    it('shows an upload progress bar that reaches 100 %', async () => {
        vi.mocked(listMedia).mockResolvedValue([])

        let onProgress: ((percent: number) => void) | undefined
        let resolveUpload: ((asset: MediaAsset) => void) | undefined
        vi.mocked(uploadMediaFile).mockImplementation(
            (_host, _file, options) => {
                onProgress = options?.onProgress
                onProgress?.(0)
                onProgress?.(50)
                return new Promise<MediaAsset>((resolve) => {
                    resolveUpload = resolve
                })
            },
        )

        render(<MediaLibraryClient />)

        await waitFor(() =>
            expect(screen.getByText('Noch keine Medien')).toBeInTheDocument(),
        )

        const dropzone = screen.getByText('Datei hierher ziehen').parentElement
        expect(dropzone).not.toBeNull()
        const file = new File(['audio'], 'folge.mp3', {type: 'audio/mpeg'})
        fireEvent.drop(dropzone as HTMLElement, {
            dataTransfer: {files: [file]},
        })

        const progressbar = await screen.findByRole('progressbar')
        expect(progressbar).toHaveAttribute('aria-valuenow', '50')

        onProgress?.(100)
        await waitFor(() =>
            expect(progressbar).toHaveAttribute('aria-valuenow', '100'),
        )

        resolveUpload?.({
            ...coverAsset,
            id: 8,
            assetType: 'AUDIO',
            mimeType: 'audio/mpeg',
            originalFilename: 'folge.mp3',
            sizeBytes: 1024,
            cdnUrl: null,
        })

        await waitFor(() =>
            expect(screen.getByRole('status')).toHaveTextContent('Hochgeladen: folge.mp3'),
        )
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('keeps pending assets whose bulk deletion fails and reports their IDs', async () => {
        const pendingAssets = [
            {
                ...coverAsset,
                id: 8,
                status: 'PENDING' as const,
                assetType: 'AUDIO' as const,
                originalFilename: 'pending-8.mp3',
            },
            {
                ...coverAsset,
                id: 9,
                status: 'PENDING' as const,
                assetType: 'AUDIO' as const,
                originalFilename: 'pending-9.mp3',
            },
        ]
        vi.mocked(listMedia).mockResolvedValue(pendingAssets)
        vi.mocked(deleteMedia)
            .mockResolvedValueOnce(pendingAssets[0])
            .mockRejectedValueOnce(new Error('delete failed'))
        vi.spyOn(window, 'confirm').mockReturnValue(true)

        render(<MediaLibraryClient />)

        fireEvent.click(
            await screen.findByRole('button', {name: 'Alle ausstehenden entfernen'}),
        )

        await waitFor(() =>
            expect(screen.queryByText('pending-8.mp3')).not.toBeInTheDocument(),
        )
        expect(screen.getByText('pending-9.mp3')).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Löschen fehlgeschlagen für Medien-IDs: 9.',
        )
        expect(screen.getByRole('status')).toHaveTextContent(
            '1 ausstehende Upload(s) entfernt.',
        )
    })

    it('applies the same partial-failure handling to selected assets', async () => {
        const selectedAssets = [
            coverAsset,
            {
                ...coverAsset,
                id: 9,
                originalFilename: 'other.png',
            },
        ]
        vi.mocked(listMedia).mockResolvedValue(selectedAssets)
        vi.mocked(deleteMedia)
            .mockResolvedValueOnce(selectedAssets[0])
            .mockRejectedValueOnce(new Error('delete failed'))
        vi.spyOn(window, 'confirm').mockReturnValue(true)

        render(<MediaLibraryClient />)

        fireEvent.click(await screen.findByRole('checkbox', {name: '„cover.png“ auswählen'}))
        fireEvent.click(screen.getByRole('checkbox', {name: '„other.png“ auswählen'}))
        fireEvent.click(screen.getByRole('button', {name: '2 löschen'}))

        await waitFor(() =>
            expect(screen.queryByText('cover.png')).not.toBeInTheDocument(),
        )
        expect(screen.getByText('other.png')).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Löschen fehlgeschlagen für Medien-IDs: 9.',
        )
        expect(
            screen.getByRole('checkbox', {name: '„other.png“ auswählen'}),
        ).not.toBeChecked()
    })
})
