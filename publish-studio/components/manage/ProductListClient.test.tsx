import {render, screen, waitFor} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import ProductListClient from '@/components/manage/ProductListClient'
import {listProducts} from '@/lib/api/tenantApi'

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/tenantApi', () => ({
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
        render(<ProductListClient />)
        await waitFor(() => expect(screen.getByText('Supporter')).toBeInTheDocument())
        expect(screen.getByRole('button', {name: /Neues Produkt/})).toHaveAttribute(
            'href',
            '/manage/products/new',
        )
    })

    it('shows an empty state with a create action', async () => {
        vi.mocked(listProducts).mockResolvedValue([])
        render(<ProductListClient />)
        await waitFor(() =>
            expect(screen.getByText('Noch keine Produkte')).toBeInTheDocument(),
        )
        expect(screen.getByRole('button', {name: /Erstes Produkt anlegen/})).toHaveAttribute(
            'href',
            '/manage/products/new',
        )
    })
})
