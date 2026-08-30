import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, describe, expect, it, vi} from 'vitest'

import ArticleListClient from '@/components/write/ArticleListClient'
import {
    cancelScheduleArticle,
    listArticles,
    publishArticle,
    unarchiveArticle,
    unpublishArticle,
} from '@/lib/api/writeApi'
import type {ArticleDetail} from '@directwerk/api/types'

const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: mockReplace,
    }),
}))

vi.mock('@directwerk/api/auth/useAuthRequired', () => ({
    useAuthRequired: () => () => false,
}))

vi.mock('@directwerk/api/tenant', () => ({
    getClientTenantHost: () => 'tenant.test',
}))

vi.mock('@/lib/api/writeApi', () => ({
    listArticles: vi.fn(),
    publishArticle: vi.fn(),
    unpublishArticle: vi.fn(),
    cancelScheduleArticle: vi.fn(),
    unarchiveArticle: vi.fn(),
}))

const mockArticles: ArticleDetail[] = [
    {
        id: 1,
        slug: 'draft-post',
        title: 'Draft Post',
        status: 'DRAFT',
        accessPolicy: 'FREE',
        publishedAt: null,
        body: 'Draft content',
        excerpt: null,
        seoDescription: null,
        heroAssetId: null,
        requiredLevelSortOrder: null,
        scheduledAt: null,
        categories: [],
    },
    {
        id: 2,
        slug: 'published-post',
        title: 'Published Post',
        status: 'PUBLISHED',
        accessPolicy: 'FREE',
        publishedAt: '2026-08-01T12:00:00Z',
        body: 'Published content',
        excerpt: null,
        seoDescription: null,
        heroAssetId: null,
        requiredLevelSortOrder: null,
        scheduledAt: null,
        categories: [],
    },
    {
        id: 3,
        slug: 'scheduled-post',
        title: 'Scheduled Post',
        status: 'SCHEDULED',
        accessPolicy: 'FREE',
        publishedAt: null,
        body: 'Scheduled content',
        excerpt: null,
        seoDescription: null,
        heroAssetId: null,
        requiredLevelSortOrder: null,
        scheduledAt: '2026-09-01T12:00:00Z',
        categories: [],
    },
    {
        id: 4,
        slug: 'archived-post',
        title: 'Archived Post',
        status: 'ARCHIVED',
        accessPolicy: 'FREE',
        publishedAt: null,
        body: 'Archived content',
        excerpt: null,
        seoDescription: null,
        heroAssetId: null,
        requiredLevelSortOrder: null,
        scheduledAt: null,
        categories: [],
    },
]

describe('ArticleListClient', () => {
    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
    })

    it('renders loaded articles and fetches only once on mount', async () => {
        vi.mocked(listArticles).mockResolvedValue(mockArticles)

        render(<ArticleListClient />)

        await waitFor(() => {
            expect(screen.getByText('Draft Post')).toBeInTheDocument()
            expect(screen.getByText('Published Post')).toBeInTheDocument()
            expect(screen.getByText('Scheduled Post')).toBeInTheDocument()
            expect(screen.getByText('Archived Post')).toBeInTheDocument()
        })

        expect(listArticles).toHaveBeenCalledWith('tenant.test')
        expect(screen.getByRole('button', {name: 'Zurückziehen'})).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Planung aufheben'})).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Wiederherstellen'})).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Veröffentlichen'})).toBeInTheDocument()
        expect(
            screen.getByRole('checkbox', {name: '„Scheduled Post“ auswählen'}),
        ).toHaveAttribute('aria-disabled', 'true')
        expect(
            screen.getByRole('checkbox', {name: '„Archived Post“ auswählen'}),
        ).toHaveAttribute('aria-disabled', 'true')
    })

    it('unpublishes a published article putting it back into draft', async () => {
        const user = userEvent.setup()
        vi.mocked(listArticles).mockResolvedValue(mockArticles)
        vi.mocked(unpublishArticle).mockResolvedValue({
            ...mockArticles[1],
            status: 'DRAFT',
            publishedAt: null,
        })

        render(<ArticleListClient />)

        await waitFor(() => {
            expect(screen.getByText('Published Post')).toBeInTheDocument()
        })

        const unpublishButton = screen.getByRole('button', {name: 'Zurückziehen'})
        await user.click(unpublishButton)

        await waitFor(() => {
            expect(unpublishArticle).toHaveBeenCalledWith('tenant.test', 2)
        })

        await waitFor(() => {
            expect(
                screen.getByText('Beitrag „Published Post“ wurde zurückgezogen (Entwurf).'),
            ).toBeInTheDocument()
        })
    })

    it('publishes a draft article from the list', async () => {
        const user = userEvent.setup()
        vi.mocked(listArticles).mockResolvedValue(mockArticles)
        vi.mocked(publishArticle).mockResolvedValue({
            ...mockArticles[0],
            status: 'PUBLISHED',
            publishedAt: '2026-08-30T12:00:00Z',
        })

        render(<ArticleListClient />)

        await waitFor(() => {
            expect(screen.getByText('Draft Post')).toBeInTheDocument()
        })

        await user.click(screen.getByRole('button', {name: 'Veröffentlichen'}))

        await waitFor(() => {
            expect(publishArticle).toHaveBeenCalledWith('tenant.test', 1)
        })

        await waitFor(() => {
            expect(
                screen.getByText('Beitrag „Draft Post“ wurde veröffentlicht.'),
            ).toBeInTheDocument()
        })
    })

    it('cancels scheduled publish putting the article back into draft', async () => {
        const user = userEvent.setup()
        vi.mocked(listArticles).mockResolvedValue(mockArticles)
        vi.mocked(cancelScheduleArticle).mockResolvedValue({
            ...mockArticles[2],
            status: 'DRAFT',
            scheduledAt: null,
        })

        render(<ArticleListClient />)

        await waitFor(() => {
            expect(screen.getByText('Scheduled Post')).toBeInTheDocument()
        })

        const cancelScheduleButton = screen.getByRole('button', {name: 'Planung aufheben'})
        await user.click(cancelScheduleButton)

        await waitFor(() => {
            expect(cancelScheduleArticle).toHaveBeenCalledWith('tenant.test', 3)
        })

        await waitFor(() => {
            expect(
                screen.getByText('Planung für „Scheduled Post“ wurde aufgehoben (Entwurf).'),
            ).toBeInTheDocument()
        })
    })

    it('unarchives an archived article putting it back into draft', async () => {
        const user = userEvent.setup()
        vi.mocked(listArticles).mockResolvedValue(mockArticles)
        vi.mocked(unarchiveArticle).mockResolvedValue({
            ...mockArticles[3],
            status: 'DRAFT',
        })

        render(<ArticleListClient />)

        await waitFor(() => {
            expect(screen.getByText('Archived Post')).toBeInTheDocument()
        })

        const unarchiveButton = screen.getByRole('button', {name: 'Wiederherstellen'})
        await user.click(unarchiveButton)

        await waitFor(() => {
            expect(unarchiveArticle).toHaveBeenCalledWith('tenant.test', 4)
        })

        await waitFor(() => {
            expect(
                screen.getByText('Beitrag „Archived Post“ wurde wiederhergestellt (Entwurf).'),
            ).toBeInTheDocument()
        })
    })

    it('bulk publishes selected draft articles', async () => {
        const user = userEvent.setup()
        vi.mocked(listArticles).mockResolvedValue(mockArticles)
        vi.mocked(publishArticle).mockResolvedValue({
            ...mockArticles[0],
            status: 'PUBLISHED',
            publishedAt: '2026-08-30T12:00:00Z',
        })

        render(<ArticleListClient />)

        await waitFor(() => {
            expect(screen.getByText('Draft Post')).toBeInTheDocument()
        })

        await user.click(screen.getByRole('checkbox', {name: '„Draft Post“ auswählen'}))

        await waitFor(() => {
            expect(screen.getByText('1 ausgewählt')).toBeInTheDocument()
        })

        await user.click(screen.getByRole('button', {name: '1 veröffentlichen'}))

        await waitFor(() => {
            expect(publishArticle).toHaveBeenCalledWith('tenant.test', 1)
        })

        await waitFor(() => {
            expect(screen.getByText('1 Beitrag wurde veröffentlicht.')).toBeInTheDocument()
        })
    })

    it('bulk unpublishes selected published articles', async () => {
        const user = userEvent.setup()
        vi.mocked(listArticles).mockResolvedValue(mockArticles)
        vi.mocked(unpublishArticle).mockResolvedValue({
            ...mockArticles[1],
            status: 'DRAFT',
            publishedAt: null,
        })

        render(<ArticleListClient />)

        await waitFor(() => {
            expect(screen.getByText('Published Post')).toBeInTheDocument()
        })

        await user.click(screen.getByRole('checkbox', {name: '„Published Post“ auswählen'}))

        await waitFor(() => {
            expect(screen.getByText('1 ausgewählt')).toBeInTheDocument()
        })

        await user.click(screen.getByRole('button', {name: '1 zurückziehen'}))

        await waitFor(() => {
            expect(unpublishArticle).toHaveBeenCalledWith('tenant.test', 2)
        })

        await waitFor(() => {
            expect(
                screen.getByText('1 Beitrag wurde zurückgezogen (Entwurf).'),
            ).toBeInTheDocument()
        })
    })

    it('switches to grid view', async () => {
        const user = userEvent.setup()
        vi.mocked(listArticles).mockResolvedValue(mockArticles)

        render(<ArticleListClient />)

        await waitFor(() => {
            expect(screen.getByText('Draft Post')).toBeInTheDocument()
        })

        await user.click(screen.getByRole('button', {name: 'Raster'}))

        expect(screen.getByRole('button', {name: 'Raster'})).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', {name: 'Liste'})).toHaveAttribute('aria-pressed', 'false')
    })

    it('renders empty state when there are no articles', async () => {
        vi.mocked(listArticles).mockResolvedValue([])

        render(<ArticleListClient />)

        await waitFor(() => {
            expect(screen.getByText('Noch keine Beiträge')).toBeInTheDocument()
            expect(
                screen.getByRole('button', {name: 'Ersten Beitrag schreiben'}),
            ).toBeInTheDocument()
        })
    })

    it('displays error message when unpublish fails', async () => {
        const user = userEvent.setup()
        vi.mocked(listArticles).mockResolvedValue(mockArticles)
        vi.mocked(unpublishArticle).mockRejectedValue(new Error('Server error'))

        render(<ArticleListClient />)

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Zurückziehen'})).toBeInTheDocument()
        })

        await user.click(screen.getByRole('button', {name: 'Zurückziehen'}))

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Server error')
        })
    })
})
