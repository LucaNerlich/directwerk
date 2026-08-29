import {describe, expect, it} from 'vitest'
import {publicEpisodePageUrl, publicSiteOrigin} from '@/lib/podcast/publicUrls'
describe('public episode URLs', () => {
    it('uses public site URL', () => { expect(publicSiteOrigin('https://demo.example')).toBe('https://demo.example') })
    it('builds episode URL', () => { expect(publicEpisodePageUrl('https://demo.example', 'folge-1')).toBe('https://demo.example/episodes/folge-1') })
    it('returns null for missing site URLs', () => {
        expect(publicSiteOrigin(null)).toBeNull()
        expect(publicEpisodePageUrl(null, 'folge-1')).toBeNull()
    })
})
