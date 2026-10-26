import {cleanup, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import type {PublicSiteConfig, SubscriberFeedView} from '@directwerk/api/types'

import PrivateFeedOnboarding from '@/components/PrivateFeedOnboarding'
import {TestLocale} from '@/lib/i18n/testWrapper'
import {SiteConfigProvider} from '@/lib/site/SiteConfigProvider'

const listMyFeedsMock = vi.fn()
const listMyArticleFeedsMock = vi.fn()
const useSubscriberAuthMock = vi.fn()

vi.mock('@/lib/api/client', () => ({
    listMyFeeds: (...args: unknown[]) => listMyFeedsMock(...args),
    listMyArticleFeeds: (...args: unknown[]) => listMyArticleFeedsMock(...args),
}))

vi.mock('@/lib/auth/useSubscriberAuth', () => ({
    useSubscriberAuth: () => useSubscriberAuthMock(),
}))

vi.mock('@/lib/tenant/clientHost', () => ({
    getWebClientTenantHost: () => 'tenant.example',
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({replace: vi.fn(), push: vi.fn()}),
}))

vi.mock('@directwerk/api/auth/useAuthRequired', () => ({
    useAuthRequired: () => () => false,
}))

function feed(overrides: Partial<SubscriberFeedView> = {}): SubscriberFeedView {
    return {
        id: 1,
        title: 'Mein Standard-Feed',
        url: 'https://tenant.example/feeds/u/token123/podcast.xml',
        enabled: true,
        isDefault: true,
        formatIds: [],
        formats: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...overrides,
    }
}

function siteConfigWithModules(modules: string[]): PublicSiteConfig {
    return {enabledModules: modules} as unknown as PublicSiteConfig
}

function renderOnboarding(
    modules: string[],
    variant: 'full' | 'compact' = 'full',
): void {
    render(
        <TestLocale>
            <SiteConfigProvider config={siteConfigWithModules(modules)}>
                <PrivateFeedOnboarding enabled variant={variant} />
            </SiteConfigProvider>
        </TestLocale>,
    )
}

beforeEach(() => {
    listMyFeedsMock.mockReset()
    listMyArticleFeedsMock.mockReset()
    useSubscriberAuthMock.mockReturnValue({isAuthenticated: true})
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
})

describe('PrivateFeedOnboarding', () => {
    it('renders nothing when RSS modules are off', () => {
        const {container} = render(
            <TestLocale>
                <SiteConfigProvider config={siteConfigWithModules([])}>
                    <PrivateFeedOnboarding enabled />
                </SiteConfigProvider>
            </TestLocale>,
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('shows private podcast URL, app checklist, and howto when ready', async () => {
        listMyFeedsMock.mockResolvedValue([feed()])
        renderOnboarding(['PODCAST_RSS'])

        await waitFor(() => {
            expect(
                screen.getByRole('heading', {name: 'Privaten Feed hinzufügen'}),
            ).toBeInTheDocument()
        })
        expect(screen.getByText('Apple Podcasts')).toBeInTheDocument()
        expect(screen.getByText('Spotify')).toBeInTheDocument()
        expect(screen.getByText('AntennaPod')).toBeInTheDocument()
        expect(
            screen.getByRole('heading', {name: 'So hörst du in der Podcast-App'}),
        ).toBeInTheDocument()
        expect(screen.getByRole('button', {name: /Kopieren/i})).toBeInTheDocument()
        expect(
            screen.getByRole('link', {name: 'Feeds verwalten'}),
        ).toHaveAttribute('href', '/de/feeds?setup=1')
    })

    it('compact variant skips howto and app checklist', async () => {
        listMyFeedsMock.mockResolvedValue([feed()])
        renderOnboarding(['PODCAST_RSS'], 'compact')

        await waitFor(() => {
            expect(
                screen.getByRole('heading', {name: 'Dein privater Feed'}),
            ).toBeInTheDocument()
        })
        expect(screen.queryByText('Apple Podcasts')).not.toBeInTheDocument()
        expect(
            screen.queryByRole('heading', {name: 'So hörst du in der Podcast-App'}),
        ).not.toBeInTheDocument()
        expect(screen.getByRole('button', {name: /Kopieren/i})).toBeInTheDocument()
    })

    it('retries once then shows empty state when no default feed', async () => {
        listMyFeedsMock.mockResolvedValue([])
        renderOnboarding(['PODCAST_RSS'])

        await waitFor(() => {
            expect(screen.getByText('Privater Feed wird vorbereitet…')).toBeInTheDocument()
        })
        await waitFor(
            () => {
                expect(
                    screen.getByRole('heading', {name: 'Noch kein privater Feed'}),
                ).toBeInTheDocument()
            },
            {timeout: 4000},
        )
        expect(
            screen.getByRole('button', {name: 'Tarife ansehen'}),
        ).toHaveAttribute('href', '/de/pricing')
        expect(listMyFeedsMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
})
