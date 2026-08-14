import {describe, expect, it} from 'vitest'

import {
    parseSubscriberFeedEnvelope,
    parseSubscriberFeedListEnvelope,
} from '@/lib/api/responseValidation'

function feed(id: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id,
        userId: 7,
        userEmail: 'sub@example.test',
        title: 'Demo Private Feed',
        isDefault: true,
        enabled: true,
        createdAt: '2026-07-20T12:00:00Z',
        updatedAt: '2026-07-20T12:00:00Z',
        ...overrides,
    }
}

describe('subscriber feed parsers', () => {
    it('parses a subscriber feed list envelope', () => {
        const parsed = parseSubscriberFeedListEnvelope({
            statusCode: 200,
            statusMessage: 'OK',
            data: [feed(42), feed(43, {isDefault: false, enabled: false})],
            errors: [],
            metadata: {},
        })

        expect(parsed?.data).toHaveLength(2)
        expect(parsed?.data[0]).toEqual({
            id: 42,
            userId: 7,
            userEmail: 'sub@example.test',
            title: 'Demo Private Feed',
            isDefault: true,
            enabled: true,
            createdAt: '2026-07-20T12:00:00Z',
            updatedAt: '2026-07-20T12:00:00Z',
        })
        expect(parsed?.data[1]?.enabled).toBe(false)
    })

    it('rejects a feed without a userEmail', () => {
        const parsed = parseSubscriberFeedListEnvelope({
            statusCode: 200,
            statusMessage: 'OK',
            data: [feed(42, {userEmail: undefined})],
            errors: [],
            metadata: {},
        })

        expect(parsed).toBeNull()
    })

    it('parses a single subscriber feed envelope', () => {
        const parsed = parseSubscriberFeedEnvelope({
            statusCode: 200,
            statusMessage: 'OK',
            data: feed(42, {enabled: false}),
            errors: [],
            metadata: {},
        })

        expect(parsed?.data?.id).toBe(42)
        expect(parsed?.data?.enabled).toBe(false)
    })

    it('parses a series list envelope including rssUrl', async () => {
        const {parseSeriesListEnvelope} = await import(
            '@/lib/api/responseValidation'
        )

        const parsed = parseSeriesListEnvelope({
            statusCode: 200,
            statusMessage: 'OK',
            data: [
                {
                    id: 1,
                    slug: 'show',
                    title: 'Meine Sendung',
                    status: 'PUBLISHED',
                    rssUrl: 'https://demo.example/feeds/demo/show.xml',
                },
            ],
            errors: [],
            metadata: {},
        })

        expect(parsed?.data[0]?.rssUrl).toBe(
            'https://demo.example/feeds/demo/show.xml',
        )
    })
})
