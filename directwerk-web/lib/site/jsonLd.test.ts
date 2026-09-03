import {describe, expect, it} from 'vitest'

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
