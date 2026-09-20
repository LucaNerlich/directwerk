import {describe, expect, it} from 'vitest'

import {
    buildMediaImageRemotePatterns,
    parseMediaImageRemoteHosts,
} from './mediaImageRemotePatterns'

describe('parseMediaImageRemoteHosts', () => {
    it('uses explicit platform CDN hosts when env is empty', () => {
        expect(parseMediaImageRemoteHosts(undefined)).toEqual([
            {hostname: 'directwerk-dev.b-cdn.net', port: ''},
            {hostname: 'directwerk-dev2.b-cdn.net', port: ''},
            {hostname: 'directwerk-dev.nbg1.your-objectstorage.com', port: ''},
            {hostname: 'cdn.stage.directwerk.org', port: ''},
            {hostname: 'cdn.directwerk.org', port: ''},
        ])
    })

    it('rejects wildcard and malformed host entries', () => {
        expect(
            parseMediaImageRemoteHosts('*.b-cdn.net, https://cdn.example.test'),
        ).toEqual([
            {hostname: 'directwerk-dev.b-cdn.net', port: ''},
            {hostname: 'directwerk-dev2.b-cdn.net', port: ''},
            {hostname: 'directwerk-dev.nbg1.your-objectstorage.com', port: ''},
            {hostname: 'cdn.stage.directwerk.org', port: ''},
            {hostname: 'cdn.directwerk.org', port: ''},
        ])
    })

    it('parses comma-separated exact hostnames and ports from env', () => {
        expect(
            parseMediaImageRemoteHosts(
                ' directwerk-dev2.b-cdn.net , de-s3.storage.bunnycdn.com:8443, cdn.example.test:443 '
            )
        ).toEqual([
            {hostname: 'directwerk-dev2.b-cdn.net', port: ''},
            {hostname: 'de-s3.storage.bunnycdn.com', port: '8443'},
            {hostname: 'cdn.example.test', port: ''},
        ])
    })

    it('rejects invalid ports', () => {
        expect(
            parseMediaImageRemoteHosts(
                'cdn.example.test:,cdn.example.test:0,cdn.example.test:65536'
            )
        ).toEqual([
            {hostname: 'directwerk-dev.b-cdn.net', port: ''},
            {hostname: 'directwerk-dev2.b-cdn.net', port: ''},
            {hostname: 'directwerk-dev.nbg1.your-objectstorage.com', port: ''},
            {hostname: 'cdn.stage.directwerk.org', port: ''},
            {hostname: 'cdn.directwerk.org', port: ''},
        ])
    })
})

describe('buildMediaImageRemotePatterns', () => {
    it('builds HTTPS remote patterns for configured hosts', () => {
        expect(
            buildMediaImageRemotePatterns('cdn.example.test:8443')
        ).toEqual([
            {
                protocol: 'https',
                hostname: 'cdn.example.test',
                port: '8443',
                pathname: '/**',
            },
        ])
    })
})
