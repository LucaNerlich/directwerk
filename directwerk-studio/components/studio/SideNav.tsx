'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
    SidebarSeparator,
} from '@directwerk/ui/components/sidebar'

import {useActiveDesk} from '@/lib/studio/useActiveDesk'
import {
    buildPodcastDeskItems,
    buildVerwaltungSections,
    buildWriteDeskItems,
    type NavigationItem,
} from '@/lib/studio/navigation'
import type {SiteConfig} from '@directwerk/api/types'
import {useOptionalMe} from '@/lib/auth/MeProvider'

function linkClassName(active: boolean): string {
    return [
        'flex h-8 w-full items-center rounded-md px-2 text-sm outline-none transition-colors',
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
    if (href === '/' || href === '/write' || href === '/podcast' || href === '/manage') {
        return pathname === href
    }
    return pathname === href || pathname.startsWith(`${href}/`)
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
                    {items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                            <Link
                                aria-current={
                                    isActivePath(pathname, item.href) ? 'page' : undefined
                                }
                                className={linkClassName(isActivePath(pathname, item.href))}
                                href={item.href}
                            >
                                <span>{item.label}</span>
                            </Link>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}

export default function SideNav({config}: {config: SiteConfig}) {
    const pathname = usePathname()
    const me = useOptionalMe()
    const activeDesk = useActiveDesk(config)
    const verwaltungSections = buildVerwaltungSections(config, me)

    const showDeskZone = activeDesk === 'WRITE' || activeDesk === 'PODCAST'
    const showVerwaltung = verwaltungSections.length > 0

    return (
        <nav aria-label="Hauptnavigation">
            <NavigationGroup
                items={[{href: '/', label: 'Studio'}]}
                pathname={pathname}
            />
            {activeDesk === 'WRITE' ? (
                <NavigationGroup
                    label="Schreiben"
                    items={buildWriteDeskItems(config)}
                    pathname={pathname}
                />
            ) : null}
            {activeDesk === 'PODCAST' ? (
                <NavigationGroup
                    label="Podcast"
                    items={buildPodcastDeskItems(config)}
                    pathname={pathname}
                />
            ) : null}
            {showDeskZone && showVerwaltung ? (
                <SidebarSeparator className="my-2" />
            ) : null}
            {showVerwaltung ? (
                <>
                    <SidebarGroup>
                        <SidebarGroupLabel>Verwaltung</SidebarGroupLabel>
                    </SidebarGroup>
                    {verwaltungSections.map((section) => (
                        <NavigationGroup
                            key={section.label ?? section.items[0]?.href}
                            label={section.label}
                            items={section.items}
                            pathname={pathname}
                        />
                    ))}
                </>
            ) : null}
        </nav>
    )
}
