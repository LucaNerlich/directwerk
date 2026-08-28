'use client'

import {usePathname} from 'next/navigation'
import {useEffect, useState} from 'react'

import {hasDesk, resolveActiveDesk} from '@/lib/api/client'
import {getLastActiveDesk, setLastActiveDesk} from '@/lib/studio/activeDeskStorage'
import type {SiteConfig, StudioDesk} from '@directwerk/api/types'

/**
 * Resolves the active studio desk for navigation, including hybrid-tenant
 * fallbacks on shared routes via session-persisted last desk.
 */
export function useActiveDesk(config: SiteConfig): StudioDesk | null {
    const pathname = usePathname()
    const [lastDesk, setLastDesk] = useState<StudioDesk | null>(() => getLastActiveDesk())

    const pathDesk = resolveActiveDesk(pathname, config)

    useEffect(() => {
        if (pathDesk === null) {
            return
        }
        setLastActiveDesk(pathDesk)
        setLastDesk(pathDesk)
    }, [pathDesk])

    if (pathDesk !== null) {
        return pathDesk
    }

    if (config.studioDesks.length === 1) {
        return config.studioDesks[0]
    }

    if (lastDesk !== null && hasDesk(config, lastDesk)) {
        return lastDesk
    }

    return null
}
