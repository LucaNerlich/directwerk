import {describe, expect, it} from 'vitest'

import {
    publicArticleFeedUrl,
    publicEnclosure,
    publicPodcastFeedUrl,
    publicSeriesFeedUrl,
    privateEnclosure,
    resolvePublicArticleFeedUrl,
    resolvePublicPodcastFeedUrl,
    seriesFeed,
    subscriberFeed,
    tenantArticleFeed,
    tenantPodcastFeed,
} from '../src/urls/feedUrls'
import type {PublicSiteConfig} from '../src/types'

const baseConfig: PublicSiteConfig = {
    tenant: {slug: 'alpha', name: 'Alpha'},
    enabledModules: ['ARTICLE_RSS'],
    branding: {
        siteTitle: null,
        primaryColor: null,
        secondaryColor: null,
        logoUrl: null,
    },
    publicSiteUrl: 'https://alpha.example.test',
    publicRssUrl: null,
    publicArticleRssUrl: null,
    analytics: null,
    emailNotifyAvailable: false,
}

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

    it('encodes tenant slug path segments', () => {
        expect(tenantPodcastFeed('https://alpha.example.test', 'alpha show')).toBe(
            'https://alpha.example.test/feeds/alpha%20show/podcast.xml',
        )
        expect(tenantArticleFeed('https://alpha.example.test', 'alpha show')).toBe(
            'https://alpha.example.test/feeds/alpha%20show/articles.xml',
        )
    })

    it('encodes every path segment of series, subscriber, and enclosure URLs', () => {
        expect(seriesFeed('https://alpha.example.test', 'alpha show', 'my show')).toBe(
            'https://alpha.example.test/feeds/alpha%20show/my%20show.xml',
        )
        expect(
            subscriberFeed('https://alpha.example.test', 'alpha show', 'tok 123'),
        ).toBe('https://alpha.example.test/feeds/alpha%20show/u/tok%20123.xml')
        expect(
            publicEnclosure('https://demo.test', 'my tenant', 'episode 1'),
        ).toBe('https://demo.test/feeds/my%20tenant/e/episode%201.mp3')
        expect(
            privateEnclosure('https://demo.test', 'my tenant', 'tok 123', 'episode 1'),
        ).toBe('https://demo.test/feeds/my%20tenant/u/tok%20123/e/episode%201.mp3')
    })

    it('matches Java tenantArticleFeed', () => {
        expect(tenantArticleFeed('https://alpha.example.test', 'alpha')).toBe(
            'https://alpha.example.test/feeds/alpha/articles.xml',
        )
    })

    it('builds the tenant-wide public article feed URL on loopback', () => {
        expect(publicArticleFeedUrl('alpha-b.localhost', 'alpha-show-b')).toBe(
            'http://alpha-b.localhost:8080/feeds/alpha-show-b/articles.xml',
        )
    })

    it('resolves public article feed from site config when ARTICLE_RSS is on', () => {
        expect(
            resolvePublicArticleFeedUrl(baseConfig, {webOrigin: 'https://web.example.test'}),
        ).toBe('https://web.example.test/feeds/alpha/articles.xml')
    })

    it('returns null when ARTICLE_RSS is off', () => {
        expect(
            resolvePublicArticleFeedUrl(
                {...baseConfig, enabledModules: ['DIGITAL_CONTENT']},
                {webOrigin: 'https://web.example.test'},
            ),
        ).toBeNull()
    })

    it('resolves public podcast feed from site config when PODCAST_RSS is on', () => {
        expect(
            resolvePublicPodcastFeedUrl(
                {...baseConfig, enabledModules: ['PODCAST_RSS']},
                {webOrigin: 'https://web.example.test'},
            ),
        ).toBe('https://web.example.test/feeds/alpha/podcast.xml')
    })

    it('never produces executable URLs from hostile origins', () => {
        expect(() => tenantPodcastFeed('javascript:alert(1)', 'alpha')).toThrow()
        // Origins with `://` go through URL parsing + allow-listing.
        expect(() => tenantPodcastFeed('javascript://evil/x', 'alpha')).toThrow()
        expect(() => tenantArticleFeed('data:text/html,<p>x</p>', 'alpha')).toThrow()
    })

    it('rejects hosts containing path separators', () => {
        expect(() => publicPodcastFeedUrl('evil.com/x', 'demo')).toThrow()
    })

    it('rejects invalid ports and preserves bracketed IPv6 loopback hosts', () => {
        expect(() => publicPodcastFeedUrl('example.test:not-a-port', 'demo')).toThrow()
        expect(() => publicPodcastFeedUrl('example.test:65536', 'demo')).toThrow()
        expect(publicPodcastFeedUrl('[::1]:9090', 'demo')).toBe(
            'http://[::1]:9090/feeds/demo/podcast.xml',
        )
    })
})
