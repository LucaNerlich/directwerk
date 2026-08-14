import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import MediaLibraryClient from '@/components/media/MediaLibraryClient'
import {listMedia} from '@/lib/api/tenantApi'
import {uploadMediaFile} from '@/lib/media/upload'

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/tenantApi', () => ({
    listMedia: vi.fn().mockResolvedValue([]),
    deleteMedia: vi.fn(),
}))
vi.mock('@/lib/media/upload', () => ({
    uploadMediaFile: vi.fn().mockResolvedValue({id: 8}),
}))

const coverAsset = {
    id: 7,
    status: 'READY',
    assetType: 'IMAGE',
    mimeType: 'image/png',
    originalFilename: 'cover.png',
    sizeBytes: 2048,
    visibility: 'PRIVATE',
    cdnUrl: 'https://cdn.example/cover.png',
}

describe('MediaLibraryClient', () => {
    afterEach(() => {
        cleanup()
    })

    beforeEach(() => {
        vi.mocked(listMedia).mockReset()
        vi.mocked(listMedia).mockResolvedValue([])
        vi.mocked(uploadMediaFile).mockReset()
        vi.mocked(uploadMediaFile).mockResolvedValue({
            id: 8,
            status: 'READY',
            assetType: 'AUDIO',
            mimeType: 'audio/mpeg',
            originalFilename: 'folge.mp3',
            sizeBytes: 1024,
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
                {assetType: 'AUDIO', visibility: 'PRIVATE'},
            ),
        )
        await waitFor(() =>
            expect(screen.getByRole('status')).toHaveTextContent('Hochgeladen: folge.mp3'),
        )
    })
})
