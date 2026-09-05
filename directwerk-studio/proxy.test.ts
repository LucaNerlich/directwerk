import {NextRequest} from 'next/server'
import {describe, expect, it} from 'vitest'

import {directwerkProxyMatcher} from '@directwerk/api/proxy/directwerkProxy'

import {config, proxy} from './proxy'

function getRequest(): NextRequest {
    return new NextRequest('http://studio.local/podcast/episodes')
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

    it('keeps the shared page-only matcher', () => {
        expect(config).toBe(directwerkProxyMatcher)
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
