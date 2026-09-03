import {describe, expect, it} from 'vitest'

import {
    buildMediaImageRemotePatterns,
    parseMediaImageRemoteHosts,
} from './mediaImageRemotePatterns'

describe('parseMediaImageRemoteHosts', () => {
    it('uses explicit platform CDN hosts when env is empty', () => {
        expect(parseMediaImageRemoteHosts(undefined)).toEqual([
            'directwerk-dev.b-cdn.net',
            'cdn.stage.directwerk.de',
            'cdn.directwerk.de',
        ])
    })

    it('rejects wildcard and malformed host entries', () => {
        expect(
            parseMediaImageRemoteHosts('*.b-cdn.net, https://cdn.example.test'),
        ).toEqual([
            'directwerk-dev.b-cdn.net',
            'cdn.stage.directwerk.de',
            'cdn.directwerk.de',
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
                port: '',
                pathname: '/**',
            },
        ])
    })
})
