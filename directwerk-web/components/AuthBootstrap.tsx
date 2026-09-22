'use client'

import {usePathname, useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
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
    '/article-feeds',
    '/newsletter',
    '/imprint',
    '/privacy',
    '/checkout/cancel',
])

const PROTECTED_PATHS = new Set(['/account', '/downloads'])

function isPublicPath(pathname: string): boolean {
    if (PUBLIC_PATHS.has(pathname)) {
        return true
    }
    return (
        pathname.startsWith('/articles/') ||
        pathname.startsWith('/episodes/') ||
        pathname.startsWith('/feeds/') ||
        pathname.startsWith('/newsletter/')
    )
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
    const [readyPathname, setReadyPathname] = useState<string | null>(() =>
        isPublicPath(pathname) ? pathname : null
    )
    const [transientError, setTransientError] = useState(false)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let active = true

        async function bootstrap(): Promise<void> {
            if (isPublicPath(pathname) && !isProtectedPath(pathname)) {
                if (active) {
                    setReadyPathname(pathname)
                }
                return
            }

            if (getAccessToken() === null) {
                if (active) {
                    setReadyPathname(null)
                    router.replace('/login')
                }
                return
            }

            try {
                await ensureAuthenticated()
                if (active) {
                    setTransientError(false)
                    setReadyPathname(pathname)
                }
            } catch (error: unknown) {
                if (!active) {
                    return
                }
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    setReadyPathname(null)
                    router.replace('/login')
                    return
                }
                // Transient failures (e.g. `AUTH_TRANSIENT` upstream outages)
                // must not evict a valid session — surface a retry instead.
                setTransientError(true)
            }
        }

        void bootstrap()

        return () => {
            active = false
        }
    }, [pathname, router, attempt])

    if (transientError && isProtectedPath(pathname)) {
        return (
            <div className="page-container space-y-3 py-8">
                <Alert variant="destructive">
                    <AlertDescription>
                        Die Anmeldung ist derzeit nicht möglich. Bitte erneut
                        versuchen.
                    </AlertDescription>
                </Alert>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        setTransientError(false)
                        setAttempt((value) => value + 1)
                    }}
                >
                    Erneut versuchen
                </Button>
            </div>
        )
    }

    if (readyPathname !== pathname && isProtectedPath(pathname)) {
        return <p>Wird geladen…</p>
    }

    return children
}
