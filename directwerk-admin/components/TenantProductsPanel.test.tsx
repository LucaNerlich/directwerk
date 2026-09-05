import {cleanup, render, screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import TenantProductsPanel from '@/components/TenantProductsPanel'
import {tenantTokenStore} from '@/lib/auth/tenantTokenStore'
import type {ProductAccessRule, SubscriptionProduct} from '@directwerk/api/types'

const listTenantProducts = vi.fn()
const getTenantData = vi.fn()
const postTenantData = vi.fn()
const putTenantData = vi.fn()
const deleteTenantData = vi.fn()

vi.mock('@/lib/api/tenantProductsApi', () => ({
    listTenantProducts: (...args: unknown[]) => listTenantProducts(...args),
}))

vi.mock('@/lib/api/tenantClient', () => ({
    getTenantData: (...args: unknown[]) => getTenantData(...args),
    postTenantData: (...args: unknown[]) => postTenantData(...args),
    putTenantData: (...args: unknown[]) => putTenantData(...args),
    deleteTenantData: (...args: unknown[]) => deleteTenantData(...args),
}))

function packageProduct(overrides: Partial<SubscriptionProduct> = {}): SubscriptionProduct {
    return {
        id: 1,
        slug: 'pro',
        title: 'Pro',
        offeringType: 'PACKAGE',
        sortOrder: 0,
        active: true,
        ...overrides,
    } as SubscriptionProduct
}

function deferred<T>(): {promise: Promise<T>; resolve: (value: T) => void} {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((accept) => {
        resolve = accept
    })
    return {promise, resolve}
}

beforeEach(() => {
    tenantTokenStore.setTokens(
        {access_token: 'tenant-access', expires_in: 900},
        'alpha-a.localhost'
    )
    listTenantProducts.mockResolvedValue([packageProduct()])
    getTenantData.mockResolvedValue([])
    putTenantData.mockImplementation(async (_path: unknown, body: unknown) => {
        const payload = body as {rules: unknown[]}
        return payload.rules.map((rule, index) => ({
            id: index + 1,
            ...(rule as Record<string, unknown>),
            effect: 'ALLOW',
        }))
    })
})

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    tenantTokenStore.clearTokens()
})

describe('TenantProductsPanel', () => {
    it('requires a tenant session before showing products', async () => {
        tenantTokenStore.clearTokens()
        listTenantProducts.mockClear()

        render(<TenantProductsPanel sessionKey={0} />)

        expect(
            screen.getByText('Tenant session required')
        ).toBeInTheDocument()
        expect(listTenantProducts).not.toHaveBeenCalled()
    })

    it('rejects saving scoped rules without a valid scope ID', async () => {
        const user = userEvent.setup()
        render(<TenantProductsPanel sessionKey={0} />)

        await user.click(await screen.findByRole('button', {name: 'Edit rules'}))
        expect(await screen.findByText('No rules yet.')).toBeInTheDocument()

        await user.selectOptions(
            screen.getByRole('combobox', {name: 'Replace with'}),
            'PODCAST_SERIES'
        )
        await user.click(screen.getByRole('button', {name: 'Save rules'}))

        expect(
            await screen.findByText('Enter a valid scope ID (positive integer).')
        ).toBeInTheDocument()
        expect(putTenantData).not.toHaveBeenCalled()

        await user.type(screen.getByLabelText('Scope ID'), '7')
        await user.click(screen.getByRole('button', {name: 'Save rules'}))

        await waitFor(() =>
            expect(putTenantData).toHaveBeenCalledWith(
                'tenant/products/1/rules',
                {rules: [{scopeType: 'PODCAST_SERIES', scopeId: 7}]}
            )
        )
        expect(screen.getByText('Rules saved.')).toBeInTheDocument()
    })

    it('disables granting when no active product exists', async () => {
        listTenantProducts.mockResolvedValue([
            packageProduct({id: 2, title: 'Legacy', slug: 'legacy', active: false}),
        ])
        render(<TenantProductsPanel sessionKey={0} />)

        await waitFor(() =>
            expect(screen.getByText('Legacy')).toBeInTheDocument()
        )

        const grantForm = screen.getByRole('button', {name: 'Grant'}).closest('form')
        expect(grantForm).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Grant'})).toBeDisabled()
        const productSelect = within(grantForm!).getByLabelText('Product')
        expect(within(productSelect).queryAllByRole('option')).toHaveLength(0)
    })

    it('retries loading products after a failure', async () => {
        listTenantProducts.mockRejectedValueOnce(new Error('unavailable'))
        const user = userEvent.setup()
        render(<TenantProductsPanel sessionKey={0} />)

        expect(
            await screen.findByText('Could not load products (is SUBSCRIPTION enabled?).')
        ).toBeInTheDocument()

        await user.click(screen.getByRole('button', {name: 'Retry'}))

        await waitFor(() =>
            expect(screen.getAllByText('Pro').length).toBeGreaterThanOrEqual(1)
        )
    })

    it('preserves grants when products are refreshed after creation', async () => {
        const user = userEvent.setup()
        postTenantData.mockImplementation(async (path: string) => {
            if (path === 'tenant/subscriptions') {
                return {
                    id: 9,
                    email: 'reader@example.com',
                    productId: 1,
                    productTitle: 'Pro',
                    status: 'ACTIVE',
                }
            }
            return packageProduct({id: 2, slug: 'plus', title: 'Plus'})
        })
        render(<TenantProductsPanel sessionKey={0} />)

        await screen.findByRole('button', {name: 'Grant'})
        await user.type(screen.getByLabelText('Email'), 'reader@example.com')
        await user.click(screen.getByRole('button', {name: 'Grant'}))
        expect(await screen.findByText('reader@example.com')).toBeInTheDocument()

        await user.type(screen.getByLabelText('Slug'), 'plus')
        await user.type(screen.getByLabelText('Title'), 'Plus')
        await user.click(screen.getByRole('button', {name: 'Create'}))

        await waitFor(() => expect(listTenantProducts).toHaveBeenCalledTimes(2))
        expect(screen.getByText('reader@example.com')).toBeInTheDocument()
    })

    it('ignores a stale rules response after switching tenant sessions', async () => {
        const user = userEvent.setup()
        const pendingRules = deferred<ProductAccessRule[]>()
        getTenantData.mockReturnValueOnce(pendingRules.promise)
        const {rerender} = render(<TenantProductsPanel sessionKey={0} />)

        await user.click(await screen.findByRole('button', {name: 'Edit rules'}))
        tenantTokenStore.setTokens(
            {access_token: 'tenant-b-access', expires_in: 900},
            'tenant-b.localhost',
        )
        rerender(<TenantProductsPanel sessionKey={1} />)
        pendingRules.resolve([
            {id: 77, scopeType: 'ALL_PODCASTS', scopeId: null, effect: 'ALLOW'},
        ] as ProductAccessRule[])

        await waitFor(() => expect(listTenantProducts).toHaveBeenCalledTimes(2))
        expect(screen.queryByText('ALL_PODCASTS')).not.toBeInTheDocument()
    })
})
