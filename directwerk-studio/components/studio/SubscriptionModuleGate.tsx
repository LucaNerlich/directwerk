'use client'

import type {ReactNode} from 'react'

import {hasModule} from '@/lib/api/client'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

import SubscriptionModuleUnavailable from '@/components/studio/SubscriptionModuleUnavailable'

/** Client gate mirroring DeskGate — reads layout-provided SiteConfigProvider. */
export default function SubscriptionModuleGate({
    children,
}: {
    children: ReactNode
}) {
    const config = useSiteConfig()

    if (!hasModule(config, 'SUBSCRIPTION')) {
        return <SubscriptionModuleUnavailable />
    }

    return children
}
