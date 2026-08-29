'use client'

import {parseSubscriptionProductList} from '@directwerk/api/validation/catalog'

import type {SubscriptionProduct} from '@directwerk/api/types'
import {getTenantData} from '@/lib/api/tenantClient'

export async function listTenantProducts(): Promise<SubscriptionProduct[]> {
    const raw = await getTenantData<unknown>('tenant/products')
    return parseSubscriptionProductList(raw) ?? []
}
