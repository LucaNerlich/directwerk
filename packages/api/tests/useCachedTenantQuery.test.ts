import {afterEach, describe, expect, it, vi} from 'vitest'

import {
    clearAllCachedTenantData,
    fetchCachedTenantData,
} from '../src/client/useCachedTenantQuery'

describe('clearAllCachedTenantData', () => {
    afterEach(() => {
        clearAllCachedTenantData()
    })

    it('drops every namespace so a later account refetches instead of reusing cached data', async () => {
        const subscribers = vi.fn(async () => ['subscriber@example.com'])
        const products = vi.fn(async () => ['product'])

        await fetchCachedTenantData('tenant-subscribers', 'tenant.test', subscribers)
        await fetchCachedTenantData('tenant-products', 'tenant.test', products)
        await fetchCachedTenantData('tenant-subscribers', 'tenant.test', subscribers)

        expect(subscribers).toHaveBeenCalledTimes(1)
        expect(products).toHaveBeenCalledTimes(1)

        clearAllCachedTenantData()

        await fetchCachedTenantData('tenant-subscribers', 'tenant.test', subscribers)
        await fetchCachedTenantData('tenant-products', 'tenant.test', products)

        expect(subscribers).toHaveBeenCalledTimes(2)
        expect(products).toHaveBeenCalledTimes(2)
    })
})
