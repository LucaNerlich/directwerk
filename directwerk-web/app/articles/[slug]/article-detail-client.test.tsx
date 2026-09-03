import {render} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import type {PublicArticle} from '@directwerk/api/types'

import ArticleDetailClient from './article-detail-client'

const MALICIOUS_BODY =
    '<p>Lesbarer Text</p>' +
    '<script>alert("stored-xss")</script>' +
    '<p><a href="javascript:alert(1)">Klick</a></p>' +
    '<img src="x" onerror="alert(2)" />'

function buildArticle(body: string): PublicArticle {
    return {
        id: 1,
        slug: 'sicherer-beitrag',
        title: 'Sicherer Beitrag',
        body,
        excerpt: null,
        seoDescription: null,
        heroAssetId: null,
        accessPolicy: 'FREE',
        requiredLevelSortOrder: null,
        publishedAt: null,
        categories: [],
    }
}

describe('ArticleDetailClient content rendering', () => {
    it('sanitizes stored article HTML before injecting it into the DOM', () => {
        const {container} = render(
            <ArticleDetailClient
                slug="sicherer-beitrag"
                initialPublicArticle={buildArticle(MALICIOUS_BODY)}
            />,
        )

        expect(container.querySelector('script')).toBeNull()
        expect(container.innerHTML).not.toContain('javascript:')
        expect(container.innerHTML).not.toContain('onerror')
        expect(container.textContent).toContain('Lesbarer Text')
    })
})
