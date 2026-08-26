import {describe, expect, it} from 'vitest'

import {
    createPublicContentParsers,
    parseMeEnvelope,
    parseStudioSiteConfigEnvelope,
    parsePublicSiteConfigEnvelope,
    parseSubscriberFeedAdminEnvelope,
    parseTokenResponse,
    isQueueJob,
} from '../src/validation'

describe('parseTokenResponse', () => {
    it('accepts minimal bearer payloads and rejects whitespace tokens', () => {
        expect(parseTokenResponse({access_token: 'abc'})).toEqual({
            access_token: 'abc',
        })
        expect(parseTokenResponse({access_token: 'a b'})).toBeNull()
        expect(parseTokenResponse({access_token: ''})).toBeNull()
        expect(
            parseTokenResponse({access_token: 'abc', expires_in: -1}),
        ).toBeNull()
    })
})

describe('parseMeEnvelope', () => {
    it('validates the me payload', () => {
        const envelope = parseMeEnvelope({
            statusCode: 200,
            data: {
                email: 'a@b.co',
                name: null,
                roles: ['EDITOR'],
                tenantId: 3,
            },
        })
        expect(envelope?.data.roles).toEqual(['EDITOR'])
        expect(
            parseMeEnvelope({statusCode: 200, data: {email: 'nope', roles: []}}),
        ).toBeNull()
    })
})

describe('site-config envelopes', () => {
    const base = {
        statusCode: 200,
        data: {
            tenant: {slug: 'show', name: 'Show'},
            enabledModules: ['PODCAST'],
            branding: {
                siteTitle: null,
                primaryColor: '#000000',
                secondaryColor: null,
                logoUrl: null,
            },
            publicRssUrl: null,
        },
    }

    it('public shape ignores studio desks', () => {
        const parsed = parsePublicSiteConfigEnvelope(base)
        expect(parsed?.data.enabledModules).toEqual(['PODCAST'])
    })

    it('studio shape requires the desk configuration', () => {
        const withDesks = {
            ...base,
            data: {
                ...base.data,
                studioHome: 'PODCAST_DESK',
                studioDesks: ['WRITE', 'PODCAST'],
                emailNotifyAvailable: true,
            },
        }
        expect(parseStudioSiteConfigEnvelope(withDesks)?.data.studioHome).toBe(
            'PODCAST_DESK',
        )
        // Without the desk config the studio parser refuses the response.
        expect(parseStudioSiteConfigEnvelope(base)).toBeNull()
    })
})

describe('subscriber feed projections', () => {
    it('admin view carries owner identity instead of a URL', () => {
        const parsed = parseSubscriberFeedAdminEnvelope({
            statusCode: 200,
            data: {
                id: 1,
                userId: 9,
                userEmail: 'sub@example.com',
                title: 'Default',
                isDefault: true,
                enabled: true,
                formatIds: [4],
                formats: [{id: 4, slug: 'tech', name: 'Tech'}],
                createdAt: '2026-01-01T00:00:00Z',
                updatedAt: '2026-01-01T00:00:00Z',
            },
        })
        expect(parsed?.data.userEmail).toBe('sub@example.com')
        expect(parsed?.data.formats[0]?.slug).toBe('tech')
    })

    it('rejects malformed admin views', () => {
        expect(
            parseSubscriberFeedAdminEnvelope({
                statusCode: 200,
                data: {id: 1},
            }),
        ).toBeNull()
    })
})

describe('createPublicContentParsers', () => {
    const parsers = createPublicContentParsers({
        sanitizeHtml: (html) => html.replaceAll('<script>', ''),
    })

    it('sanitizes article bodies through the injected policy', () => {
        const parsed = parsers.parsePublicArticleListEnvelope({
            statusCode: 200,
            data: [
                {
                    id: 1,
                    slug: 'hello',
                    title: 'Hello',
                    body: '<script>alert(1)</script><p>Hi</p>',
                    excerpt: null,
                    seoDescription: null,
                    heroAssetId: null,
                    accessPolicy: 'FREE',
                    requiredLevelSortOrder: null,
                    publishedAt: null,
                    categories: [],
                },
            ],
        })
        expect(parsed?.data[0]?.body).not.toContain('<script>')
        expect(parsed?.data[0]?.body).toContain('<p>Hi</p>')
    })

    it('coerces unsafe audio URLs to null without failing the episode', () => {
        const parsed = parsers.parsePublicEpisodeListEnvelope({
            statusCode: 200,
            data: [
                {
                    id: 2,
                    seriesId: 1,
                    seriesSlug: 's',
                    slug: 'e',
                    title: 'E',
                    description: null,
                    durationSeconds: null,
                    accessPolicy: 'PAID',
                    requiredLevelSortOrder: 1,
                    publishedAt: null,
                    audioCdnUrl: 'http://evil.example/x.mp3',
                },
            ],
        })
        expect(parsed?.data[0]?.audioCdnUrl).toBeNull()
    })
})

describe('isQueueJob', () => {
    it('validates platform queue jobs', () => {
        expect(
            isQueueJob({
                id: 'j1',
                queue: 'email',
                payload: {},
                priority: 1,
                status: 'QUEUED',
                availableAt: '2026-01-01T00:00:00Z',
                attempts: 0,
                maxAttempts: 3,
                lockedBy: null,
                lockedUntil: null,
                lastError: null,
                createdAt: '2026-01-01T00:00:00Z',
                updatedAt: '2026-01-01T00:00:00Z',
            }),
        ).toBe(true)
        expect(isQueueJob({id: 'j1'})).toBe(false)
        expect(isQueueJob(null)).toBe(false)
    })
})
