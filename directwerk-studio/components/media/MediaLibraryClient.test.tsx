import {cleanup, fireEvent, screen, waitFor, within} from '@testing-library/react'
import {renderWithLocale} from '@/lib/i18n/testUtils'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import MediaLibraryClient from '@/components/media/MediaLibraryClient'
import {resetMediaPreviewFetchQueueForTests} from '@/components/media/MediaAudioPreview'
import {
    createMediaFolder,
    deleteMedia,
    deleteMediaFolder,
    getMediaPreviewUrl,
    getMediaReferences,
    getMediaUploadLimits,
    listMedia,
    listMediaFolders,
    moveMediaAsset,
    moveMediaFolder,
    renameMediaAsset,
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
    getMediaUploadLimits: vi.fn().mockResolvedValue(null),
    getMediaPreviewUrl: vi.fn(),
    getMediaReferences: vi.fn().mockResolvedValue([]),
    createMediaFolder: vi.fn(),
    renameMediaAsset: vi.fn(),
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
    createdBy: null,
    cdnUrl: 'https://cdn.example/cover.png',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
}

function testFolder(id: number, name: string, parentId: number | null): MediaFolder {
    return {
        id,
        name,
        parentId,
        createdBy: null,
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
        resetMediaPreviewFetchQueueForTests()
        vi.mocked(listMedia).mockReset()
        vi.mocked(listMedia).mockResolvedValue([])
        vi.mocked(deleteMedia).mockReset()
        vi.mocked(deleteMedia).mockResolvedValue(coverAsset)
        vi.mocked(listMediaFolders).mockReset()
        vi.mocked(listMediaFolders).mockResolvedValue([])
        vi.mocked(getMediaUploadLimits).mockReset()
        vi.mocked(getMediaUploadLimits).mockResolvedValue({
            maxAudioBytes: 500 * 1024 * 1024,
            maxImageBytes: 10 * 1024 * 1024,
            maxVideoBytes: 5 * 1024 * 1024 * 1024,
            maxDocumentBytes: 50 * 1024 * 1024,
        })
        vi.mocked(getMediaPreviewUrl).mockReset()
        vi.mocked(getMediaPreviewUrl).mockResolvedValue('https://cdn.example/preview.mp3')
        vi.mocked(getMediaReferences).mockReset()
        vi.mocked(getMediaReferences).mockResolvedValue([])
        vi.mocked(createMediaFolder).mockReset()
        vi.mocked(renameMediaAsset).mockReset()
        vi.mocked(renameMediaFolder).mockReset()
        vi.mocked(moveMediaFolder).mockReset()
        vi.mocked(deleteMediaFolder).mockReset()
        vi.mocked(moveMediaAsset).mockReset()
        vi.mocked(moveMediaAsset).mockImplementation(async (assetId, folderId) => ({
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
        renderWithLocale(<MediaLibraryClient />)

        await waitFor(() =>
            expect(screen.getByText('Noch keine Medien')).toBeInTheDocument(),
        )
        expect(screen.getAllByRole('button', {name: 'Datei hochladen'}).length).toBeGreaterThan(0)
    })

    it('shows the tenant upload limits from the API', async () => {
        vi.mocked(getMediaUploadLimits).mockResolvedValue({
            maxAudioBytes: 100 * 1024 * 1024,
            maxImageBytes: 20 * 1024 * 1024,
            maxVideoBytes: 1024 * 1024 * 1024,
            maxDocumentBytes: 50 * 1024 * 1024,
        })

        renderWithLocale(<MediaLibraryClient />)

        await waitFor(() =>
            expect(screen.getByText(/Audio bis 100 MB/)).toBeInTheDocument(),
        )
        expect(screen.getByText(/Video bis 1 GB/)).toBeInTheDocument()
    })

    it('renders a media grid and uploads a dropped file', async () => {
        vi.mocked(listMedia).mockResolvedValue([coverAsset])

        renderWithLocale(<MediaLibraryClient />)

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

        renderWithLocale(<MediaLibraryClient />)

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

        renderWithLocale(<MediaLibraryClient />)

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

        renderWithLocale(<MediaLibraryClient />)

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

        renderWithLocale(<MediaLibraryClient />)

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

        renderWithLocale(<MediaLibraryClient />)

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

        renderWithLocale(<MediaLibraryClient />)

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

        renderWithLocale(<MediaLibraryClient />)

        await waitFor(() =>
            expect(vi.mocked(listMedia)).toHaveBeenLastCalledWith({
                limit: 100,
                offset: 0,
                folderId: undefined,
                recursive: false,
                unassignedOnly: true,
            }),
        )

        fireEvent.click(await screen.findByRole('button', {name: /Interviews/}))
        await waitFor(() =>
            expect(vi.mocked(listMedia)).toHaveBeenLastCalledWith({
                limit: 100,
                offset: 0,
                folderId: 1,
                recursive: false,
                unassignedOnly: false,
            }),
        )

        fireEvent.click(screen.getByRole('checkbox', {name: 'Unterordner einbeziehen'}))
        await waitFor(() =>
            expect(vi.mocked(listMedia)).toHaveBeenLastCalledWith({
                limit: 100,
                offset: 0,
                folderId: 1,
                recursive: true,
                unassignedOnly: false,
            }),
        )
    })

    it('refetches with unreferencedOnly when the orphan filter is enabled', async () => {
        renderWithLocale(<MediaLibraryClient />)

        await waitFor(() =>
            expect(vi.mocked(listMedia)).toHaveBeenCalled(),
        )
        vi.mocked(listMedia).mockClear()

        fireEvent.click(screen.getByRole('checkbox', {name: 'Nur unverknüpfte Dateien'}))
        await waitFor(() =>
            expect(vi.mocked(listMedia)).toHaveBeenLastCalledWith({
                limit: 100,
                offset: 0,
                folderId: undefined,
                recursive: false,
                unassignedOnly: true,
                unreferencedOnly: true,
            }),
        )
    })

    it('opens detail panel with referencing entities and empty state', async () => {
        vi.mocked(listMedia).mockResolvedValue([coverAsset])
        vi.mocked(getMediaReferences).mockResolvedValue([
            {kind: 'EPISODE_COVER', id: 42, title: 'Folge 42'},
        ])

        renderWithLocale(<MediaLibraryClient />)

        expect(await screen.findByText('cover.png')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', {name: 'Details'}))

        const detailDialog = await screen.findByRole('dialog')
        await waitFor(() =>
            expect(getMediaReferences).toHaveBeenCalledWith(7),
        )
        expect(await within(detailDialog).findByText('Folgen-Cover')).toBeInTheDocument()
        expect(within(detailDialog).getByRole('link', {name: 'Folge 42'})).toHaveAttribute(
            'href',
            expect.stringContaining('/podcast/episodes/42'),
        )

        fireEvent.click(within(detailDialog).getAllByRole('button', {name: 'Schließen'})[0]!)
        await waitFor(() =>
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
        )

        vi.mocked(getMediaReferences).mockResolvedValue([])
        fireEvent.click(screen.getByRole('button', {name: 'Details'}))
        const emptyDialog = await screen.findByRole('dialog')
        expect(await within(emptyDialog).findByText('Nicht verknüpft')).toBeInTheDocument()
        expect(
            within(emptyDialog).getByText(
                'Diese Datei wird derzeit von keinem Inhalt referenziert.',
            ),
        ).toBeInTheDocument()
    })

    it('shows a references load error without the unused empty state', async () => {
        vi.mocked(listMedia).mockResolvedValue([coverAsset])
        vi.mocked(getMediaReferences).mockRejectedValue(new Error('Referenzen offline'))

        renderWithLocale(<MediaLibraryClient />)

        expect(await screen.findByText('cover.png')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', {name: 'Details'}))

        const detailDialog = await screen.findByRole('dialog')
        expect(await within(detailDialog).findByRole('alert')).toHaveTextContent(
            'Referenzen offline',
        )
        expect(within(detailDialog).queryByText('Nicht verknüpft')).not.toBeInTheDocument()
    })

    it('renames an asset from the first reference title in the detail panel', async () => {
        const downloadAsset = {
            ...coverAsset,
            id: 11,
            originalFilename: 'download.mp3',
            assetType: 'AUDIO',
            mimeType: 'audio/mpeg',
            s3Key: 'tenant/staging/download.mp3',
        }
        vi.mocked(listMedia).mockResolvedValue([downloadAsset])
        vi.mocked(getMediaReferences).mockResolvedValue([
            {kind: 'EPISODE_AUDIO', id: 42, title: 'Folge 42'},
            {kind: 'EPISODE_COVER', id: 42, title: 'Folge 42'},
        ])
        vi.mocked(renameMediaAsset).mockResolvedValue({
            ...downloadAsset,
            originalFilename: 'folge-42.mp3',
        })

        renderWithLocale(<MediaLibraryClient />)

        expect(await screen.findByText('download.mp3')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', {name: 'Details'}))

        const detailDialog = await screen.findByRole('dialog')
        expect(
            await within(detailDialog).findByRole('button', {name: 'Von Referenz umbenennen'}),
        ).toBeInTheDocument()
        fireEvent.click(
            within(detailDialog).getByRole('button', {name: 'Von Referenz umbenennen'}),
        )
        expect(
            within(detailDialog).getByText(/Datei in „folge-42\.mp3“ umbenennen/),
        ).toBeInTheDocument()
        fireEvent.click(within(detailDialog).getByRole('button', {name: 'Datei umbenennen'}))

        await waitFor(() =>
            expect(renameMediaAsset).toHaveBeenCalledWith(11, 'folge-42.mp3'),
        )
        expect(await screen.findByText(/Datei in „folge-42\.mp3“ umbenannt/)).toBeInTheDocument()
        expect(await within(detailDialog).findByText('folge-42.mp3')).toBeInTheDocument()
        expect(
            within(detailDialog).queryByRole('button', {name: 'Von Referenz umbenennen'}),
        ).not.toBeInTheDocument()
        expect(getMediaReferences).toHaveBeenCalledTimes(1)
    })

    it('does not reopen the detail dialog when rename finishes after dismiss', async () => {
        const downloadAsset = {
            ...coverAsset,
            id: 11,
            originalFilename: 'download.mp3',
            assetType: 'AUDIO',
            mimeType: 'audio/mpeg',
            s3Key: 'tenant/staging/download.mp3',
        }
        vi.mocked(listMedia).mockResolvedValue([downloadAsset])
        vi.mocked(getMediaReferences).mockResolvedValue([
            {kind: 'EPISODE_AUDIO', id: 42, title: 'Folge 42'},
        ])
        let resolveRename: (asset: MediaAsset) => void = () => undefined
        vi.mocked(renameMediaAsset).mockImplementation(
            () =>
                new Promise<MediaAsset>((resolve) => {
                    resolveRename = resolve
                }),
        )

        renderWithLocale(<MediaLibraryClient />)

        expect(await screen.findByText('download.mp3')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', {name: 'Details'}))

        const detailDialog = await screen.findByRole('dialog')
        fireEvent.click(
            await within(detailDialog).findByRole('button', {name: 'Von Referenz umbenennen'}),
        )
        fireEvent.click(within(detailDialog).getByRole('button', {name: 'Datei umbenennen'}))

        await waitFor(() => expect(renameMediaAsset).toHaveBeenCalled())
        fireEvent.click(within(detailDialog).getByRole('button', {name: 'Schließen'}))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

        resolveRename({
            ...downloadAsset,
            originalFilename: 'folge-42.mp3',
        })

        expect(await screen.findByText(/Datei in „folge-42\.mp3“ umbenannt/)).toBeInTheDocument()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(await screen.findByText('folge-42.mp3')).toBeInTheDocument()
    })

    it('hides rename-from-reference when the asset has no references', async () => {
        vi.mocked(listMedia).mockResolvedValue([coverAsset])
        vi.mocked(getMediaReferences).mockResolvedValue([])

        renderWithLocale(<MediaLibraryClient />)

        expect(await screen.findByText('cover.png')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', {name: 'Details'}))

        const detailDialog = await screen.findByRole('dialog')
        expect(await within(detailDialog).findByText('Nicht verknüpft')).toBeInTheDocument()
        expect(
            within(detailDialog).queryByRole('button', {name: 'Von Referenz umbenennen'}),
        ).not.toBeInTheDocument()
    })

    it('creates a folder in the current location', async () => {
        vi.mocked(createMediaFolder).mockResolvedValue(testFolder(5, 'Neu', null))

        renderWithLocale(<MediaLibraryClient />)

        await waitFor(() =>
            expect(screen.getByRole('button', {name: 'Neuer Ordner'})).toBeInTheDocument(),
        )
        fireEvent.click(screen.getByRole('button', {name: 'Neuer Ordner'}))
        fireEvent.change(screen.getByPlaceholderText('z. B. Interviews'), {
            target: {value: 'Neu'},
        })
        fireEvent.click(screen.getByRole('button', {name: 'Ordner anlegen'}))

        await waitFor(() =>
            expect(createMediaFolder).toHaveBeenCalledWith('Neu', null),
        )
        expect(await screen.findByText('Ordner „Neu“ angelegt.')).toBeInTheDocument()
    })

    it('moves a single asset into a folder', async () => {
        vi.mocked(listMediaFolders).mockResolvedValue([testFolder(1, 'Interviews', null)])
        vi.mocked(listMedia).mockResolvedValue([coverAsset])

        renderWithLocale(<MediaLibraryClient />)

        expect(await screen.findByText('cover.png')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', {name: 'Verschieben'}))

        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText('Zielordner'), {
            target: {value: '1'},
        })
        fireEvent.click(within(dialog).getByRole('button', {name: 'Verschieben'}))

        await waitFor(() =>
            expect(moveMediaAsset).toHaveBeenCalledWith(7, 1),
        )
        expect(await screen.findByText('1 Datei(en) verschoben.')).toBeInTheDocument()
    })

    it('moves selected assets in bulk back to the library root', async () => {
        const filed = {...coverAsset, id: 9, originalFilename: 'filed.png', folderId: 1}
        vi.mocked(listMediaFolders).mockResolvedValue([testFolder(1, 'Interviews', null)])
        vi.mocked(listMedia).mockResolvedValue([filed])

        renderWithLocale(<MediaLibraryClient />)

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
            expect(moveMediaAsset).toHaveBeenCalledWith(9, null),
        )
        expect(
            await screen.findByText('1 Datei(en) in die Bibliothek verschoben.'),
        ).toBeInTheDocument()
    })

    it('uploads into the open folder', async () => {
        vi.mocked(listMediaFolders).mockResolvedValue([testFolder(1, 'Interviews', null)])
        vi.mocked(listMedia).mockResolvedValue([])

        renderWithLocale(<MediaLibraryClient />)

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

        renderWithLocale(<MediaLibraryClient />)

        fireEvent.click(await screen.findByRole('button', {name: /Interviews/}))
        fireEvent.click(await screen.findByRole('button', {name: 'Löschen'}))

        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', {name: 'Ordner löschen'}))

        await waitFor(() =>
            expect(deleteMediaFolder).toHaveBeenCalledWith(1, 'move_to_parent'),
        )
        expect(await screen.findByText('Ordner „Interviews“ gelöscht.')).toBeInTheDocument()
    })

    it('requires the folder name for destructive deletion even when no assets are loaded', async () => {
        const folder = testFolder(1, 'Interviews', null)
        vi.mocked(listMediaFolders).mockResolvedValue([folder])
        vi.mocked(listMedia).mockResolvedValue([])

        renderWithLocale(<MediaLibraryClient />)

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

        renderWithLocale(<MediaLibraryClient />)

        fireEvent.click(await screen.findByRole('button', {name: /Interviews/}))
        fireEvent.click(await screen.findByRole('button', {name: 'Umbenennen'}))

        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText('Name'), {
            target: {value: 'Neu'},
        })
        fireEvent.click(within(dialog).getByRole('button', {name: 'Umbenennen'}))

        await waitFor(() =>
            expect(renameMediaFolder).toHaveBeenCalledWith(1, 'Neu'),
        )
        expect(await screen.findByText('Ordner in „Neu“ umbenannt.')).toBeInTheDocument()
    })
    it('renders an inline audio player for public CDN audio without fetching a preview URL', async () => {
        const publicAudio: MediaAsset = {
            ...coverAsset,
            id: 11,
            assetType: 'AUDIO',
            mimeType: 'audio/mpeg',
            originalFilename: 'public.mp3',
            sizeBytes: 4096,
            cdnUrl: 'https://cdn.example/public.mp3',
        }
        vi.mocked(listMedia).mockResolvedValue([publicAudio, coverAsset])

        const {container} = renderWithLocale(<MediaLibraryClient />)

        await waitFor(() => {
            const audio = container.querySelector('audio')
            expect(audio).not.toBeNull()
            expect(audio).toHaveAttribute('src', 'https://cdn.example/public.mp3')
            expect(audio).toHaveAttribute('controls')
        })
        expect(getMediaPreviewUrl).not.toHaveBeenCalled()
        expect(screen.getByRole('img', {name: 'cover.png'})).toHaveAttribute(
            'src',
            'https://cdn.example/cover.png',
        )
    })

    it('lazily loads a private READY audio preview URL on demand', async () => {
        const privateAudio: MediaAsset = {
            ...coverAsset,
            id: 12,
            assetType: 'AUDIO',
            mimeType: 'audio/mpeg',
            originalFilename: 'private.mp3',
            sizeBytes: 2048,
            visibility: 'PRIVATE',
            cdnUrl: null,
        }
        vi.mocked(listMedia).mockResolvedValue([privateAudio])
        vi.mocked(getMediaPreviewUrl).mockResolvedValue('https://cdn.example/signed-private.mp3')

        const {container} = renderWithLocale(<MediaLibraryClient />)

        expect(await screen.findByText('private.mp3')).toBeInTheDocument()
        expect(container.querySelector('audio')).toBeNull()
        expect(getMediaPreviewUrl).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', {name: 'Vorschau laden'}))

        await waitFor(() => {
            const audio = container.querySelector('audio')
            expect(audio).not.toBeNull()
            expect(audio).toHaveAttribute('src', 'https://cdn.example/signed-private.mp3')
        })
        expect(getMediaPreviewUrl).toHaveBeenCalledTimes(1)
        expect(getMediaPreviewUrl).toHaveBeenCalledWith(12)
    })

    it('keeps non-audio placeholders without an audio element', async () => {
        const videoAsset: MediaAsset = {
            ...coverAsset,
            id: 13,
            assetType: 'VIDEO',
            mimeType: 'video/mp4',
            originalFilename: 'clip.mp4',
            sizeBytes: 8192,
            cdnUrl: null,
        }
        vi.mocked(listMedia).mockResolvedValue([videoAsset])

        const {container} = renderWithLocale(<MediaLibraryClient />)

        expect(await screen.findByText('clip.mp4')).toBeInTheDocument()
        expect(screen.getByText('VIDEO')).toBeInTheDocument()
        expect(container.querySelector('audio')).toBeNull()
        expect(getMediaPreviewUrl).not.toHaveBeenCalled()
    })

    it('reloads the folder the user navigated into when an upload finishes', async () => {
        vi.mocked(listMediaFolders).mockResolvedValue([testFolder(1, 'Interviews', null)])
        vi.mocked(listMedia).mockResolvedValue([])
        let resolveUpload: ((asset: MediaAsset) => void) | undefined
        vi.mocked(uploadMediaFile).mockImplementation(
            () =>
                new Promise<MediaAsset>((resolve) => {
                    resolveUpload = resolve
                }),
        )

        renderWithLocale(<MediaLibraryClient />)

        const folderTile = await screen.findByRole('button', {name: /Interviews/})
        const dropzone = screen.getByText('Datei hierher ziehen').parentElement
        expect(dropzone).not.toBeNull()
        fireEvent.drop(dropzone as HTMLElement, {
            dataTransfer: {files: [new File(['audio'], 'folge.mp3', {type: 'audio/mpeg'})]},
        })
        await waitFor(() => expect(uploadMediaFile).toHaveBeenCalled())

        // Navigate into the folder while the upload is still running.
        fireEvent.click(folderTile)
        await waitFor(() =>
            expect(vi.mocked(listMedia).mock.calls.at(-1)?.[0]).toMatchObject({folderId: 1}),
        )

        resolveUpload?.({
            ...coverAsset,
            id: 8,
            assetType: 'AUDIO',
            mimeType: 'audio/mpeg',
            originalFilename: 'folge.mp3',
            sizeBytes: 1024,
            cdnUrl: null,
            folderId: 1,
        })

        // The status is set after the post-upload reload, so this also waits for that reload.
        await waitFor(() =>
            expect(screen.getByRole('status')).toHaveTextContent('Hochgeladen: folge.mp3'),
        )
        // #587: the post-upload reload must load the folder the user is looking at, not the
        // root captured when the upload started.
        expect(vi.mocked(listMedia).mock.calls.at(-1)?.[0]).toMatchObject({folderId: 1})
    })

})
