import {hasDesk, hasModule} from '@/lib/api/client'
import {isTenantAdminRole} from '@/lib/api/studioHelpers'
import type {Dictionary} from '@/lib/i18n/dictionary'
import type {Me, SiteConfig} from '@directwerk/api/types'
import type {NavigationItem} from '@directwerk/ui/lib/navigation'

export type {NavigationItem} from '@directwerk/ui/lib/navigation'

export interface NavigationGroupConfig {
    label?: string
    items: NavigationItem[]
}

export interface DeskNavModel {
    primary: NavigationItem[]
    secondary: NavigationItem[]
}

function mediaShortcut(dict: Dictionary): NavigationItem {
    return {href: '/media', label: dict.nav.mediaLibraryShortcut}
}

export function buildWriteDeskNav(
    config: SiteConfig,
    dict: Dictionary,
    options: {collapseSecondary: boolean} = {collapseSecondary: true},
): DeskNavModel {
    const primary: NavigationItem[] = [
        {href: '/write', label: dict.nav.write.start},
        {href: '/write/articles', label: dict.nav.write.articles},
    ]
    if (hasModule(config, 'DIGITAL_CONTENT') || hasModule(config, 'PODCAST')) {
        primary.push(mediaShortcut(dict))
    }

    const secondary: NavigationItem[] = [
        {href: '/write/import', label: dict.nav.write.import},
    ]
    if (hasModule(config, 'EMAIL_NOTIFY')) {
        secondary.push({href: '/write/lists', label: dict.nav.write.lists})
    }
    if (hasModule(config, 'ARTICLE_RSS') || config.publicArticleRssUrl !== null) {
        secondary.push({href: '/write/feeds', label: dict.nav.write.feeds})
    }

    if (!options.collapseSecondary) {
        return {primary: [...primary, ...secondary], secondary: []}
    }
    return {primary, secondary}
}

export function buildPodcastDeskNav(
    config: SiteConfig,
    dict: Dictionary,
    options: {collapseSecondary: boolean} = {collapseSecondary: true},
): DeskNavModel {
    const primary: NavigationItem[] = [
        {href: '/podcast', label: dict.nav.podcast.start},
        {href: '/podcast/episodes', label: dict.nav.podcast.episodes},
    ]
    if (hasModule(config, 'DIGITAL_CONTENT') || hasModule(config, 'PODCAST')) {
        primary.push(mediaShortcut(dict))
    }

    const secondary: NavigationItem[] = [
        {href: '/podcast/import', label: dict.nav.podcast.import},
        {href: '/podcast/series', label: dict.nav.podcast.series},
        {href: '/podcast/formats', label: dict.nav.podcast.formats},
    ]
    if (hasModule(config, 'PODCAST_RSS') || config.publicRssUrl !== null) {
        secondary.push({href: '/podcast/feeds', label: dict.nav.podcast.feeds})
    }

    if (!options.collapseSecondary) {
        return {primary: [...primary, ...secondary], secondary: []}
    }
    return {primary, secondary}
}

/** @deprecated Prefer buildWriteDeskNav — kept for callers that need a flat list. */
export function buildWriteDeskItems(config: SiteConfig, dict: Dictionary): NavigationItem[] {
    const nav = buildWriteDeskNav(config, dict, {collapseSecondary: false})
    return [...nav.primary, ...nav.secondary]
}

/** @deprecated Prefer buildPodcastDeskNav — kept for callers that need a flat list. */
export function buildPodcastDeskItems(config: SiteConfig, dict: Dictionary): NavigationItem[] {
    const nav = buildPodcastDeskNav(config, dict, {collapseSecondary: false})
    return [...nav.primary, ...nav.secondary]
}

/**
 * Collapsed Verwaltung: Abos, Team, Einstellungen (+ Statistik when analytics qualifies).
 * Mediathek lives in desk primary nav; only falls back here when no Write/Podcast desk
 * would surface the shortcut (hub-only tenants). Nested media pages use MediaHubNav.
 */
export function buildVerwaltungSections(
    config: SiteConfig,
    me: Me | null,
    dict: Dictionary,
): NavigationGroupConfig[] {
    const items: NavigationItem[] = []
    const showMedia =
        hasModule(config, 'DIGITAL_CONTENT') || hasModule(config, 'PODCAST')
    const deskSurfacesMedia =
        showMedia && (hasDesk(config, 'WRITE') || hasDesk(config, 'PODCAST'))
    const showSubscription = hasModule(config, 'SUBSCRIPTION')
    const showAdmin = me !== null && isTenantAdminRole(me.roles)
    const v = dict.nav.verwaltung

    // Desk primary already lists Mediathek — keep Verwaltung free of the duplicate.
    if (showMedia && !deskSurfacesMedia) {
        items.push({href: '/media', label: v.mediaHub})
    }

    if (showSubscription && showAdmin) {
        items.push({href: '/manage', label: v.subscriptions})
    }

    const showAnalytics =
        hasDesk(config, 'WRITE') ||
        hasDesk(config, 'PODCAST') ||
        showMedia ||
        showSubscription
    if (showAnalytics) {
        items.push({href: '/analytics', label: v.statistics})
    }

    if (showAdmin) {
        items.push({href: '/team', label: v.team})
        items.push({href: '/settings', label: v.settings})
    }

    if (items.length === 0) {
        return []
    }

    return [{label: v.label, items}]
}

export function buildManageHubItems(dict: Dictionary): NavigationItem[] {
    const v = dict.nav.verwaltung
    return [
        {href: '/manage', label: v.payments},
        {href: '/manage/products', label: v.products},
        {href: '/manage/grants', label: v.grants},
        {href: '/manage/subscribers', label: v.subscribers},
    ]
}

export function buildMediaHubItems(
    config: SiteConfig,
    dict: Dictionary,
): NavigationItem[] {
    const v = dict.nav.verwaltung
    const items: NavigationItem[] = [{href: '/media', label: v.library}]
    if (hasModule(config, 'BONUS_CONTENT')) {
        items.push({href: '/bonus', label: v.bonus})
    }
    if (hasModule(config, 'DIGITAL_CONTENT')) {
        items.push({href: '/manage/categories', label: v.categories})
    }
    return items
}

export interface SettingsTabItem {
    href: string
    label: string
    match: (path: string) => boolean
}

export function buildSettingsTabs(
    config: SiteConfig,
    dict: Dictionary,
): SettingsTabItem[] {
    const v = dict.nav.verwaltung
    const tabs: SettingsTabItem[] = [
        {
            href: '/settings/branding',
            label: v.branding,
            match: (path) => path === '/settings/branding' || path.startsWith('/settings/branding/'),
        },
        {
            href: '/settings/domains',
            label: v.domains,
            match: (path) => path === '/settings/domains' || path.startsWith('/settings/domains/'),
        },
        {
            href: '/settings/integrations',
            label: v.delivery,
            match: (path) =>
                path === '/settings/integrations' ||
                path.startsWith('/settings/integrations/') ||
                path === '/settings/email' ||
                path.startsWith('/settings/email/'),
        },
    ]
    if (hasModule(config, 'STRIPE_BILLING')) {
        tabs.push({
            href: '/settings/stripe',
            label: v.paymentsSettings,
            match: (path) => path === '/settings/stripe' || path.startsWith('/settings/stripe/'),
        })
    }
    tabs.push({
        href: '/settings/api-keys',
        label: v.apiKeys,
        match: (path) => path === '/settings/api-keys' || path.startsWith('/settings/api-keys/'),
    })
    tabs.push({
        href: '/settings/advanced',
        label: v.advanced,
        match: (path) => path === '/settings/advanced' || path.startsWith('/settings/advanced/'),
    })
    return tabs
}
