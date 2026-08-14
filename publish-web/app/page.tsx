'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'

import {buttonVariants} from '@publish/ui/components/button'
import EmptyState from '@publish/ui/components/empty-state'

import BrandLogo from '@/components/BrandLogo'
import HowToListen from '@/components/HowToListen'
import {
    listPublicArticles,
    listPublicEpisodes,
    listPublicProducts,
} from '@/lib/api/client'
import type {PublicArticle, PublicEpisode} from '@/lib/api/types'
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
        void Promise.all(loads).catch(() => {
            /* homepage still works without latest items */
        })
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
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        1
                    </p>
                    <h2 className="mt-2 font-semibold">Entdecken</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {showPodcast
                            ? 'Höre freie Folgen im Browser oder abonniere den öffentlichen Feed.'
                            : 'Lies freie Beiträge ohne Anmeldung.'}
                    </p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        2
                    </p>
                    <h2 className="mt-2 font-semibold">Anmelden</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Ein Konto merkt sich deinen Zugang — auf dieser Domain, ohne
                        fremde Plattform.
                    </p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        3
                    </p>
                    <h2 className="mt-2 font-semibold">Zugang</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {showPricing
                            ? 'Mitgliedschaften schalten bezahlte Folgen, Beiträge und Bonusdateien frei.'
                            : 'Nach der Anmeldung siehst du alles, was für dich freigeschaltet ist.'}
                    </p>
                </div>
            </section>

            {latestEpisode !== null || latestArticle !== null ? (
                <section className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
                    {latestEpisode !== null ? (
                        <article className="rounded-xl border bg-card p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Neueste Folge
                            </p>
                            <h2 className="mt-2 text-xl font-semibold">
                                <Link href={`/episodes/${encodeURIComponent(latestEpisode.slug)}`}>
                                    {latestEpisode.episodeNumber !== null
                                        ? `#${latestEpisode.episodeNumber} `
                                        : ''}
                                    {latestEpisode.title}
                                </Link>
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {latestEpisode.accessPolicy === 'PAID' ? 'Bezahlt' : 'Frei'}
                                {' · '}
                                {formatPublishedAt(latestEpisode.publishedAt)}
                            </p>
                            <p className="mt-3 text-sm">
                                <Link href="/episodes">Alle Folgen</Link>
                            </p>
                        </article>
                    ) : null}
                    {latestArticle !== null ? (
                        <article className="rounded-xl border bg-card p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Neuester Beitrag
                            </p>
                            <h2 className="mt-2 text-xl font-semibold">
                                <Link href={`/articles/${encodeURIComponent(latestArticle.slug)}`}>
                                    {latestArticle.title}
                                </Link>
                            </h2>
                            <p className="mt-3 text-sm">
                                <Link href="/articles">Alle Beiträge</Link>
                            </p>
                        </article>
                    ) : null}
                </section>
            ) : null}

            {showPricing && products.length > 0 ? (
                <section className="mx-auto mt-10 max-w-3xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Mitgliedschaft
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">Was du freischalten kannst</h2>
                    <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                        {products.map((product) => (
                            <li className="rounded-xl border bg-card p-4" key={product.slug}>
                                <p className="font-medium">{product.title}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {product.offeringType === 'LEVEL' ? 'Stufe' : 'Paket'}
                                    {' · '}
                                    {formatMoney(
                                        product.priceCents,
                                        product.currency,
                                        product.billingInterval,
                                    )}
                                </p>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-4 text-sm">
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
