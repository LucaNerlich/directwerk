'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'

import {buttonVariants} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import FeatureCard from '@directwerk/ui/components/feature-card'
import SectionHeader from '@directwerk/ui/components/section-header'
import StatCard from '@directwerk/ui/components/stat-card'

import BrandLogo from '@/components/BrandLogo'
import HowToListen from '@/components/HowToListen'
import {
    listPublicArticles,
    listPublicEpisodes,
    listPublicProducts,
} from '@/lib/api/client'
import type {PublicArticle, PublicEpisode} from '@directwerk/api/types'
import {formatPublishedAt} from '@/lib/format'
import {formatMoney} from '@/lib/format/money'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

interface PublicProduct {
    slug: string
    title: string
    offeringType: string
    sortOrder: number
    description: string | null
    priceCents: number | null
    currency: string
    billingInterval: string
}

export default function HomePage(): React.JSX.Element {
    const config = useSiteConfig()
    const title = config.branding.siteTitle ?? config.tenant.name
    const showPodcast = config.enabledModules.includes('PODCAST')
    const showArticles =
        config.enabledModules.includes('DIGITAL_CONTENT') || showPodcast
    const showPricing = config.enabledModules.includes('SUBSCRIPTION')
    const tenantHost = getClientTenantHost()
    const [latestEpisode, setLatestEpisode] = useState<PublicEpisode | null>(null)
    const [latestArticle, setLatestArticle] = useState<PublicArticle | null>(null)
    const [products, setProducts] = useState<PublicProduct[]>([])

    useEffect(() => {
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
        void Promise.allSettled(loads)
        return () => {
            active = false
        }
    }, [showArticles, showPodcast, showPricing, tenantHost])

    const primaryHref = showPodcast
        ? latestEpisode !== null
            ? `/episodes/${encodeURIComponent(latestEpisode.slug)}`
            : '/episodes'
        : showArticles
          ? latestArticle !== null
              ? `/articles/${encodeURIComponent(latestArticle.slug)}`
              : '/articles'
          : '/register'
    const primaryLabel = showPodcast
        ? latestEpisode !== null
            ? 'Neueste Folge anhören'
            : 'Folgen anhören'
        : showArticles
          ? 'Beiträge lesen'
          : 'Registrieren'

    return (
        <div className="page-container">
            <section className="mx-auto flex max-w-3xl flex-col gap-6 py-8 sm:py-14">
                <BrandLogo
                    className="h-14 w-auto"
                    logoUrl={config.branding.logoUrl}
                    name={title}
                />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {config.tenant.name}
                </p>
                <h1 className="text-pretty text-4xl font-semibold tracking-tight sm:text-5xl">
                    {title}
                </h1>
                <p className="max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
                    {showPodcast
                        ? 'Neue Folgen auf deiner Domain — frei im Browser oder per Feed in der Podcast-App. Bezahlte Folgen nach der Anmeldung.'
                        : 'Beiträge auf deiner Domain. Freie Texte öffentlich, bezahlte Inhalte nach der Anmeldung.'}
                </p>
                <div className="flex flex-wrap gap-3">
                    <Link className={buttonVariants({size: 'lg'})} href={primaryHref}>
                        {primaryLabel}
                    </Link>
                    {showPricing ? (
                        <Link
                            className={buttonVariants({variant: 'outline', size: 'lg'})}
                            href="/pricing"
                        >
                            Mitgliedschaft
                        </Link>
                    ) : (
                        <Link
                            className={buttonVariants({variant: 'outline', size: 'lg'})}
                            href="/register"
                        >
                            Registrieren
                        </Link>
                    )}
                </div>
            </section>

            <section className="mx-auto mt-4 grid max-w-3xl gap-4 sm:grid-cols-3">
                <StatCard
                    hint={
                        showPodcast
                            ? 'Höre freie Folgen im Browser oder abonniere den öffentlichen Feed.'
                            : 'Lies freie Beiträge ohne Anmeldung.'
                    }
                    label="Schritt 1"
                    value="Entdecken"
                />
                <StatCard
                    hint="Ein Konto merkt sich deinen Zugang — auf dieser Domain, ohne fremde Plattform."
                    label="Schritt 2"
                    value="Anmelden"
                />
                <StatCard
                    hint={
                        showPricing
                            ? 'Mitgliedschaften schalten bezahlte Folgen, Beiträge und Bonusdateien frei.'
                            : 'Nach der Anmeldung siehst du alles, was für dich freigeschaltet ist.'
                    }
                    label="Schritt 3"
                    value="Zugang"
                />
            </section>

            {latestEpisode !== null || latestArticle !== null ? (
                <section className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
                    {latestEpisode !== null ? (
                        <FeatureCard
                            description={
                                <>
                                    {latestEpisode.accessPolicy === 'PAID' ? 'Bezahlt' : 'Frei'}
                                    {' · '}
                                    {formatPublishedAt(latestEpisode.publishedAt)}
                                    <span className="mt-3 block">
                                        <Link href="/episodes">Alle Folgen</Link>
                                    </span>
                                </>
                            }
                            eyebrow="Neueste Folge"
                            title={
                                <Link
                                    className="hover:underline"
                                    href={`/episodes/${encodeURIComponent(latestEpisode.slug)}`}
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
                                <span className="mt-3 block">
                                    <Link href="/articles">Alle Beiträge</Link>
                                </span>
                            }
                            eyebrow="Neuester Beitrag"
                            title={
                                <Link
                                    className="hover:underline"
                                    href={`/articles/${encodeURIComponent(latestArticle.slug)}`}
                                >
                                    {latestArticle.title}
                                </Link>
                            }
                        />
                    ) : null}
                </section>
            ) : null}

            {showPricing && products.length > 0 ? (
                <section className="mx-auto mt-10 max-w-3xl space-y-4">
                    <SectionHeader
                        description="Mitgliedschaften und Pakete auf einen Blick."
                        title="Was du freischalten kannst"
                    />
                    <ul className="grid gap-3 sm:grid-cols-3">
                        {products.map((product) => (
                            <li key={product.slug}>
                                <FeatureCard
                                    description={
                                        <>
                                            {product.offeringType === 'LEVEL' ? 'Stufe' : 'Paket'}
                                            {' · '}
                                            {formatMoney(
                                                product.priceCents,
                                                product.currency,
                                                product.billingInterval,
                                            )}
                                        </>
                                    }
                                    title={product.title}
                                />
                            </li>
                        ))}
                    </ul>
                    <p className="text-sm">
                        <Link href="/pricing">Zu den Preisen</Link>
                    </p>
                </section>
            ) : null}

            {showPodcast ? (
                <div className="mx-auto mt-10 max-w-3xl">
                    <HowToListen
                        isAuthenticated={false}
                        publicFeedUrl={config.publicRssUrl}
                    />
                </div>
            ) : null}

            {showPodcast && latestEpisode === null && latestArticle === null ? (
                <div className="mx-auto mt-8 max-w-3xl">
                    <EmptyState
                        title="Noch keine veröffentlichten Inhalte"
                        description="Sobald die Redaktion eine Folge oder einen Beitrag veröffentlicht, erscheint sie hier."
                    />
                </div>
            ) : null}
        </div>
    )
}
