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

export function middleware(request: NextRequest): NextResponse {
    const {pathname} = request.nextUrl

    if (
        isPublicPath(pathname) ||
        pathname.startsWith('/_next/') ||
        pathname === '/favicon.ico'
    ) {
        return NextResponse.next()
    }

    if (!request.cookies.has(REFRESH_COOKIE)) {
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = '/login'
        loginUrl.searchParams.set('next', pathname)
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
