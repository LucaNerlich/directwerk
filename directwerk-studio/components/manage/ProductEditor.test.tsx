import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import ProductEditor from '@/components/manage/ProductEditor'
import {createProduct} from '@/lib/api/subscriptionApi'
import type {SubscriptionProduct} from '@directwerk/api/types'

// Stable across renders, like the real Next.js useRouter().
const mockRouter = {replace: vi.fn()}
vi.mock('next/navigation', () => ({useRouter: () => mockRouter}))
vi.mock('@directwerk/api/auth/useAuthRequired', () => ({
    useAuthRequired: () => () => false,
}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/subscriptionApi', () => ({
    createProduct: vi.fn(),
    deactivateProduct: vi.fn(),
    listProducts: vi.fn().mockResolvedValue([]),
    syncProductStripe: vi.fn(),
    listPublicLevels: vi.fn().mockResolvedValue([]),
}))

describe('ProductEditor price validation', () => {
    it('rejects an invalid price with a German error instead of silently dropping it', async () => {
        render(<ProductEditor />)

        // NB: fireEvent instead of user.type — user-event keystrokes don't
        // reach the Base-UI input primitive's state (see BrandingEditor tests).
        fireEvent.change(screen.getByLabelText('Titel'), {
            target: {value: 'Supporter'},
        })
        fireEvent.change(screen.getByLabelText('Preis'), {
            target: {value: '12,345'},
        })
        fireEvent.submit(screen.getByLabelText('Preis').closest('form') as HTMLFormElement)

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Bitte einen gültigen Preis eingeben',
            ),
        )
        expect(createProduct).not.toHaveBeenCalled()
    })

    it('converts a German price to cents when creating the product', async () => {
        vi.mocked(createProduct).mockResolvedValue({id: 3} as SubscriptionProduct)
        render(<ProductEditor />)

        fireEvent.change(screen.getByLabelText('Titel'), {
            target: {value: 'Supporter'},
        })
        fireEvent.change(screen.getByLabelText('Preis'), {
            target: {value: '14,90'},
        })
        fireEvent.submit(screen.getByLabelText('Preis').closest('form') as HTMLFormElement)

        await waitFor(() =>
            expect(createProduct).toHaveBeenCalledWith(
                'tenant.test',
                expect.objectContaining({priceCents: 1490, title: 'Supporter'}),
            ),
        )
        expect(mockRouter.replace).toHaveBeenCalledWith('/manage/products/3')
    })
})
