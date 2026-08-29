import {describe, expect, it} from 'vitest'

import {publicArticlePageUrl} from '@directwerk/api/urls/publicContentUrls'

describe('publicArticlePageUrl', () => {
    it('builds article URL from public site origin', () => {
        expect(publicArticlePageUrl('https://podcast.example', 'mein-beitrag')).toBe(
            'https://podcast.example/articles/mein-beitrag',
        )
    })

    it('returns null without origin', () => {
        expect(publicArticlePageUrl(null, 'slug')).toBeNull()
    })
})
