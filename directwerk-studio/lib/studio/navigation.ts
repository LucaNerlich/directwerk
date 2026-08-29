import {hasModule} from '@/lib/api/client'
import {isTenantAdminRole} from '@/lib/api/studioHelpers'
import type {Me, SiteConfig} from '@directwerk/api/types'
import type {NavigationItem} from '@directwerk/ui/lib/navigation'

export type {NavigationItem} from '@directwerk/ui/lib/navigation'

export interface NavigationGroupConfig {
    label?: string
    items: NavigationItem[]
}

export function buildWriteDeskItems(config: SiteConfig): NavigationItem[] {
    const items: NavigationItem[] = [
        {href: '/write', label: 'Start'},
        {href: '/write/articles', label: 'Beiträge'},
    ]
    if (hasModule(config, 'DIGITAL_CONTENT')) {
        items.push({href: '/write/bonus', label: 'Bonusdateien'})
    }
    return items
}

/**
 * Builds the Podcast desk navigation items available for the site.
 *
 * @param config - Site configuration used to determine whether RSS feeds are available
 * @returns The Podcast desk navigation items
 */
export function buildPodcastDeskItems(config: SiteConfig): NavigationItem[] {
    const items: NavigationItem[] = [
        {href: '/podcast', label: 'Start'},
        {href: '/podcast/episodes', label: 'Folgen'},
        {href: '/podcast/import', label: 'Import'},
        {href: '/podcast/series', label: 'Sendungen'},
        {href: '/podcast/formats', label: 'Formate'},
    ]
    if (hasModule(config, 'PODCAST_RSS') || config.publicRssUrl !== null) {
        items.push({href: '/podcast/feeds', label: 'Feeds'})
    }
    return items
}

export function buildVerwaltungSections(
    config: SiteConfig,
    me: Me | null,
): NavigationGroupConfig[] {
    const sections: NavigationGroupConfig[] = []
    const showMedia =
        hasModule(config, 'DIGITAL_CONTENT') || hasModule(config, 'PODCAST')
    const showCategories = hasModule(config, 'DIGITAL_CONTENT')
    const showSubscription = hasModule(config, 'SUBSCRIPTION')
    const showEmailNotify = hasModule(config, 'EMAIL_NOTIFY')
    const showStripeBilling = hasModule(config, 'STRIPE_BILLING')
    const showAdmin = me !== null && isTenantAdminRole(me.roles)

    if (showMedia) {
        sections.push({
            label: 'Medien',
            items: [{href: '/media', label: 'Bibliothek'}],
        })
    }

    if (showCategories) {
        sections.push({
            label: 'Organisation',
            items: [{href: '/manage/categories', label: 'Kategorien'}],
        })
    }

    if (showSubscription && showAdmin) {
        sections.push({
            label: 'Abos',
            items: [
                {href: '/manage', label: 'Zahlungen'},
                {href: '/manage/products', label: 'Produkte'},
                {href: '/manage/grants', label: 'Freischaltungen'},
                {href: '/manage/subscribers', label: 'Abonnenten'},
            ],
        })
    }

    if (showAdmin) {
        sections.push({
            label: 'Team',
            items: [{href: '/team', label: 'Mitglieder'}],
        })

        const settingsItems: NavigationItem[] = [
            {href: '/settings/branding', label: 'Branding'},
            {href: '/settings/domains', label: 'Domains'},
        ]
        if (showEmailNotify) {
            settingsItems.push({href: '/settings/email', label: 'E-Mail-Vorlagen'})
        }
        if (showStripeBilling) {
            settingsItems.push({href: '/settings/stripe', label: 'Stripe'})
        }

        sections.push({
            label: 'Einstellungen',
            items: settingsItems,
        })
    }

    return sections
}
