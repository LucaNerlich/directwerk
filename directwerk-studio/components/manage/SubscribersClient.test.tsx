import {cleanup, render, screen, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import SubscribersClient from '@/components/manage/SubscribersClient'
import {clearCachedTenantData} from '@directwerk/api/client/useCachedTenantQuery'
import {listSubscribers} from '@/lib/api/tenantSettingsApi'

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@directwerk/api/auth/useAuthRequired', () => ({
    useAuthRequired: () => () => false,
}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/tenantSettingsApi', () => ({
    listSubscribers: vi.fn(),
}))
vi.mock('@/lib/api/subscriptionApi', () => ({
    revokeSubscription: vi.fn(),
}))

afterEach(() => {
    cleanup()
    clearCachedTenantData('tenant-subscribers', 'tenant.test')
    vi.mocked(listSubscribers).mockReset()
})

describe('SubscribersClient', () => {
    it('shows an empty state pointing to products and grants', async () => {
        vi.mocked(listSubscribers).mockResolvedValue([])
        render(<SubscribersClient />)

        await waitFor(() =>
            expect(screen.getByText('Noch keine Abonnenten')).toBeInTheDocument(),
        )
        expect(screen.getByRole('button', {name: /Zu den Produkten/})).toHaveAttribute(
            'href',
            '/manage/products',
        )
        expect(screen.getByRole('button', {name: /Freischaltung vergeben/})).toHaveAttribute(
            'href',
            '/manage/grants',
        )
    })

    it('shows source, period, Stripe id, and revoke for an active membership', async () => {
        vi.mocked(listSubscribers).mockResolvedValue([
            {
                userId: 4,
                email: 'member@example.com',
                name: 'Member',
                status: 'ACTIVE',
                subscriptions: [
                    {
                        id: 9,
                        productId: 2,
                        productSlug: 'supporter',
                        productTitle: 'Supporter',
                        status: 'ACTIVE',
                        source: 'STRIPE',
                        startedAt: '2026-08-01T00:00:00Z',
                        endsAt: '2026-09-01T00:00:00Z',
                        externalSubscriptionId: 'sub_abc',
                    },
                ],
            },
        ])
        render(<SubscribersClient />)

        await waitFor(() =>
            expect(screen.getByText('member@example.com')).toBeInTheDocument(),
        )
        expect(screen.getByText('Supporter')).toBeInTheDocument()
        expect(screen.getByText(/Aktiv · Stripe · bis 2026-09-01 · sub_abc/)).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Zugang beenden'})).toBeInTheDocument()
    })
})
