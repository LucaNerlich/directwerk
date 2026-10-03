'use client'

import Link from 'next/link'
import {useEffect, useRef, useState} from 'react'

import {buttonVariants} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import FeatureCard from '@directwerk/ui/components/feature-card'
import SectionHeader from '@directwerk/ui/components/section-header'

import AccessPolicyBadge from '@/components/AccessPolicyBadge'
import BrandLogo from '@/components/BrandLogo'
import {CardGridSkeleton, HeroSkeleton} from '@/components/ContentLoadingSkeleton'
import SubscriberContextBanner from '@/components/SubscriberContextBanner'
import {
    listPublicArticles,
    listPublicEpisodes,
    listPublicProducts,
} from '@/lib/api/client'
import type {PublicArticle, PublicEpisode, PublicProduct} from '@directwerk/api/types'
import {formatDuration} from '@/lib/format/content'
import {formatPublishedAt} from '@/lib/format/dateTime'
import {formatMoney} from '@/lib/format/money'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'

export interface HomeInitialData {
    /** Server-rendered public catalog; `null` when the upstream call failed. */
    episodes: PublicEpisode[] | null
    articles: PublicArticle[] | null
    products: PublicProduct[] | null
}

/**
 * Renders the tenant home from server-seeded catalogs and refreshes enabled
 * content after authentication changes.
 */
export default function HomeClient({
    initialData,
}: {
    initialData: HomeInitialData
}): React.JSX.Element {
    const lang = useLocale()
    const {common, format, home, nav} = useDictionary()
    const config = useSiteConfig()
    const {isAuthenticated} = useSubscriberAuth()
    const title = config.branding.siteTitle ?? config.tenant.name
    const showPodcast = config.enabledModules.includes('PODCAST')
    const showArticles =
        config.enabledModules.includes('DIGITAL_CONTENT') || showPodcast
    const showPricing = config.enabledModules.includes('SUBSCRIPTION')
    const tenantHost = getWebClientTenantHost()
    const showFeeds =
        config.enabledModules.includes('PODCAST_RSS') ||
        config.enabledModules.includes('ARTICLE_RSS')
    const [latestEpisode, setLatestEpisode] = useState<PublicEpisode | null>(
        initialData.episodes?.[0] ?? null,
    )
    const [latestArticle, setLatestArticle] = useState<PublicArticle | null>(
        initialData.articles?.[0] ?? null,
    )
    const [products, setProducts] = useState<PublicProduct[]>(
        initialData.products?.slice(0, 3) ?? [],
    )
    // Only show skeletons when the server could not seed an enabled surface.
    const initialComplete =
        (showPodcast ? initialData.episodes !== null : true) &&
        (showArticles ? initialData.articles !== null : true) &&
        (showPricing ? initialData.products !== null : true)
    const [isLoading, setIsLoading] = useState(!initialComplete)
    const wasAuthenticatedRef = useRef(isAuthenticated)

    useEffect(() => {
        const wasAuthenticated = wasAuthenticatedRef.current
        wasAuthenticatedRef.current = isAuthenticated
        // Nothing to do when the server already seeded an anonymous visitor's
        // surfaces, but drop any entitled data fetched before a logout so the
        // page does not keep showing paid badges to a signed-out visitor.
        if (!isAuthenticated && initialComplete) {
            if (wasAuthenticated) {
                setLatestEpisode(initialData.episodes?.[0] ?? null)
                setLatestArticle(initialData.articles?.[0] ?? null)
                setProducts(initialData.products?.slice(0, 3) ?? [])
            }
            return
        }
        let active = true
        const loads: Array<Promise<void>> = []
        if (showPodcast) {
            loads.push(
                listPublicEpisodes(tenantHost).then((episodes) => {
                    if (active) {
                        setLatestEpisode(episodes[0] ?? null)
                    }
                }),
            )
        }
        if (showArticles) {
            loads.push(
                listPublicArticles(tenantHost).then((articles) => {
                    if (active) {
                        setLatestArticle(articles[0] ?? null)
                    }
                }),
            )
        }
        if (showPricing) {
            loads.push(
                listPublicProducts(tenantHost).then((productList) => {
                    if (active) {
                        setProducts(productList.slice(0, 3))
                    }
                }),
            )
        }
        void Promise.allSettled(loads).finally(() => {
            if (active) {
                setIsLoading(false)
            }
        })
        return () => {
            active = false
        }
    }, [showArticles, showPodcast, showPricing, tenantHost, isAuthenticated, initialComplete])

    const primaryHref = showPodcast
        ? latestEpisode !== null
            ? localizedPath(lang, `/episodes/${encodeURIComponent(latestEpisode.slug)}`)
            : localizedPath(lang, '/episodes')
        : showArticles
          ? latestArticle !== null
              ? localizedPath(lang, `/articles/${encodeURIComponent(latestArticle.slug)}`)
              : localizedPath(lang, '/articles')
          : localizedPath(lang, '/register')
    const primaryLabel = showPodcast
        ? latestEpisode !== null
            ? home.ctaLatestEpisode
            : home.ctaEpisodes
        : showArticles
          ? home.ctaArticles
          : nav.register

    const quickLinks = [
        showPodcast
            ? {href: localizedPath(lang, '/episodes'), label: nav.allEpisodes}
            : null,
        showArticles
            ? {href: localizedPath(lang, '/articles'), label: nav.allArticles}
            : null,
        showPricing
            ? {href: localizedPath(lang, '/pricing'), label: nav.membership}
            : null,
        showFeeds ? {href: localizedPath(lang, '/feeds'), label: nav.rssFeeds} : null,
        {
            href: localizedPath(lang, isAuthenticated ? '/account' : '/login'),
            label: isAuthenticated ? nav.myAccount : nav.login,
        },
    ].filter((item): item is {href: string; label: string} => item !== null)

    return (
        <div className="page-container">
            {isLoading ? (
                <div aria-busy="true" aria-label={common.loadingHome} role="status">
                    <HeroSkeleton />
                </div>
            ) : (
                <section className="mx-auto flex max-w-6xl flex-col gap-6 py-8 sm:py-14">
                    <BrandLogo
                        className="h-14 w-auto"
                        logoUrl={config.branding.logoUrl}
                        name={title}
                        priority
                    />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {config.tenant.name}
                    </p>
                    <h1 className="text-pretty text-4xl font-semibold tracking-tight sm:text-5xl">
                        {title}
                    </h1>
                    <p className="max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
                        {showPodcast ? home.taglinePodcast : home.taglineArticles}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Link className={buttonVariants({size: 'lg'})} href={primaryHref}>
                            {primaryLabel}
                        </Link>
                        {showPricing ? (
                            <Link
                                className={buttonVariants({variant: 'outline', size: 'lg'})}
                                href={localizedPath(lang, '/pricing')}
                            >
                                {nav.membership}
                            </Link>
                        ) : (
                            <Link
                                className={buttonVariants({variant: 'outline', size: 'lg'})}
                                href={localizedPath(lang, '/register')}
                            >
                                {nav.register}
                            </Link>
                        )}
                    </div>
                    {quickLinks.length > 0 ? (
                        <nav
                            aria-label={nav.quickAccess}
                            className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"
                        >
                            {quickLinks.map((item) => (
                                <Link
                                    className="underline-offset-4 hover:text-foreground hover:underline"
                                    href={item.href}
                                    key={item.href}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    ) : null}
                </section>
            )}

            <div className="mx-auto mt-2 max-w-6xl">
                <SubscriberContextBanner />
            </div>

            {isLoading ? (
                <div
                    aria-busy="true"
                    aria-label={common.loadingContent}
                    className="mx-auto mt-10 max-w-6xl"
                    role="status"
                >
                    <CardGridSkeleton cards={2} columns={2} />
                </div>
            ) : latestEpisode !== null || latestArticle !== null ? (
                <section className="mx-auto mt-10 grid max-w-6xl gap-4 sm:grid-cols-2">
                    {latestEpisode !== null ? (
                        <FeatureCard
                            description={
                                <>
                                    <span className="inline-flex flex-wrap items-center gap-2">
                                        <AccessPolicyBadge
                                            policy={latestEpisode.accessPolicy}
                                            isEntitled={
                                                latestEpisode.accessPolicy === 'PAID'
                                                    ? latestEpisode.audioCdnUrl !== null
                                                    : undefined
                                            }
                                        />
                                        {formatPublishedAt(latestEpisode.publishedAt, lang, format)}
                                        {formatDuration(latestEpisode.durationSeconds) !== null
                                            ? ` · ${formatDuration(latestEpisode.durationSeconds)}`
                                            : null}
                                    </span>
                                    <span className="mt-3 block">
                                        <Link href={localizedPath(lang, '/episodes')}>{nav.allEpisodes}</Link>
                                    </span>
                                </>
                            }
                            eyebrow={home.latestEpisodeEyebrow}
                            title={
                                <Link
                                    className="hover:underline"
                                    href={localizedPath(lang, `/episodes/${encodeURIComponent(latestEpisode.slug)}`)}
                                >
                                    {latestEpisode.episodeNumber !== null
                                        ? `#${latestEpisode.episodeNumber} `
                                        : ''}
                                    {latestEpisode.title}
                                </Link>
                            }
                        />
                    ) : null}
                    {latestArticle !== null ? (
                        <FeatureCard
                            description={
                                <>
                                    <span className="inline-flex flex-wrap items-center gap-2">
                                        <AccessPolicyBadge
                                            policy={latestArticle.accessPolicy}
                                            isEntitled={
                                                latestArticle.accessPolicy === 'PAID'
                                                    ? latestArticle.body !== null
                                                    : undefined
                                            }
                                        />
                                        {formatPublishedAt(latestArticle.publishedAt, lang, format)}
                                    </span>
                                    {latestArticle.excerpt !== null &&
                                    latestArticle.excerpt.length > 0 ? (
                                        <span className="mt-2 line-clamp-2 block">
                                            {latestArticle.excerpt}
                                        </span>
                                    ) : null}
                                    <span className="mt-3 block">
                                        <Link href={localizedPath(lang, '/articles')}>{nav.allArticles}</Link>
                                    </span>
                                </>
                            }
                            eyebrow={home.latestArticleEyebrow}
                            title={
                                <Link
                                    className="hover:underline"
                                    href={localizedPath(lang, `/articles/${encodeURIComponent(latestArticle.slug)}`)}
                                >
                                    {latestArticle.title}
                                </Link>
                            }
                        />
                    ) : null}
                </section>
            ) : null}

            {showPricing && products.length > 0 ? (
                <section className="mx-auto mt-10 max-w-6xl space-y-4">
                    <SectionHeader
                        description={home.productsDescription}
                        title={home.productsTitle}
                    />
                    <ul className="grid gap-3 sm:grid-cols-3">
                        {products.map((product) => (
                            <li key={product.slug}>
                                <FeatureCard
                                    description={
                                        <>
                                            {product.offeringType === 'LEVEL' ? common.level : common.package}
                                            {' · '}
                                            {formatMoney(
                                                product.priceCents,
                                                product.currency,
                                                product.billingInterval,
                                                lang,
                                                format,
                                            )}
                                            {product.description !== null &&
                                            product.description.length > 0 ? (
                                                <span className="mt-2 line-clamp-3 block">
                                                    {product.description}
                                                </span>
                                            ) : null}
                                        </>
                                    }
                                    title={product.title}
                                />
                            </li>
                        ))}
                    </ul>
                    <p className="text-sm">
                        <Link href={localizedPath(lang, '/pricing')}>{home.allMemberships}</Link>
                    </p>
                </section>
            ) : null}

            {showFeeds ? (
                <p className="mx-auto mt-10 max-w-6xl text-sm text-muted-foreground">
                    {showPodcast && showArticles
                        ? home.feedHintBoth
                        : showPodcast
                          ? home.feedHintPodcast
                          : home.feedHintArticles}
                    <Link
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                        href={localizedPath(lang, '/feeds')}
                    >
                        {home.openFeeds}
                    </Link>
                </p>
            ) : null}

            {!isLoading && (showPodcast || showArticles) && latestEpisode === null && latestArticle === null ? (
                <div className="mx-auto mt-8 max-w-6xl">
                    <EmptyState
                        title={home.emptyTitle}
                        description={home.emptyDescription}
                        action={
                            showPricing ? (
                                <Link className={buttonVariants({variant: 'outline'})} href={localizedPath(lang, '/pricing')}>
                                    {common.viewMembership}
                                </Link>
                            ) : undefined
                        }
                    />
                </div>
            ) : null}
        </div>
    )
}
