import {NextResponse} from 'next/server'
import type {NextRequest} from 'next/server'

const REFRESH_COOKIE = 'dw_admin_refresh'

const PUBLIC_PATH_PREFIXES = [
    '/login',
    '/api/auth/login',
    '/api/auth/refresh',
]

function isPublicPath(pathname: string): boolean {
    return PUBLIC_PATH_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
}

// Nonce-based strict script CSP (per the Next.js Content Security Policy guide).
// Next.js applies the script nonce to framework bundles; style-src keeps
// 'unsafe-inline' because React style={{…}} attributes and @directwerk/ui
// components (sidebar, progress, brand-theme) set inline styles that nonces
// do not cover. CSS injection is far less risky than script XSS.
export function proxy(request: NextRequest) {
    const {pathname} = request.nextUrl

    if (
        !isPublicPath(pathname) &&
        !pathname.startsWith('/_next/') &&
        pathname !== '/favicon.ico' &&
        !request.cookies.has(REFRESH_COOKIE)
    ) {
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = '/login'
        loginUrl.searchParams.set('next', pathname)
        return NextResponse.redirect(loginUrl)
    }

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
    // Baseline hardening alongside the nonce CSP (frame-ancestors 'none' is
    // already in the CSP; X-Frame-Options stays as defense-in-depth for older
    // user agents. HSTS is a no-op over plain-HTTP local dev and enforced
    // behind the HTTPS reverse proxy in stage/prod).
    response.headers.set(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
    )
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=()',
    )
    // Avoid cached HTML referencing server-action IDs from a previous deploy.
    response.headers.set('Cache-Control', 'no-store, must-revalidate')

    return response
}

export const config = {
    matcher: [
        {
            source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
            missing: [
                {type: 'header', key: 'next-router-prefetch'},
                {type: 'header', key: 'purpose', value: 'prefetch'},
            ],
        },
    ],
}
