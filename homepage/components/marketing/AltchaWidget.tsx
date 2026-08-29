'use client'

import {useEffect, useRef, useState, useSyncExternalStore} from 'react'

import {API_URL} from '@/lib/marketing/constants'

type AltchaElement = HTMLElement & AltchaWidgetMethods

export default function AltchaWidget({
    onVerifiedChange,
    widgetRef,
}: {
    onVerifiedChange?: (verified: boolean) => void
    widgetRef?: (element: AltchaElement | null) => void
}): React.JSX.Element | null {
    const internalRef = useRef<AltchaElement>(null)
    const [altchaLoaded, setAltchaLoaded] = useState(false)
    const isClient = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    )

    useEffect(() => {
        if (!isClient) {
            return
        }
        void import('altcha').then(() => {
            setAltchaLoaded(true)
        })
    }, [isClient])

    useEffect(() => {
        widgetRef?.(altchaLoaded ? internalRef.current : null)
    }, [altchaLoaded, widgetRef])

    if (!isClient || !altchaLoaded) {
        return null
    }

    return (
        <altcha-widget
            challengeurl={`${API_URL}/api/v1/public/altcha/challenge`}
            ref={internalRef}
            onstatechange={(event: AltchaStateChangeEvent) => {
                onVerifiedChange?.(event.detail?.state === 'verified')
            }}
        />
    )
}
