'use client'

import {useRouter} from 'next/navigation'
import {useEffect, type ReactNode} from 'react'

import EmptyState from '@directwerk/ui/components/empty-state'

import {useDictionary} from '@/components/i18n/LocaleProvider'
import {useLocalizedPath} from '@/components/i18n/useLocalizedPath'
import {isTenantAdminRole} from '@/lib/api/studioHelpers'
import {useMe} from '@/lib/auth/MeProvider'

export default function TenantAdminGuard({
    children,
}: {
    children: ReactNode
}): React.JSX.Element {
    const me = useMe()
    const router = useRouter()
    const localize = useLocalizedPath()
    const dict = useDictionary()
    const allowed = isTenantAdminRole(me.roles)

    useEffect(() => {
        if (!allowed) {
            router.replace(localize('/'))
        }
    }, [allowed, localize, router])

    if (!allowed) {
        return (
            <div role="status">
                <EmptyState
                    title={dict.gates.noPermission}
                    description={dict.gates.tenantAdminOnly}
                />
            </div>
        )
    }

    return <>{children}</>
}
