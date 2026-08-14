import {describe, expect, it} from 'vitest'

import {
    parseProductEnvelope,
    parseProductListEnvelope,
    parseProductRuleListEnvelope,
    parseSubscriptionGrantEnvelope,
} from '@/lib/api/responseValidation'

describe('subscription product parsers', () => {
    it('parses a product list envelope', () => {
        const parsed = parseProductListEnvelope({
            statusCode: 200,
            statusMessage: 'OK',
            data: [
                {
                    id: 1,
                    slug: 'supporter',
                    title: 'Supporter',
                    offeringType: 'LEVEL',
                    sortOrder: 10,
                    active: true,
                    description: 'Zugang zu allen Folgen',
                    priceCents: 990,
                    currency: 'EUR',
                    billingInterval: 'MONTH',
                    stripeProductId: null,
                    stripePriceId: null,
                },
            ],
            errors: [],
            metadata: {},
        })

        expect(parsed?.data[0]?.slug).toBe('supporter')
        expect(parsed?.data[0]?.offeringType).toBe('LEVEL')
    })

    it('parses a single product envelope', () => {
        const parsed = parseProductEnvelope({
            statusCode: 201,
            statusMessage: 'Created',
            data: {
                id: 2,
                slug: 'bonus',
                title: 'Bonus Pack',
                offeringType: 'PACKAGE',
                sortOrder: 0,
                active: true,
                description: null,
                priceCents: 1900,
                currency: 'EUR',
                billingInterval: 'ONE_TIME',
                stripeProductId: 'prod_1',
                stripePriceId: 'price_1',
            },
            errors: [],
            metadata: {},
        })

        expect(parsed?.data.offeringType).toBe('PACKAGE')
    })

    it('parses product rules including null scopeId', () => {
        const parsed = parseProductRuleListEnvelope({
            statusCode: 200,
            statusMessage: 'OK',
            data: [
                {
                    id: 9,
                    productId: 2,
                    scopeType: 'ALL_PODCASTS',
                    scopeId: null,
                    effect: 'GRANT',
                    createdAt: '2026-07-22T10:00:00Z',
                },
            ],
            errors: [],
            metadata: {},
        })

        expect(parsed?.data[0]?.scopeType).toBe('ALL_PODCASTS')
        expect(parsed?.data[0]?.scopeId).toBeNull()
    })

    it('parses a subscription grant envelope', () => {
        const parsed = parseSubscriptionGrantEnvelope({
            statusCode: 201,
            statusMessage: 'Created',
            data: {
                id: 5,
                userId: 3,
                email: 'member@example.com',
                productId: 1,
                productSlug: 'supporter',
                productTitle: 'Supporter',
                status: 'ACTIVE',
                source: 'MANUAL',
            },
            errors: [],
            metadata: {},
        })

        expect(parsed?.data.email).toBe('member@example.com')
        expect(parsed?.data.status).toBe('ACTIVE')
    })
})
