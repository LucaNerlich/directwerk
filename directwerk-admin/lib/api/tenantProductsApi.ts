'use client'

<<<<<<< HEAD
import {parseSubscriptionProductList} from '@directwerk/api/validation/catalog'

import type {SubscriptionProduct} from '@directwerk/api/types'
import {getTenantData} from '@/lib/api/tenantClient'
=======
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
>>>>>>> cleanup/5-weak-types

export async function listTenantProducts(): Promise<SubscriptionProduct[]> {
    return getTenantEnvelope('tenant/products', parseProductListEnvelope, 'Could not load products.')
}
<<<<<<< HEAD
=======

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
>>>>>>> cleanup/5-weak-types
