import {describe, expect, it} from 'vitest'

import {buildSubscriberCsv} from '@/lib/manage/subscriberCsv'
import type {TenantSubscriber} from '@directwerk/api/types'

function subscriber(partial: Partial<TenantSubscriber> & Pick<TenantSubscriber, 'userId' | 'email'>): TenantSubscriber {
    return {
        name: null,
        status: 'ACTIVE',
        subscriptions: [],
        ...partial,
    }
}

describe('buildSubscriberCsv', () => {
    it('emits a header and one row for subscribers without products', () => {
        const csv = buildSubscriberCsv([
            subscriber({userId: 1, email: 'a@example.com', name: 'Ada'}),
        ])
        expect(csv).toContain('email,name,account_status,product_title')
        expect(csv).toContain('a@example.com,Ada,ACTIVE,,,,,,,')
    })

    it('emits one row per subscription and escapes commas', () => {
        const csv = buildSubscriberCsv([
            subscriber({
                userId: 2,
                email: 'b@example.com',
                name: 'Bee, Jr',
                subscriptions: [
                    {
                        id: 10,
                        productId: 3,
                        productSlug: 'supporter',
                        productTitle: 'Supporter, yearly',
                        status: 'ACTIVE',
                        source: 'MANUAL',
                        startedAt: '2026-01-01T00:00:00Z',
                        endsAt: null,
                        externalSubscriptionId: null,
                    },
                ],
            }),
        ])
        expect(csv).toContain('"Bee, Jr"')
        expect(csv).toContain('"Supporter, yearly"')
        expect(csv).toContain('supporter,ACTIVE,MANUAL,2026-01-01T00:00:00Z,,')
    })
})
