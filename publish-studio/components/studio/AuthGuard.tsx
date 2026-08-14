'use client'

import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {fetchMe, isEditorRole} from '@/lib/api/tenantApi'
import {MeProvider} from '@/lib/auth/MeProvider'
import {ensureAuthenticated} from '@/lib/auth/session'
import {clearTokens, getAccessToken} from '@/lib/auth/tokenStore'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import type {Me} from '@/lib/api/types'

export default function AuthGuard({children}: Readonly<{children: React.ReactNode}>) {
    const router = useRouter()
    const [me, setMe] = useState<Me | null>(null)

    useEffect(() => {
        let active = true

        async function verify(): Promise<void> {
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
            } catch {
                if (!active) {
                    return
                }

                clearTokens()
                router.replace('/login')
            }
        }

        verify()

        return () => {
            active = false
        }
    }, [router])

    if (me === null) {
        return <p>Wird geladen…</p>
    }

    return <MeProvider me={me}>{children}</MeProvider>
}
