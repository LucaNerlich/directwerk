'use client'

import {
    parseProductRuleListEnvelope,
    parseSubscriptionGrantEnvelope,
    parseSubscriptionProductList,
} from '@directwerk/api/validation'
import type {
    ProductAccessRule,
    SubscriptionGrant,
    SubscriptionProduct,
} from '@directwerk/api/types'
import {getTenantData, postTenantData} from '@/lib/api/tenantClient'
import {envelopeData} from '@/lib/api/envelopeHelpers'

export async function listTenantProducts(): Promise<SubscriptionProduct[]> {
    const raw = await getTenantData<unknown>('tenant/products')
    return parseSubscriptionProductList(raw) ?? []
}

export async function listTenantProductRules(
    productId: number,
): Promise<ProductAccessRule[]> {
    return envelopeData(
        parseProductRuleListEnvelope,
        await getTenantData<unknown>(`tenant/products/${productId}/rules`),
        'Could not load product rules.',
    )
}

export async function grantTenantSubscription(
    body: unknown,
): Promise<SubscriptionGrant> {
    return envelopeData(
        parseSubscriptionGrantEnvelope,
        await postTenantData<unknown>('tenant/subscriptions/grants', body),
        'Could not grant subscription.',
    )
}
