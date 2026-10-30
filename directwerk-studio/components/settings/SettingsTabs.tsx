'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {buildSettingsTabs} from '@/lib/studio/navigation'
import {stripLangPrefix} from '@/lib/i18n/paths'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {usePathname} from 'next/navigation'

export default function SettingsTabs(): React.JSX.Element {
    const pathname = usePathname()
    const path = stripLangPrefix(pathname)
    const dict = useDictionary()
    const config = useSiteConfig()
    const tabs = buildSettingsTabs(config, dict)

    return (
        <nav aria-label={dict.nav.verwaltung.settings} className="border-b">
            <ul className="-mb-px flex flex-wrap gap-1">
                {tabs.map((tab) => {
                    const active = tab.match(path)
                    return (
                        <li key={tab.href}>
                            <LocaleLink
                                aria-current={active ? 'page' : undefined}
                                className={[
                                    'inline-flex min-h-9 items-center border-b-2 px-3 py-2 text-sm transition-colors',
                                    active
                                        ? 'border-primary font-medium text-foreground'
                                        : 'border-transparent text-muted-foreground hover:text-foreground',
                                ].join(' ')}
                                href={tab.href}
                            >
                                {tab.label}
                            </LocaleLink>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}
