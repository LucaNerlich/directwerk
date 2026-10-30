'use client'

import {usePathname} from 'next/navigation'
import {useEffect, useState} from 'react'

import {defaultActiveDesk, hasDesk, resolveActiveDesk} from '@/lib/api/client'
import {useOptionalMe} from '@/lib/auth/MeProvider'
import {getLastActiveDesk, setLastActiveDesk} from '@/lib/studio/activeDeskStorage'
import type {SiteConfig, StudioDesk} from '@directwerk/api/types'

/**
 * Resolves the active Studio desk for nav chrome.
 * Path under `/write` or `/podcast` wins; otherwise restores the last valid
 * localStorage desk for this tenant; first visit falls through to module /
 * `studioHome` defaults.
 *
 * Storage is read in an effect (not `useState` init) so SSR and the first
 * client render stay on module defaults — avoids hydration mismatch.
 */
export function useActiveDesk(config: SiteConfig): StudioDesk | null {
    const pathname = usePathname()
    const me = useOptionalMe()
    const tenantId = me?.tenantId ?? null
    const tenantSlug = config.tenant.slug
    const [lastDesk, setLastDesk] = useState<StudioDesk | null>(null)

    const pathDesk = resolveActiveDesk(pathname, config)

    useEffect(() => {
        setLastDesk(getLastActiveDesk({tenantId, tenantSlug}))
    }, [tenantId, tenantSlug])

    useEffect(() => {
        if (pathDesk === null) {
            return
        }
        setLastActiveDesk(pathDesk, {tenantId, tenantSlug})
        setLastDesk(pathDesk)
    }, [pathDesk, tenantId, tenantSlug])

    if (pathDesk !== null) {
        return pathDesk
    }

    if (config.studioDesks.length === 1) {
        return config.studioDesks[0]
    }

    if (lastDesk !== null && hasDesk(config, lastDesk)) {
        return lastDesk
    }

    return defaultActiveDesk(config)
}
