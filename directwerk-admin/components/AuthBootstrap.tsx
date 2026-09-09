'use client'

import {usePathname, useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {ensureAuthenticated} from '@/lib/auth/session'
import {getAccessToken} from '@/lib/auth/tokenStore'

const PUBLIC_PATHS = new Set(['/login', '/imprint', '/privacy'])

function isPublicPath(pathname: string): boolean {
    return PUBLIC_PATHS.has(pathname)
}

export default function AuthBootstrap({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    const pathname = usePathname()
    const router = useRouter()
    const [ready, setReady] = useState(isPublicPath(pathname))

    useEffect(() => {
        let active = true

        async function bootstrap(): Promise<void> {
            if (isPublicPath(pathname)) {
                if (pathname === '/login' && getAccessToken() !== null) {
                    try {
                        await ensureAuthenticated()
                        if (active) {
                            router.replace('/')
                        }
                        return
                    } catch {
                        if (active) {
                            setReady(true)
                        }
                        return
                    }
                }

                if (active) {
                    setReady(true)
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
                    router.replace('/login')
                    return
                }

                // Handle transient errors without redirecting
                if (active) {
                    setReady(true)
                }
            }
        }

        setReady(isPublicPath(pathname))
        void bootstrap()

        return () => {
            active = false
        }
    }, [pathname, router])

    if (!ready) {
        return (
            <main
                aria-busy="true"
                aria-live="polite"
                className="grid min-h-screen place-items-center text-sm text-muted-foreground"
            >
                Loading administration…
            </main>
        )
    }

    return children
}
