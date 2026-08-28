import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import ArticleEditor from '@/components/write/ArticleEditor'

const mockRouter = {replace: vi.fn()}
vi.mock('next/navigation', () => ({useRouter: () => mockRouter}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/site/SiteConfigProvider', () => ({
    useSiteConfig: () => ({enabledModules: [], emailNotifyAvailable: false, publicRssUrl: null}),
}))
vi.mock('@/lib/auth/MeProvider', () => ({
    useOptionalMe: () => null,
}))

const getArticle = vi.fn().mockResolvedValue({
    id: 1, slug: 'beitrag', title: 'Beitrag', status: 'DRAFT', accessPolicy: 'FREE', publishedAt: null,
    body: null, excerpt: null, seoDescription: null, heroAssetId: null,
    requiredLevelSortOrder: null, scheduledAt: null, categories: [],
})
const updateArticle = vi.fn().mockResolvedValue({
    id: 1, slug: 'beitrag', title: 'Beitrag', status: 'DRAFT', accessPolicy: 'FREE', publishedAt: null,
    body: null, excerpt: null, seoDescription: null, heroAssetId: null,
    requiredLevelSortOrder: null, scheduledAt: null, categories: [],
})
const listPublicLevels = vi.fn().mockResolvedValue([
    {id: 1, slug: 'fan', title: 'Fan', sortOrder: 10},
    {id: 2, slug: 'supporter', title: 'Supporter', sortOrder: 20},
])

const replaceArticleCategories = vi.fn().mockResolvedValue({
    id: 1, slug: 'beitrag', title: 'Beitrag', status: 'DRAFT', accessPolicy: 'FREE', publishedAt: null,
    body: null, excerpt: null, seoDescription: null, heroAssetId: null,
    requiredLevelSortOrder: null, scheduledAt: null,
    categories: [{id: 1, slug: 'news', name: 'News'}],
})

vi.mock('@/lib/api/tenantApi', () => ({
    getArticle: (...args: unknown[]) => getArticle(...args),
    updateArticle: (...args: unknown[]) => updateArticle(...args),
    listArticles: vi.fn().mockResolvedValue([]),
    listPublicLevels: (...args: unknown[]) => listPublicLevels(...args),
    listCategories: vi.fn().mockResolvedValue([
        {id: 1, slug: 'news', name: 'News', parentId: null, active: true},
    ]),
    replaceArticleCategories: (...args: unknown[]) => replaceArticleCategories(...args),
    listMedia: vi.fn().mockResolvedValue([]),
    getMediaPreviewUrl: vi.fn(),
    suggestSlug: (title: string) => title.toLowerCase(),
}))

describe('ArticleEditor tagging', () => {
    it('persists selected categories on save', async () => {
        const user = userEvent.setup()
        render(<ArticleEditor articleId={1} />)

        await waitFor(() => expect(screen.getByLabelText('News')).toBeInTheDocument())
        await user.click(screen.getByLabelText('News'))
        await user.click(screen.getByRole('button', {name: 'Speichern'}))

        await waitFor(() =>
            expect(replaceArticleCategories).toHaveBeenCalledWith('tenant.test', 1, [1]),
        )
    })

    it('disables Mindest-Stufe for free articles', async () => {
        render(<ArticleEditor articleId={1} />)

        await waitFor(() => expect(screen.getByRole('combobox')).toBeDisabled())
        expect(
            screen.getByText(/Nur relevant für kostenpflichtige Beiträge/),
        ).toBeInTheDocument()
    })

    it('offers the level catalog when the article is paid', async () => {
        getArticle.mockResolvedValueOnce({
            id: 1, slug: 'beitrag', title: 'Beitrag', status: 'DRAFT', accessPolicy: 'PAID', publishedAt: null,
            body: null, excerpt: null, seoDescription: null, heroAssetId: null,
            requiredLevelSortOrder: null, scheduledAt: null, categories: [],
        })
        render(<ArticleEditor articleId={1} />)

        expect(
            await screen.findByRole('option', {name: 'Öffentlich / Keine Mindeststufe'}),
        ).toBeInTheDocument()
        expect(screen.getByRole('option', {name: 'Fan (10)'})).toBeInTheDocument()
    })
})
