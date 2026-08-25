import {describe, expect, it} from 'vitest'

import {
    parseAccessEnvelope,
    parseMeEnvelope,
    parsePublicArticleEnvelope,
    parsePublicEpisodeListEnvelope,
    parseSiteConfigEnvelope,
    parseCheckoutSessionEnvelope,
    parseSubscriptionListEnvelope,
    parseSubscriberDownloadListEnvelope,
    parseFeedPreviewEnvelope,
    parseSubscriberFeedEnvelope,
    parseSubscriberFeedListEnvelope,
    parseTokenResponse,
} from './responseValidation'

function envelopeWith(data: unknown) {
    return {statusCode: 200, statusMessage: 'OK', data}
}

describe('API response validation', () => {
    it('accepts a bounded OAuth token response', () => {
        expect(
            parseTokenResponse({
                access_token: 'header.payload.signature',
                refresh_token: 'refresh-token',
                expires_in: 300,
            }),
        ).toEqual({
            access_token: 'header.payload.signature',
            refresh_token: 'refresh-token',
            expires_in: 300,
        })
    })

    it('rejects malformed OAuth token responses', () => {
        expect(parseTokenResponse({access_token: 'token with spaces'})).toBeNull()
        expect(parseTokenResponse({access_token: 42})).toBeNull()
    })

    it('validates the three UI response envelopes', () => {
        expect(
            parseSiteConfigEnvelope({
                statusCode: 200,
                data: {
                    tenant: {slug: 'alpha-show-a', name: 'Tenant A'},
                    enabledModules: ['DIGITAL_CONTENT'],
                    branding: {
                        siteTitle: null,
                        primaryColor: null,
                        secondaryColor: null,
                        logoUrl: null,
                    },
                    publicRssUrl: null,
                },
            })?.data.tenant.slug,
        ).toBe('alpha-show-a')
        expect(
            parseMeEnvelope({
                statusCode: 200,
                data: {
                    email: 'subscriber@example.com',
                    name: null,
                    roles: ['SUBSCRIBER'],
                    tenantId: 1,
                },
            })?.data.roles,
        ).toEqual(['SUBSCRIBER'])
        expect(
            parseAccessEnvelope({
                statusCode: 200,
                data: {
                    activeLevels: [],
                    maxLevelSortOrder: null,
                    roles: ['SUBSCRIBER'],
                    tenantId: 1,
                },
            })?.data.activeLevels,
        ).toEqual([])
    })

    it('rejects malformed UI response envelopes', () => {
        expect(parseSiteConfigEnvelope({data: {tenant: {slug: 1}}})).toBeNull()
        expect(parseMeEnvelope({data: {email: 'subscriber@example.com'}})).toBeNull()
        expect(parseAccessEnvelope({data: {activeLevels: 'all'}})).toBeNull()
        expect(parseMeEnvelope({statusCode: 200, data: {email: 'invalid-email', name: null, roles: ['SUBSCRIBER'], tenantId: 1}})).toBeNull()
        expect(parseMeEnvelope({statusCode: 200, data: {email: 'user@example.com', name: null, roles: ['SUBSCRIBER'], tenantId: -1}})).toBeNull()
        expect(parseMeEnvelope({statusCode: 200, data: {email: 'user@example.com', name: null, roles: ['SUBSCRIBER'], tenantId: 1.5}})).toBeNull()
        expect(parseAccessEnvelope({statusCode: 200, data: {activeLevels: [{id: -1, slug: 'test', title: 'Test', sortOrder: 1}], maxLevelSortOrder: null, roles: ['SUBSCRIBER'], tenantId: 1}})).toBeNull()
        expect(parseAccessEnvelope({statusCode: 200, data: {activeLevels: [{id: 1, slug: 'test', title: 'Test', sortOrder: 1.5}], maxLevelSortOrder: null, roles: ['SUBSCRIBER'], tenantId: 1}})).toBeNull()
    })
})


describe('public content HTML sanitization', () => {
    function validArticle(overrides: Record<string, unknown> = {}) {
        return {
            id: 1,
            slug: 'hello',
            title: 'Hello',
            body: '<p>Safe</p>',
            excerpt: null,
            seoDescription: null,
            heroAssetId: null,
            accessPolicy: 'FREE',
            requiredLevelSortOrder: null,
            publishedAt: '2026-07-20T00:00:00Z',
            categories: [],
            ...overrides,
        }
    }

    function validEpisode(overrides: Record<string, unknown> = {}) {
        return {
            id: 1,
            seriesId: 2,
            seriesSlug: 'show',
            episodeNumber: 1,
            slug: 'ep-1',
            title: 'Episode 1',
            description: '<p>Notes</p>',
            durationSeconds: 60,
            accessPolicy: 'FREE',
            requiredLevelSortOrder: null,
            publishedAt: '2026-07-20T00:00:00Z',
            audioCdnUrl: null,
            ...overrides,
        }
    }

    it('sanitizes article body before returning', () => {
        const result = parsePublicArticleEnvelope(
            envelopeWith(
                validArticle({
                    body: '<p onclick="alert(1)">Hi</p><script>alert(2)</script>',
                }),
            ),
        )
        expect(result?.data.body).toBe('<p>Hi</p>')
    })

    it('preserves null article body', () => {
        const result = parsePublicArticleEnvelope(
            envelopeWith(validArticle({body: null})),
        )
        expect(result?.data.body).toBeNull()
    })

    it('sanitizes episode description before returning', () => {
        const result = parsePublicEpisodeListEnvelope(
            envelopeWith([
                validEpisode({
                    description:
                        '<svg onload="alert(1)"></svg><p>Show notes</p>',
                }),
            ]),
        )
        expect(result?.data[0].description).toBe('<p>Show notes</p>')
    })

    it('preserves null episode description', () => {
        const result = parsePublicEpisodeListEnvelope(
            envelopeWith([validEpisode({description: null})]),
        )
        expect(result?.data[0].description).toBeNull()
    })

    it('accepts a subscriber feed list envelope', () => {
        const result = parseSubscriberFeedListEnvelope(
            envelopeWith([
                {
                    id: 1,
                    title: 'Alpha Private Feed',
                    isDefault: true,
                    enabled: true,
                    url: 'https://alpha-a.localhost/feeds/alpha-show-a/u/tok123.xml',
                    createdAt: '2026-07-22T12:00:00Z',
                    updatedAt: '2026-07-22T12:00:00Z',
                },
            ]),
        )
        expect(result?.data).toHaveLength(1)
        expect(result?.data[0].url).toContain('/feeds/')
        expect(result?.data[0].isDefault).toBe(true)
        expect(result?.data[0].formatIds).toEqual([])
        expect(result?.data[0].formats).toEqual([])
    })

    it('accepts a custom subscriber feed with formats', () => {
        const result = parseSubscriberFeedEnvelope(
            envelopeWith({
                id: 9,
                title: 'Nur Interviews',
                isDefault: false,
                enabled: true,
                url: 'http://alpha-a.localhost:8080/feeds/alpha-show-a/u/customtok.xml',
                formatIds: [3],
                formats: [
                    {
                        id: 3,
                        slug: 'interview',
                        name: 'Interview',
                        requiredLevelSortOrder: null,
                        sortOrder: 2,
                    },
                ],
                createdAt: '2026-07-22T12:00:00Z',
                updatedAt: '2026-07-22T12:00:00Z',
            }),
        )
        expect(result?.data.isDefault).toBe(false)
        expect(result?.data.formatIds).toEqual([3])
        expect(result?.data.formats[0].name).toBe('Interview')
    })

    it('accepts a feed preview envelope', () => {
        const result = parseFeedPreviewEnvelope(
            envelopeWith({
                episodeCount: 2,
                sampleTitles: ['Eins', 'Zwei'],
            }),
        )
        expect(result?.data).toEqual({
            episodeCount: 2,
            sampleTitles: ['Eins', 'Zwei'],
        })
    })

    it('accepts http subscriber feed urls on loopback hosts', () => {
        const result = parseSubscriberFeedListEnvelope(
            envelopeWith([
                {
                    id: 1,
                    title: 'Alpha Private Feed',
                    isDefault: true,
                    enabled: true,
                    url: 'http://alpha-a.localhost:8080/feeds/alpha-show-a/u/tok123.xml',
                    createdAt: '2026-07-22T12:00:00Z',
                    updatedAt: '2026-07-22T12:00:00Z',
                },
            ]),
        )
        expect(result?.data[0].url).toContain('http://alpha-a.localhost:8080/')
    })

    it('accepts a subscriber download list with loopback http urls', () => {
        const result = parseSubscriberDownloadListEnvelope(
            envelopeWith([
                {
                    id: 71,
                    title: 'bonus.pdf',
                    assetType: 'DOCUMENT',
                    mimeType: 'application/pdf',
                    sizeBytes: 1024,
                    downloadUrl: 'http://alpha-a.localhost:8080/files/bonus.pdf',
                },
            ]),
        )
        expect(result?.data).toHaveLength(1)
        expect(result?.data[0].title).toBe('bonus.pdf')
    })

    it('rejects download urls that are not https or loopback', () => {
        expect(
            parseSubscriberDownloadListEnvelope(
                envelopeWith([
                    {
                        id: 71,
                        title: 'bonus.pdf',
                        assetType: 'DOCUMENT',
                        mimeType: 'application/pdf',
                        sizeBytes: 1024,
                        downloadUrl: 'http://evil.example.test/bonus.pdf',
                    },
                ]),
            ),
        ).toBeNull()
    })

    it('accepts a checkout session url on https', () => {
        expect(
            parseCheckoutSessionEnvelope(
                envelopeWith({url: 'https://checkout.stripe.com/c/pay/cs_test'}),
            ),
        ).toBe('https://checkout.stripe.com/c/pay/cs_test')
    })

    it('accepts a single subscriber feed envelope', () => {
        const result = parseSubscriberFeedEnvelope(
            envelopeWith({
                id: 1,
                title: 'Alpha Private Feed',
                isDefault: true,
                enabled: false,
                url: 'http://alpha-a.localhost:8080/feeds/alpha-show-a/u/tok123.xml',
                createdAt: '2026-07-22T12:00:00Z',
                updatedAt: '2026-07-22T12:00:00Z',
            }),
        )
        expect(result?.data.enabled).toBe(false)
        expect(result?.data.url).toContain('http://alpha-a.localhost:8080/')
    })

    it('rejects http subscriber feed urls on non-loopback hosts', () => {
        const result = parseSubscriberFeedListEnvelope(
            envelopeWith([
                {
                    id: 1,
                    title: 'Alpha Private Feed',
                    isDefault: true,
                    enabled: true,
                    url: 'http://evil.example.test/feeds/alpha-show-a/u/tok123.xml',
                    createdAt: '2026-07-22T12:00:00Z',
                    updatedAt: '2026-07-22T12:00:00Z',
                },
            ]),
        )
        expect(result).toBeNull()
    })
})

describe('parseSubscriptionListEnvelope', () => {
    it('accepts a subscriber membership list', () => {
        const result = parseSubscriptionListEnvelope(
            envelopeWith([
                {
                    id: 9,
                    productId: 2,
                    productSlug: 'supporter',
                    productTitle: 'Supporter',
                    offeringType: 'LEVEL',
                    status: 'PAST_DUE',
                    source: 'STRIPE',
                    startedAt: '2026-08-01T00:00:00Z',
                    endsAt: '2026-09-01T00:00:00Z',
                },
            ]),
        )
        expect(result?.data).toEqual([
            {
                id: 9,
                productId: 2,
                productSlug: 'supporter',
                productTitle: 'Supporter',
                offeringType: 'LEVEL',
                status: 'PAST_DUE',
                source: 'STRIPE',
                startedAt: '2026-08-01T00:00:00Z',
                endsAt: '2026-09-01T00:00:00Z',
            },
        ])
    })

    it('rejects a malformed membership row', () => {
        expect(
            parseSubscriptionListEnvelope(
                envelopeWith([
                    {
                        id: 9,
                        productId: 2,
                        productSlug: 'supporter',
                        productTitle: 'Supporter',
                        offeringType: 'LEVEL',
                        status: 'ACTIVE',
                        source: 'STRIPE',
                    },
                ]),
            ),
        ).toBeNull()
    })
})
