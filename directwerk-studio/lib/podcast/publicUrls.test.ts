import {describe, expect, it} from 'vitest'

import {publicEpisodePageUrl, publicSiteOrigin} from '@/lib/podcast/publicUrls'

describe('public episode URLs', () => {
    it('prefers the server-provided public site URL', () => {
        expect(publicSiteOrigin('https://demo.example', null)).toBe('https://demo.example')
    })

    it('derives the site origin from the tenant feed URL when publicSiteUrl is absent', () => {
        expect(
            publicSiteOrigin(null, 'https://demo.example/feeds/demo/podcast.xml'),
        ).toBe('https://demo.example')
    })

    it('builds the public episode page URL', () => {
        expect(publicEpisodePageUrl('https://demo.example', 'folge-1')).toBe(
            'https://demo.example/episodes/folge-1',
        )
    })

    it('returns null for missing site URLs', () => {
        expect(publicSiteOrigin(null, null)).toBeNull()
        expect(publicEpisodePageUrl(null, 'folge-1')).toBeNull()
    })
})
