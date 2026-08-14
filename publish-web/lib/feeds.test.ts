import {describe, expect, it} from 'vitest'

import {publicPodcastFeedUrl, publicSeriesFeedUrl} from './feeds'

describe('public feed URLs', () => {
    it('uses http with API port for .localhost hosts', () => {
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
