import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import PaymentsDashboardClient from '@/components/manage/PaymentsDashboardClient'
import {getBillingDashboard, revokeSubscription} from '@/lib/api/subscriptionApi'
import type {BillingDashboard, BillingMembership} from '@directwerk/api/types'

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/tenantApi', () => ({
    getBillingDashboard: vi.fn(),
    revokeSubscription: vi.fn(),
}))

function membership(overrides: Partial<BillingMembership> = {}): BillingMembership {
    return {
        id: 9,
        userId: 3,
        email: 'member@example.com',
        productId: 1,
        productSlug: 'supporter',
        productTitle: 'Supporter',
        status: 'ACTIVE',
        source: 'STRIPE',
        startedAt: '2026-08-01T00:00:00Z',
        endsAt: null,
        externalSubscriptionId: 'sub_1',
        ...overrides,
    }
}

function dashboard(overrides: Partial<BillingDashboard> = {}): BillingDashboard {
    return {
        stripe: {
            status: 'CONNECTED',
            moduleEnabled: true,
            message: 'Stripe ist verbunden und kann Zahlungen annehmen.',
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
            pastDueSubscriptions: 1,
            incompleteSubscriptions: 0,
            totalMemberships: 5,
            estimatedMonthlyCents: 1980,
            currency: 'EUR',
        },
        memberships: [membership()],
        ...overrides,
    }
}

describe('PaymentsDashboardClient', () => {
    beforeEach(() => {
        vi.mocked(getBillingDashboard).mockReset()
        vi.mocked(revokeSubscription).mockReset()
        vi.mocked(getBillingDashboard).mockResolvedValue(dashboard())
    })

    it('renders payment stats and memberships', async () => {
        render(<PaymentsDashboardClient />)
        await waitFor(() => expect(screen.getByText('member@example.com')).toBeInTheDocument())
        expect(screen.getByText('Zahlungen & Mitgliedschaften')).toBeInTheDocument()
        expect(screen.getByText('Verbunden')).toBeInTheDocument()
        expect(screen.getAllByText('Zahlungsrückstand').length).toBeGreaterThan(0)
        expect(screen.getByRole('button', {name: 'Stripe'})).toHaveAttribute(
            'href',
            '/settings/stripe',
        )
        expect(screen.getByRole('button', {name: 'Zugang beenden'})).toBeInTheDocument()
    })

    it('revokes an active membership after confirmation', async () => {
        const canceled = dashboard({
            memberships: [membership({status: 'CANCELED'})],
            stats: {
                ...dashboard().stats,
                activeSubscriptions: 3,
                canceledThisMonth: 1,
            },
        })
        vi.mocked(revokeSubscription).mockImplementation(async () => {
            vi.mocked(getBillingDashboard).mockResolvedValue(canceled)
            return {
                id: 9,
                userId: 3,
                email: 'member@example.com',
                productId: 1,
                productSlug: 'supporter',
                productTitle: 'Supporter',
                status: 'CANCELED',
                source: 'STRIPE',
            }
        })

        render(<PaymentsDashboardClient />)
        await waitFor(() => expect(screen.getByText('member@example.com')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', {name: 'Zugang beenden'}))
        expect(
            await screen.findByText(
                'Nochmal bestätigen: das Stripe-Abo wird gekündigt und der Zugang entfällt sofort.',
            ),
        ).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', {name: 'Wirklich beenden'}))

        await waitFor(() =>
            expect(revokeSubscription).toHaveBeenCalledWith('tenant.test', 9),
        )
        expect(await screen.findByText('Zugang beendet: member@example.com')).toBeInTheDocument()
        expect(screen.getByText(/Supporter · Gekündigt · Stripe/)).toBeInTheDocument()
        expect(screen.queryByRole('button', {name: 'Zugang beenden'})).not.toBeInTheDocument()
    })
})
