import {describe, expect, it} from 'vitest'

import {publicArticlePageUrl} from '@/lib/write/publicUrls'

describe('publicArticlePageUrl', () => {
    it('builds article URL from public site origin', () => {
        expect(publicArticlePageUrl('https://podcast.example', 'mein-beitrag')).toBe(
            'https://podcast.example/articles/mein-beitrag',
        )
    })

    it('falls back to feed URL origin when publicSiteUrl is absent', () => {
        expect(
            publicArticlePageUrl(
                null,
                'mein-beitrag',
                'https://podcast.example/feeds/tenant/podcast.xml',
            ),
        ).toBe('https://podcast.example/articles/mein-beitrag')
    })

    it('returns null without origin', () => {
        expect(publicArticlePageUrl(null, 'slug')).toBeNull()
    })
})
