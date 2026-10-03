import {screen, waitFor} from '@testing-library/react'
import {renderWithLocale} from '@/lib/i18n/testUtils'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import CategoryListClient from '@/components/manage/CategoryListClient'
import {listCategories} from '@/lib/api/catalogApi'

vi.mock('next/link', () => ({
    default: ({children, href, ...props}: {children?: React.ReactNode; href: string; [key: string]: unknown}) => (
        <a href={href} {...props}>{children}</a>
    ),
}))

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/catalogApi', () => ({
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
        renderWithLocale(<CategoryListClient />)
        await waitFor(() => expect(screen.getByText('News')).toBeInTheDocument())
        expect(screen.getByRole('button', {name: /Neue Kategorie/})).toHaveAttribute(
            'href', '/de/manage/categories/new',
        )
    })

    it('shows an empty state with a create action', async () => {
        vi.mocked(listCategories).mockResolvedValue([])
        renderWithLocale(<CategoryListClient />)
        await waitFor(() =>
            expect(screen.getByText('Noch keine Kategorien')).toBeInTheDocument(),
        )
        expect(screen.getByRole('button', {name: /Erste Kategorie anlegen/})).toHaveAttribute(
            'href', '/de/manage/categories/new',
        )
    })
})
