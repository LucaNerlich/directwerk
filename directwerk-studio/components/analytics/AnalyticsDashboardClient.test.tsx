import {cleanup, render, screen, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import AnalyticsDashboardClient from '@/components/analytics/AnalyticsDashboardClient'

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@directwerk/api/auth/useAuthRequired', () => ({
    useAuthRequired: () => () => false,
}))

const listArticlesMock = vi.fn()
const listEpisodesMock = vi.fn()
const listSeriesMock = vi.fn()
const getBillingDashboardMock = vi.fn()
const getUmamiStatsMock = vi.fn()

vi.mock('@/lib/api/writeApi', () => ({
    listArticles: (...args: unknown[]) => listArticlesMock(...args),
}))
vi.mock('@/lib/api/podcastApi', () => ({
    listEpisodes: (...args: unknown[]) => listEpisodesMock(...args),
    listSeries: (...args: unknown[]) => listSeriesMock(...args),
}))
vi.mock('@/lib/api/subscriptionApi', () => ({
    getBillingDashboard: (...args: unknown[]) => getBillingDashboardMock(...args),
}))
vi.mock('@/lib/api/umamiApi', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/api/umamiApi')>()),
    getUmamiStats: (...args: unknown[]) => getUmamiStatsMock(...args),
}))

function billingDashboard() {
    return {
        stripe: {
            status: 'CONNECTED',
            moduleEnabled: true,
            message: 'ok',
            chargesEnabled: true,
            payoutsEnabled: true,
            detailsSubmitted: true,
        },
        stats: {
            activeSubscriptions: 4,
            activePaidSubscriptions: 2,
            activeGrantSubscriptions: 2,
            uniqueActiveMembers: 3,
            newThisMonth: 1,
            canceledThisMonth: 0,
            pastDueSubscriptions: 0,
            incompleteSubscriptions: 0,
            totalMemberships: 5,
            estimatedMonthlyCents: 1980,
            currency: 'EUR',
        },
        memberships: [],
    }
}

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    getUmamiStatsMock.mockRejectedValue(new Error('Umami unreachable'))
})

describe('AnalyticsDashboardClient', () => {
    it('renders content stats and recent items per desk', async () => {
        listArticlesMock.mockResolvedValue([
            {
                id: 1,
                slug: 'a',
                title: 'Beitrag eins',
                status: 'PUBLISHED',
                accessPolicy: 'FREE',
                publishedAt: '2026-08-20T00:00:00Z',
            },
            {
                id: 2,
                slug: 'b',
                title: 'Beitrag zwei',
                status: 'DRAFT',
                accessPolicy: 'FREE',
                publishedAt: null,
            },
        ])
        listEpisodesMock.mockResolvedValue([
            {
                id: 9,
                slug: 'ep',
                title: 'Folge eins',
                status: 'PUBLISHED',
                accessPolicy: 'FREE',
                publishedAt: '2026-08-21T00:00:00Z',
            },
        ])
        listSeriesMock.mockResolvedValue([
            {id: 3, slug: 'show', title: 'Show', status: 'PUBLISHED', rssUrl: null},
        ])
        getBillingDashboardMock.mockResolvedValue(billingDashboard())

        render(
            <AnalyticsDashboardClient
                analytics={null}
                analyticsModuleEnabled={false}
                desks={['WRITE', 'PODCAST']}
                subscriptionEnabled={true}
            />,
        )

        await waitFor(() => expect(screen.getByText('Folge eins')).toBeInTheDocument())
        expect(screen.getByText('Beitrag eins')).toBeInTheDocument()
        expect(screen.getByText('Beiträge veröffentlicht')).toBeInTheDocument()
        expect(screen.getByText('Folgen veröffentlicht')).toBeInTheDocument()
        expect(screen.getByText('Sendungen')).toBeInTheDocument()
        expect(screen.getByText('Aktive Mitgliedschaften')).toBeInTheDocument()
        expect(screen.getByText('Noch nicht eingerichtet')).toBeInTheDocument()
    })

    it('renders live Umami stats when measurement is active', async () => {
        listArticlesMock.mockResolvedValue([])
        listEpisodesMock.mockResolvedValue([])
        listSeriesMock.mockResolvedValue([])
        getUmamiStatsMock.mockResolvedValue({
            range: '30d',
            stats: {
                pageviews: 100,
                visitors: 40,
                visits: 50,
                bounces: 10,
                totaltime: 3600,
                comparison: {
                    pageviews: 80,
                    visitors: 20,
                    visits: 40,
                    bounces: 8,
                    totaltime: 3000,
                },
            },
            pageviews: [{t: '2026-08-01T00:00:00Z', y: 5}],
            sessions: [{t: '2026-08-01T00:00:00Z', y: 2}],
        })

        render(
            <AnalyticsDashboardClient
                analytics={{
                    umamiWebsiteId: 'website-1',
                    umamiHostUrl: 'https://umami.example.com',
                    umamiScriptUrl: 'https://umami.example.com/script.js',
                }}
                analyticsModuleEnabled={true}
                desks={['PODCAST']}
                subscriptionEnabled={false}
            />,
        )

        await waitFor(() => expect(screen.getByText('Besucher')).toBeInTheDocument())
        expect(screen.getByText('Seitenaufrufe')).toBeInTheDocument()
        expect(screen.getByText('+100 % ggü. Vorperiode')).toBeInTheDocument()
        expect(screen.getByText('Aufrufe pro Tag')).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'In Umami öffnen'})).toHaveAttribute(
            'href',
            'https://umami.example.com/dashboard/websites/website-1',
        )
        expect(screen.queryByText('Publikum & Umsatz')).not.toBeInTheDocument()
        expect(screen.queryByText('Beiträge veröffentlicht')).not.toBeInTheDocument()
    })

    it('falls back to the Umami link when live stats fail', async () => {
        listArticlesMock.mockResolvedValue([])
        listEpisodesMock.mockResolvedValue([])
        listSeriesMock.mockResolvedValue([])

        render(
            <AnalyticsDashboardClient
                analytics={{
                    umamiWebsiteId: 'website-1',
                    umamiHostUrl: 'https://umami.example.com',
                    umamiScriptUrl: 'https://umami.example.com/script.js',
                }}
                analyticsModuleEnabled={true}
                desks={['PODCAST']}
                subscriptionEnabled={false}
            />,
        )

        await waitFor(() =>
            expect(
                screen.getByText('Live-Kennzahlen konnten nicht geladen werden.'),
            ).toBeInTheDocument(),
        )
        expect(screen.getByRole('button', {name: 'In Umami öffnen'})).toBeInTheDocument()
    })

    it('hints at the missing API key when the proxy reports 503', async () => {
        listArticlesMock.mockResolvedValue([])
        listEpisodesMock.mockResolvedValue([])
        listSeriesMock.mockResolvedValue([])
        getUmamiStatsMock.mockRejectedValue(Object.assign(new Error('nope'), {status: 503}))

        render(
            <AnalyticsDashboardClient
                analytics={{
                    umamiWebsiteId: 'website-1',
                    umamiHostUrl: 'https://umami.example.com',
                    umamiScriptUrl: 'https://umami.example.com/script.js',
                }}
                analyticsModuleEnabled={true}
                desks={['PODCAST']}
                subscriptionEnabled={false}
            />,
        )

        await waitFor(() =>
            expect(screen.getByText(/UMAMI_USERNAME/)).toBeInTheDocument(),
        )
    })

    it('hides audience stats gracefully when billing is forbidden', async () => {
        listArticlesMock.mockResolvedValue([])
        listEpisodesMock.mockResolvedValue([])
        listSeriesMock.mockResolvedValue([])
        getBillingDashboardMock.mockRejectedValue(new Error('Forbidden'))

        render(
            <AnalyticsDashboardClient
                analytics={null}
                analyticsModuleEnabled={false}
                desks={['PODCAST']}
                subscriptionEnabled={true}
            />,
        )

        await waitFor(() =>
            expect(
                screen.getByText('Abo-Kennzahlen sind nur für Tenant-Admins sichtbar.'),
            ).toBeInTheDocument(),
        )
    })
})
