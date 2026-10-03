import {NextRequest} from 'next/server'
import {describe, expect, it} from 'vitest'

import {config, proxy} from './proxy'

describe('proxy', () => {
    it('sets matching nonce CSP headers on locale-prefixed pages', () => {
        const response = proxy(new NextRequest('http://tenant.local/de/episodes'))

        const responseCsp = response.headers.get('Content-Security-Policy')
        expect(responseCsp).toContain("default-src 'self'")
        expect(responseCsp).toContain('nonce-')

        const forwardedNonce = response.headers.get('x-middleware-request-x-nonce')
        const forwardedCsp = response.headers.get(
            'x-middleware-request-content-security-policy',
        )
        expect(forwardedCsp).toBe(responseCsp)
        expect(forwardedNonce).not.toBeNull()
        expect(responseCsp).toContain(`'nonce-${forwardedNonce}'`)
    })

    it('redirects unprefixed UI paths to the default locale', () => {
        const response = proxy(new NextRequest('http://tenant.local/account'))
        expect(response.status).toBeGreaterThanOrEqual(300)
        expect(response.status).toBeLessThan(400)
        expect(response.headers.get('location')).toBe('http://tenant.local/de/account')
    })

    it('redirects `/` using Accept-Language when no locale cookie', () => {
        const response = proxy(
            new NextRequest('http://tenant.local/', {
                headers: {'accept-language': 'en-US,en;q=0.9'},
            }),
        )
        expect(response.headers.get('location')).toBe('http://tenant.local/en')
    })

    it('prefers NEXT_LOCALE cookie over Accept-Language', () => {
        const response = proxy(
            new NextRequest('http://tenant.local/pricing', {
                headers: {
                    'accept-language': 'en-US,en;q=0.9',
                    cookie: 'NEXT_LOCALE=de',
                },
            }),
        )
        expect(response.headers.get('location')).toBe('http://tenant.local/de/pricing')
    })

    it('skips nested feeds paths in the matcher (RSS protocol surface)', () => {
        expect(config).toEqual({
            matcher: [
                {
                    source: '/((?!api|feeds/|_next/static|_next/image|favicon.ico).*)',
                    missing: [
                        {type: 'header', key: 'next-router-prefetch'},
                        {type: 'header', key: 'purpose', value: 'prefetch'},
                    ],
                },
            ],
        })
    })
})
