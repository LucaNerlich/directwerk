import {cleanup, screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, describe, expect, it, vi} from 'vitest'

import {renderWithLocale} from '@/lib/i18n/testUtils'
import type {MediaAsset, MediaFolder} from '@directwerk/api/types'

const listMediaMock = vi.fn()
const listMediaFoldersMock = vi.fn()

vi.mock('@/lib/api/mediaApi', () => ({
    listMedia: (...args: unknown[]) => listMediaMock(...args),
    listMediaFolders: (...args: unknown[]) => listMediaFoldersMock(...args),
}))

import MediaLibraryPicker from '@/components/media/MediaLibraryPicker'

function asset(overrides: Partial<MediaAsset> & {id: number; title?: string}): MediaAsset {
    return {
        assetType: 'IMAGE',
        status: 'READY',
        visibility: 'PUBLIC',
        cdnUrl: 'https://cdn.example.test/a.jpg',
        originalFilename: overrides.originalFilename ?? overrides.title ?? `asset-${overrides.id}.jpg`,
        folderId: null,
        ...overrides,
    } as MediaAsset
}

function folder(overrides: Partial<MediaFolder> & {id: number; name: string}): MediaFolder {
    return {
        parentId: null,
        createdBy: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...overrides,
    }
}

async function openPicker(label: string): Promise<HTMLElement> {
    const trigger = await screen.findByRole('button', {name: new RegExp(label)})
    await userEvent.click(trigger)
    return screen.getByRole('listbox')
}

function offeredIds(listbox: HTMLElement): string[] {
    return within(listbox)
        .getAllByRole('option')
        .map((option) => option.textContent?.trim() ?? '')
}

afterEach(() => {
    cleanup()
    listMediaMock.mockReset()
    listMediaFoldersMock.mockReset()
})

describe('media library picker visibility (#553)', () => {
    it('cannot offer a PRIVATE image to a public cover field', async () => {
        listMediaMock.mockResolvedValue([
            asset({id: 1, title: 'Public cover', originalFilename: 'public-cover.jpg'}),
            asset({
                id: 2,
                title: 'Private cover',
                originalFilename: 'private-cover.jpg',
                visibility: 'PRIVATE',
                cdnUrl: null as never,
            }),
        ])
        listMediaFoldersMock.mockResolvedValue([])

        renderWithLocale(
            <MediaLibraryPicker
                assetType="IMAGE"
                label="Titelbild aus Mediathek"
                onAuthRequired={() => {}}
                onSelect={() => {}}
                requirePublic
                selectedId={null}
            />,
        )

        const listbox = await openPicker('Titelbild aus Mediathek')
        expect(offeredIds(listbox)).toEqual(['public-cover.jpg'])
        expect(within(listbox).queryByText('private-cover.jpg')).not.toBeInTheDocument()
    })

    it('still lists private files for non-public fields', async () => {
        listMediaMock.mockResolvedValue([
            asset({
                id: 2,
                title: 'Private audio',
                assetType: 'AUDIO',
                visibility: 'PRIVATE',
                originalFilename: 'private-audio.mp3',
            }),
        ])
        listMediaFoldersMock.mockResolvedValue([])

        renderWithLocale(
            <MediaLibraryPicker
                assetType="AUDIO"
                label="Audio aus Mediathek"
                onAuthRequired={() => {}}
                onSelect={() => {}}
                selectedId={null}
            />,
        )

        const listbox = await openPicker('Audio aus Mediathek')
        expect(offeredIds(listbox)).toEqual(['private-audio.mp3'])
    })
})

describe('media library picker groups + search (#825)', () => {
    it('groups READY assets by folder and shows the current selection on the trigger', async () => {
        listMediaMock.mockResolvedValue([
            asset({id: 1, originalFilename: 'root-cover.jpg', folderId: null}),
            asset({id: 2, originalFilename: 'interview-cover.jpg', folderId: 11}),
            asset({id: 3, originalFilename: 'pending.jpg', status: 'PENDING', folderId: 11}),
        ])
        listMediaFoldersMock.mockResolvedValue([folder({id: 11, name: 'Interviews'})])

        renderWithLocale(
            <MediaLibraryPicker
                assetType="IMAGE"
                label="Titelbild aus Mediathek"
                onAuthRequired={() => {}}
                onSelect={() => {}}
                requirePublic
                selectedId={2}
            />,
        )

        const trigger = await screen.findByRole('button', {name: 'Titelbild aus Mediathek'})
        expect(trigger).toHaveTextContent('interview-cover.jpg')

        const listbox = await openPicker('Titelbild aus Mediathek')
        expect(within(listbox).getByText('Bibliothek (oberste Ebene)')).toBeInTheDocument()
        expect(within(listbox).getByText('Interviews')).toBeInTheDocument()
        expect(offeredIds(listbox)).toEqual(['root-cover.jpg', 'interview-cover.jpg'])
        expect(within(listbox).queryByText('pending.jpg')).not.toBeInTheDocument()
    })

    it('filters options by filename substring', async () => {
        listMediaMock.mockResolvedValue([
            asset({id: 1, originalFilename: 'cover-a.jpg', folderId: null}),
            asset({id: 2, originalFilename: 'jingle.mp3', assetType: 'AUDIO', folderId: null}),
            asset({id: 3, originalFilename: 'cover-b.png', folderId: 11}),
        ])
        listMediaFoldersMock.mockResolvedValue([folder({id: 11, name: 'Covers'})])

        renderWithLocale(
            <MediaLibraryPicker
                assetType="IMAGE"
                label="Titelbild aus Mediathek"
                onAuthRequired={() => {}}
                onSelect={() => {}}
                requirePublic
                selectedId={null}
            />,
        )

        const listbox = await openPicker('Titelbild aus Mediathek')
        expect(offeredIds(listbox)).toEqual(['cover-a.jpg', 'cover-b.png'])

        await userEvent.type(screen.getByPlaceholderText('Dateiname suchen…'), 'cover-b')

        await waitFor(() => {
            expect(offeredIds(listbox)).toEqual(['cover-b.png'])
        })
        expect(within(listbox).queryByText('cover-a.jpg')).not.toBeInTheDocument()
        expect(within(listbox).getByText('Covers')).toBeInTheDocument()
    })

    it('selects an asset and closes the panel', async () => {
        const onSelect = vi.fn()
        listMediaMock.mockResolvedValue([
            asset({id: 9, originalFilename: 'pick-me.jpg', folderId: null}),
        ])
        listMediaFoldersMock.mockResolvedValue([])

        renderWithLocale(
            <MediaLibraryPicker
                assetType="IMAGE"
                label="Titelbild aus Mediathek"
                onAuthRequired={() => {}}
                onSelect={onSelect}
                requirePublic
                selectedId={null}
            />,
        )

        await openPicker('Titelbild aus Mediathek')
        await userEvent.click(screen.getByRole('option', {name: 'pick-me.jpg'}))

        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({id: 9}))
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('portals the open panel outside a clipping Card ancestor', async () => {
        listMediaMock.mockResolvedValue([
            asset({id: 1, originalFilename: 'cover.jpg', folderId: null}),
        ])
        listMediaFoldersMock.mockResolvedValue([])

        const {Card, CardContent} = await import('@directwerk/ui/components/card')

        renderWithLocale(
            <Card>
                <CardContent className="pt-(--card-spacing)">
                    <MediaLibraryPicker
                        assetType="IMAGE"
                        label="Titelbild aus Mediathek"
                        onAuthRequired={() => {}}
                        onSelect={() => {}}
                        requirePublic
                        selectedId={null}
                    />
                </CardContent>
            </Card>,
        )

        const listbox = await openPicker('Titelbild aus Mediathek')
        expect(listbox.closest('[data-slot="card"]')).toBeNull()
        expect(document.body.contains(listbox)).toBe(true)
        expect(offeredIds(listbox)).toEqual(['cover.jpg'])
    })
})
