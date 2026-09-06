import type {Metadata, Viewport} from 'next'
import {connection} from 'next/server'

import BrandTheme from '@directwerk/ui/components/brand-theme'

import AuthBootstrap from '@/components/AuthBootstrap'
import SiteHeader from '@/components/SiteHeader'
import UmamiAnalytics from '@/components/UmamiAnalytics'
import {buildWebsiteJsonLd, serializeJsonLd} from '@/lib/site/jsonLd'
import {fetchSiteConfigServer} from '@/lib/site/fetchSiteConfigServer'
import {getTenantHost} from '@/lib/site/getTenantHost'
import {resolveTenantOrigin} from '@/lib/site/siteOrigin'
import {SiteConfigProvider} from '@/lib/site/SiteConfigProvider'
import type {PublicSiteConfig} from '@directwerk/api/types'

import './globals.css'

const FALLBACK_TITLE = 'Publish'
const FALLBACK_DESCRIPTION = 'Tenant public site'

async function resolveTenantSeo(): Promise<{
    origin: string
    title: string
    description: string
    primaryColor: string | null
    logoUrl: string | null
    podcastFeedUrl: string | null
    articleFeedUrl: string | null
    config: PublicSiteConfig | null
}> {
    try {
        const host = await getTenantHost()
        if (host === null) {
            throw new Error('Tenant host unresolved')
        }
        const config = await fetchSiteConfigServer(host)
        const title = config.branding.siteTitle ?? config.tenant.name
        return {
            origin: resolveTenantOrigin(host, config.publicSiteUrl),
            title,
            description: `${config.tenant.name} — Inhalte und Abonnements`,
            primaryColor: config.branding.primaryColor,
            logoUrl: config.branding.logoUrl,
            podcastFeedUrl: config.publicRssUrl,
            articleFeedUrl: config.publicArticleRssUrl,
            config,
        }
    } catch {
        return {
            origin: 'https://localhost',
            title: FALLBACK_TITLE,
            description: FALLBACK_DESCRIPTION,
            primaryColor: null,
            logoUrl: null,
            podcastFeedUrl: null,
            articleFeedUrl: null,
            config: null,
        }
    }
}

export async function generateMetadata(): Promise<Metadata> {
    const seo = await resolveTenantSeo()
    const feedTypes: {url: string; title?: string}[] = []
    if (seo.podcastFeedUrl !== null) {
        feedTypes.push({url: seo.podcastFeedUrl, title: `${seo.title} — Podcast-Feed`})
    }
    if (seo.articleFeedUrl !== null) {
        feedTypes.push({url: seo.articleFeedUrl, title: `${seo.title} — Artikel-Feed`})
    }
    return {
        metadataBase: new URL(seo.origin),
        title: {
            default: seo.title,
            template: `%s · ${seo.title}`,
        },
        description: seo.description,
        alternates: {
            canonical: '/',
            types:
                feedTypes.length > 0
                    ? {'application/rss+xml': feedTypes}
                    : undefined,
        },
        openGraph: {
            siteName: seo.title,
            title: seo.title,
            description: seo.description,
            type: 'website',
            locale: 'de_DE',
            url: '/',
        },
        twitter: {
            card: 'summary',
            title: seo.title,
            description: seo.description,
        },
        icons: {
            icon: seo.logoUrl ?? '/favicon.ico',
        },
    }
}

export async function generateViewport(): Promise<Viewport> {
    const seo = await resolveTenantSeo()
    return {
        themeColor: seo.primaryColor ?? '#000000',
    }
}

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>): Promise<React.JSX.Element> {
    await connection()

    // The layout renders on every route — an upstream outage or unmapped host
    // must degrade to a neutral default instead of hard-failing every page.
    let config: PublicSiteConfig
    let origin = 'https://localhost'
    try {
        const host = await getTenantHost()
        if (host === null) {
            throw new Error('Tenant host unresolved')
        }
        config = await fetchSiteConfigServer(host)
        origin = resolveTenantOrigin(host, config.publicSiteUrl)
    } catch {
        config = {
            tenant: {slug: 'unknown', name: 'Publish'},
            enabledModules: [],
            branding: {
                siteTitle: null,
                primaryColor: null,
                secondaryColor: null,
                logoUrl: null,
            },
            publicSiteUrl: null,
            publicRssUrl: null,
            publicArticleRssUrl: null,
            analytics: null,
            emailNotifyAvailable: false,
        }
    }
    const primary = config.branding.primaryColor
    const secondary = config.branding.secondaryColor
    const siteName = config.branding.siteTitle ?? config.tenant.name
    const websiteJsonLd = buildWebsiteJsonLd({name: siteName, origin})

    return (
        <html lang="de">
            <body>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{__html: serializeJsonLd(websiteJsonLd)}}
                />
                <UmamiAnalytics analytics={config.analytics} />
                <SiteConfigProvider config={config}>
                    <BrandTheme primaryHex={primary} secondaryHex={secondary}>
                        <AuthBootstrap>
                            <SiteHeader>{children}</SiteHeader>
                        </AuthBootstrap>
                    </BrandTheme>
                </SiteConfigProvider>
            </body>
        </html>
    )
}
