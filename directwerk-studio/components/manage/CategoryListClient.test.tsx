import {render, screen, waitFor} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import CategoryListClient from '@/components/manage/CategoryListClient'
import {listCategories} from '@/lib/api/catalogApi'

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/tenantApi', () => ({
    listCategories: vi.fn().mockResolvedValue([
        {id: 1, slug: 'news', name: 'News', parentId: null, active: true},
    ]),
}))

describe('CategoryListClient', () => {
    beforeEach(() => {
        vi.mocked(listCategories).mockReset()
        vi.mocked(listCategories).mockResolvedValue([
            {id: 1, slug: 'news', name: 'News', parentId: null, active: true},
        ])
    })

    it('renders loaded categories', async () => {
        render(<CategoryListClient />)
        await waitFor(() => expect(screen.getByText('News')).toBeInTheDocument())
        expect(screen.getByRole('button', {name: /Neue Kategorie/})).toHaveAttribute(
            'href',
            '/manage/categories/new',
        )
    })

    it('shows an empty state with a create action', async () => {
        vi.mocked(listCategories).mockResolvedValue([])
        render(<CategoryListClient />)
        await waitFor(() =>
            expect(screen.getByText('Noch keine Kategorien')).toBeInTheDocument(),
        )
        expect(screen.getByRole('button', {name: /Erste Kategorie anlegen/})).toHaveAttribute(
            'href',
            '/manage/categories/new',
        )
    })
})
