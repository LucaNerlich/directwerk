import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import BonusLibraryClient from '@/components/media/BonusLibraryClient'
import {listMedia} from '@/lib/api/mediaApi'

// Stable across renders, like the real Next.js useRouter().
const mockRouter = {replace: vi.fn()}
vi.mock('next/navigation', () => ({useRouter: () => mockRouter}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/mediaApi', () => ({
    listMedia: vi.fn().mockResolvedValue([
        {
            id: 3,
            status: 'READY',
            assetType: 'DOCUMENT',
            mimeType: 'application/pdf',
            originalFilename: 'bonus.pdf',
            sizeBytes: 2048,
        },
        {
            id: 4,
            status: 'READY',
            assetType: 'AUDIO',
            mimeType: 'audio/mpeg',
            originalFilename: 'folge.mp3',
            sizeBytes: 1024,
        },
    ]),
}))

describe('BonusLibraryClient', () => {
    it('lists ready documents and points to products', async () => {
        render(<BonusLibraryClient />)
        await waitFor(() => expect(screen.getByText('bonus.pdf')).toBeInTheDocument())
        expect(screen.queryByText('folge.mp3')).not.toBeInTheDocument()
        expect(screen.getByRole('button', {name: /An Paket hängen/})).toHaveAttribute(
            'href',
            '/manage/products',
        )
    })

    it('retries loading the library after a load error', async () => {
        vi.mocked(listMedia).mockClear()
        vi.mocked(listMedia)
            .mockRejectedValueOnce(new Error('Netzwerkfehler'))
            .mockResolvedValueOnce([])

        render(<BonusLibraryClient />)

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent('Netzwerkfehler'),
        )
        fireEvent.click(screen.getByRole('button', {name: 'Erneut versuchen'}))

        await waitFor(() =>
            expect(screen.getByText('Noch keine Bonusdateien')).toBeInTheDocument(),
        )
        expect(vi.mocked(listMedia)).toHaveBeenCalledTimes(2)
    })
})
