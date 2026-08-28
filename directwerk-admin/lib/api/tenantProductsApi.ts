'use client'

import {parseSubscriptionProductList} from '@directwerk/api/validation'
import type {
    ProductAccessRule,
    SubscriptionGrant,
    SubscriptionProduct,
} from '@directwerk/api/types'
import {getTenantData, postTenantData} from '@/lib/api/tenantClient'

export async function listTenantProducts(): Promise<SubscriptionProduct[]> {
    const raw = await getTenantData<unknown>('tenant/products')
    return parseSubscriptionProductList(raw) ?? []
}

export async function listTenantProductRules(
    productId: number,
): Promise<ProductAccessRule[]> {
    return getTenantData<ProductAccessRule[]>(`tenant/products/${productId}/rules`)
}

export async function grantTenantSubscription(
    body: unknown,
): Promise<SubscriptionGrant> {
    return postTenantData<SubscriptionGrant>('tenant/subscriptions/grants', body)
}
