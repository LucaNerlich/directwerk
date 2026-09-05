import {describe, expect, it} from 'vitest'

import {
    createPublicContentParsers,
    parseBulkImportQueuedEnvelope,
    parseEffectiveRightsEnvelope,
    parseImportedEpisodeEnvelope,
    parseMeEnvelope,
    parseMediaAsset,
    parseMediaFolder,
    parseMediaFolderListEnvelope,
    parseMediaUploadLimitsEnvelope,
    parsePermissionRestriction,
    parsePermissionRestrictionListEnvelope,
    parseRssImportPreviewEnvelope,
    parseStudioSiteConfigEnvelope,
    parsePublicSiteConfigEnvelope,
    parseSubscriberFeedAdminEnvelope,
    parseTenantUserListEnvelope,
    parseTokenResponse,
    isQueueJob,
} from '../src/validation'

const rssEpisodePreview = {
    guid: 'episode-guid-1',
    title: 'Episode 1',
    description: 'Shownotes',
    publishedAt: '2026-08-29T12:00:00Z',
    durationSeconds: 3600,
    episodeNumber: 1,
    audioUrl: 'https://cdn.example.com/episode-1.mp3',
    audioMimeType: 'audio/mpeg',
    audioSizeBytes: 12_345,
    imageUrl: 'https://cdn.example.com/episode-1.jpg',
    suggestedSlug: 'episode-1',
    alreadyImportedEpisodeId: null,
}

const rssImportPreview = {
    feedUrl: 'https://cdn.example.com/feed.xml',
    channel: {
        title: 'Example Show',
        description: 'About the show',
        language: 'de-DE',
        itunesCategory: 'News',
        imageUrl: 'https://cdn.example.com/show.jpg',
        link: 'https://example.com',
        suggestedSlug: 'example-show',
    },
    episodes: [rssEpisodePreview],
    truncated: false,
}

const importedEpisode = {
    id: 42,
    slug: 'episode-1',
    title: 'Episode 1',
    status: 'DRAFT',
    accessPolicy: 'FREE',
    publishedAt: null,
    seriesId: 7,
    seriesSlug: 'example-show',
    description: 'Shownotes',
    episodeNumber: 1,
    audioAssetId: 11,
    coverAssetId: null,
    enclosureEnabled: true,
    requiredLevelSortOrder: null,
    scheduledAt: null,
    formats: [],
    categories: [],
}

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

describe('RSS import envelopes', () => {
    it('parses a complete feed preview without dropping import metadata', () => {
        const parsed = parseRssImportPreviewEnvelope({
            statusCode: 200,
            statusMessage: 'OK',
            data: rssImportPreview,
        })

        expect(parsed?.data).toEqual(rssImportPreview)
        expect(parsed?.statusMessage).toBe('OK')
    })

    it('normalizes omitted optional episode numbers to null', () => {
        const {durationSeconds, episodeNumber, audioSizeBytes, alreadyImportedEpisodeId, ...required} =
            rssEpisodePreview
        const parsed = parseRssImportPreviewEnvelope({
            statusCode: 200,
            data: {...rssImportPreview, episodes: [required]},
        })

        expect(parsed?.data.episodes[0]).toMatchObject({
            durationSeconds: null,
            episodeNumber: null,
            audioSizeBytes: null,
            alreadyImportedEpisodeId: null,
        })
    })

    it.each([
        ['zero duration', {...rssEpisodePreview, durationSeconds: 0}],
        ['negative episode number', {...rssEpisodePreview, episodeNumber: -1}],
        ['fractional audio size', {...rssEpisodePreview, audioSizeBytes: 1.5}],
        ['unsafe existing episode id', {...rssEpisodePreview, alreadyImportedEpisodeId: Number.MAX_VALUE}],
    ])('rejects an episode with %s', (_label, episode) => {
        expect(
            parseRssImportPreviewEnvelope({
                statusCode: 200,
                data: {...rssImportPreview, episodes: [episode]},
            }),
        ).toBeNull()
    })

    it('rejects malformed nested records and values beyond API bounds', () => {
        expect(
            parseRssImportPreviewEnvelope({
                statusCode: 200,
                data: {...rssImportPreview, channel: null},
            }),
        ).toBeNull()
        expect(
            parseRssImportPreviewEnvelope({
                statusCode: 200,
                data: {
                    ...rssImportPreview,
                    episodes: [{...rssEpisodePreview, guid: 'x'.repeat(513)}],
                },
            }),
        ).toBeNull()
        expect(
            parseRssImportPreviewEnvelope({
                statusCode: 200,
                data: {
                    ...rssImportPreview,
                    channel: {...rssImportPreview.channel, suggestedSlug: 'x'.repeat(65)},
                },
            }),
        ).toBeNull()
    })

    it('parses imported episodes and requires the idempotency flag to be boolean', () => {
        const parsed = parseImportedEpisodeEnvelope({
            statusCode: 200,
            data: {episode: importedEpisode, alreadyImported: true},
        })

        expect(parsed?.data.episode.id).toBe(42)
        expect(parsed?.data.alreadyImported).toBe(true)
        expect(
            parseImportedEpisodeEnvelope({
                statusCode: 200,
                data: {episode: importedEpisode, alreadyImported: 'true'},
            }),
        ).toBeNull()
    })

    it('rejects imported results containing an invalid episode', () => {
        expect(
            parseImportedEpisodeEnvelope({
                statusCode: 200,
                data: {
                    episode: {...importedEpisode, seriesId: 0},
                    alreadyImported: false,
                },
            }),
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
            publicSiteUrl: null,
            publicRssUrl: null,
        },
    }

    it('public shape ignores studio desks', () => {
        const parsed = parsePublicSiteConfigEnvelope(base)
        expect(parsed?.data.enabledModules).toEqual(['PODCAST'])
        expect(parsed?.data.emailNotifyAvailable).toBe(false)
        expect(parsed?.data.analytics).toBeNull()
    })

    it('public shape exposes emailNotifyAvailable when enabled', () => {
        const parsed = parsePublicSiteConfigEnvelope({
            ...base,
            data: {
                ...base.data,
                emailNotifyAvailable: true,
            },
        })
        expect(parsed?.data.emailNotifyAvailable).toBe(true)
    })

    it('public shape parses analytics when configured', () => {
        const parsed = parsePublicSiteConfigEnvelope({
            ...base,
            data: {
                ...base.data,
                analytics: {
                    umamiWebsiteId: '12345678-abcd-abcd-abcd-abcdefabcdef',
                    umamiHostUrl: 'https://umami.example.com',
                    umamiScriptUrl: 'https://umami.example.com/script.js',
                },
            },
        })
        expect(parsed?.data.analytics).toEqual({
            umamiWebsiteId: '12345678-abcd-abcd-abcd-abcdefabcdef',
            umamiHostUrl: 'https://umami.example.com',
            umamiScriptUrl: 'https://umami.example.com/script.js',
        })
    })

    it('public shape drops invalid analytics payloads', () => {
        const parsed = parsePublicSiteConfigEnvelope({
            ...base,
            data: {
                ...base.data,
                analytics: {
                    umamiWebsiteId: '',
                    umamiHostUrl: 'https://umami.example.com',
                    umamiScriptUrl: 'https://umami.example.com/script.js',
                },
            },
        })
        expect(parsed?.data.analytics).toBeNull()
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

    it('coerces unsafe series feed URLs to null without failing the series', () => {
        const parsed = parsers.parsePublicSeriesListEnvelope({
            statusCode: 200,
            data: [
                {
                    id: 1,
                    slug: 'show',
                    title: 'Show',
                    description: null,
                    coverAssetId: null,
                    language: null,
                    itunesCategory: null,
                    rssUrl: 'javascript:alert(1)',
                },
            ],
        })
        expect(parsed?.data[0]?.rssUrl).toBeNull()
    })

    it('keeps safe https series feed URLs', () => {
        const parsed = parsers.parsePublicSeriesListEnvelope({
            statusCode: 200,
            data: [
                {
                    id: 1,
                    slug: 'show',
                    title: 'Show',
                    description: null,
                    coverAssetId: null,
                    language: null,
                    itunesCategory: null,
                    rssUrl: 'https://cdn.example.com/show.xml',
                },
            ],
        })
        expect(parsed?.data[0]?.rssUrl).toBe('https://cdn.example.com/show.xml')
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

    it('accepts tenant user list items without optional timestamp fields', () => {
        const parsed = parseTenantUserListEnvelope({
            statusCode: 200,
            statusMessage: 'OK',
            data: [
                {
                    userId: 1,
                    email: 'admin@example.com',
                    name: null,
                    roles: ['TENANT_ADMIN'],
                    status: 'ACTIVE',
                },
            ],
            errors: [],
            metadata: {},
        })

        expect(parsed?.data[0]?.invitedAt).toBeNull()
        expect(parsed?.data[0]?.lastLoginAt).toBeNull()
    })

    it('parses media folders and asset folder assignments', () => {
        expect(
            parseMediaFolder({
                id: 3,
                name: 'Interviews',
                parentId: null,
                createdAt: '2026-01-01T00:00:00Z',
                updatedAt: '2026-01-01T00:00:00Z',
            }),
        ).toMatchObject({id: 3, name: 'Interviews', parentId: null})
        expect(parseMediaFolder({id: 3, name: 'x', parentId: -1})).toBeNull()
        expect(
            parseMediaFolderListEnvelope({
                statusCode: 200,
                statusMessage: 'OK',
                data: [
                    {
                        id: 3,
                        name: 'Interviews',
                        parentId: 1,
                        createdAt: '2026-01-01T00:00:00Z',
                        updatedAt: '2026-01-01T00:00:00Z',
                    },
                ],
                errors: [],
                metadata: {},
            })?.data,
        ).toHaveLength(1)
    })

    it('parses unpaginated media folder lists larger than 500 entries', () => {
        const parsed = parseMediaFolderListEnvelope({
            statusCode: 200,
            statusMessage: 'OK',
            data: Array.from({length: 501}, (_, index) => ({
                id: index + 1,
                name: `Folder ${index + 1}`,
                parentId: null,
                createdAt: '2026-01-01T00:00:00Z',
                updatedAt: '2026-01-01T00:00:00Z',
            })),
        })

        expect(parsed?.data).toHaveLength(501)
    })

    it('parses effective media upload limits, rejecting partial bounds', () => {
        expect(
            parseMediaUploadLimitsEnvelope({
                statusCode: 200,
                statusMessage: 'OK',
                data: {
                    maxAudioBytes: 104857600,
                    maxImageBytes: 20971520,
                    maxVideoBytes: 1073741824,
                    maxDocumentBytes: 52428800,
                },
                errors: [],
                metadata: {},
            })?.data,
        ).toEqual({
            maxAudioBytes: 104857600,
            maxImageBytes: 20971520,
            maxVideoBytes: 1073741824,
            maxDocumentBytes: 52428800,
        })
        expect(
            parseMediaUploadLimitsEnvelope({
                statusCode: 200,
                statusMessage: 'OK',
                data: {maxAudioBytes: 1},
                errors: [],
                metadata: {},
            }),
        ).toBeNull()
    })

    it('parses queued bulk imports, rejecting malformed payloads', () => {
        expect(
            parseBulkImportQueuedEnvelope({
                statusCode: 202,
                statusMessage: 'OK',
                data: {
                    jobId: '9f2c1a4e-3b1f-4e5a-9c2d-7f6a5b4c3d2e1',
                    totalEpisodes: 40,
                    alreadyImported: 3,
                    notifyEmail: 'editor@example.com',
                },
                errors: [],
                metadata: {},
            })?.data,
        ).toEqual({
            jobId: '9f2c1a4e-3b1f-4e5a-9c2d-7f6a5b4c3d2e1',
            totalEpisodes: 40,
            alreadyImported: 3,
            notifyEmail: 'editor@example.com',
        })
        expect(
            parseBulkImportQueuedEnvelope({
                statusCode: 202,
                statusMessage: 'OK',
                data: {jobId: 'x', totalEpisodes: 1},
                errors: [],
                metadata: {},
            }),
        ).toBeNull()
    })

    it('parses media asset folder ids, tolerating older responses without one', () => {        const base = {
            id: 7,
            s3Key: 't/private/audio/a.mp3',
            visibility: 'PRIVATE',
            scope: 'CONTENT',
            assetType: 'AUDIO',
            status: 'READY',
            mimeType: 'audio/mpeg',
            sizeBytes: 100,
            originalFilename: 'a.mp3',
            episodeId: null,
            ownerUserId: null,
            cdnUrl: null,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
        }
        expect(parseMediaAsset({...base, folderId: 3})?.folderId).toBe(3)
        expect(parseMediaAsset({...base, folderId: null})?.folderId).toBeNull()
        expect(parseMediaAsset(base)?.folderId).toBeNull()
        expect(parseMediaAsset({...base, folderId: -1})).toBeNull()
    })

    it('parses creator ids leniently', () => {
        const base = {
            id: 7,
            s3Key: 't/private/audio/a.mp3',
            visibility: 'PRIVATE',
            scope: 'CONTENT',
            assetType: 'AUDIO',
            status: 'READY',
            mimeType: 'audio/mpeg',
            sizeBytes: 100,
            originalFilename: 'a.mp3',
            episodeId: null,
            ownerUserId: null,
            cdnUrl: null,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
        }
        expect(parseMediaAsset({...base, createdBy: 5})?.createdBy).toBe(5)
        expect(parseMediaAsset(base)?.createdBy).toBeNull()
        expect(
            parseMediaFolder({
                id: 3,
                name: 'Interviews',
                parentId: null,
                createdBy: 5,
                createdAt: '2026-01-01T00:00:00Z',
                updatedAt: '2026-01-01T00:00:00Z',
            })?.createdBy,
        ).toBe(5)
    })

    it('parses permission restrictions and effective rights', () => {
        expect(
            parsePermissionRestriction({entityType: 'EPISODE', operation: 'DELETE', scope: 'DENY'}),
        ).toEqual({entityType: 'EPISODE', operation: 'DELETE', scope: 'DENY'})
        expect(
            parsePermissionRestriction({entityType: 'EPISODE', operation: 'FLY', scope: 'DENY'}),
        ).toBeNull()
        expect(
            parsePermissionRestrictionListEnvelope({
                statusCode: 200,
                statusMessage: 'OK',
                data: [{entityType: 'ARTICLE', operation: 'PUBLISH', scope: 'OTHERS_ONLY'}],
                errors: [],
                metadata: {},
            })?.data,
        ).toHaveLength(1)
        expect(
            parseEffectiveRightsEnvelope({
                statusCode: 200,
                statusMessage: 'OK',
                data: {
                    userId: 5,
                    roles: ['EDITOR'],
                    restrictions: [
                        {entityType: 'EPISODE', operation: 'DELETE', scope: 'DENY'},
                    ],
                    effective: {
                        EPISODE: {DELETE: 'DENIED', UPDATE: 'OWN_ONLY', CREATE: 'FULL'},
                        ARTICLE: {PUBLISH: 'FULL'},
                    },
                },
                errors: [],
                metadata: {},
            })?.data?.effective.EPISODE?.DELETE,
        ).toBe('DENIED')
        expect(
            parseEffectiveRightsEnvelope({
                statusCode: 200,
                statusMessage: 'OK',
                data: {userId: 5, roles: ['EDITOR'], restrictions: [], effective: {EPISODE: {DELETE: 'MAYBE'}}},
                errors: [],
                metadata: {},
            }),
        ).toBeNull()
    })
})
