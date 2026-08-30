import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {cleanup} from '@testing-library/react'

import FeedManagementClient from '@/components/podcast/FeedManagementClient'
import type {SiteConfig} from '@directwerk/api/types'
import {SiteConfigProvider} from '@/lib/site/SiteConfigProvider'

const mockRouter = {replace: vi.fn()}

vi.mock('next/navigation', () => ({useRouter: () => mockRouter}))

const listSeriesMock = vi.fn()
const listSubscriberFeedsMock = vi.fn()
const setSubscriberFeedEnabledMock = vi.fn()

vi.mock('@directwerk/api/tenant', () => ({
    getClientTenantHost: () => 'tenant.test',
}))
vi.mock('@/lib/api/podcastApi', () => ({
    listSeries: (...args: unknown[]) => listSeriesMock(...args),
}))
vi.mock('@/lib/api/subscriptionApi', () => ({
    listSubscriberFeeds: (...args: unknown[]) => listSubscriberFeedsMock(...args),
    setSubscriberFeedEnabled: (...args: unknown[]) => setSubscriberFeedEnabledMock(...args),
}))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

function config(overrides: Partial<SiteConfig> = {}): SiteConfig {
    return {
        tenant: {slug: 'tenant', name: 'Demo'},
        enabledModules: ['PODCAST', 'PODCAST_RSS', 'SUBSCRIPTION'],
        branding: {siteTitle: null, primaryColor: null, secondaryColor: null, logoUrl: null},
        publicSiteUrl: 'https://demo.example',
        publicRssUrl: 'https://demo.example/feeds/demo/podcast.xml',
        studioHome: 'PODCAST_DESK',
        studioDesks: ['PODCAST'],
        analytics: null,
        emailNotifyAvailable: false,
        ...overrides,
    }
}

describe('FeedManagementClient', () => {
    it('shows the tenant feed, series feeds and subscriber feeds', async () => {
        listSeriesMock.mockResolvedValue([
            {
                id: 1,
                slug: 'show',
                title: 'Meine Sendung',
                status: 'PUBLISHED',
                rssUrl: 'https://demo.example/feeds/demo/show.xml',
            },
            {
                id: 2,
                slug: 'draft',
                title: 'Noch nicht live',
                status: 'DRAFT',
                rssUrl: null,
            },
        ])
        listSubscriberFeedsMock.mockResolvedValue([
            {
                id: 42,
                userId: 7,
                userEmail: 'sub@example.test',
                title: 'Demo Private Feed',
                isDefault: true,
                enabled: true,
                formatIds: [],
                formats: [],
                createdAt: '2026-07-20T12:00:00Z',
                updatedAt: '2026-07-20T12:00:00Z',
            },
            {
                id: 43,
                userId: 7,
                userEmail: 'sub@example.test',
                title: 'Nur Interviews',
                isDefault: false,
                enabled: true,
                formatIds: [3],
                formats: [{id: 3, slug: 'interview', name: 'Interview'}],
                createdAt: '2026-07-20T12:00:00Z',
                updatedAt: '2026-07-20T12:00:00Z',
            },
        ])

        render(
            <SiteConfigProvider config={config()}>
                <FeedManagementClient />
            </SiteConfigProvider>,
        )

        await waitFor(() =>
            expect(screen.getByText('Allgemeiner Feed')).toBeInTheDocument(),
        )
        expect(screen.getByText('Meine Sendung')).toBeInTheDocument()
        expect(screen.getByText('Noch nicht live')).toBeInTheDocument()
        expect(
            screen.getByRole('link', {name: 'Sendung veröffentlichen'}),
        ).toHaveAttribute('href', '/podcast/series/2')
        expect(screen.getAllByText('sub@example.test')).toHaveLength(2)
        expect(screen.getByText(/Eigener Feed/)).toBeInTheDocument()
        expect(screen.getByText(/· Interview/)).toBeInTheDocument()
        expect(screen.getAllByRole('button', {name: 'Raster'})).toHaveLength(1)
        const openLinks = screen.getAllByRole('link', {name: 'Öffnen'})
        expect(openLinks).toHaveLength(2)
        expect(openLinks[0]).toHaveAttribute(
            'href',
            'https://demo.example/feeds/demo/podcast.xml',
        )
        expect(openLinks[1]).toHaveAttribute(
            'href',
            'https://demo.example/feeds/demo/show.xml',
        )
    })

    it('hides the subscriber section when SUBSCRIPTION is not enabled', async () => {
        listSeriesMock.mockResolvedValue([])
        listSubscriberFeedsMock.mockResolvedValue([])

        render(
            <SiteConfigProvider
                config={config({enabledModules: ['PODCAST', 'PODCAST_RSS']})}
            >
                <FeedManagementClient />
            </SiteConfigProvider>,
        )

        await waitFor(() =>
            expect(screen.getByText('Allgemeiner Feed')).toBeInTheDocument(),
        )
        expect(listSubscriberFeedsMock).not.toHaveBeenCalled()
        expect(
            screen.queryByText('Abonnenten-Feeds'),
        ).not.toBeInTheDocument()
    })

    it('toggles a subscriber feed via the API', async () => {
        const original = {
            id: 42,
            userId: 7,
            userEmail: 'sub@example.test',
            title: 'Demo Private Feed',
            isDefault: true,
            enabled: true,
            formatIds: [],
            formats: [],
            createdAt: '2026-07-20T12:00:00Z',
            updatedAt: '2026-07-20T12:00:00Z',
        }
        listSeriesMock.mockResolvedValue([])
        listSubscriberFeedsMock.mockResolvedValue([original])
        setSubscriberFeedEnabledMock.mockResolvedValue({...original, enabled: false})

        render(
            <SiteConfigProvider config={config()}>
                <FeedManagementClient />
            </SiteConfigProvider>,
        )

        await waitFor(() =>
            expect(screen.getByText('sub@example.test')).toBeInTheDocument(),
        )
        await userEvent.click(screen.getByRole('button', {name: 'Deaktivieren'}))

        await waitFor(() =>
            expect(setSubscriberFeedEnabledMock).toHaveBeenCalledWith(
                'tenant.test',
                42,
                false,
            ),
        )
        await waitFor(() =>
            expect(screen.getByText('Deaktiviert')).toBeInTheDocument(),
        )
        expect(screen.getByRole('button', {name: 'Aktivieren'})).toBeInTheDocument()
    })
})
