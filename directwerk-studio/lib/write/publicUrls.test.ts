import {describe, expect, it} from 'vitest'

import {publicArticlePageUrl} from '@/lib/write/publicUrls'

describe('publicArticlePageUrl', () => {
    it('builds article URL from feed origin', () => {
        expect(
            publicArticlePageUrl('https://podcast.example/feeds/tenant/podcast.xml', 'mein-beitrag'),
        ).toBe('https://podcast.example/articles/mein-beitrag')
    })

    it('returns null without origin', () => {
        expect(publicArticlePageUrl(null, 'slug')).toBeNull()
    })
})
