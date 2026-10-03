import {NextRequest} from 'next/server'
import {describe, expect, it} from 'vitest'

import {directwerkProxyMatcher} from '@directwerk/api/proxy/directwerkProxy'

import {config, proxy} from './proxy'

function getRequest(path = '/de/podcast/episodes', headers?: HeadersInit): NextRequest {
    return new NextRequest(`http://studio.local${path}`, {headers})
}

describe('proxy', () => {
    it('sets matching nonce CSP headers on the request and response', () => {
        const response = proxy(getRequest())

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

    it('redirects unprefixed paths to the preferred locale', () => {
        const response = proxy(
            getRequest('/podcast/episodes', { 'accept-language': 'en-US,en;q=0.9' }),
        )
        expect(response.status).toBeGreaterThanOrEqual(300)
        expect(response.status).toBeLessThan(400)
        expect(response.headers.get('location')).toBe(
            'http://studio.local/en/podcast/episodes',
        )
    })

    it('defaults unprefixed redirects to de', () => {
        const response = proxy(getRequest('/login'))
        expect(response.headers.get('location')).toBe('http://studio.local/de/login')
    })

    it('honors NEXT_LOCALE cookie over Accept-Language', () => {
        const request = getRequest('/media', { 'accept-language': 'en-US' })
        request.cookies.set('NEXT_LOCALE', 'de')
        const response = proxy(request)
        expect(response.headers.get('location')).toBe('http://studio.local/de/media')
    })

    it('keeps the shared page-only matcher (api skipped)', () => {
        expect(config).toEqual(directwerkProxyMatcher)
        expect(config).toEqual({
            matcher: [
                {
                    source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
                    missing: [
                        {type: 'header', key: 'next-router-prefetch'},
                        {type: 'header', key: 'purpose', value: 'prefetch'},
                    ],
                },
            ],
        })
    })
})
