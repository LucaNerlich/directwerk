import {describe, expect, it} from 'vitest'

import {
    publicArticlePageUrl,
    publicEpisodePageUrl,
    publicSiteOrigin,
} from '../src/urls/publicContentUrls'

describe('publicContentUrls', () => {
    it('uses the server-provided public site URL', () => {
        expect(publicSiteOrigin('https://demo.example')).toBe('https://demo.example')
    })

    it('builds episode URL', () => {
        expect(publicEpisodePageUrl('https://demo.example', 'folge-1')).toBe(
            'https://demo.example/episodes/folge-1',
        )
    })

    it('builds article URL', () => {
        expect(publicArticlePageUrl('https://podcast.example', 'mein-beitrag')).toBe(
            'https://podcast.example/articles/mein-beitrag',
        )
    })

    it('returns null for missing site URLs', () => {
        expect(publicSiteOrigin(null)).toBeNull()
        expect(publicEpisodePageUrl(null, 'folge-1')).toBeNull()
        expect(publicArticlePageUrl(null, 'slug')).toBeNull()
    })

    it('rejects javascript: site URLs instead of interpolating them', () => {
        expect(publicSiteOrigin('javascript:alert(1)')).toBeNull()
        expect(publicEpisodePageUrl('javascript:alert(1)', 'folge-1')).toBeNull()
        expect(publicArticlePageUrl('javascript:alert(1)', 'slug')).toBeNull()
    })
})
