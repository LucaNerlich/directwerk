'use client'

import {usePathname, useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {AUTH_REQUIRED} from '@/lib/api/errors'
import {ensureAuthenticated} from '@/lib/auth/session'
import {getAccessToken} from '@/lib/auth/tokenStore'

const PUBLIC_PATHS = new Set([
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/accept-invite',
    '/episodes',
    '/articles',
    '/pricing',
    '/feeds',
])

const PROTECTED_PATHS = new Set(['/account'])

function isPublicPath(pathname: string): boolean {
    if (PUBLIC_PATHS.has(pathname)) {
        return true
    }
    return pathname.startsWith('/articles/') || pathname.startsWith('/episodes/')
}

function isProtectedPath(pathname: string): boolean {
    return PROTECTED_PATHS.has(pathname)
}

export default function AuthBootstrap({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    const pathname = usePathname()
    const router = useRouter()
    const [ready, setReady] = useState(() => isPublicPath(pathname))

    useEffect(() => {
        let active = true

        async function bootstrap(): Promise<void> {
            if (isPublicPath(pathname) && !isProtectedPath(pathname)) {
                if (active) {
                    setReady(true)
                }
                return
            }

            if (getAccessToken() === null) {
                if (active) {
                    setReady(false)
                    router.replace('/login')
                }
                return
            }

            try {
                await ensureAuthenticated()
                if (active) {
                    setReady(true)
                }
            } catch (error: unknown) {
                if (!active) {
                    return
                }
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    setReady(false)
                    router.replace('/login')
                    return
                }
                setReady(false)
                router.replace('/login')
            }
        }

        void bootstrap()

        return () => {
            active = false
        }
    }, [pathname, router])

    if (!ready && isProtectedPath(pathname)) {
        return <p>Wird geladen…</p>
    }

    return children
}
