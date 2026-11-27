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

    it('neutralizes formula-starting subscriber values', () => {
        const csv = buildSubscriberCsv([
            subscriber({userId: 3, email: 'c@example.com', name: '=HYPERLINK("http://evil")'}),
            subscriber({userId: 4, email: 'd@example.com', name: '-2+3+cmd'}),
            subscriber({userId: 5, email: 'e@example.com', name: '+cmd'}),
            subscriber({userId: 6, email: 'f@example.com', name: '@cmd'}),
            subscriber({userId: 7, email: 'g@example.com', name: '\t=1+1'}),
            subscriber({userId: 8, email: 'h@example.com', name: '\r=1+1'}),
            subscriber({userId: 9, email: 'i@example.com', name: '\n=1+1'}),
        ])
        expect(csv).toContain('"\'=HYPERLINK(""http://evil"")"')
        expect(csv).toContain("'\t=1+1")
        expect(csv).toContain("'\r=1+1")
        expect(csv).toContain("'\n=1+1")
        expect(csv).toContain("'-2+3+cmd")
        expect(csv).toContain("'+cmd")
        expect(csv).toContain("'@cmd")
    })
})
