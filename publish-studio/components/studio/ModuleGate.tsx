import type {ReactNode} from 'react'

import type {SiteConfig} from '@/lib/api/types'

export function ModuleGate({
    moduleKey,
    config,
    children,
}: {
    moduleKey: string
    config: SiteConfig
    children: ReactNode
}) {
    if (!config.enabledModules.includes(moduleKey)) {
        return null
    }
    return children
}
