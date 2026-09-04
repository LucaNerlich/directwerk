'use client'

import {useEffect, useState} from 'react'

import {getMyEffectiveRights} from '@/lib/api/tenantSettingsApi'
import {useOptionalMe} from '@/lib/auth/MeProvider'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {deskAccess, type DeskAccess} from '@/lib/rbac/access'
import type {EffectiveRights, RbacEntityType} from '@directwerk/api/types'

/**
 * RBAC desk adaptation (issue #148): resolves the acting user, loads their
 * effective rights once, and computes row permissions for episode/article
 * editors. A failed rights fetch resolves permissively — UI adaptation is
 * convenience-only while the backend enforces authoritatively per row.
 */
export function useDeskAccess({
    entity,
    ownerUserId,
    kind,
}: {
    entity: RbacEntityType
    /**
     * Creator id of the open row; `null` means legacy/unknown,
     * `undefined` means the row doesn't exist yet (create form, counts as own —
     * creation itself is governed by the CREATE check on save).
     */
    ownerUserId?: number | null
    /** Publication kind label for messages ("Folge" or "Beitrag"). */
    kind: string
}): DeskAccess {
    const me = useOptionalMe()
    const [rights, setRights] = useState<EffectiveRights | null>(null)

    useEffect(() => {
        let active = true
        getMyEffectiveRights(getClientTenantHost())
            .then((loaded) => {
                if (active) {
                    setRights(loaded)
                }
            })
            .catch(() => {
                if (active) {
                    setRights(null)
                }
            })
        return () => {
            active = false
        }
    }, [])

    const myUserId = me?.userId ?? null
    return deskAccess({
        effective: rights?.effective ?? null,
        entity,
        ownerUserId: ownerUserId === undefined ? myUserId : ownerUserId,
        myUserId,
        kind,
    })
}
