'use client'

import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Skeleton} from '@directwerk/ui/components/skeleton'

import {isEditorRole} from '@/lib/api/studioHelpers'
import {fetchMe} from '@/lib/api/authApi'
import {MeProvider} from '@/lib/auth/MeProvider'
import {ensureAuthenticated} from '@/lib/auth/session'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {clearTokens, getAccessToken} from '@/lib/auth/tokenStore'
import {getClientTenantHost} from '@directwerk/api/tenant'
import type {Me} from '@directwerk/api/types'

function AuthLoading(): React.JSX.Element {
    return (
        <div
            aria-busy="true"
            aria-live="polite"
            className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6"
            role="status"
        >
            <span className="sr-only">Studio wird geladen…</span>
            <Skeleton className="h-8 w-48" aria-hidden="true" />
            <Skeleton className="h-24 w-full" aria-hidden="true" />
            <Skeleton className="h-12 w-full" aria-hidden="true" />
        </div>
    )
}

export default function AuthGuard({children}: Readonly<{children: React.ReactNode}>) {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [me, setMe] = useState<Me | null>(null)
    const [verifyError, setVerifyError] = useState<string | null>(null)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let active = true

        async function verify(): Promise<void> {
            setVerifyError(null)

            if (getAccessToken() === null) {
                if (active) {
                    router.replace('/login')
                }
                return
            }

            try {
                await ensureAuthenticated()
                const account = await fetchMe(getClientTenantHost())
                if (!active) {
                    return
                }

                if (!isEditorRole(account.roles)) {
                    clearTokens()
                    router.replace('/login?reason=role')
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
                if (authRedirect(error)) {
                    clearTokens()
                    return
                }

                setVerifyError(
                    'Die Verbindung zum Server ist fehlgeschlagen. Bitte erneut versuchen.',
                )
            }
        }

        void verify()

        return () => {
            active = false
        }
    }, [authRedirect, router, attempt])

    if (me === null) {
        if (verifyError !== null) {
            return (
                <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
                    <Alert variant="destructive">
                        <AlertDescription>{verifyError}</AlertDescription>
                    </Alert>
                    <Button
                        onClick={() => {
                            setAttempt((value) => value + 1)
                        }}
                        type="button"
                        variant="outline"
                    >
                        Erneut versuchen
                    </Button>
                </div>
            )
        }

        return <AuthLoading />
    }

    return <MeProvider me={me}>{children}</MeProvider>
}
