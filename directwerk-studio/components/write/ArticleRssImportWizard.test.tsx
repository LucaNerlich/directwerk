import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import ArticleRssImportWizard from '@/components/write/ArticleRssImportWizard'
import {MeProvider} from '@/lib/auth/MeProvider'
import type {ArticleRssImportPreview, Me} from '@directwerk/api/types'

const previewArticleRssFeed = vi.fn()
const importRssArticle = vi.fn()
const bulkImportArticleRss = vi.fn()
const ingestRemoteAssetWithProgress = vi.fn()
const listCategories = vi.fn()
const createCategory = vi.fn()
const deleteMedia = vi.fn()

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('next/link', () => ({
    default: ({children, href}: {children: React.ReactNode; href: string}) => (
        <a href={href}>{children}</a>
    ),
}))
vi.mock('@directwerk/api/auth/useAuthRequired', () => ({
    useAuthRequired: () => () => false,
}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/catalogApi', () => ({
    listCategories: (...args: unknown[]) => listCategories(...args),
    createCategory: (...args: unknown[]) => createCategory(...args),
}))
vi.mock('@/lib/media/remoteIngest', () => ({
    ingestRemoteAssetWithProgress: (...args: unknown[]) => ingestRemoteAssetWithProgress(...args),
}))
vi.mock('@/lib/api/articleImportApi', () => ({
    previewArticleRssFeed: (...args: unknown[]) => previewArticleRssFeed(...args),
    importRssArticle: (...args: unknown[]) => importRssArticle(...args),
    bulkImportArticleRss: (...args: unknown[]) => bulkImportArticleRss(...args),
}))
vi.mock('@/lib/api/mediaApi', () => ({
    deleteMedia: (...args: unknown[]) => deleteMedia(...args),
}))
vi.mock('@/lib/api/subscriptionApi', () => ({
    listPublicLevels: vi.fn().mockResolvedValue([
        {id: 1, slug: 'fan', title: 'Fan', sortOrder: 10},
    ]),
}))

const preview: ArticleRssImportPreview = {
    feedUrl: 'https://cdn.example.com/articles.xml',
    channel: {
        title: 'M10Z',
        description: 'Articles',
        language: 'de',
        imageUrl: null,
        link: 'https://m10z.de',
        suggestedSlug: 'm10z',
    },
    articles: [
        {
            guid: 'guid-1',
            title: 'Artikel 1',
            body: '<p>Body 1</p>',
            excerpt: 'Teaser 1',
            publishedAt: '2026-07-20T12:00:00Z',
            imageUrl: 'https://cdn.example.com/a1.jpg',
            suggestedSlug: 'artikel-1',
            alreadyImportedArticleId: null,
        },
        {
            guid: 'guid-2',
            title: 'Artikel 2',
            body: '<p>Body 2</p>',
            excerpt: null,
            publishedAt: null,
            imageUrl: null,
            suggestedSlug: 'artikel-2',
            alreadyImportedArticleId: null,
        },
    ],
    truncated: false,
}

const adminMe: Me = {
    userId: 1,
    email: 'admin@example.com',
    name: 'Admin',
    roles: ['TENANT_ADMIN'],
    tenantId: 10,
}

function renderWizard(): void {
    render(
        <MeProvider me={adminMe}>
            <ArticleRssImportWizard />
        </MeProvider>,
    )
}

describe('ArticleRssImportWizard', () => {
    beforeEach(() => {
        listCategories.mockResolvedValue([])
        previewArticleRssFeed.mockResolvedValue(preview)
        importRssArticle.mockResolvedValue({
            article: {id: 42, slug: 'artikel-1', title: 'Artikel 1', status: 'DRAFT'},
            alreadyImported: false,
        })
        bulkImportArticleRss.mockResolvedValue({
            jobId: 'job-1',
            totalArticles: 2,
            alreadyImported: 0,
            notifyEmail: 'admin@example.com',
        })
        ingestRemoteAssetWithProgress.mockResolvedValue({
            id: 9,
            status: 'READY',
            assetType: 'IMAGE',
        })
    })

    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
    })

    it('imports one article after preview and category step', async () => {
        const user = userEvent.setup()
        renderWizard()
        await screen.findByText('RSS-Import')

        await user.type(screen.getByPlaceholderText('https://beispiel.de/rss.xml'), preview.feedUrl)
        await user.click(screen.getByRole('button', {name: 'Feed prüfen'}))
        await screen.findByText('M10Z')
        await user.click(screen.getByRole('button', {name: 'Weiter zu den Beiträgen'}))
        await screen.findByText('Beitrag 1 von 2')
        await user.click(screen.getByRole('button', {name: 'Diesen Beitrag importieren'}))

        await waitFor(() => {
            expect(ingestRemoteAssetWithProgress).toHaveBeenCalled()
            expect(importRssArticle).toHaveBeenCalledWith(
                'tenant.test',
                expect.objectContaining({
                    guid: 'guid-1',
                    heroAssetId: 9,
                    importInlineImages: true,
                }),
            )
        })
        await screen.findByText('Beitrag 2 von 2')
    })

    it('queues bulk import without per-item import', async () => {
        const user = userEvent.setup()
        renderWizard()
        await screen.findByText('RSS-Import')

        await user.type(screen.getByPlaceholderText('https://beispiel.de/rss.xml'), preview.feedUrl)
        await user.click(screen.getByRole('button', {name: 'Feed prüfen'}))
        await screen.findByText('M10Z')
        await user.click(
            screen.getByRole('button', {name: '2 Beiträge als Hintergrund-Job importieren'}),
        )

        await waitFor(() => {
            expect(bulkImportArticleRss).toHaveBeenCalledWith('tenant.test', {
                feedUrl: preview.feedUrl,
                categoryIds: [],
                accessPolicy: 'FREE',
                requiredLevelSortOrder: undefined,
                importHero: true,
                importInlineImages: true,
            })
        })
        expect(importRssArticle).not.toHaveBeenCalled()
        await screen.findByText('Stapelimport gestartet')
    })
})
