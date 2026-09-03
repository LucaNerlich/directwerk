import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, describe, expect, it, vi} from 'vitest'

import ArticleListClient from '@/components/write/ArticleListClient'
import {listCategories, replaceArticleCategories} from '@/lib/api/catalogApi'
import {
    cancelScheduleArticle,
    deleteArticle,
    listArticles,
    publishArticle,
    unarchiveArticle,
    unpublishArticle,
    updateArticle,
} from '@/lib/api/writeApi'
import type {ArticleDetail} from '@directwerk/api/types'

const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: mockReplace,
    }),
}))

vi.mock('@directwerk/api/auth/useAuthRequired', () => {
    // Stable like the production hook (useCallback): a fresh closure per
    // render would change `load` identity and refetch after every render.
    const authRedirect = () => false
    return {useAuthRequired: () => authRedirect}
})

vi.mock('@directwerk/api/tenant', () => ({
    getClientTenantHost: () => 'tenant.test',
}))

vi.mock('@/lib/api/writeApi', () => ({
    listArticles: vi.fn(),
    publishArticle: vi.fn(),
    unpublishArticle: vi.fn(),
    cancelScheduleArticle: vi.fn(),
    unarchiveArticle: vi.fn(),
    updateArticle: vi.fn(),
    deleteArticle: vi.fn(),
}))

vi.mock('@/lib/api/catalogApi', () => ({
    listCategories: vi.fn(),
    replaceArticleCategories: vi.fn(),
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
        categories: [{id: 11, slug: 'interview', name: 'Interview'}],
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
        categories: [{id: 12, slug: 'news', name: 'News'}],
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
        expect(screen.getByText('Interview')).toBeInTheDocument()
        expect(screen.getByText('News')).toBeInTheDocument()
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

    it('bulk applies categories to selected draft articles skipping published ones', async () => {
        const user = userEvent.setup()
        vi.mocked(listArticles).mockResolvedValue(mockArticles)
        vi.mocked(listCategories).mockResolvedValue([
            {id: 21, slug: 'news', name: 'News', parentId: null, active: true},
            {id: 22, slug: 'stories', name: 'Stories', parentId: null, active: true},
        ])
        vi.mocked(replaceArticleCategories).mockImplementation(
            async (_tenantHost, articleId) => {
                const article = mockArticles.find((entry) => entry.id === articleId)
                if (article === undefined) {
                    throw new Error('unknown article')
                }
                return {...article, categories: [{id: 21, slug: 'news', name: 'News'}]}
            },
        )

        render(<ArticleListClient />)

        await waitFor(() => {
            expect(screen.getByText('Draft Post')).toBeInTheDocument()
        })

        await user.click(screen.getByRole('checkbox', {name: '„Draft Post“ auswählen'}))
        await user.click(screen.getByRole('checkbox', {name: '„Published Post“ auswählen'}))

        await waitFor(() => {
            expect(screen.getByText('2 ausgewählt')).toBeInTheDocument()
        })

        await user.click(screen.getByRole('button', {name: 'Bearbeiten…'}))

        expect(await screen.findByRole('dialog')).toBeInTheDocument()
        expect(
            await screen.findByText(
                '1 von 2 ausgewählten Beiträgen sind Entwürfe — veröffentlichte Beiträge werden übersprungen.',
            ),
        ).toBeInTheDocument()

        await user.click(await screen.findByRole('radio', {name: 'Kategorien'}))
        await user.click(await screen.findByRole('checkbox', {name: 'News'}))
        await user.click(screen.getByRole('button', {name: 'Anwenden'}))

        await waitFor(() => {
            expect(replaceArticleCategories).toHaveBeenCalledTimes(1)
        })
        expect(replaceArticleCategories).toHaveBeenCalledWith('tenant.test', 1, [21])
        expect(updateArticle).not.toHaveBeenCalled()

        await waitFor(() => {
            expect(screen.getByText('1 Beitrag aktualisiert.')).toBeInTheDocument()
        })
    })

    it('offers bulk edit for published-only selections but disables apply', async () => {        const user = userEvent.setup()
        vi.mocked(listArticles).mockResolvedValue(mockArticles)
        vi.mocked(listCategories).mockResolvedValue([
            {id: 21, slug: 'news', name: 'News', parentId: null, active: true},
        ])

        render(<ArticleListClient />)

        await waitFor(() => {
            expect(screen.getByText('Draft Post')).toBeInTheDocument()
        })

        await user.click(screen.getByRole('checkbox', {name: '„Published Post“ auswählen'}))

        await waitFor(() => {
            expect(screen.getByText('1 ausgewählt')).toBeInTheDocument()
        })

        await user.click(screen.getByRole('button', {name: 'Bearbeiten…'}))

        expect(await screen.findByRole('dialog')).toBeInTheDocument()
        expect(
            await screen.findByText(
                '0 von 1 ausgewählten Beiträgen sind Entwürfe — veröffentlichte Beiträge werden übersprungen.',
            ),
        ).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Anwenden'})).toBeDisabled()
        expect(replaceArticleCategories).not.toHaveBeenCalled()
        expect(updateArticle).not.toHaveBeenCalled()
    })

    it('deletes a draft article after simple confirmation', async () => {
        const user = userEvent.setup()
        vi.mocked(listArticles).mockResolvedValue(mockArticles)
        vi.mocked(deleteArticle).mockResolvedValue(undefined)

        render(<ArticleListClient />)

        await waitFor(() => {
            expect(screen.getByText('Draft Post')).toBeInTheDocument()
        })

        const deleteButtons = screen.getAllByRole('button', {name: /löschen/i})
        await user.click(deleteButtons[0])

        await waitFor(() => {
            expect(screen.getByText('Beitrag löschen?')).toBeInTheDocument()
        })
        await user.click(screen.getByRole('button', {name: 'Löschen' }))

        await waitFor(() => {
            expect(deleteArticle).toHaveBeenCalledWith('tenant.test', 1)
        })

        await waitFor(() => {
            expect(
                screen.getByText('Beitrag „Draft Post“ wurde gelöscht.'),
            ).toBeInTheDocument()
        })
        expect(screen.queryByText('Draft Post')).not.toBeInTheDocument()
    })

    it('requires typing the slug to delete a published article', async () => {
        const user = userEvent.setup()
        vi.mocked(listArticles).mockResolvedValue(mockArticles)
        vi.mocked(deleteArticle).mockResolvedValue(undefined)

        render(<ArticleListClient />)

        await waitFor(() => {
            expect(screen.getByText('Published Post')).toBeInTheDocument()
        })

        await user.click(
            screen.getByRole('button', {name: '„Published Post“ löschen'}),
        )

        const confirmButton = await screen.findByRole('button', {
            name: 'Endgültig löschen',
        })
        expect(confirmButton).toBeDisabled()

        await user.type(
            screen.getByLabelText('Slug zur Bestätigung'),
            'published-post',
        )
        await user.click(confirmButton)

        await waitFor(() => {
            expect(deleteArticle).toHaveBeenCalledWith('tenant.test', 2)
        })
    })

    it('shows a German error when deleting fails and keeps the article', async () => {
        const user = userEvent.setup()
        vi.mocked(listArticles).mockResolvedValue(mockArticles)
        vi.mocked(deleteArticle).mockRejectedValue(
            new Error('Beitrag konnte nicht gelöscht werden.'),
        )

        render(<ArticleListClient />)

        await waitFor(() => {
            expect(screen.getByText('Draft Post')).toBeInTheDocument()
        })

        const deleteButtons = screen.getAllByRole('button', {name: /löschen/i})
        await user.click(deleteButtons[0])

        await waitFor(() => {
            expect(screen.getByText('Beitrag löschen?')).toBeInTheDocument()
        })
        await user.click(screen.getByRole('button', {name: 'Löschen' }))

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Beitrag konnte nicht gelöscht werden.',
            )
        })
        expect(screen.getByText('Draft Post')).toBeInTheDocument()
    })
})
