import {screen, waitFor} from '@testing-library/react'
import {renderWithLocale} from '@/lib/i18n/testUtils'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import ProductListClient from '@/components/manage/ProductListClient'
import {clearCachedTenantData} from '@directwerk/api/client/useCachedTenantQuery'
import {listProducts} from '@/lib/api/subscriptionApi'

vi.mock('next/link', () => ({
    default: ({children, href, ...props}: {children?: React.ReactNode; href: string; [key: string]: unknown}) => (
        <a href={href} {...props}>{children}</a>
    ),
}))

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@directwerk/api/auth/useAuthRequired', () => ({
    useAuthRequired: () => () => false,
}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/subscriptionApi', () => ({
    listProducts: vi.fn().mockResolvedValue([
        {
            id: 1,
            slug: 'supporter',
            title: 'Supporter',
            offeringType: 'LEVEL',
            sortOrder: 1,
            active: true,
            description: null,
            priceCents: 990,
            currency: 'EUR',
            billingInterval: 'MONTH',
            stripeProductId: null,
            stripePriceId: null,
        },
    ]),
}))

describe('ProductListClient', () => {
    beforeEach(() => {
        clearCachedTenantData('tenant-products', 'tenant.test')
        vi.mocked(listProducts).mockReset()
        vi.mocked(listProducts).mockResolvedValue([
            {
                id: 1,
                slug: 'supporter',
                title: 'Supporter',
                offeringType: 'LEVEL',
                sortOrder: 1,
                active: true,
                description: null,
                priceCents: 990,
                currency: 'EUR',
                billingInterval: 'MONTH',
                stripeProductId: null,
                stripePriceId: null,
            },
        ])
    })

    it('renders loaded products', async () => {
        renderWithLocale(<ProductListClient />)
        await waitFor(() => expect(screen.getByText('Supporter')).toBeInTheDocument())
        expect(screen.getByRole('button', {name: /Neues Produkt/})).toHaveAttribute(
            'href', '/de/manage/products/new',
        )
    })

    it('shows an empty state with a create action', async () => {
        vi.mocked(listProducts).mockResolvedValue([])
        renderWithLocale(<ProductListClient />)
        await waitFor(() =>
            expect(screen.getByText('Noch keine Produkte')).toBeInTheDocument(),
        )
        expect(screen.getByRole('button', {name: /Erstes Produkt anlegen/})).toHaveAttribute(
            'href', '/de/manage/products/new',
        )
    })
})
