'use client'

import Link from 'next/link'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {buttonVariants} from '@directwerk/ui/components/button'

import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'

/**
 * Displays an authentication-context banner for subscriber content.
 *
 * @param showWhenAuthenticated - Whether to display the banner for authenticated users
 * @returns The context banner, or `null` when authenticated users are excluded
 */
export default function SubscriberContextBanner({
    showWhenAuthenticated = true,
}: {
    showWhenAuthenticated?: boolean
}): React.JSX.Element | null {
    const {isAuthenticated} = useSubscriberAuth()
    const lang = useLocale()
    const {nav, subscriberBanner} = useDictionary()

    if (isAuthenticated && !showWhenAuthenticated) {
        return null
    }

    if (isAuthenticated) {
        return (
            <Alert>
                <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>{subscriberBanner.authenticatedMessage}</span>
                    <Link className={buttonVariants({size: 'sm', variant: 'outline'})} href={localizedPath(lang, '/account')}>
                        {nav.toAccount}
                    </Link>
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <Alert>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{subscriberBanner.guestMessage}</span>
                <div className="flex flex-wrap gap-2">
                    <Link className={buttonVariants({size: 'sm'})} href={localizedPath(lang, '/login')}>
                        {nav.login}
                    </Link>
                    <Link className={buttonVariants({size: 'sm', variant: 'outline'})} href={localizedPath(lang, '/register')}>
                        {nav.register}
                    </Link>
                </div>
            </AlertDescription>
        </Alert>
    )
}
