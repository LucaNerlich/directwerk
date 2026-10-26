import {describe, expect, it} from 'vitest'

import {
    DEFAULT_PUBLIC_LOCALE,
    publicArticlePageUrl,
    publicEpisodePageUrl,
    publicNewsletterSubscribeUrl,
    publicSiteOrigin,
} from '../src/urls/publicContentUrls'

describe('publicContentUrls', () => {
    it('uses the server-provided public site URL', () => {
        expect(publicSiteOrigin('https://demo.example')).toBe('https://demo.example')
    })

    it('builds locale-prefixed episode URL', () => {
        expect(publicEpisodePageUrl('https://demo.example', 'folge-1')).toBe(
            `https://demo.example/${DEFAULT_PUBLIC_LOCALE}/episodes/folge-1`,
        )
    })

    it('builds locale-prefixed article URL', () => {
        expect(publicArticlePageUrl('https://podcast.example', 'mein-beitrag')).toBe(
            `https://podcast.example/${DEFAULT_PUBLIC_LOCALE}/articles/mein-beitrag`,
        )
    })

    it('builds locale-prefixed newsletter subscribe URL', () => {
        expect(publicNewsletterSubscribeUrl('https://demo.example', 'weekly')).toBe(
            `https://demo.example/${DEFAULT_PUBLIC_LOCALE}/newsletter/weekly`,
        )
    })

    it('returns null for missing site URLs', () => {
        expect(publicSiteOrigin(null)).toBeNull()
        expect(publicEpisodePageUrl(null, 'folge-1')).toBeNull()
        expect(publicArticlePageUrl(null, 'slug')).toBeNull()
        expect(publicNewsletterSubscribeUrl(null, 'weekly')).toBeNull()
    })

    it('rejects javascript: site URLs instead of interpolating them', () => {
        expect(publicSiteOrigin('javascript:alert(1)')).toBeNull()
        expect(publicEpisodePageUrl('javascript:alert(1)', 'folge-1')).toBeNull()
        expect(publicArticlePageUrl('javascript:alert(1)', 'slug')).toBeNull()
        expect(publicNewsletterSubscribeUrl('javascript:alert(1)', 'weekly')).toBeNull()
    })
})
