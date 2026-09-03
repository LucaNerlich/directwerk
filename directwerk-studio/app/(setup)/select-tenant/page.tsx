'use client'

import {useRouter} from 'next/navigation'
import {useEffect} from 'react'

import AuthCard from '@directwerk/ui/components/auth-card'
import {Progress} from '@directwerk/ui/components/progress'

/**
 * Legacy route kept for old bookmarks. The workspace picker now lives on
 * `/login`, so this page only explains the redirect and moves on.
 */
export default function LegacySelectTenantPage(): React.JSX.Element {
    const router = useRouter()

    useEffect(() => {
        const timer = window.setTimeout(() => {
            router.replace('/login')
        }, 900)
        return () => window.clearTimeout(timer)
    }, [router])

    return (
        <AuthCard
            description="Der Workspace-Dialog ist in die Anmeldung umgezogen. Du wirst gleich weitergeleitet."
            title="Weiter zur Anmeldung"
        >
            <div
                aria-busy="true"
                aria-live="polite"
                className="grid gap-3"
                role="status"
            >
                <Progress aria-label="Weiterleitung zur Anmeldung" value={65} />
                <p className="text-sm text-muted-foreground">
                    Schritt 1 von 2 — Workspace wählen, dann anmelden. Falls nichts
                    passiert,{' '}
                    <a className="underline" href="/login">
                        hier klicken
                    </a>
                    .
                </p>
            </div>
        </AuthCard>
    )
}
