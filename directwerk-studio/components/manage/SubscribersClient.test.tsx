import {cleanup, fireEvent, screen, waitFor} from '@testing-library/react'
import {renderWithLocale} from '@/lib/i18n/testUtils'
import {afterEach, describe, expect, it, vi} from 'vitest'

import SubscribersClient from '@/components/manage/SubscribersClient'
import {clearCachedTenantData} from '@directwerk/api/client/useCachedTenantQuery'
import {revokeSubscription} from '@/lib/api/subscriptionApi'
import {listSubscribers} from '@/lib/api/tenantSettingsApi'

vi.mock('next/link', () => ({
    default: ({children, href, ...props}: {children?: React.ReactNode; href: string; [key: string]: unknown}) => (
        <a href={href} {...props}>{children}</a>
    ),
}))

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
const authRedirect = vi.fn(() => false)
vi.mock('@directwerk/api/auth/useAuthRequired', () => ({
    useAuthRequired: () => authRedirect,
}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
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
    vi.mocked(revokeSubscription).mockReset()
})

describe('SubscribersClient', () => {
    it('shows an empty state pointing to products and grants', async () => {
        vi.mocked(listSubscribers).mockResolvedValue([])
        renderWithLocale(<SubscribersClient />)

        await waitFor(() =>
            expect(screen.getByText('Noch keine Abonnenten')).toBeInTheDocument(),
        )
        expect(screen.getByRole('button', {name: /Zu den Produkten/})).toHaveAttribute(
            'href',
            '/de/manage/products',
        )
        expect(screen.getByRole('button', {name: /Freischaltung vergeben/})).toHaveAttribute(
            'href',
            '/de/manage/grants',
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
        renderWithLocale(<SubscribersClient />)

        await waitFor(() =>
            expect(screen.getByText('member@example.com')).toBeInTheDocument(),
        )
        expect(screen.getByText('Supporter')).toBeInTheDocument()
        expect(screen.getByText(/Aktiv · Stripe · bis 2026-09-01 · sub_abc/)).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Zugang beenden'})).toBeInTheDocument()
    })

    it('resets the revoke confirmation after a failed revoke', async () => {
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
        vi.mocked(revokeSubscription).mockRejectedValue(new Error('Widerruf fehlgeschlagen.'))

        renderWithLocale(<SubscribersClient />)
        await waitFor(() =>
            expect(screen.getByText('member@example.com')).toBeInTheDocument(),
        )
        fireEvent.click(screen.getByRole('button', {name: 'Zugang beenden'}))
        fireEvent.click(await screen.findByRole('button', {name: 'Wirklich beenden'}))

        expect(await screen.findByText('Widerruf fehlgeschlagen.')).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Zugang beenden'})).toBeInTheDocument()
        expect(screen.queryByRole('button', {name: 'Wirklich beenden'})).not.toBeInTheDocument()
        expect(revokeSubscription).toHaveBeenCalledTimes(1)
    })
})
