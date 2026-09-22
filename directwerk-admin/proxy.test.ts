import {NextRequest} from 'next/server'
import {describe, expect, it} from 'vitest'

import nextConfig from './next.config'

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

    it('defines the DENY frame policy exactly once, in next.config', async () => {
        const headerGroups = (await nextConfig.headers?.()) ?? []
        const frameValues = headerGroups.flatMap((group) =>
            group.headers
                .filter((header) => header.key === 'X-Frame-Options')
                .map((header) => header.value),
        )
        expect(frameValues).toEqual(['DENY'])
        // proxy.ts must not emit its own X-Frame-Options, or responses could
        // carry conflicting frame policies.
        expect(proxy(requestFor('/imprint')).headers.get('X-Frame-Options')).toBeNull()
    })
})
