import {describe, expect, it} from 'vitest'

import {
    publicArticlePageUrl,
    publicEpisodePageUrl,
    publicSiteOrigin,
} from '../src/urls/publicContentUrls'

describe('publicContentUrls', () => {
    it('prefers the server-provided public site URL', () => {
        expect(publicSiteOrigin('https://demo.example', null)).toBe('https://demo.example')
    })

    it('falls back to deriving the site origin from the tenant feed URL', () => {
        expect(
            publicSiteOrigin(null, 'https://demo.example/feeds/demo/podcast.xml'),
        ).toBe('https://demo.example')
    })

    it('builds the public episode page URL from publicSiteUrl', () => {
        expect(publicEpisodePageUrl('https://demo.example', 'folge-1')).toBe(
            'https://demo.example/episodes/folge-1',
        )
    })

    it('builds the public article page URL from publicSiteUrl', () => {
        expect(publicArticlePageUrl('https://podcast.example', 'mein-beitrag')).toBe(
            'https://podcast.example/articles/mein-beitrag',
        )
    })

    it('returns null for missing site URLs', () => {
        expect(publicSiteOrigin(null, null)).toBeNull()
        expect(publicEpisodePageUrl(null, 'folge-1')).toBeNull()
        expect(publicArticlePageUrl(null, 'slug')).toBeNull()
    })
})
