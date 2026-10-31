import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('next/navigation', () => ({
    usePathname: () => '/de/articles/sicherer-beitrag',
}))

import type {PublicArticle} from '@directwerk/api/types'

import {TestLocale} from '@/lib/i18n/testWrapper'

import ArticleDetailClient from './article-detail-client'

afterEach(cleanup)

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
        heroImageUrl: null,
        accessPolicy: 'FREE',
        requiredLevelSortOrder: null,
        publishedAt: null,
        categories: [],
    }
}

describe('ArticleDetailClient content rendering', () => {
    it('sanitizes stored article HTML before injecting it into the DOM', () => {
        const {container} = render(
            <TestLocale><ArticleDetailClient
                slug="sicherer-beitrag"
                initialPublicArticle={buildArticle(MALICIOUS_BODY)}
            /></TestLocale>,
        )

        expect(container.querySelector('script')).toBeNull()
        expect(container.innerHTML).not.toContain('javascript:')
        expect(container.innerHTML).not.toContain('onerror')
        expect(container.textContent).toContain('Lesbarer Text')
    })

    it('preserves returnTo on locked-description sign-in link', () => {
        render(
            <TestLocale>
                <ArticleDetailClient
                    slug="sicherer-beitrag"
                    initialPublicArticle={{
                        ...buildArticle(''),
                        body: null,
                        accessPolicy: 'PAID',
                    }}
                />
            </TestLocale>,
        )

        expect(screen.getByRole('link', {name: 'anmelden'})).toHaveAttribute(
            'href',
            '/de/login?returnTo=%2Fde%2Farticles%2Fsicherer-beitrag',
        )
    })
})
