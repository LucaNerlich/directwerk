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
    failureLabel = 'Das Sicherheits-Widget konnte nicht geladen werden. Bitte lade die Seite neu.',
}: {
    onVerifiedChange?: (verified: boolean) => void
    widgetRef?: (element: AltchaElement | null) => void
    failureLabel?: string
}): React.JSX.Element | null {
    const internalRef = useRef<AltchaElement>(null)
    const [altchaLoaded, setAltchaLoaded] = useState(false)
    const [loadFailed, setLoadFailed] = useState(false)

    // Issues #351/#443: effects only run on the client, so the separate `isClient` state (and its
    // second effect) were redundant. The dynamic import had no .catch, so a chunk/network/CSP
    // failure left the submit button permanently disabled with no message and an unhandled
    // rejection.
    useEffect(() => {
        let active = true
        import('altcha')
            .then(() => {
                if (active) {
                    setAltchaLoaded(true)
                }
            })
            .catch(() => {
                if (active) {
                    setLoadFailed(true)
                }
            })
        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        widgetRef?.(altchaLoaded ? internalRef.current : null)
    }, [altchaLoaded, widgetRef])

    if (loadFailed) {
        return (
            <p className="text-sm text-destructive" role="alert">
                {failureLabel}
            </p>
        )
    }

    if (!altchaLoaded) {
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
