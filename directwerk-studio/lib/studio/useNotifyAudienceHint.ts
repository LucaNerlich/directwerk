'use client'

import {listSubscribers} from '@/lib/api/tenantSettingsApi'
import {isTenantAdminRole} from '@/lib/api/studioHelpers'
import {useOptionalMe} from '@/lib/auth/MeProvider'

import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {useEffect, useState} from 'react'

/** Audience hint for episode notify (account members). Articles compute list counts locally. */
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
        listSubscribers({page: 0, size: 1})
            .then((page) => {
                if (!active) {
                    return
                }
                if (page.totalElements === 0) {
                    setHint(null)
                    return
                }
                setHint(`ca. ${page.totalElements} Abonnenten`)
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
