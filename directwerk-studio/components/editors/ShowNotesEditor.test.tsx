import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import ShowNotesEditor from '@/components/editors/ShowNotesEditor'

vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('next/link', () => ({
    default: ({children, href}: {children: React.ReactNode; href: string}) => (
        <a href={href}>{children}</a>
    ),
}))

const baseAsset = {
    status: 'READY',
    visibility: 'PUBLIC',
    s3Key: 't/public/images/cover.png',
    scope: 'TENANT_PUBLIC',
    mimeType: 'image/png',
    sizeBytes: 1024,
    episodeId: null,
    ownerUserId: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
}

const listMedia = vi.fn().mockResolvedValue([
    {
        ...baseAsset,
        id: 1,
        assetType: 'IMAGE',
        cdnUrl: 'https://cdn.example.test/t/public/images/cover.png',
        originalFilename: 'cover.png',
    },
    {
        ...baseAsset,
        id: 2,
        assetType: 'AUDIO',
        mimeType: 'audio/mpeg',
        sizeBytes: 2048,
        s3Key: 't/public/audio/jingle.mp3',
        cdnUrl: 'https://cdn.example.test/t/public/audio/jingle.mp3',
        originalFilename: 'jingle.mp3',
    },
])

vi.mock('@/lib/api/mediaApi', () => ({
    listMedia: (...args: unknown[]) => listMedia(...args),
}))

describe('ShowNotesEditor', () => {
    it('does not report a content change when mounted or disabled', async () => {
        const onChange = vi.fn()
        const {container, rerender} = render(
            <ShowNotesEditor onChange={onChange} value="<p>Draft</p>" />,
        )

        const editor = await waitFor(() => {
            const element = container.querySelector('.ProseMirror')
            expect(element).toHaveAttribute('contenteditable', 'true')
            return element
        })
        expect(onChange).not.toHaveBeenCalled()

        rerender(
            <ShowNotesEditor disabled onChange={onChange} value="<p>Draft</p>" />,
        )

        await waitFor(() => expect(editor).toHaveAttribute('contenteditable', 'false'))

        rerender(
            <ShowNotesEditor onChange={onChange} value="<p>Draft</p>" />,
        )

        await waitFor(() => expect(editor).toHaveAttribute('contenteditable', 'true'))
        expect(onChange).not.toHaveBeenCalled()
    })

    it('embeds a library image at the cursor', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        const {container} = render(
            <ShowNotesEditor onChange={onChange} value="<p>Draft</p>" />,
        )

        await waitFor(() =>
            expect(container.querySelector('.ProseMirror')).toBeInTheDocument(),
        )
        await user.click(
            screen.getByRole('button', {name: 'Medium aus Mediathek einfügen'}),
        )
        expect(await screen.findByText('cover.png')).toBeInTheDocument()
        const rows = screen.getAllByRole('button', {name: 'Einfügen'})
        await user.click(rows[0])

        await waitFor(() => expect(onChange).toHaveBeenCalled())
        const lastHtml = onChange.mock.calls[onChange.mock.calls.length - 1][0] as string
        expect(lastHtml).toContain(
            'src="https://cdn.example.test/t/public/images/cover.png"',
        )
        expect(lastHtml).toContain('<img')
    })

    it('inserts a library audio file as a link', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        const {container} = render(
            <ShowNotesEditor onChange={onChange} value="<p>Draft</p>" />,
        )

        await waitFor(() =>
            expect(container.querySelector('.ProseMirror')).toBeInTheDocument(),
        )
        await user.click(
            screen.getByRole('button', {name: 'Medium aus Mediathek einfügen'}),
        )
        expect(await screen.findByText('jingle.mp3')).toBeInTheDocument()
        const rows = screen.getAllByRole('button', {name: 'Einfügen'})
        await user.click(rows[1])

        await waitFor(() => expect(onChange).toHaveBeenCalled())
        const lastHtml = onChange.mock.calls[onChange.mock.calls.length - 1][0] as string
        // TipTap renders target/rel on links; the backend sanitizer keeps href.
        expect(lastHtml).toContain('href="https://cdn.example.test/t/public/audio/jingle.mp3"')
        expect(lastHtml).toContain('>jingle.mp3</a>')
    })

    it('hides the media button when insertion is disabled', async () => {
        const {container} = render(
            <ShowNotesEditor allowMediaInsert={false} onChange={vi.fn()} value="<p>Draft</p>" />,
        )

        await waitFor(() =>
            expect(container.querySelector('.ProseMirror')).toBeInTheDocument(),
        )
        expect(
            screen.queryByRole('button', {name: 'Medium aus Mediathek einfügen'}),
        ).not.toBeInTheDocument()
    })
})
