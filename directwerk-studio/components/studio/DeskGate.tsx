'use client'

import type {ReactNode} from 'react'

import EmptyState from '@directwerk/ui/components/empty-state'

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

    if (!hasDesk(config, desk)) {
        return (
            <div role="status">
                <EmptyState
                    title="Bereich nicht freigeschaltet"
                    description="Dieser Bereich ist für diesen Mandanten nicht freigeschaltet."
                />
            </div>
        )
    }

    return children
}
