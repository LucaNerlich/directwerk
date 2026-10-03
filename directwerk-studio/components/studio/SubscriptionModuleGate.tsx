import {hasModule} from '@/lib/api/client'
import {requireStudioSiteConfig} from '@/lib/site/requireSiteConfig'

import SubscriptionModuleUnavailable from '@/components/studio/SubscriptionModuleUnavailable'

export default async function SubscriptionModuleGate({
    children,
}: {
    children: React.ReactNode
}): Promise<React.JSX.Element> {
    const {config} = await requireStudioSiteConfig()

    if (!hasModule(config, 'SUBSCRIPTION')) {
        return <SubscriptionModuleUnavailable />
    }

    return <>{children}</>
}
