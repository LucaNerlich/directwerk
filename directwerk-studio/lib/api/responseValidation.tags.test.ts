import {describe, expect, it} from 'vitest'

import {
    parseCategoryEnvelope,
    parseEpisodeEnvelope,
    parseArticleEnvelope,
    parseFormatEnvelope,
    parseSeriesEnvelope,
} from '@/lib/api/responseValidation'

function envelope(data: unknown) {
    return {statusCode: 200, statusMessage: 'OK', data}
}

describe('tag and rssUrl parsing', () => {
    it('parses episode formats and categories tags', () => {
        const parsed = parseEpisodeEnvelope(
            envelope({
                id: 1,
                slug: 'ep-1',
                title: 'Episode 1',
                status: 'DRAFT',
                accessPolicy: 'FREE',
                publishedAt: null,
                seriesId: 1,
                description: null,
                episodeNumber: null,
                audioAssetId: null,
                requiredLevelSortOrder: null,
                scheduledAt: null,
                formats: [{id: 1, slug: 'interview', name: 'Interview'}],
                categories: [{id: 2, slug: 'tech', name: 'Tech'}],
            }),
        )

        expect(parsed?.data.formats).toEqual([{id: 1, slug: 'interview', name: 'Interview'}])
        expect(parsed?.data.categories).toEqual([{id: 2, slug: 'tech', name: 'Tech'}])
    })

    it('parses article categories tags', () => {
        const parsed = parseArticleEnvelope(
            envelope({
                id: 1,
                slug: 'art-1',
                title: 'Article 1',
                status: 'DRAFT',
                accessPolicy: 'FREE',
                publishedAt: null,
                body: null,
                excerpt: null,
                seoDescription: null,
                heroAssetId: null,
                requiredLevelSortOrder: null,
                scheduledAt: null,
                categories: [{id: 3, slug: 'news', name: 'News'}],
            }),
        )

        expect(parsed?.data.categories).toEqual([{id: 3, slug: 'news', name: 'News'}])
    })

    it('parses series rssUrl', () => {
        const parsed = parseSeriesEnvelope(
            envelope({
                id: 1,
                slug: 'show',
                title: 'Show',
                status: 'DRAFT',
                description: null,
                coverAssetId: null,
                language: null,
                itunesCategory: null,
                defaultRequiredLevelSortOrder: null,
                rssUrl: 'http://localhost:8080/feeds/tenant/show.xml',
            }),
        )

        expect(parsed?.data.rssUrl).toBe('http://localhost:8080/feeds/tenant/show.xml')
    })

    it('parses a single format envelope with detail fields', () => {
        const parsed = parseFormatEnvelope(
            envelope({
                id: 1,
                slug: 'interview',
                name: 'Interview',
                active: true,
                description: 'Long-form talks',
                requiredLevelSortOrder: 1,
                sortOrder: 0,
            }),
        )

        expect(parsed?.data).toEqual({
            id: 1,
            slug: 'interview',
            name: 'Interview',
            active: true,
            description: 'Long-form talks',
            requiredLevelSortOrder: 1,
            sortOrder: 0,
        })
    })

    it('parses a single category envelope', () => {
        const parsed = parseCategoryEnvelope(
            envelope({id: 1, slug: 'news', name: 'News', parentId: null, active: true}),
        )

        expect(parsed?.data).toEqual({id: 1, slug: 'news', name: 'News', parentId: null, active: true})
    })
})
