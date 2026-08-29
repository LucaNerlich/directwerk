import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import CategoryEditor from '@/components/manage/CategoryEditor'

const replace = vi.fn()
vi.mock('next/navigation', () => ({useRouter: () => ({replace})}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))

const createCategory = vi.fn().mockResolvedValue({
    id: 1,
    slug: 'news',
    name: 'News',
    parentId: null,
    active: true,
})
vi.mock('@/lib/api/catalogApi', () => ({
    createCategory: (...args: unknown[]) => createCategory(...args),
    updateCategory: vi.fn(),
    deactivateCategory: vi.fn(),
    listCategories: vi.fn().mockResolvedValue([]),
}))

describe('CategoryEditor', () => {
    it('creates a new category and redirects to its detail page', async () => {
        const user = userEvent.setup()
        render(<CategoryEditor />)

        await user.type(screen.getByLabelText('Name'), 'News')
        await user.type(screen.getByLabelText('Slug'), 'news')
        await user.click(screen.getByRole('button', {name: /Speichern/}))

        await waitFor(() =>
            expect(createCategory).toHaveBeenCalledWith('tenant.test', {
                slug: 'news',
                name: 'News',
                parentId: undefined,
            }),
        )
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/manage/categories/1'))
    })
})
