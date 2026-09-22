'use client'

import {useRouter} from 'next/navigation'
import {useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {clearAllCachedTenantData} from '@directwerk/api/client/useCachedTenantQuery'

import {useOptionalMe} from '@/lib/auth/MeProvider'
import {clearSessionTokens} from '@/lib/auth/session'

export default function LogoutButton() {
    const router = useRouter()
    const me = useOptionalMe()
    const [logoutError, setLogoutError] = useState<string | null>(null)

    return (
        <div className="flex min-w-0 flex-col gap-2">
            {me !== null ? (
                <p className="truncate px-1 text-xs text-muted-foreground" title={me.email}>
                    Angemeldet als {me.email}
                </p>
            ) : null}
            {logoutError !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{logoutError}</AlertDescription>
                </Alert>
            ) : null}
            <Button
                type="button"
                className="w-full justify-start"
                variant="outline"
                onClick={() => {
                    void (async () => {
                        setLogoutError(null)
                        try {
                            const response = await fetch('/api/auth/logout', {
                                method: 'POST',
                                cache: 'no-store',
                            })
                            if (!response.ok) {
                                setLogoutError('Abmeldung fehlgeschlagen. Bitte versuche es erneut.')
                                return
                            }
                        } catch {
                            setLogoutError('Abmeldung fehlgeschlagen. Bitte versuche es erneut.')
                            return
                        }
                        clearSessionTokens()
                        clearAllCachedTenantData()
                        router.push('/login')
                    })()
                }}
            >
                Abmelden
            </Button>
        </div>
    )
}
