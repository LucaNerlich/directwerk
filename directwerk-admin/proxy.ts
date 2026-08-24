import {NextResponse} from 'next/server'
import type {NextRequest} from 'next/server'

// Nonce-based strict CSP (per the Next.js Content Security Policy guide). Next.js
// automatically applies the nonce from the request's CSP header to its own scripts,
// so production no longer needs `script-src 'unsafe-inline'`.
// Dev tooling still needs eval(); React hot reloading additionally requires
// style-src unsafe-inline in dev.
export function proxy(request: NextRequest) {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
    const isDev = process.env.NODE_ENV === 'development'

    const cspHeader = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; ')

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nonce', nonce)
    requestHeaders.set('Content-Security-Policy', cspHeader)

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    })
    response.headers.set('Content-Security-Policy', cspHeader)

    return response
}

export const config = {
    matcher: [
        // Run on pages, not on API routes or static assets (which need no CSP).
        {
            source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
            missing: [
                {type: 'header', key: 'next-router-prefetch'},
                {type: 'header', key: 'purpose', value: 'prefetch'},
            ],
        },
    ],
}
