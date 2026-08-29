'use client'

import {useEffect, useRef} from 'react'

/**
 * When EMAIL_NOTIFY is available, default the publish-time notify checkbox to on
 * once per editor session (matches the product mock in content-creation-implementation).
 */
export function useDefaultNotifySubscribers(
    notifyAvailable: boolean,
    setNotifySubscribers: (value: boolean) => void,
): void {
    const appliedRef = useRef(false)

    useEffect(() => {
        if (!notifyAvailable || appliedRef.current) {
            return
        }
        appliedRef.current = true
        setNotifySubscribers(true)
    }, [notifyAvailable, setNotifySubscribers])
}
