'use client'

import Link from 'next/link'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {buttonVariants} from '@directwerk/ui/components/button'

import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'

export default function SubscriberContextBanner({
    showWhenAuthenticated = true,
    showWhenAnonymous = true,
}: {
    showWhenAuthenticated?: boolean
    showWhenAnonymous?: boolean
}): React.JSX.Element | null {
    const {isAuthenticated} = useSubscriberAuth()

    if (isAuthenticated && !showWhenAuthenticated) {
        return null
    }
    if (!isAuthenticated && !showWhenAnonymous) {
        return null
    }

    if (isAuthenticated) {
        return (
            <Alert>
                <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                        Du bist angemeldet — bezahlte Inhalte erscheinen, sobald sie für
                        dein Abo freigeschaltet sind.
                    </span>
                    <Link className={buttonVariants({size: 'sm', variant: 'outline'})} href="/account">
                        Zum Konto
                    </Link>
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <Alert>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                    Öffentlich siehst du freie Inhalte. Melde dich an, um bezahlte Folgen,
                    Beiträge und Bonusdateien freizuschalten.
                </span>
                <div className="flex flex-wrap gap-2">
                    <Link className={buttonVariants({size: 'sm'})} href="/login">
                        Anmelden
                    </Link>
                    <Link className={buttonVariants({size: 'sm', variant: 'outline'})} href="/register">
                        Registrieren
                    </Link>
                </div>
            </AlertDescription>
        </Alert>
    )
}
