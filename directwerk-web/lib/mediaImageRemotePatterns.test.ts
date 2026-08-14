import {describe, expect, it} from 'vitest'

import {
    buildMediaImageRemotePatterns,
    parseMediaImageRemoteHosts,
} from './mediaImageRemotePatterns'

describe('parseMediaImageRemoteHosts', () => {
    it('uses Bunny CDN defaults when env is empty', () => {
        expect(parseMediaImageRemoteHosts(undefined)).toEqual([
            '*.b-cdn.net',
            '*.storage.bunnycdn.com',
        ])
    })

    it('parses comma-separated hostnames from env', () => {
        expect(
            parseMediaImageRemoteHosts(
                ' directwerk-dev2.b-cdn.net , de-s3.storage.bunnycdn.com '
            )
        ).toEqual([
            'directwerk-dev2.b-cdn.net',
            'de-s3.storage.bunnycdn.com',
        ])
    })
})

describe('buildMediaImageRemotePatterns', () => {
    it('builds HTTPS remote patterns for configured hosts', () => {
        expect(
            buildMediaImageRemotePatterns('cdn.example.test')
        ).toEqual([
            {
                protocol: 'https',
                hostname: 'cdn.example.test',
            },
        ])
    })
})
