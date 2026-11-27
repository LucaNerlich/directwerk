'use client'

import {useEffect, useState} from 'react'

import {getMediaUploadLimits} from '@/lib/api/mediaApi'
import {resolveMediaLimits, type ResolvedMediaLimits} from '@/lib/media/limits'

/**
 * The tenant's effective upload limits, with platform defaults until the fetch
 * resolves (and when it fails — the server still enforces its own caps).
 */
export function useMediaUploadLimits(): ResolvedMediaLimits {
    const [limits, setLimits] = useState<ResolvedMediaLimits>(() => resolveMediaLimits(null))

    useEffect(() => {
        let active = true
        void getMediaUploadLimits()
            .then((remote) => {
                if (active) {
                    setLimits(resolveMediaLimits(remote))
                }
            })
            .catch(() => {
                // Keep the defaults.
            })
        return () => {
            active = false
        }
    }, [])

    return limits
}
