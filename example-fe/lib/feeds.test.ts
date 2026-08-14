import {describe, expect, it} from 'vitest'

import {
    feedOriginFromPublicRssUrl,
    isAllowedFeedUrl,
    publicFeedOrigin,
    publicPodcastFeedUrl,
    publicSeriesFeedUrl,
} from './feeds'

describe('public feed URLs', () => {
    it('uses http with API port for .localhost hosts', () => {
        expect(publicFeedOrigin('alpha-a.localhost')).toBe('http://alpha-a.localhost:8080')
        expect(publicPodcastFeedUrl('alpha-a.localhost', 'alpha-show-a')).toBe(
            'http://alpha-a.localhost:8080/feeds/alpha-show-a/podcast.xml',
        )
        expect(publicSeriesFeedUrl('alpha-a.localhost', 'alpha-show-a', 'main-show')).toBe(
            'http://alpha-a.localhost:8080/feeds/alpha-show-a/main-show.xml',
        )
    })

    it('uses https for non-loopback hosts', () => {
        expect(publicPodcastFeedUrl('show.example.test', 'demo')).toBe(
            'https://show.example.test/feeds/demo/podcast.xml',
        )
    })

    it('prefers an absolute origin when provided', () => {
        expect(
            publicSeriesFeedUrl(
                'http://alpha-a.localhost:8080',
                'alpha-show-a',
                'a b',
            ),
        ).toBe('http://alpha-a.localhost:8080/feeds/alpha-show-a/a%20b.xml')
    })

    it('extracts origin from publicRssUrl', () => {
        expect(
            feedOriginFromPublicRssUrl(
                'http://alpha-a.localhost:8080/feeds/alpha-show-a/podcast.xml',
            ),
        ).toBe('http://alpha-a.localhost:8080')
    })

    it('allows http feed URLs only on loopback hosts', () => {
        expect(
            isAllowedFeedUrl('http://alpha-a.localhost:8080/feeds/a/u/tok.xml'),
        ).toBe(true)
        expect(isAllowedFeedUrl('https://show.example.test/feeds/a/u/tok.xml')).toBe(
            true,
        )
        expect(isAllowedFeedUrl('http://evil.example.test/feeds/a/u/tok.xml')).toBe(
            false,
        )
    })
})
