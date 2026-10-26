'use client'

import {useRouter} from 'next/navigation'
import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Skeleton} from '@directwerk/ui/components/skeleton'

import {useDictionary} from '@/components/i18n/LocaleProvider'
import {useLocalizedPath} from '@/components/i18n/useLocalizedPath'
import {isEditorRole} from '@/lib/api/studioHelpers'
import {fetchMe} from '@/lib/api/authApi'
import {MeProvider} from '@/lib/auth/MeProvider'
import {ensureAuthenticated, clearSessionTokens} from '@/lib/auth/session'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {clearAllCachedTenantData} from '@directwerk/api/client/useCachedTenantQuery'
import {getAccessToken} from '@/lib/auth/tokenStore'

import type {Me} from '@directwerk/api/types'

type AuthStatus = {
    ready: boolean
    verifyError: string | null
    retry: () => void
}

const AuthStatusContext = createContext<AuthStatus | null>(null)

function useAuthStatus(): AuthStatus {
    const value = useContext(AuthStatusContext)
    if (value === null) {
        throw new Error('AuthContentGate must be used within AuthGuard')
    }
    return value
}

function AuthLoading(): React.JSX.Element {
    const dict = useDictionary()
    return (
        <div
            aria-busy="true"
            aria-live="polite"
            className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6"
            role="status"
        >
            <span className="sr-only">{dict.auth.studioLoading}</span>
            <Skeleton className="h-8 w-48" aria-hidden="true" />
            <Skeleton className="h-24 w-full" aria-hidden="true" />
            <Skeleton className="h-12 w-full" aria-hidden="true" />
        </div>
    )
}

/**
 * Boots auth for the studio tree: always renders children (shell chrome first)
 * and supplies MeProvider. Gate page content with {@link AuthContentGate}.
 */
export default function AuthGuard({children}: Readonly<{children: ReactNode}>) {
    const router = useRouter()
    const localize = useLocalizedPath()
    const dict = useDictionary()
    const [me, setMe] = useState<Me | null>(null)
    const [verifyError, setVerifyError] = useState<string | null>(null)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let active = true

        async function verify(): Promise<void> {
            setVerifyError(null)

            if (getAccessToken() === null) {
                if (active) {
                    router.replace(localize('/login'))
                }
                return
            }

            try {
                await ensureAuthenticated()
                const account = await fetchMe()
                if (!active) {
                    return
                }

                if (!isEditorRole(account.roles)) {
                    clearSessionTokens()
                    clearAllCachedTenantData()
                    router.replace(localize('/login?reason=role'))
                    return
                }

                setMe(account)
            } catch (error: unknown) {
                if (!active) {
                    return
                }

                // Only definitive auth failures end the session. Network or
                // upstream errors during a deploy must keep the valid refresh
                // cookie intact and offer a retry instead.
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    clearSessionTokens()
                    clearAllCachedTenantData()
                    router.replace(localize('/login'))
                    return
                }

                setVerifyError(dict.auth.connectionFailed)
            }
        }

        void verify()

        return () => {
            active = false
        }
    }, [dict.auth.connectionFailed, localize, router, attempt])

    const status: AuthStatus = {
        ready: me !== null,
        verifyError,
        retry: () => {
            setAttempt((value) => value + 1)
        },
    }

    return (
        <AuthStatusContext.Provider value={status}>
            <MeProvider me={me}>{children}</MeProvider>
        </AuthStatusContext.Provider>
    )
}

/** Skeletons (or retry) for main content until /me succeeds. Shell stays visible. */
export function AuthContentGate({
    children,
}: Readonly<{children: ReactNode}>): React.JSX.Element {
    const dict = useDictionary()
    const {ready, verifyError, retry} = useAuthStatus()

    if (ready) {
        return <>{children}</>
    }

    if (verifyError !== null) {
        return (
            <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
                <Alert variant="destructive">
                    <AlertDescription>{verifyError}</AlertDescription>
                </Alert>
                <Button onClick={retry} type="button" variant="outline">
                    {dict.common.retry}
                </Button>
            </div>
        )
    }

    return <AuthLoading />
}
