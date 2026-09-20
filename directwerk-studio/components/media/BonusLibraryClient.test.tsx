import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import BonusLibraryClient from '@/components/media/BonusLibraryClient'
import {listDigitalPublications} from '@/lib/api/digitalPublicationsApi'

const mockRouter = {replace: vi.fn()}
vi.mock('next/navigation', () => ({useRouter: () => mockRouter}))
vi.mock('next/link', () => ({
    default: ({children, href}: {children: React.ReactNode; href: string}) => (
        <a href={href}>{children}</a>
    ),
}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/digitalPublicationsApi', () => ({
    listDigitalPublications: vi.fn().mockResolvedValue([
        {
            id: 3,
            slug: 'bonus-guide',
            title: 'Bonus-Guide',
            description: null,
            assetId: 9,
            originalFilename: 'bonus.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 2048,
            accessPolicy: 'FREE',
            requiredLevelSortOrder: null,
            status: 'PUBLISHED',
            publishedAt: '2026-01-01T00:00:00Z',
            createdBy: 1,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
        },
        {
            id: 4,
            slug: 'draft-file',
            title: 'Entwurf PDF',
            description: null,
            assetId: 10,
            originalFilename: 'draft.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1024,
            accessPolicy: 'PAID',
            requiredLevelSortOrder: 1,
            status: 'DRAFT',
            publishedAt: null,
            createdBy: 1,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
        },
    ]),
}))

describe('BonusLibraryClient', () => {
    it('lists digital publications with status and edit links', async () => {
        render(<BonusLibraryClient />)
        await waitFor(() => expect(screen.getByText('Bonus-Guide')).toBeInTheDocument())
        expect(screen.getByText('Entwurf PDF')).toBeInTheDocument()
        expect(screen.getByText('Veröffentlicht')).toBeInTheDocument()
        expect(screen.getByText('Entwurf')).toBeInTheDocument()
        expect(screen.getAllByRole('link', {name: 'Bearbeiten'})[0]).toHaveAttribute(
            'href',
            '/bonus/3',
        )
        expect(screen.getByRole('link', {name: 'Neue Bonusdatei'})).toHaveAttribute(
            'href',
            '/bonus/new',
        )
    })

    it('retries loading after a load error', async () => {
        vi.mocked(listDigitalPublications).mockClear()
        vi.mocked(listDigitalPublications)
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
        expect(vi.mocked(listDigitalPublications)).toHaveBeenCalledTimes(2)
    })
})
