import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import MediaLibraryClient from '@/components/media/MediaLibraryClient'
import {
    createMediaFolder,
    deleteMedia,
    deleteMediaFolder,
    listMedia,
    listMediaFolders,
    moveMediaAsset,
    moveMediaFolder,
    renameMediaFolder,
} from '@/lib/api/mediaApi'
import {uploadMediaFile} from '@/lib/media/upload'
import type {MediaAsset, MediaFolder} from '@directwerk/api/types'

const mockRouter = {replace: vi.fn()}
vi.mock('next/navigation', () => ({useRouter: () => mockRouter}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/mediaApi', () => ({
    listMedia: vi.fn().mockResolvedValue([]),
    deleteMedia: vi.fn(),
    listMediaFolders: vi.fn().mockResolvedValue([]),
    createMediaFolder: vi.fn(),
    renameMediaFolder: vi.fn(),
    moveMediaFolder: vi.fn(),
    deleteMediaFolder: vi.fn(),
    moveMediaAsset: vi.fn(),
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
    bytesTransferred: 0,
    episodeId: null,
    ownerUserId: 1,
    folderId: null,
    cdnUrl: 'https://cdn.example/cover.png',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
}

function testFolder(id: number, name: string, parentId: number | null): MediaFolder {
    return {
        id,
        name,
        parentId,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
    }
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
        vi.mocked(listMediaFolders).mockReset()
        vi.mocked(listMediaFolders).mockResolvedValue([])
        vi.mocked(createMediaFolder).mockReset()
        vi.mocked(renameMediaFolder).mockReset()
        vi.mocked(moveMediaFolder).mockReset()
        vi.mocked(deleteMediaFolder).mockReset()
        vi.mocked(moveMediaAsset).mockReset()
        vi.mocked(moveMediaAsset).mockImplementation(async (_host, assetId, folderId) => ({
            ...coverAsset,
            id: assetId,
            folderId,
        }))
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
        ).toBeChecked()
        expect(screen.getByRole('button', {name: '1 löschen'})).toBeInTheDocument()
    })

    it('offers a retry for a failed upload without reselecting the file', async () => {
        vi.mocked(listMedia).mockResolvedValue([])
        vi.mocked(uploadMediaFile)
            .mockRejectedValueOnce(new Error('Upload fehlgeschlagen.'))
            .mockResolvedValue({
                ...coverAsset,
                id: 8,
                assetType: 'AUDIO',
                mimeType: 'audio/mpeg',
                originalFilename: 'folge.mp3',
                sizeBytes: 1024,
                cdnUrl: null,
            })

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

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent('Upload fehlgeschlagen.'),
        )
        fireEvent.click(
            screen.getByRole('button', {name: 'Upload erneut versuchen'}),
        )

        await waitFor(() => expect(vi.mocked(uploadMediaFile)).toHaveBeenCalledTimes(2))
        await waitFor(() =>
            expect(screen.getByRole('status')).toHaveTextContent('Hochgeladen: folge.mp3'),
        )
    })

    it('retries loading the library after a load error', async () => {
        vi.mocked(listMedia)
            .mockRejectedValueOnce(new Error('Netzwerkfehler'))
            .mockResolvedValueOnce([])

        render(<MediaLibraryClient />)

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent('Netzwerkfehler'),
        )
        fireEvent.click(screen.getByRole('button', {name: 'Erneut versuchen'}))

        await waitFor(() =>
            expect(screen.getByText('Noch keine Medien')).toBeInTheDocument(),
        )
        expect(vi.mocked(listMedia)).toHaveBeenCalledTimes(2)
    })

    it('navigates into folders via tiles and back via breadcrumbs', async () => {
        vi.mocked(listMediaFolders).mockResolvedValue([
            testFolder(1, 'Interviews', null),
            testFolder(2, 'Cuts', 1),
        ])
        vi.mocked(listMedia).mockResolvedValue([
            coverAsset,
            {...coverAsset, id: 9, originalFilename: 'filed.png', folderId: 1},
        ])

        render(<MediaLibraryClient />)

        expect(await screen.findByText('Interviews')).toBeInTheDocument()
        expect(screen.getByText('cover.png')).toBeInTheDocument()
        expect(screen.queryByText('filed.png')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', {name: /Interviews/}))
        expect(await screen.findByText('filed.png')).toBeInTheDocument()
        expect(screen.queryByText('cover.png')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', {name: 'Bibliothek'}))
        expect(await screen.findByText('cover.png')).toBeInTheDocument()
        expect(screen.queryByText('filed.png')).not.toBeInTheDocument()
    })

    it('refetches assets with the active folder scope', async () => {
        vi.mocked(listMediaFolders).mockResolvedValue([
            testFolder(1, 'Interviews', null),
            testFolder(2, 'Cuts', 1),
        ])

        render(<MediaLibraryClient />)

        await waitFor(() =>
            expect(vi.mocked(listMedia)).toHaveBeenLastCalledWith('tenant.test', {
                limit: 100,
                folderId: undefined,
                recursive: false,
                unassignedOnly: true,
            }),
        )

        fireEvent.click(await screen.findByRole('button', {name: /Interviews/}))
        await waitFor(() =>
            expect(vi.mocked(listMedia)).toHaveBeenLastCalledWith('tenant.test', {
                limit: 100,
                folderId: 1,
                recursive: false,
                unassignedOnly: false,
            }),
        )

        fireEvent.click(screen.getByRole('checkbox', {name: 'Unterordner einbeziehen'}))
        await waitFor(() =>
            expect(vi.mocked(listMedia)).toHaveBeenLastCalledWith('tenant.test', {
                limit: 100,
                folderId: 1,
                recursive: true,
                unassignedOnly: false,
            }),
        )
    })

    it('creates a folder in the current location', async () => {
        vi.mocked(createMediaFolder).mockResolvedValue(testFolder(5, 'Neu', null))

        render(<MediaLibraryClient />)

        await waitFor(() =>
            expect(screen.getByRole('button', {name: 'Neuer Ordner'})).toBeInTheDocument(),
        )
        fireEvent.click(screen.getByRole('button', {name: 'Neuer Ordner'}))
        fireEvent.change(screen.getByPlaceholderText('z. B. Interviews'), {
            target: {value: 'Neu'},
        })
        fireEvent.click(screen.getByRole('button', {name: 'Ordner anlegen'}))

        await waitFor(() =>
            expect(createMediaFolder).toHaveBeenCalledWith('tenant.test', 'Neu', null),
        )
        expect(await screen.findByText('Ordner „Neu“ angelegt.')).toBeInTheDocument()
    })

    it('moves a single asset into a folder', async () => {
        vi.mocked(listMediaFolders).mockResolvedValue([testFolder(1, 'Interviews', null)])
        vi.mocked(listMedia).mockResolvedValue([coverAsset])

        render(<MediaLibraryClient />)

        expect(await screen.findByText('cover.png')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', {name: 'Verschieben'}))

        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText('Zielordner'), {
            target: {value: '1'},
        })
        fireEvent.click(within(dialog).getByRole('button', {name: 'Verschieben'}))

        await waitFor(() =>
            expect(moveMediaAsset).toHaveBeenCalledWith('tenant.test', 7, 1),
        )
        expect(await screen.findByText('1 Datei(en) verschoben.')).toBeInTheDocument()
    })

    it('moves selected assets in bulk back to the library root', async () => {
        const filed = {...coverAsset, id: 9, originalFilename: 'filed.png', folderId: 1}
        vi.mocked(listMediaFolders).mockResolvedValue([testFolder(1, 'Interviews', null)])
        vi.mocked(listMedia).mockResolvedValue([filed])

        render(<MediaLibraryClient />)

        fireEvent.click(
            await screen.findByRole('button', {name: /Interviews/}),
        )
        fireEvent.click(
            await screen.findByRole('checkbox', {name: '„filed.png“ auswählen'}),
        )
        fireEvent.click(screen.getByRole('button', {name: 'Auswahl verschieben'}))

        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText('Zielordner'), {
            target: {value: ''},
        })
        fireEvent.click(within(dialog).getByRole('button', {name: 'Verschieben'}))

        await waitFor(() =>
            expect(moveMediaAsset).toHaveBeenCalledWith('tenant.test', 9, null),
        )
        expect(
            await screen.findByText('1 Datei(en) in die Bibliothek verschoben.'),
        ).toBeInTheDocument()
    })

    it('uploads into the open folder', async () => {
        vi.mocked(listMediaFolders).mockResolvedValue([testFolder(1, 'Interviews', null)])
        vi.mocked(listMedia).mockResolvedValue([])

        render(<MediaLibraryClient />)

        fireEvent.click(await screen.findByRole('button', {name: /Interviews/}))
        await waitFor(() =>
            expect(screen.getByText(/Uploads landen in „Interviews“/)).toBeInTheDocument(),
        )

        const dropzone = screen.getByText('Datei hierher ziehen').parentElement
        const file = new File(['audio'], 'folge.mp3', {type: 'audio/mpeg'})
        fireEvent.drop(dropzone as HTMLElement, {
            dataTransfer: {files: [file]},
        })

        await waitFor(() =>
            expect(uploadMediaFile).toHaveBeenCalledWith(
                'tenant.test',
                file,
                expect.objectContaining({folderId: 1}),
            ),
        )
    })

    it('deletes a folder and reports success', async () => {
        const folder = testFolder(1, 'Interviews', null)
        vi.mocked(listMediaFolders).mockResolvedValue([folder])
        vi.mocked(listMedia).mockResolvedValue([])
        vi.mocked(deleteMediaFolder).mockResolvedValue(folder)

        render(<MediaLibraryClient />)

        fireEvent.click(await screen.findByRole('button', {name: /Interviews/}))
        fireEvent.click(await screen.findByRole('button', {name: 'Löschen'}))

        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', {name: 'Ordner löschen'}))

        await waitFor(() =>
            expect(deleteMediaFolder).toHaveBeenCalledWith('tenant.test', 1, 'move_to_parent'),
        )
        expect(await screen.findByText('Ordner „Interviews“ gelöscht.')).toBeInTheDocument()
    })

    it('requires the folder name for destructive deletion even when no assets are loaded', async () => {
        const folder = testFolder(1, 'Interviews', null)
        vi.mocked(listMediaFolders).mockResolvedValue([folder])
        vi.mocked(listMedia).mockResolvedValue([])

        render(<MediaLibraryClient />)

        fireEvent.click(await screen.findByRole('button', {name: /Interviews/}))
        fireEvent.click(await screen.findByRole('button', {name: 'Löschen'}))

        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('radio', {name: /Inhalte endgültig löschen/}))
        expect(within(dialog).getByRole('button', {name: 'Ordner löschen'})).toBeDisabled()

        fireEvent.change(within(dialog).getByLabelText('Ordnernamen zur Bestätigung eingeben'), {
            target: {value: 'Interviews'},
        })
        expect(within(dialog).getByRole('button', {name: 'Ordner löschen'})).toBeEnabled()
    })

    it('renames the open folder', async () => {
        const folder = testFolder(1, 'Interviews', null)
        vi.mocked(listMediaFolders).mockResolvedValue([folder])
        vi.mocked(listMedia).mockResolvedValue([])
        vi.mocked(renameMediaFolder).mockResolvedValue({...folder, name: 'Neu'})

        render(<MediaLibraryClient />)

        fireEvent.click(await screen.findByRole('button', {name: /Interviews/}))
        fireEvent.click(await screen.findByRole('button', {name: 'Umbenennen'}))

        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText('Name'), {
            target: {value: 'Neu'},
        })
        fireEvent.click(within(dialog).getByRole('button', {name: 'Umbenennen'}))

        await waitFor(() =>
            expect(renameMediaFolder).toHaveBeenCalledWith('tenant.test', 1, 'Neu'),
        )
        expect(await screen.findByText('Ordner in „Neu“ umbenannt.')).toBeInTheDocument()
    })
})
