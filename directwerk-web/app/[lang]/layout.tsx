import type {Metadata, Viewport} from 'next'
import {connection} from 'next/server'
import {notFound} from 'next/navigation'

import BrandTheme from '@directwerk/ui/components/brand-theme'

import AuthBootstrap from '@/components/AuthBootstrap'
import HtmlLang from '@/components/HtmlLang'
import SiteHeader from '@/components/SiteHeader'
import UmamiAnalytics from '@/components/UmamiAnalytics'
import {LocaleProvider} from '@/lib/i18n/LocaleProvider'
import {getDictionary} from '@/lib/i18n/getDictionary'
import {interpolate} from '@/lib/i18n/interpolate'
import {isLocale, locales, type Locale} from '@/lib/i18n/config'
import {buildWebsiteJsonLd, serializeJsonLd} from '@/lib/site/jsonLd'
import {fetchSiteConfigServer} from '@/lib/site/fetchSiteConfigServer'
import {getTenantHost} from '@/lib/site/getTenantHost'
import {resolveTenantOrigin} from '@/lib/site/siteOrigin'
import {SiteConfigProvider} from '@/lib/site/SiteConfigProvider'
import type {PublicSiteConfig} from '@directwerk/api/types'

// Matches the light `--background` token in `@directwerk/ui/theme.css`.
const FALLBACK_THEME_COLOR = '#fcfbf8'

export function generateStaticParams(): Array<{lang: Locale}> {
    return locales.map((lang) => ({lang}))
}

async function resolveTenantSeo(lang: Locale): Promise<{
    origin: string
    title: string
    description: string
    primaryColor: string | null
    logoUrl: string | null
    faviconUrl: string | null
    podcastFeedUrl: string | null
    articleFeedUrl: string | null
    config: PublicSiteConfig | null
}> {
    const dictionary = await getDictionary(lang)
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
            description: interpolate(dictionary.layoutSeo.tenantDescription, {
                name: config.tenant.name,
            }),
            primaryColor: config.branding.primaryColor,
            logoUrl: config.branding.logoUrl,
            faviconUrl: config.branding.faviconUrl,
            podcastFeedUrl: config.publicRssUrl,
            articleFeedUrl: config.publicArticleRssUrl,
            config,
        }
    } catch {
        return {
            origin: 'https://localhost',
            title: dictionary.layoutSeo.fallbackTitle,
            description: dictionary.layoutSeo.fallbackDescription,
            primaryColor: null,
            logoUrl: null,
            faviconUrl: null,
            podcastFeedUrl: null,
            articleFeedUrl: null,
            config: null,
        }
    }
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{lang: string}>
}): Promise<Metadata> {
    const {lang: langParam} = await params
    if (!isLocale(langParam)) {
        return {}
    }
    const lang = langParam
    const dictionary = await getDictionary(lang)
    const seo = await resolveTenantSeo(lang)
    const feedTypes: {url: string; title?: string}[] = []
    if (seo.podcastFeedUrl !== null) {
        feedTypes.push({
            url: seo.podcastFeedUrl,
            title: interpolate(dictionary.layoutSeo.podcastFeedTitle, {
                siteTitle: seo.title,
            }),
        })
    }
    if (seo.articleFeedUrl !== null) {
        feedTypes.push({
            url: seo.articleFeedUrl,
            title: interpolate(dictionary.layoutSeo.articleFeedTitle, {
                siteTitle: seo.title,
            }),
        })
    }
    const ogLocale = lang === 'en' ? 'en_US' : 'de_DE'
    return {
        metadataBase: new URL(seo.origin),
        title: {
            default: seo.title,
            template: interpolate(dictionary.layoutSeo.titleTemplate, {
                siteTitle: seo.title,
            }),
        },
        description: seo.description,
        alternates: {
            canonical: `/${lang}`,
            languages: {
                de: '/de',
                en: '/en',
            },
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
            locale: ogLocale,
            url: `/${lang}`,
        },
        twitter: {
            card: 'summary',
            title: seo.title,
            description: seo.description,
        },
        icons: {
            icon: seo.faviconUrl ?? seo.logoUrl ?? '/favicon.ico',
        },
    }
}

export async function generateViewport(): Promise<Viewport> {
    // Viewport is locale-agnostic; reuse DE SEO fetch for branding color only.
    const seo = await resolveTenantSeo('de')
    return {
        themeColor: seo.primaryColor ?? FALLBACK_THEME_COLOR,
    }
}

export default async function LangLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode
    params: Promise<{lang: string}>
}>): Promise<React.JSX.Element> {
    const {lang: langParam} = await params
    if (!isLocale(langParam)) {
        notFound()
    }
    const lang = langParam
    await connection()

    const dictionary = await getDictionary(lang)

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
            tenant: {slug: 'unknown', name: dictionary.layoutSeo.fallbackTitle},
            enabledModules: [],
            branding: {
                siteTitle: null,
                primaryColor: null,
                secondaryColor: null,
                logoUrl: null,
                faviconUrl: null,
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
    const websiteJsonLd = buildWebsiteJsonLd({name: siteName, origin, lang})

    return (
        <LocaleProvider lang={lang} dictionary={dictionary}>
            <HtmlLang lang={lang} />
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
        </LocaleProvider>
    )
}
