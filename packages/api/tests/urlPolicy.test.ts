import {describe, expect, it} from 'vitest'

import {isAllowedFeedUrl} from '../src/validation/primitives'
import {
    httpsOriginFromHost,
    isLoopbackHostname,
    isSafeRedirectTarget,
    isTrustedOrigin,
    isTrustedUploadUrl,
    normalizeHttpOrigin,
} from '../src/urls/urlPolicy'

describe('isLoopbackHostname', () => {
    it('recognises the loopback hosts', () => {
        expect(isLoopbackHostname('localhost')).toBe(true)
        expect(isLoopbackHostname('127.0.0.1')).toBe(true)
        expect(isLoopbackHostname('[::1]')).toBe(true)
        expect(isLoopbackHostname('  LOCALHOST  ')).toBe(true)
    })

    it('only accepts *.localhost when the variant opts in', () => {
        expect(isLoopbackHostname('alpha.localhost')).toBe(false)
        expect(
            isLoopbackHostname('alpha.localhost', {allowLocalhostSubdomains: true}),
        ).toBe(true)
        expect(isLoopbackHostname('evil.example.test')).toBe(false)
    })

    it('accepts IPv6 loopback unless the variant opts out', () => {
        expect(isLoopbackHostname('[::1]')).toBe(true)
        expect(isLoopbackHostname('[::1]', {allowIpv6Loopback: false})).toBe(false)
    })
})

describe('isTrustedOrigin', () => {
    it('accepts any HTTPS host by default', () => {
        expect(isTrustedOrigin('https://cdn.example.test/asset.mp3')).toBe(true)
        expect(isTrustedOrigin('http://example.test/file')).toBe(false)
    })

    it('accepts HTTP loopback when the variant opts in', () => {
        const loopback = {allowLoopback: true}
        expect(isTrustedOrigin('http://localhost:8080', loopback)).toBe(true)
        expect(isTrustedOrigin('http://127.0.0.1:8080', loopback)).toBe(true)
        expect(isTrustedOrigin('http://[::1]:8080', loopback)).toBe(true)
        expect(isTrustedOrigin('http://alpha.localhost:8080', loopback)).toBe(false)
        expect(isTrustedOrigin('http://example.test', loopback)).toBe(false)
        expect(isTrustedOrigin('http://[::1]:8080', loopback)).toBe(true)
        expect(
            isTrustedOrigin('http://[::1]:8080', {
                allowLoopback: true,
                allowIpv6Loopback: false,
            }),
        ).toBe(false)
    })

    it('accepts *.localhost only when explicitly enabled', () => {
        const feed = {allowLoopback: true, allowLocalhostSubdomains: true}
        expect(isTrustedOrigin('http://alpha.localhost:8080', feed)).toBe(true)
    })

    it('accepts any-host HTTP only when explicitly enabled', () => {
        expect(
            isTrustedOrigin('http://example.test', {allowAnyHostHttp: true}),
        ).toBe(true)
    })

    it('rejects malformed URLs and non-HTTP protocols', () => {
        expect(isTrustedOrigin('not a url')).toBe(false)
        expect(isTrustedOrigin('javascript:alert(1)')).toBe(false)
        expect(isTrustedOrigin('ftp://example.test')).toBe(false)
    })
})

describe('normalizeHttpOrigin', () => {
    it('returns the origin when trusted and null otherwise', () => {
        expect(normalizeHttpOrigin('https://example.test/a/b?c=1')).toBe(
            'https://example.test',
        )
        expect(
            normalizeHttpOrigin('http://localhost:3000/x', {allowLoopback: true}),
        ).toBe('http://localhost:3000')
        expect(normalizeHttpOrigin('http://example.test')).toBeNull()
        expect(normalizeHttpOrigin('javascript:alert(1)')).toBeNull()
    })
})

describe('isSafeRedirectTarget', () => {
    it('allows same-origin absolute paths', () => {
        expect(isSafeRedirectTarget('/feeds/alpha/podcast.xml')).toBe(true)
        expect(isSafeRedirectTarget('//evil.test/x')).toBe(false)
    })

    it('allows HTTPS and loopback HTTP including *.localhost', () => {
        expect(isSafeRedirectTarget('https://cdn.example.test/a.mp3')).toBe(true)
        expect(isSafeRedirectTarget('http://localhost:8080/a')).toBe(true)
        expect(isSafeRedirectTarget('http://alpha.localhost:8080/a')).toBe(true)
        expect(isSafeRedirectTarget('http://example.test/a')).toBe(false)
    })
})

describe('isTrustedUploadUrl', () => {
    it('accepts HTTPS and bare loopback HTTP only', () => {
        expect(isTrustedUploadUrl('https://s3.example.test/key')).toBe(true)
        expect(isTrustedUploadUrl('http://127.0.0.1:9000/key')).toBe(true)
        expect(isTrustedUploadUrl('http://localhost:9000/key')).toBe(true)
        expect(isTrustedUploadUrl('http://alpha.localhost:9000/key')).toBe(false)
        expect(isTrustedUploadUrl('http://storage.example.test/key')).toBe(false)
    })
})

describe('httpsOriginFromHost', () => {
    it('normalises raw hosts and absolute URLs to HTTPS origins', () => {
        expect(httpsOriginFromHost('alpha.example.test')).toBe(
            'https://alpha.example.test',
        )
        expect(httpsOriginFromHost('http://alpha.example.test/path')).toBe(
            'https://alpha.example.test',
        )
        expect(httpsOriginFromHost('alpha.example.test:8080')).toBe(
            'https://alpha.example.test:8080',
        )
    })
})

describe('isAllowedFeedUrl policy equivalence', () => {
    it('matches the feed variant for representative URLs', () => {
        const cases = [
            'https://cdn.example.test/a.mp3',
            'http://localhost:8080/a',
            'http://127.0.0.1/a',
            'http://[::1]/a',
            'http://alpha.localhost:8080/a',
            'http://example.test/a',
            'javascript:alert(1)',
            'not a url',
        ]
        for (const url of cases) {
            expect(isAllowedFeedUrl(url)).toBe(
                isTrustedOrigin(url, {
                    allowLoopback: true,
                    allowLocalhostSubdomains: true,
                }),
            )
        }
    })
})
