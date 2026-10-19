'use client'

import {usePathname, useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {ensureAuthenticated} from '@/lib/auth/session'
import {defaultLocale} from '@/lib/i18n/config'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localeFromPathname, localizedPath, stripLocalePrefix} from '@/lib/i18n/paths'

// Issue #554: only these paths require a session. Everything else — including unknown URLs
// (the branded 404) and routes added later — renders without a login redirect.
const PROTECTED_PATHS = new Set(['/account', '/downloads'])

function isProtectedPath(pathname: string): boolean {
    return PROTECTED_PATHS.has(stripLocalePrefix(pathname))
}

export default function AuthBootstrap({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    const pathname = usePathname()
    const router = useRouter()
    const lang = useLocale()
    const dictionary = useDictionary()
    const pathLang = localeFromPathname(pathname) ?? lang ?? defaultLocale
    const [readyPathname, setReadyPathname] = useState<string | null>(() =>
        isProtectedPath(pathname) ? null : pathname,
    )
    const [transientError, setTransientError] = useState(false)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let active = true

        async function bootstrap(): Promise<void> {
            if (!isProtectedPath(pathname)) {
                if (active) {
                    setReadyPathname(pathname)
                }
                return
            }

            // No early "no access token" redirect: on a protected path a fresh tab may hold
            // only the refresh cookie, and ensureAuthenticated() signs it in (issue #554).
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
                    router.replace(localizedPath(pathLang, '/login'))
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
    }, [pathname, router, attempt, pathLang])

    if (transientError && isProtectedPath(pathname)) {
        return (
            <div className="page-container space-y-3 py-8">
                <Alert variant="destructive">
                    <AlertDescription>
                        {dictionary.common.authTransient}
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
                    {dictionary.common.retry}
                </Button>
            </div>
        )
    }

    if (readyPathname !== pathname && isProtectedPath(pathname)) {
        return <p>{dictionary.common.loading}</p>
    }

    return children
}
