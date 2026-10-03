'use client'

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
    SidebarSeparator,
} from '@directwerk/ui/components/sidebar'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {useActiveDesk} from '@/lib/studio/useActiveDesk'
import {
    buildPodcastDeskItems,
    buildVerwaltungSections,
    buildWriteDeskItems,
    type NavigationItem,
} from '@/lib/studio/navigation'
import {stripLangPrefix} from '@/lib/i18n/paths'
import type {SiteConfig} from '@directwerk/api/types'
import {useOptionalMe} from '@/lib/auth/MeProvider'
import {usePathname} from 'next/navigation'

function linkClassName(active: boolean): string {
    return [
        'flex min-h-9 w-full items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        'focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        active
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : '',
    ]
        .filter((part) => part.length > 0)
        .join(' ')
}

function isActivePath(pathname: string, href: string): boolean {
    const path = stripLangPrefix(pathname)
    if (href === '/' || href === '/write' || href === '/podcast' || href === '/manage') {
        return path === href
    }
    return path === href || path.startsWith(`${href}/`)
}

function NavigationGroup({
    label,
    items,
    pathname,
}: {
    label?: string
    items: NavigationItem[]
    pathname: string
}): React.JSX.Element {
    return (
        <SidebarGroup>
            {label !== undefined ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => {
                        const active = isActivePath(pathname, item.href)
                        return (
                            <SidebarMenuItem key={item.href}>
                                <LocaleLink
                                    aria-current={active ? 'page' : undefined}
                                    className={linkClassName(active)}
                                    href={item.href}
                                >
                                    <span>{item.label}</span>
                                </LocaleLink>
                            </SidebarMenuItem>
                        )
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}

export default function SideNav({config}: {config: SiteConfig}) {
    const pathname = usePathname()
    const me = useOptionalMe()
    const dict = useDictionary()
    const activeDesk = useActiveDesk(config)
    const verwaltungSections = buildVerwaltungSections(config, me, dict)

    const showDeskZone = activeDesk === 'WRITE' || activeDesk === 'PODCAST'
    const showVerwaltung = verwaltungSections.length > 0

    return (
        <nav aria-label={dict.nav.ariaMain}>
            <NavigationGroup
                items={[{href: '/', label: dict.nav.studio}]}
                pathname={pathname}
            />
            {activeDesk === 'WRITE' ? (
                <NavigationGroup
                    label={dict.nav.write.label}
                    items={buildWriteDeskItems(config, dict)}
                    pathname={pathname}
                />
            ) : null}
            {activeDesk === 'PODCAST' ? (
                <NavigationGroup
                    label={dict.nav.podcast.label}
                    items={buildPodcastDeskItems(config, dict)}
                    pathname={pathname}
                />
            ) : null}
            {showDeskZone && showVerwaltung ? (
                <SidebarSeparator className="my-2" />
            ) : null}
            {showVerwaltung ? (
                <SidebarGroup>
                    <SidebarGroupLabel>{dict.nav.verwaltung.label}</SidebarGroupLabel>
                    <SidebarGroupContent className="flex flex-col gap-4">
                        {verwaltungSections.map((section) => (
                            <div key={section.label ?? section.items[0]?.href}>
                                {section.label !== undefined ? (
                                    <p className="px-2 pb-1 text-xs font-medium text-sidebar-foreground/70">
                                        {section.label}
                                    </p>
                                ) : null}
                                <SidebarMenu>
                                    {section.items.map((item) => {
                                        const active = isActivePath(pathname, item.href)
                                        return (
                                            <SidebarMenuItem key={item.href}>
                                                <LocaleLink
                                                    aria-current={active ? 'page' : undefined}
                                                    className={linkClassName(active)}
                                                    href={item.href}
                                                >
                                                    <span>{item.label}</span>
                                                </LocaleLink>
                                            </SidebarMenuItem>
                                        )
                                    })}
                                </SidebarMenu>
                            </div>
                        ))}
                    </SidebarGroupContent>
                </SidebarGroup>
            ) : null}
        </nav>
    )
}
