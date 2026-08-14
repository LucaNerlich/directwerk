import {describe, expect, it} from 'vitest'

import {
    parseAccessEnvelope,
    parseMediaListEnvelope,
    parseMeEnvelope,
    parsePreviewUrlEnvelope,
    parsePublicArticleEnvelope,
    parsePublicEpisodeListEnvelope,
    parseSiteConfigEnvelope,
    parseSubscriberFeedListEnvelope,
    parseTokenResponse,
} from './responseValidation'

function validAsset(id: number) {
    return {
        id,
        s3Key: `tenant/staging/${id}.jpg`,
        visibility: 'private',
        scope: 'tenant',
        assetType: 'image',
        status: 'ready',
        mimeType: null,
        sizeBytes: null,
        originalFilename: null,
        episodeId: null,
        ownerUserId: null,
        cdnUrl: null,
        createdAt: '2026-07-20T00:00:00Z',
        updatedAt: '2026-07-20T00:00:00Z',
    }
}

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


describe('parseMediaListEnvelope', () => {
    it('accepts an empty list', () => {
        const result = parseMediaListEnvelope(envelopeWith([]))
        expect(result).not.toBeNull()
        expect(result?.data).toEqual([])
    })

    it('accepts exactly 100 valid assets', () => {
        const assets = Array.from({length: 100}, (_, i) => validAsset(i + 1))
        const result = parseMediaListEnvelope(envelopeWith(assets))
        expect(result).not.toBeNull()
        expect(result?.data).toHaveLength(100)
    })

    it('rejects 101 assets', () => {
        const assets = Array.from({length: 101}, (_, i) => validAsset(i + 1))
        expect(parseMediaListEnvelope(envelopeWith(assets))).toBeNull()
    })

    it('rejects the whole list when a single asset is malformed', () => {
        const good = validAsset(1)
        const bad = validAsset(2) as Partial<ReturnType<typeof validAsset>>
        delete bad.s3Key
        expect(parseMediaListEnvelope(envelopeWith([good, bad]))).toBeNull()
    })

    it('returns typed data for a single valid asset', () => {
        const result = parseMediaListEnvelope(envelopeWith([validAsset(42)]))
        expect(result).not.toBeNull()
        expect(result?.data[0].id).toBe(42)
        expect(result?.data[0].s3Key).toBe('tenant/staging/42.jpg')
    })

    it('accepts a public CDN URL when present', () => {
        const result = parseMediaListEnvelope(
            envelopeWith([
                {
                    ...validAsset(7),
                    visibility: 'PUBLIC',
                    status: 'READY',
                    cdnUrl: 'https://cdn.example.test/tenant/public/7.jpg',
                },
            ])
        )
        expect(result?.data[0].cdnUrl).toBe(
            'https://cdn.example.test/tenant/public/7.jpg'
        )
    })
})

describe('parseMediaAsset field boundaries', () => {
    it('rejects a non-integer id', () => {
        expect(parseMediaListEnvelope(envelopeWith([{...validAsset(1), id: 'one'}]))).toBeNull()
    })

    it('rejects a negative id', () => {
        expect(parseMediaListEnvelope(envelopeWith([{...validAsset(1), id: -1}]))).toBeNull()
    })

    it('rejects an unsafe integer id', () => {
        expect(
            parseMediaListEnvelope(envelopeWith([{...validAsset(1), id: Number.MAX_SAFE_INTEGER + 1}])),
        ).toBeNull()
    })

    it('rejects an overlong s3Key (>512 chars)', () => {
        expect(
            parseMediaListEnvelope(envelopeWith([{...validAsset(1), s3Key: 'a'.repeat(513)}])),
        ).toBeNull()
    })

    it('rejects a non-string s3Key', () => {
        expect(parseMediaListEnvelope(envelopeWith([{...validAsset(1), s3Key: 42}]))).toBeNull()
    })

    it('accepts null for all nullable fields', () => {
        const asset = {
            ...validAsset(1),
            mimeType: null,
            sizeBytes: null,
            originalFilename: null,
            episodeId: null,
            ownerUserId: null,
        }
        const result = parseMediaListEnvelope(envelopeWith([asset]))
        expect(result).not.toBeNull()
        expect(result?.data[0].mimeType).toBeNull()
    })

    it('rejects a negative sizeBytes', () => {
        expect(
            parseMediaListEnvelope(envelopeWith([{...validAsset(1), sizeBytes: -1}])),
        ).toBeNull()
    })

    it('rejects a float sizeBytes', () => {
        expect(
            parseMediaListEnvelope(envelopeWith([{...validAsset(1), sizeBytes: 1.5}])),
        ).toBeNull()
    })

    it('rejects an overlong originalFilename (>512 chars)', () => {
        expect(
            parseMediaListEnvelope(
                envelopeWith([{...validAsset(1), originalFilename: 'a'.repeat(513)}]),
            ),
        ).toBeNull()
    })
})

describe('parsePreviewUrlEnvelope', () => {
    it('accepts a valid HTTPS URL', () => {
        const url = 'https://cdn.example.test/media/foo.jpg'
        expect(parsePreviewUrlEnvelope({data: {url}})).toBe(url)
    })

    it('rejects non-HTTPS URLs', () => {
        expect(
            parsePreviewUrlEnvelope({data: {url: 'http://cdn.example.test/foo.jpg'}}),
        ).toBeNull()
    })

    it('rejects a relative path', () => {
        expect(parsePreviewUrlEnvelope({data: {url: '/media/foo.jpg'}})).toBeNull()
    })

    it('rejects a missing data.url field', () => {
        expect(parsePreviewUrlEnvelope({data: {}})).toBeNull()
    })

    it('rejects an empty string', () => {
        expect(parsePreviewUrlEnvelope({data: {url: ''}})).toBeNull()
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
