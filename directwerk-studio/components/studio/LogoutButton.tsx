'use client'

import {useRouter} from 'next/navigation'

import {Button} from '@directwerk/ui/components/button'

import {useOptionalMe} from '@/lib/auth/MeProvider'
import {clearTokens} from '@/lib/auth/tokenStore'

export default function LogoutButton() {
    const router = useRouter()
    const me = useOptionalMe()

    return (
        <div className="flex min-w-0 flex-col gap-2">
            {me !== null ? (
                <p className="truncate px-1 text-xs text-muted-foreground" title={me.email}>
                    Angemeldet als {me.email}
                </p>
            ) : null}
            <Button
                type="button"
                className="w-full justify-start"
                variant="outline"
                onClick={() => {
                    void (async () => {
                        try {
                            await fetch('/api/auth/logout', {method: 'POST', cache: 'no-store'})
                        } catch {
                            // Best effort — still clear local tokens below.
                        }
                        clearTokens()
                        router.push('/login')
                    })()
                }}
            >
                Abmelden
            </Button>
        </div>
    )
}
