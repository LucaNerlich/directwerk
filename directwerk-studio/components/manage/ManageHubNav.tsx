'use client'

import HubSubnav from '@/components/studio/HubSubnav'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {buildManageHubItems, buildMediaHubItems} from '@/lib/studio/navigation'
import {stripLangPrefix} from '@/lib/i18n/paths'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {usePathname} from 'next/navigation'

export default function ManageHubNav({
    children,
}: {
    children: React.ReactNode
}): React.JSX.Element {
    const pathname = usePathname()
    const path = stripLangPrefix(pathname)
    const dict = useDictionary()
    const config = useSiteConfig()

    // Categories belong to Mediathek, not Abos.
    if (path.startsWith('/manage/categories')) {
        const mediaItems = buildMediaHubItems(config, dict)
        if (mediaItems.length <= 1) {
            return <>{children}</>
        }
        return (
            <div className="flex flex-col gap-6">
                <HubSubnav ariaLabel={dict.nav.verwaltung.mediaHub} items={mediaItems} />
                {children}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            <HubSubnav
                ariaLabel={dict.nav.verwaltung.subscriptions}
                items={buildManageHubItems(dict)}
            />
            {children}
        </div>
    )
}
