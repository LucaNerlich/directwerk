'use client'

import {useEffect, useState} from 'react'

import {isTenantAdminRole, listSubscribers} from '@/lib/api/tenantApi'
import {useOptionalMe} from '@/lib/auth/MeProvider'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

/**
 * Loads a short subscriber-count hint for publish notify UI (tenant admins only).
 */
export function useNotifyAudienceHint(enabled: boolean): string | null {
    const me = useOptionalMe()
    const authRedirect = useAuthRequired()
    const [hint, setHint] = useState<string | null>(null)

    useEffect(() => {
        if (!enabled || me === null || !isTenantAdminRole(me.roles)) {
            setHint(null)
            return
        }

        let active = true
        listSubscribers(getClientTenantHost())
            .then((subscribers) => {
                if (!active) {
                    return
                }
                if (subscribers.length === 0) {
                    setHint(null)
                    return
                }
                setHint(`ca. ${subscribers.length} Abonnenten`)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                authRedirect(error)
            })

        return () => {
            active = false
        }
    }, [authRedirect, enabled, me])

    return hint
}
