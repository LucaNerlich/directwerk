import {render, screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import MediaInlinePickerDialog from '@/components/media/MediaInlinePickerDialog'
import type {MediaAsset} from '@directwerk/api/types'

vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('next/link', () => ({
    default: ({children, href}: {children: React.ReactNode; href: string}) => (
        <a href={href}>{children}</a>
    ),
}))

const publicImage = {
    id: 1,
    assetType: 'IMAGE',
    status: 'READY',
    visibility: 'PUBLIC',
    cdnUrl: 'https://cdn.example.test/t/public/images/cover.png',
    originalFilename: 'cover.png',
    sizeBytes: 1024,
    s3Key: 't/public/images/cover.png',
    scope: 'TENANT_PUBLIC',
    mimeType: 'image/png',
    episodeId: null,
    ownerUserId: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
}

const publicAudio = {
    ...publicImage,
    id: 2,
    assetType: 'AUDIO',
    cdnUrl: 'https://cdn.example.test/t/public/audio/jingle.mp3',
    originalFilename: 'jingle.mp3',
    mimeType: 'audio/mpeg',
    s3Key: 't/public/audio/jingle.mp3',
}

const privateImage = {
    ...publicImage,
    id: 3,
    visibility: 'PRIVATE',
    cdnUrl: null,
    originalFilename: 'privat.png',
}

const pendingImage = {
    ...publicImage,
    id: 4,
    status: 'PENDING',
    cdnUrl: null,
    originalFilename: 'wartend.png',
}

const listMedia = vi.fn().mockResolvedValue([publicImage, publicAudio, privateImage, pendingImage])

vi.mock('@/lib/api/mediaApi', () => ({
    listMedia: (...args: unknown[]) => listMedia(...args),
}))

function renderDialog(onInsert: (asset: MediaAsset) => void = () => undefined) {
    const insert = vi.fn(onInsert)
    const openChange = vi.fn()
    render(
        <MediaInlinePickerDialog
            onAuthRequired={vi.fn()}
            onInsert={insert}
            onOpenChange={openChange}
            open
        />,
    )
    return {insert, openChange}
}

describe('MediaInlinePickerDialog', () => {
    it('lists public ready assets and hides private/pending ones', async () => {
        renderDialog()

        expect(await screen.findByText('cover.png')).toBeInTheDocument()
        expect(screen.getByText('jingle.mp3')).toBeInTheDocument()
        expect(screen.queryByText('privat.png')).not.toBeInTheDocument()
        expect(screen.queryByText('wartend.png')).not.toBeInTheDocument()
        expect(screen.getByText(/1 private Datei\(en\) ausgeblendet/)).toBeInTheDocument()
    })

    it('marks images as embedded and audio as linked', async () => {
        renderDialog()

        expect(await screen.findByText('wird eingebettet')).toBeInTheDocument()
        expect(screen.getByText('wird verlinkt')).toBeInTheDocument()
    })

    it('filters by media type', async () => {
        const user = userEvent.setup()
        renderDialog()

        expect(await screen.findByText('cover.png')).toBeInTheDocument()
        await user.click(screen.getByRole('button', {name: 'Audio'}))

        expect(screen.queryByText('cover.png')).not.toBeInTheDocument()
        expect(screen.getByText('jingle.mp3')).toBeInTheDocument()
    })

    it('inserts the chosen asset and closes', async () => {
        const user = userEvent.setup()
        const {insert, openChange} = renderDialog()

        expect(await screen.findByText('cover.png')).toBeInTheDocument()
        const row = screen.getByText('cover.png').closest('li') as HTMLElement
        await user.click(within(row).getByRole('button', {name: 'Einfügen'}))

        expect(insert).toHaveBeenCalledTimes(1)
        expect(insert.mock.calls[0][0]).toMatchObject({id: 1})
        expect(openChange).toHaveBeenCalledWith(false)
    })
})
