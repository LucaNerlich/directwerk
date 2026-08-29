'use client'

import {parseProductListEnvelope} from '@directwerk/api/validation/catalog'

import type {SubscriptionProduct} from '@directwerk/api/types'

import {getTenantEnvelope} from '@/lib/api/tenantClient'

export async function listTenantProducts(): Promise<SubscriptionProduct[]> {
    return getTenantEnvelope(
        'tenant/products',
        parseProductListEnvelope,
        'Could not load products.',
    )
}
