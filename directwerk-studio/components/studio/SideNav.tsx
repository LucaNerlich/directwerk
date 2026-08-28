'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
} from '@directwerk/ui/components/sidebar'

import {hasModule, resolveActiveDesk} from '@/lib/api/client'
import {isTenantAdminRole} from '@/lib/api/tenantApi'
import type {SiteConfig} from '@directwerk/api/types'
import {useOptionalMe} from '@/lib/auth/MeProvider'

interface NavigationItem {
    href: string
    label: string
}

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
    // Hub/index links must stay exact so child routes (e.g. /podcast/episodes)
    // do not keep "Übersicht" highlighted.
    if (href === '/' || href === '/podcast' || href === '/manage') {
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

/**
 * Renders the tenant's side navigation, ordered around the content-creation journey.
 *
 * @param config - Site configuration used to determine the tenant name and available navigation items
 */
export default function SideNav({config}: {config: SiteConfig}) {
    const pathname = usePathname()
    const me = useOptionalMe()
    const activeDesk = resolveActiveDesk(pathname, config)
    const showWrite = activeDesk === 'WRITE'
    const showPodcast = activeDesk === 'PODCAST'
    const showPodcastRss = hasModule(config, 'PODCAST_RSS')
    const showSubscription = hasModule(config, 'SUBSCRIPTION')
    const showMedia =
        hasModule(config, 'DIGITAL_CONTENT') || hasModule(config, 'PODCAST')
    const showCategories = hasModule(config, 'DIGITAL_CONTENT')
    const showEmailNotify = hasModule(config, 'EMAIL_NOTIFY')
    const showAdmin = me !== null && isTenantAdminRole(me.roles)

    const podcastCreateItems: NavigationItem[] = [
        {href: '/podcast', label: 'Start'},
        {href: '/podcast/episodes', label: 'Folgen'},
    ]
    const podcastSetupItems: NavigationItem[] = [
        {href: '/podcast/series', label: 'Sendungen'},
        {href: '/podcast/formats', label: 'Formate'},
    ]
    if (showPodcastRss || config.publicRssUrl !== null) {
        podcastSetupItems.push({href: '/podcast/feeds', label: 'Feeds'})
    }

    const audienceItems: NavigationItem[] = []
    if (showSubscription) {
        if (showAdmin) {
            audienceItems.push(
                {href: '/manage', label: 'Zahlungen'},
                {href: '/manage/products', label: 'Produkte'},
                {href: '/manage/grants', label: 'Freischaltungen'},
                {href: '/manage/subscribers', label: 'Abonnenten'},
            )
        }
    }

    return (
        <nav aria-label="Hauptnavigation">
            <NavigationGroup
                items={[{href: '/', label: 'Studio'}]}
                pathname={pathname}
            />
            {showWrite ? (
                <NavigationGroup
                    label="Schreiben"
                    items={[
                        {href: '/write/articles', label: 'Beiträge'},
                        ...(showCategories
                            ? [{href: '/write/bonus', label: 'Bonusdateien'}]
                            : []),
                    ]}
                    pathname={pathname}
                />
            ) : null}
            {showPodcast ? (
                <>
                    <NavigationGroup
                        label="Podcast · Erstellen"
                        items={podcastCreateItems}
                        pathname={pathname}
                    />
                    <NavigationGroup
                        label="Podcast · Einrichtung"
                        items={podcastSetupItems}
                        pathname={pathname}
                    />
                </>
            ) : null}
            {showMedia ? (
                <NavigationGroup
                    label="Medien"
                    items={[{href: '/media', label: 'Bibliothek'}]}
                    pathname={pathname}
                />
            ) : null}
            {showCategories ? (
                <NavigationGroup
                    label="Organisation"
                    items={[{href: '/manage/categories', label: 'Kategorien'}]}
                    pathname={pathname}
                />
            ) : null}
            {audienceItems.length > 0 ? (
                <NavigationGroup
                    label="Abos"
                    items={audienceItems}
                    pathname={pathname}
                />
            ) : null}
            {showAdmin ? (
                <>
                    <NavigationGroup
                        label="Team"
                        items={[{href: '/team', label: 'Mitglieder'}]}
                        pathname={pathname}
                    />
                    <NavigationGroup
                        label="Einstellungen"
                        items={[
                            {href: '/settings/branding', label: 'Branding'},
                            {href: '/settings/domains', label: 'Domains'},
                            ...(showEmailNotify
                                ? [{href: '/settings/email', label: 'E-Mail-Vorlagen'}]
                                : []),
                            {href: '/settings/stripe', label: 'Stripe'},
                        ]}
                        pathname={pathname}
                    />
                </>
            ) : null}
        </nav>
    )
}
