'use client'

import {useEffect, useState} from 'react'
import {useSearchParams} from 'next/navigation'

import {Alert, AlertDescription, AlertTitle} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'

import {
    dismissFeedOnboarding,
    isFeedOnboardingDismissed,
} from '@/lib/feeds/feedOnboardingStorage'
import {useDictionary} from '@/lib/i18n/LocaleProvider'

/**
 * Dismissible first-run banner when landing on `/feeds?setup=1` after subscribe
 * or from the account private-feed card.
 */
export default function FeedSetupBanner(): React.JSX.Element | null {
    const {common, feeds} = useDictionary()
    const searchParams = useSearchParams()
    const setup = searchParams.get('setup') === '1'
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if (!setup) {
            setVisible(false)
            return
        }
        setVisible(!isFeedOnboardingDismissed())
    }, [setup])

    if (!visible) {
        return null
    }

    return (
        <Alert>
            <AlertTitle>{feeds.setupBannerTitle}</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <span>{feeds.setupBannerDesc}</span>
                <Button
                    onClick={() => {
                        dismissFeedOnboarding()
                        setVisible(false)
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    {common.dismiss}
                </Button>
            </AlertDescription>
        </Alert>
    )
}
