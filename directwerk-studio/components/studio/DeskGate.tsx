'use client'

import type {ReactNode} from 'react'

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
            <p role="status">
                Dieser Bereich ist für diesen Mandanten nicht freigeschaltet.
            </p>
        )
    }

    return children
}
