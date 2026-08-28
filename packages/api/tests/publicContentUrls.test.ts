import {describe, expect, it} from 'vitest'

import {
    publicArticlePageUrl,
    publicEpisodePageUrl,
    publicSiteOrigin,
} from '../src/urls/publicContentUrls'

describe('publicContentUrls', () => {
    it('derives the site origin from the tenant feed URL', () => {
        expect(
            publicSiteOrigin('https://demo.example/feeds/demo/podcast.xml'),
        ).toBe('https://demo.example')
    })

    it('builds the public episode page URL', () => {
        expect(
            publicEpisodePageUrl(
                'https://demo.example/feeds/demo/podcast.xml',
                'folge-1',
            ),
        ).toBe('https://demo.example/episodes/folge-1')
    })

    it('builds the public article page URL', () => {
        expect(
            publicArticlePageUrl(
                'https://podcast.example/feeds/tenant/podcast.xml',
                'mein-beitrag',
            ),
        ).toBe('https://podcast.example/articles/mein-beitrag')
    })

    it('returns null for missing feed URLs', () => {
        expect(publicSiteOrigin(null)).toBeNull()
        expect(publicEpisodePageUrl(null, 'folge-1')).toBeNull()
        expect(publicArticlePageUrl(null, 'slug')).toBeNull()
    })
})
