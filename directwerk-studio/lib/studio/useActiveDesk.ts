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
 */
export function useActiveDesk(config: SiteConfig): StudioDesk | null {
    const pathname = usePathname()
    const me = useOptionalMe()
    const tenantId = me?.tenantId ?? null
    const tenantSlug = config.tenant.slug
    const [lastDesk, setLastDesk] = useState<StudioDesk | null>(() =>
        getLastActiveDesk({tenantSlug}),
    )

    const pathDesk = resolveActiveDesk(pathname, config)

    // When /me resolves, re-read under the tenant-id key (may migrate from slug).
    useEffect(() => {
        if (tenantId == null) {
            return
        }
        const remembered = getLastActiveDesk({tenantId, tenantSlug})
        if (remembered !== null) {
            setLastDesk(remembered)
        }
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
