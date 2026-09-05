import {cleanup, renderHook, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {useAccountDashboard} from '@/lib/account/useAccountDashboard'

const router = {replace: vi.fn()}
const getAccess = vi.fn()
const getMe = vi.fn()
const getNotificationPreferences = vi.fn()
const getSiteConfig = vi.fn()
const listMyArticleFeeds = vi.fn()
const listMyFeeds = vi.fn()
const listMySubscriptions = vi.fn()

vi.mock('next/navigation', () => ({useRouter: () => router}))
vi.mock('@/lib/tenant/clientHost', () => ({
    getClientTenantHost: () => 'tenant.example',
}))
vi.mock('@/lib/api/client', () => ({
    createPortalSession: vi.fn(),
    getAccess: (...args: unknown[]) => getAccess(...args),
    getMe: (...args: unknown[]) => getMe(...args),
    getNotificationPreferences: (...args: unknown[]) =>
        getNotificationPreferences(...args),
    getSiteConfig: (...args: unknown[]) => getSiteConfig(...args),
    listMyArticleFeeds: (...args: unknown[]) => listMyArticleFeeds(...args),
    listMyFeeds: (...args: unknown[]) => listMyFeeds(...args),
    listMySubscriptions: (...args: unknown[]) => listMySubscriptions(...args),
    updateNotificationPreferences: vi.fn(),
}))

const podcastFeed = {
    id: 1,
    title: 'Podcast privat',
    isDefault: true,
    enabled: true,
    url: 'https://tenant.example/feeds/tenant/u/podcast.xml',
    formatIds: [],
    formats: [],
    createdAt: '2026-08-01T12:00:00Z',
    updatedAt: '2026-08-01T12:00:00Z',
}

const articleFeed = {
    id: 2,
    title: 'Beiträge privat',
    isDefault: true,
    enabled: true,
    url: 'https://tenant.example/feeds/tenant/articles/u/article.xml',
    categoryIds: [],
    categories: [],
    createdAt: '2026-08-01T12:00:00Z',
    updatedAt: '2026-08-01T12:00:00Z',
}

beforeEach(() => {
    getMe.mockResolvedValue({
        data: {
            email: 'reader@example.com',
            name: 'Reader',
            roles: ['SUBSCRIBER'],
            tenantId: 1,
        },
    })
    getAccess.mockResolvedValue({
        data: {
            activeLevels: [],
            maxLevelSortOrder: null,
            activePackages: [],
            roles: ['SUBSCRIBER'],
            tenantId: 1,
        },
    })
    getNotificationPreferences.mockResolvedValue({
        emailNotificationsEnabled: true,
        emailNotifyAvailable: true,
    })
    listMySubscriptions.mockResolvedValue([])
    listMyFeeds.mockResolvedValue([podcastFeed])
    listMyArticleFeeds.mockResolvedValue([articleFeed])
})

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe('useAccountDashboard', () => {
    it('loads podcast and article feeds when both RSS modules are enabled', async () => {
        getSiteConfig.mockResolvedValue({
            data: {
                enabledModules: [
                    'PODCAST_RSS',
                    'ARTICLE_RSS',
                    'SUBSCRIPTION',
                ],
                publicRssUrl: 'https://tenant.example/feeds/tenant/podcast.xml',
                publicArticleRssUrl:
                    'https://tenant.example/feeds/tenant/articles.xml',
            },
        })

        const {result} = renderHook(() => useAccountDashboard())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(listMyFeeds).toHaveBeenCalledWith('tenant.example')
        expect(listMyArticleFeeds).toHaveBeenCalledWith('tenant.example')
        expect(result.current.feeds).toEqual([podcastFeed])
        expect(result.current.articleFeeds).toEqual([articleFeed])
        expect(result.current.publicArticleRssUrl).toBe(
            'https://tenant.example/feeds/tenant/articles.xml',
        )
    })

    it('does not call private feed endpoints when subscriptions are disabled', async () => {
        getSiteConfig.mockResolvedValue({
            data: {
                enabledModules: ['PODCAST_RSS', 'ARTICLE_RSS'],
                publicRssUrl: 'https://tenant.example/feeds/tenant/podcast.xml',
                publicArticleRssUrl:
                    'https://tenant.example/feeds/tenant/articles.xml',
            },
        })

        const {result} = renderHook(() => useAccountDashboard())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(listMyFeeds).not.toHaveBeenCalled()
        expect(listMyArticleFeeds).not.toHaveBeenCalled()
        expect(result.current.feeds).toEqual([])
        expect(result.current.articleFeeds).toEqual([])
    })

    it('loads only article feeds for an article-only tenant', async () => {
        getSiteConfig.mockResolvedValue({
            data: {
                enabledModules: ['ARTICLE_RSS', 'SUBSCRIPTION'],
                publicRssUrl: null,
                publicArticleRssUrl:
                    'https://tenant.example/feeds/tenant/articles.xml',
            },
        })

        const {result} = renderHook(() => useAccountDashboard())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(listMyFeeds).not.toHaveBeenCalled()
        expect(listMyArticleFeeds).toHaveBeenCalledWith('tenant.example')
        expect(result.current.feeds).toEqual([])
        expect(result.current.articleFeeds).toEqual([articleFeed])
    })

    it('keeps account data and public feeds when one private feed request fails', async () => {
        getSiteConfig.mockResolvedValue({
            data: {
                enabledModules: [
                    'PODCAST_RSS',
                    'ARTICLE_RSS',
                    'SUBSCRIPTION',
                ],
                publicRssUrl: 'https://tenant.example/feeds/tenant/podcast.xml',
                publicArticleRssUrl:
                    'https://tenant.example/feeds/tenant/articles.xml',
            },
        })
        listMyArticleFeeds.mockRejectedValueOnce(new Error('Article feed unavailable'))

        const {result} = renderHook(() => useAccountDashboard())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.me?.email).toBe('reader@example.com')
        expect(result.current.feeds).toEqual([podcastFeed])
        expect(result.current.articleFeeds).toEqual([])
        expect(result.current.publicArticleRssUrl).toBe(
            'https://tenant.example/feeds/tenant/articles.xml',
        )
        expect(result.current.error).toBe(
            'Einige private Feeds konnten nicht geladen werden.',
        )
    })

    it('skips subscriptions without failing when the module is disabled', async () => {
        getSiteConfig.mockResolvedValue({
            data: {
                enabledModules: ['PODCAST_RSS', 'ARTICLE_RSS'],
                publicRssUrl: 'https://tenant.example/feeds/tenant/podcast.xml',
                publicArticleRssUrl:
                    'https://tenant.example/feeds/tenant/articles.xml',
            },
        })

        const {result} = renderHook(() => useAccountDashboard())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(listMySubscriptions).not.toHaveBeenCalled()
        expect(result.current.me?.email).toBe('reader@example.com')
        expect(result.current.subscriptions).toEqual([])
        expect(result.current.error).toBeNull()
    })
})
