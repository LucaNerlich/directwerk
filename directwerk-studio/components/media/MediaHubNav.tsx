'use client'

import HubSubnav from '@/components/studio/HubSubnav'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {buildMediaHubItems} from '@/lib/studio/navigation'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

export default function MediaHubNav({
    children,
}: {
    children: React.ReactNode
}): React.JSX.Element {
    const dict = useDictionary()
    const config = useSiteConfig()
    const items = buildMediaHubItems(config, dict)
    if (items.length <= 1) {
        return <>{children}</>
    }

    return (
        <div className="flex flex-col gap-6">
            <HubSubnav ariaLabel={dict.nav.verwaltung.mediaHub} items={items} />
            {children}
        </div>
    )
}
