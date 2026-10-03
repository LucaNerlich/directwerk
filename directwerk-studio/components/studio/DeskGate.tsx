'use client'

import type {ReactNode} from 'react'

import EmptyState from '@directwerk/ui/components/empty-state'

import {useDictionary} from '@/components/i18n/LocaleProvider'
import {hasDesk} from '@/lib/api/client'
import type {StudioDesk} from '@directwerk/api/types'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

export default function DeskGate({
    desk,
    children,
}: {
    desk: StudioDesk
    children: ReactNode
}) {
    const config = useSiteConfig()
    const dict = useDictionary()

    if (!hasDesk(config, desk)) {
        return (
            <div role="status">
                <EmptyState
                    title={dict.gates.deskNotEnabledTitle}
                    description={dict.gates.deskNotEnabled}
                />
            </div>
        )
    }

    return children
}
