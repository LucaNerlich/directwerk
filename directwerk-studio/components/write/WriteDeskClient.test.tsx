import {render, screen, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import WriteDeskClient from '@/components/write/WriteDeskClient'

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/writeApi', () => ({
    listArticles: vi.fn().mockResolvedValue([]),
    listCategories: vi.fn().mockResolvedValue([]),
}))

describe('WriteDeskClient', () => {
    it('guides first-run setup toward creating an article', async () => {
        render(<WriteDeskClient />)
        await waitFor(() =>
            expect(screen.getByRole('heading', {name: 'Inhalte erstellen'})).toBeInTheDocument(),
        )
        expect(screen.getByText('So entsteht ein Beitrag')).toBeInTheDocument()
        expect(screen.getAllByRole('button', {name: 'Neuer Beitrag'})[0]).toHaveAttribute(
            'href',
            '/write/articles/new',
        )
    })
})
