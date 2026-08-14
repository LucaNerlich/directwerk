import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import ArticleEditor from '@/components/write/ArticleEditor'

// `useRouter()` in Next.js returns a stable/memoized object across re-renders.
// The load effect depends on `router` (see ArticleEditor.tsx), so the mock must
// return the same object reference on every call, or an unstable mock would
// re-trigger that effect on every render and reset in-progress tag selections.
const mockRouter = {replace: vi.fn()}
vi.mock('next/navigation', () => ({useRouter: () => mockRouter}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/site/SiteConfigProvider', () => ({
    useSiteConfig: () => ({enabledModules: [], emailNotifyAvailable: false}),
}))

const replaceArticleCategories = vi.fn().mockResolvedValue({
    id: 1, slug: 'beitrag', title: 'Beitrag', status: 'DRAFT', accessPolicy: 'FREE', publishedAt: null,
    body: null, excerpt: null, seoDescription: null, heroAssetId: null,
    requiredLevelSortOrder: null, scheduledAt: null,
    categories: [{id: 1, slug: 'news', name: 'News'}],
})

vi.mock('@/lib/api/tenantApi', () => ({
    getArticle: vi.fn().mockResolvedValue({
        id: 1, slug: 'beitrag', title: 'Beitrag', status: 'DRAFT', accessPolicy: 'FREE', publishedAt: null,
        body: null, excerpt: null, seoDescription: null, heroAssetId: null,
        requiredLevelSortOrder: null, scheduledAt: null, categories: [],
    }),
    listCategories: vi.fn().mockResolvedValue([
        {id: 1, slug: 'news', name: 'News', parentId: null, active: true},
    ]),
    replaceArticleCategories: (...args: unknown[]) => replaceArticleCategories(...args),
    listMedia: vi.fn().mockResolvedValue([]),
    getMediaPreviewUrl: vi.fn(),
    suggestSlug: (title: string) => title.toLowerCase(),
}))

describe('ArticleEditor tagging', () => {
    it('saves selected categories', async () => {
        const user = userEvent.setup()
        render(<ArticleEditor articleId={1} />)

        await waitFor(() => expect(screen.getByLabelText('News')).toBeInTheDocument())
        await user.click(screen.getByLabelText('News'))
        await user.click(screen.getByRole('button', {name: 'Kategorien speichern'}))

        await waitFor(() =>
            expect(replaceArticleCategories).toHaveBeenCalledWith('tenant.test', 1, [1]),
        )
    })
})
