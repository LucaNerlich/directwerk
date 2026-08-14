import {describe, expect, it} from 'vitest'

import {publicEpisodePageUrl, publicSiteOrigin} from '@/lib/podcast/publicUrls'

describe('public episode URLs', () => {
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

    it('returns null for missing feed URLs', () => {
        expect(publicSiteOrigin(null)).toBeNull()
        expect(publicEpisodePageUrl(null, 'folge-1')).toBeNull()
    })
})
