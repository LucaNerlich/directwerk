import {describe, expect, it} from 'vitest'

import {buildPodcastEpisodeJsonLd} from './jsonLd'
import type {PublicEpisode} from '@directwerk/api/types'

import type {PublicArticle} from '@directwerk/api/types'

import {buildArticleJsonLd, serializeJsonLd} from './jsonLd'

function articleWithTitle(title: string): PublicArticle {
    return {
        id: 1,
        slug: 'test-article',
        title,
        body: null,
        excerpt: null,
        seoDescription: null,
        heroAssetId: null,
        heroImageUrl: null,
        accessPolicy: 'FREE',
        requiredLevelSortOrder: null,
        publishedAt: null,
        categories: [],
    }
}

describe('serializeJsonLd', () => {
    it('escapes a closing-script payload in article data', () => {
        const title = '</script><script>alert("json-ld-xss")</script>'
        const jsonLd = buildArticleJsonLd({
            article: articleWithTitle(title),
            origin: 'https://tenant.example',
        })

        const serialized = serializeJsonLd(jsonLd)

        expect(serialized).not.toContain('<')
        expect(serialized).toContain('\\u003c/script\\u003e')
        expect(JSON.parse(serialized)).toMatchObject({headline: title})
    })

    it('escapes every HTML-sensitive and line-separator character', () => {
        expect(serializeJsonLd({value: '<>&\u2028\u2029'})).toContain(
            '\\u003c\\u003e\\u0026\\u2028\\u2029',
        )
    })
})

describe('buildPodcastEpisodeJsonLd', () => {
    it('links the series without a slug-shaped name', () => {
        const episode = {
            id: 1,
            seriesId: 2,
            seriesSlug: 'main-show',
            episodeNumber: 1,
            slug: 'ep-1',
            title: 'Episode 1',
            description: 'Show notes',
            durationSeconds: 600,
            accessPolicy: 'FREE',
            requiredLevelSortOrder: null,
            publishedAt: null,
            audioCdnUrl: null,
            coverImageUrl: null,
            formats: [],
            categories: [],
        } as PublicEpisode

        const json = buildPodcastEpisodeJsonLd({
            episode,
            origin: 'https://alpha.example.test',
            lang: 'de',
        })

        expect(json.partOfSeries).toEqual({
            '@type': 'PodcastSeries',
            url: 'https://alpha.example.test/de/episodes',
        })
        expect(json.partOfSeries).not.toHaveProperty('name')
    })
})
