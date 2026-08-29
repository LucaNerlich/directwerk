'use client'

import {useEffect, useSyncExternalStore} from 'react'

import 'altcha'
import type {} from 'altcha/types/react'

import {API_URL} from '@/lib/marketing/constants'

type AltchaElement = HTMLElement & {
    reset?: () => void
}

export default function AltchaWidget({
    onVerifiedChange,
    widgetRef,
}: {
    onVerifiedChange?: (verified: boolean) => void
    widgetRef?: (element: AltchaElement | null) => void
}): React.JSX.Element | null {
    const isClient = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    )

    useEffect(() => {
        if (!isClient) {
            widgetRef?.(null)
        }
    }, [isClient, widgetRef])

    if (!isClient) {
        return null
    }

    return (
        <altcha-widget
            challenge={`${API_URL}/api/v1/public/altcha/challenge`}
            ref={(element: AltchaElement | null) => {
                widgetRef?.(element)
            }}
            onstatechange={(event: Event) => {
                const customEvent = event as CustomEvent<{state?: string}>
                onVerifiedChange?.(customEvent.detail?.state === 'verified')
            }}
        />
    )
}
