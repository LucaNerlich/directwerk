'use client'

import {
    parseProductListEnvelope,
    parseProductRuleListEnvelope,
    parseSubscriptionGrantEnvelope,
} from '@directwerk/api/validation/catalog'
import type {
    GrantSubscriptionInput,
    ProductAccessRule,
    SubscriptionGrant,
    SubscriptionProduct,
} from '@directwerk/api/types'

import {getTenantEnvelope, postTenantEnvelope} from '@/lib/api/tenantClient'

export async function listTenantProducts(): Promise<SubscriptionProduct[]> {
    return getTenantEnvelope('tenant/products', parseProductListEnvelope, 'Could not load products.')
}

export async function listTenantProductRules(productId: number): Promise<ProductAccessRule[]> {
    return getTenantEnvelope(
        `tenant/products/${productId}/rules`,
        parseProductRuleListEnvelope,
        'Could not load product rules.',
    )
}

export async function grantTenantSubscription(body: GrantSubscriptionInput): Promise<SubscriptionGrant> {
    return postTenantEnvelope(
        'tenant/subscriptions/grants',
        body,
        parseSubscriptionGrantEnvelope,
        'Could not grant subscription.',
    )
}
