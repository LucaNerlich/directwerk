'use client'

import {useEffect, useRef, useState} from 'react'

import {API_URL} from '@/lib/marketing/constants'

type AltchaElement = HTMLElement & AltchaWidgetMethods

/**
 * Renders the Altcha verification widget and reports whether verification succeeds.
 *
 * @param onVerifiedChange - Callback invoked when the widget's verification state changes
 * @param widgetRef - Callback receiving the widget element after loading, or `null` before loading
 * @returns The verification widget when ready, otherwise `null`
 */
export default function AltchaWidget({
    onVerifiedChange,
    widgetRef,
}: {
    onVerifiedChange?: (verified: boolean) => void
    widgetRef?: (element: AltchaElement | null) => void
}): React.JSX.Element | null {
    const internalRef = useRef<AltchaElement>(null)
    const [altchaLoaded, setAltchaLoaded] = useState(false)
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
    }, [])

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
