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

    it('links out to Umami when measurement is active', async () => {
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

        await waitFor(() => expect(screen.getByText('Messung aktiv')).toBeInTheDocument())
        expect(screen.getByRole('button', {name: 'In Umami öffnen'})).toHaveAttribute(
            'href',
            'https://umami.example.com/dashboard/websites/website-1',
        )
        expect(screen.queryByText('Publikum & Umsatz')).not.toBeInTheDocument()
        expect(screen.queryByText('Beiträge veröffentlicht')).not.toBeInTheDocument()
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
