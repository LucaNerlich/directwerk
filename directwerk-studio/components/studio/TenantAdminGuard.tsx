'use client'

import {useRouter} from 'next/navigation'
import {useEffect, type ReactNode} from 'react'

import {isTenantAdminRole} from '@/lib/api/studioHelpers'
import {useMe} from '@/lib/auth/MeProvider'

export default function TenantAdminGuard({
    children,
}: {
    children: ReactNode
}): React.JSX.Element {
    const me = useMe()
    const router = useRouter()
    const allowed = isTenantAdminRole(me.roles)

    useEffect(() => {
        if (!allowed) {
            router.replace('/')
        }
    }, [allowed, router])

    if (!allowed) {
        return <p>Keine Berechtigung.</p>
    }

    return <>{children}</>
}
