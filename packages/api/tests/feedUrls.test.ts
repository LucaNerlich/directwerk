import {describe, expect, it} from 'vitest'

import {
    publicEnclosure,
    publicPodcastFeedUrl,
    publicSeriesFeedUrl,
    privateEnclosure,
    seriesFeed,
    subscriberFeed,
    tenantPodcastFeed,
} from '../src/urls/feedUrls'

describe('feedUrls', () => {
    it('matches Java tenantPodcastFeed', () => {
        expect(tenantPodcastFeed('https://alpha.example.test', 'alpha')).toBe(
            'https://alpha.example.test/feeds/alpha/podcast.xml',
        )
    })

    it('matches Java seriesFeed', () => {
        expect(seriesFeed('http://localhost:8080', 'alpha', 'main-show')).toBe(
            'http://localhost:8080/feeds/alpha/main-show.xml',
        )
    })

    it('matches Java subscriberFeed', () => {
        expect(subscriberFeed('https://alpha.example.test', 'alpha', 'tok_123')).toBe(
            'https://alpha.example.test/feeds/alpha/u/tok_123.xml',
        )
    })

    it('builds enclosure URLs', () => {
        expect(publicEnclosure('https://demo.test', 'tenant', 'episode-1')).toBe(
            'https://demo.test/feeds/tenant/e/episode-1.mp3',
        )
        expect(
            privateEnclosure('https://demo.test', 'tenant', 'tok', 'episode-1'),
        ).toBe('https://demo.test/feeds/tenant/u/tok/e/episode-1.mp3')
    })

    it('uses http with API port for .localhost hosts in browser helpers', () => {
        expect(publicSeriesFeedUrl('alpha-a.localhost', 'alpha-show-a', 'main-show')).toBe(
            'http://alpha-a.localhost:8080/feeds/alpha-show-a/main-show.xml',
        )
    })

    it('builds the tenant-wide public podcast feed URL on loopback', () => {
        expect(publicPodcastFeedUrl('alpha-b.localhost', 'alpha-show-b')).toBe(
            'http://alpha-b.localhost:8080/feeds/alpha-show-b/podcast.xml',
        )
    })

    it('uses https for non-loopback hosts', () => {
        expect(publicPodcastFeedUrl('show.example.test', 'demo')).toBe(
            'https://show.example.test/feeds/demo/podcast.xml',
        )
    })

    it('encodes series slug path segments', () => {
        expect(publicSeriesFeedUrl('alpha-a.localhost', 'alpha-show-a', 'a b')).toBe(
            'http://alpha-a.localhost:8080/feeds/alpha-show-a/a%20b.xml',
        )
    })
})
