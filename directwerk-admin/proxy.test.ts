import {NextRequest} from 'next/server'
import {describe, expect, it} from 'vitest'

import {config, proxy} from './proxy'

function requestFor(pathname: string, cookie?: string): NextRequest {
    const headers = new Headers()
    if (cookie !== undefined) {
        headers.set('cookie', cookie)
    }
    return new NextRequest(`http://admin.local${pathname}`, {headers})
}

describe('proxy', () => {
    it('allows imprint and privacy without a refresh cookie', () => {
        for (const pathname of ['/imprint', '/privacy']) {
            const response = proxy(requestFor(pathname))
            expect(response.status).toBe(200)
            expect(response.headers.get('location')).toBeNull()
        }
    })

    it('redirects protected pages without a refresh cookie to login', () => {
        const response = proxy(requestFor('/tenants'))
        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toBe(
            'http://admin.local/login?next=%2Ftenants',
        )
    })

    it('keeps the page-only matcher', () => {
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
