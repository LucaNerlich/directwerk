'use client'

import {useEffect, useState} from 'react'

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
    buildPodcastDeskNav,
    buildVerwaltungSections,
    buildWriteDeskNav,
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
        'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0',
        active
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : '',
    ]
        .filter((part) => part.length > 0)
        .join(' ')
}

function isActivePath(pathname: string, href: string): boolean {
    const path = stripLangPrefix(pathname)
    if (href === '/') {
        return path === '/'
    }
    if (href === '/settings') {
        return path === '/settings' || path.startsWith('/settings/')
    }
    if (href === '/media') {
        return (
            path === '/media' ||
            path.startsWith('/media/') ||
            path === '/bonus' ||
            path.startsWith('/bonus/') ||
            path.startsWith('/manage/categories')
        )
    }
    if (href === '/manage') {
        if (path.startsWith('/manage/categories')) {
            return false
        }
        return path === '/manage' || path.startsWith('/manage/')
    }
    if (href === '/write' || href === '/podcast') {
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
                            <SidebarMenuItem key={`${item.href}-${item.label}`}>
                                <LocaleLink
                                    aria-current={active ? 'page' : undefined}
                                    className={linkClassName(active)}
                                    href={item.href}
                                    title={item.label}
                                >
                                    <span className="truncate group-data-[collapsible=icon]:sr-only">
                                        {item.label}
                                    </span>
                                    <span
                                        aria-hidden="true"
                                        className="hidden size-2 rounded-full bg-current group-data-[collapsible=icon]:block"
                                    />
                                </LocaleLink>
                            </SidebarMenuItem>
                        )
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}

function isSecondaryActive(pathname: string, items: NavigationItem[]): boolean {
    return items.some((item) => isActivePath(pathname, item.href))
}

export default function SideNav({config}: {config: SiteConfig}) {
    const pathname = usePathname()
    const me = useOptionalMe()
    const dict = useDictionary()
    const activeDesk = useActiveDesk(config)
    const verwaltungSections = buildVerwaltungSections(config, me, dict)
    const path = stripLangPrefix(pathname)

    const writeNav = buildWriteDeskNav(config, dict, {collapseSecondary: true})
    const podcastNav = buildPodcastDeskNav(config, dict, {collapseSecondary: true})

    const writeSecondaryOpen = isSecondaryActive(path, writeNav.secondary)
    const podcastSecondaryOpen = isSecondaryActive(path, podcastNav.secondary)
    const [writeMoreOpen, setWriteMoreOpen] = useState(writeSecondaryOpen)
    const [podcastMoreOpen, setPodcastMoreOpen] = useState(podcastSecondaryOpen)

    useEffect(() => {
        if (writeSecondaryOpen) {
            setWriteMoreOpen(true)
        }
    }, [writeSecondaryOpen])

    useEffect(() => {
        if (podcastSecondaryOpen) {
            setPodcastMoreOpen(true)
        }
    }, [podcastSecondaryOpen])

    const showDeskZone = activeDesk === 'WRITE' || activeDesk === 'PODCAST'
    const showVerwaltung = verwaltungSections.length > 0

    return (
        <nav aria-label={dict.nav.ariaMain}>
            <NavigationGroup
                items={[{href: '/', label: dict.nav.studio}]}
                pathname={pathname}
            />
            {activeDesk === 'WRITE' ? (
                <>
                    <NavigationGroup
                        label={dict.nav.write.label}
                        items={writeNav.primary}
                        pathname={pathname}
                    />
                    {writeNav.secondary.length > 0 ? (
                        <SidebarGroup>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    <SidebarMenuItem>
                                        <button
                                            aria-expanded={writeMoreOpen}
                                            className={linkClassName(false)}
                                            onClick={() => setWriteMoreOpen((open) => !open)}
                                            type="button"
                                        >
                                            <span className="truncate group-data-[collapsible=icon]:sr-only">
                                                {dict.nav.more}
                                            </span>
                                        </button>
                                    </SidebarMenuItem>
                                    {writeMoreOpen
                                        ? writeNav.secondary.map((item) => {
                                              const active = isActivePath(pathname, item.href)
                                              return (
                                                  <SidebarMenuItem key={item.href}>
                                                      <LocaleLink
                                                          aria-current={active ? 'page' : undefined}
                                                          className={linkClassName(active)}
                                                          href={item.href}
                                                          title={item.label}
                                                      >
                                                          <span className="truncate group-data-[collapsible=icon]:sr-only">
                                                              {item.label}
                                                          </span>
                                                      </LocaleLink>
                                                  </SidebarMenuItem>
                                              )
                                          })
                                        : null}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    ) : null}
                </>
            ) : null}
            {activeDesk === 'PODCAST' ? (
                <>
                    <NavigationGroup
                        label={dict.nav.podcast.label}
                        items={podcastNav.primary}
                        pathname={pathname}
                    />
                    {podcastNav.secondary.length > 0 ? (
                        <SidebarGroup>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    <SidebarMenuItem>
                                        <button
                                            aria-expanded={podcastMoreOpen}
                                            className={linkClassName(false)}
                                            onClick={() => setPodcastMoreOpen((open) => !open)}
                                            type="button"
                                        >
                                            <span className="truncate group-data-[collapsible=icon]:sr-only">
                                                {dict.nav.more}
                                            </span>
                                        </button>
                                    </SidebarMenuItem>
                                    {podcastMoreOpen
                                        ? podcastNav.secondary.map((item) => {
                                              const active = isActivePath(pathname, item.href)
                                              return (
                                                  <SidebarMenuItem key={item.href}>
                                                      <LocaleLink
                                                          aria-current={active ? 'page' : undefined}
                                                          className={linkClassName(active)}
                                                          href={item.href}
                                                          title={item.label}
                                                      >
                                                          <span className="truncate group-data-[collapsible=icon]:sr-only">
                                                              {item.label}
                                                          </span>
                                                      </LocaleLink>
                                                  </SidebarMenuItem>
                                              )
                                          })
                                        : null}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    ) : null}
                </>
            ) : null}
            {showDeskZone && showVerwaltung ? (
                <SidebarSeparator className="my-2" />
            ) : null}
            {showVerwaltung
                ? verwaltungSections.map((section) => (
                      <NavigationGroup
                          key={section.label ?? section.items[0]?.href}
                          label={section.label}
                          items={section.items}
                          pathname={pathname}
                      />
                  ))
                : null}
        </nav>
    )
}
