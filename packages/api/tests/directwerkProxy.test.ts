import {NextRequest} from 'next/server'
import {describe, expect, it} from 'vitest'

import {
    createDirectwerkProxyHandler,
    directwerkProxyMatcher,
} from '../src/proxy/directwerkProxy'

function getRequest(): NextRequest {
    return new NextRequest('http://app.local/podcast/episodes')
}

describe('createDirectwerkProxyHandler', () => {
    it('builds the CSP through the injected builder and mirrors headers', () => {
        const seen: Array<{nonce: string; isDevelopment: boolean}> = []
        const handle = createDirectwerkProxyHandler({
            buildContentSecurityPolicy: (nonce, isDevelopment) => {
                seen.push({nonce, isDevelopment})
                return `csp-for-${nonce}`
            },
        })

        const response = handle(getRequest())

        expect(seen).toHaveLength(1)
        const forwardedNonce = response.headers.get('x-middleware-request-x-nonce')
        expect(forwardedNonce).toBe(seen[0]?.nonce)
        expect(
            response.headers.get('x-middleware-request-content-security-policy'),
        ).toBe(`csp-for-${forwardedNonce}`)
        expect(response.headers.get('Content-Security-Policy')).toBe(
            `csp-for-${forwardedNonce}`,
        )
    })

    it('generates a fresh nonce per request', () => {
        const handle = createDirectwerkProxyHandler({
            buildContentSecurityPolicy: (nonce) => `csp-for-${nonce}`,
        })

        const first = handle(getRequest()).headers.get('x-middleware-request-x-nonce')
        const second = handle(getRequest()).headers.get('x-middleware-request-x-nonce')

        expect(first).not.toBeNull()
        expect(second).not.toBeNull()
        expect(first).not.toBe(second)
    })
})

describe('directwerkProxyMatcher', () => {
    it('matches pages only', () => {
        expect(directwerkProxyMatcher).toEqual({
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
