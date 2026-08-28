'use client'

import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'

import {isEditorRole} from '@/lib/api/studioHelpers'
import {fetchMe} from '@/lib/api/authApi'
import {MeProvider} from '@/lib/auth/MeProvider'
import {ensureAuthenticated} from '@/lib/auth/session'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {clearTokens, getAccessToken} from '@/lib/auth/tokenStore'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import type {Me} from '@directwerk/api/types'

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
    }, [router, attempt])

    if (me === null) {
        if (verifyError !== null) {
            return (
                <div className="flex flex-col items-start gap-3 p-6">
                    <p className="text-sm text-muted-foreground">{verifyError}</p>
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

        return <p>Wird geladen…</p>
    }

    return <MeProvider me={me}>{children}</MeProvider>
}
