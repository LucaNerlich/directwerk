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

export function buildWriteDeskItems(config: SiteConfig, dict: Dictionary): NavigationItem[] {
    const items: NavigationItem[] = [
        {href: '/write', label: dict.nav.write.start},
        {href: '/write/articles', label: dict.nav.write.articles},
        {href: '/write/import', label: dict.nav.write.import},
    ]
    if (hasModule(config, 'EMAIL_NOTIFY')) {
        items.push({href: '/write/lists', label: dict.nav.write.lists})
    }
    if (hasModule(config, 'ARTICLE_RSS') || config.publicArticleRssUrl !== null) {
        items.push({href: '/write/feeds', label: dict.nav.write.feeds})
    }
    return items
}

export function buildPodcastDeskItems(config: SiteConfig, dict: Dictionary): NavigationItem[] {
    const items: NavigationItem[] = [
        {href: '/podcast', label: dict.nav.podcast.start},
        {href: '/podcast/episodes', label: dict.nav.podcast.episodes},
        {href: '/podcast/import', label: dict.nav.podcast.import},
        {href: '/podcast/series', label: dict.nav.podcast.series},
        {href: '/podcast/formats', label: dict.nav.podcast.formats},
    ]
    if (hasModule(config, 'PODCAST_RSS') || config.publicRssUrl !== null) {
        items.push({href: '/podcast/feeds', label: dict.nav.podcast.feeds})
    }
    return items
}

export function buildVerwaltungSections(
    config: SiteConfig,
    me: Me | null,
    dict: Dictionary,
): NavigationGroupConfig[] {
    const sections: NavigationGroupConfig[] = []
    const showMedia =
        hasModule(config, 'DIGITAL_CONTENT') || hasModule(config, 'PODCAST')
    const showBonusContent = hasModule(config, 'BONUS_CONTENT')
    const showCategories = hasModule(config, 'DIGITAL_CONTENT')
    const showSubscription = hasModule(config, 'SUBSCRIPTION')
    const showEmailNotify = hasModule(config, 'EMAIL_NOTIFY')
    const showStripeBilling = hasModule(config, 'STRIPE_BILLING')
    const showAdmin = me !== null && isTenantAdminRole(me.roles)
    const v = dict.nav.verwaltung

    if (showMedia) {
        const mediaItems: NavigationItem[] = [{href: '/media', label: v.library}]
        if (showBonusContent) {
            mediaItems.push({href: '/bonus', label: v.bonus})
        }
        sections.push({
            label: v.media,
            items: mediaItems,
        })
    }

    if (showCategories) {
        sections.push({
            label: v.organisation,
            items: [{href: '/manage/categories', label: v.categories}],
        })
    }

    if (showSubscription && showAdmin) {
        sections.push({
            label: v.subscriptions,
            items: [
                {href: '/manage', label: v.payments},
                {href: '/manage/products', label: v.products},
                {href: '/manage/grants', label: v.grants},
                {href: '/manage/subscribers', label: v.subscribers},
            ],
        })
    }

    const showAnalytics =
        hasDesk(config, 'WRITE') ||
        hasDesk(config, 'PODCAST') ||
        showMedia ||
        showSubscription
    if (showAnalytics) {
        sections.push({
            label: v.analyticsSection,
            items: [{href: '/analytics', label: v.statistics}],
        })
    }

    if (showAdmin) {
        sections.push({
            label: v.team,
            items: [{href: '/team', label: v.members}],
        })

        const settingsItems: NavigationItem[] = [
            {href: '/settings/branding', label: v.branding},
            {href: '/settings/domains', label: v.domains},
            {href: '/settings/integrations', label: v.integrations},
        ]
        if (showEmailNotify) {
            settingsItems.push({href: '/settings/email', label: v.emailTemplates})
        }
        if (showStripeBilling) {
            settingsItems.push({href: '/settings/stripe', label: v.stripe})
        }

        sections.push({
            label: v.settings,
            items: settingsItems,
        })
    }

    return sections
}
