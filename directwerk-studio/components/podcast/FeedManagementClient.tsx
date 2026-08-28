'use client'

import {Button} from '@directwerk/ui/components/button'

import {useCallback, useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'
import Link from 'next/link'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {hasModule} from '@/lib/api/client'
import {
    listSeries,
    listSubscriberFeeds,
    setSubscriberFeedEnabled,
} from '@/lib/api/tenantApi'
import type {SeriesSummary, SubscriberFeedSummary} from '@directwerk/api/types'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {safeLinkHref} from '@/lib/url/safeUrl'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

function copyUrl(url: string): Promise<void> {
    return navigator.clipboard.writeText(url)
}

export default function FeedManagementClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const config = useSiteConfig()
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [subscriberFeeds, setSubscriberFeeds] = useState<SubscriberFeedSummary[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [busyFeedId, setBusyFeedId] = useState<number | null>(null)
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
    const showSubscriberFeeds = hasModule(config, 'SUBSCRIPTION')

    useEffect(() => {
        let active = true

        async function load(): Promise<void> {
            try {
                const host = getClientTenantHost()
                const [loadedSeries, loadedFeeds] = await Promise.all([
                    listSeries(host),
                    showSubscriberFeeds ? listSubscriberFeeds(host) : Promise.resolve([]),
                ])
                if (!active) {
                    return
                }
                setSeries(loadedSeries)
                setSubscriberFeeds(loadedFeeds)
            } catch (error) {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Feeds konnten nicht geladen werden.',
                )
            } finally {
                if (active) {
                    setIsLoading(false)
                }
            }
        }

        load()

        return () => {
            active = false
        }
    }, [router, showSubscriberFeeds])

    const handleAuthError = useCallback(
        (error: unknown) => {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
            )
        },
        [router],
    )

    async function handleCopy(url: string): Promise<void> {
        setErrorMessage(null)
        try {
            await copyUrl(url)
            setCopiedUrl(url)
        } catch (error) {
            authRedirect(error)
        }
    }

    async function handleToggleFeed(
        feed: SubscriberFeedSummary,
    ): Promise<void> {
        setBusyFeedId(feed.id)
        setErrorMessage(null)
        try {
            const updated = await setSubscriberFeedEnabled(
                getClientTenantHost(),
                feed.id,
                !feed.enabled,
            )
            setSubscriberFeeds((current) =>
                current.map((item) => (item.id === feed.id ? updated : item)),
            )
        } catch (error) {
            authRedirect(error)
        } finally {
            setBusyFeedId(null)
        }
    }

    if (isLoading) {
        return <p>Feeds werden geladen…</p>
    }

    const seriesWithFeeds = series.filter(
        (item) => item.rssUrl !== null && item.status === 'PUBLISHED',
    )
    const draftSeries = series.filter((item) => item.status !== 'PUBLISHED')

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Podcast · Einrichtung
                    </p>
                    <h1>Feeds</h1>
                </div>
            </header>

            <p>
                Teile diese URLs mit Podcast-Apps und Verzeichnissen. Der
                Abonnenten-Feed ist privat und wird über den Feed-Token der
                Abonnentin bzw. des Abonnenten geschützt.
            </p>

            {errorMessage !== null && (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            )}

            {config.publicRssUrl !== null ? (
                <section>
                    <h2>Allgemeiner Feed</h2>
                    <ul className="overflow-hidden rounded-xl border bg-card divide-y [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-4 [&>li]:p-4">
                        <li>
                            <span>
                                {config.tenant.name}{' '}
                                <code>{config.publicRssUrl}</code>
                            </span>
                            <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                                {safeLinkHref(config.publicRssUrl) !== null ? (
                                    <a
                                        href={config.publicRssUrl}
                                        rel="noreferrer"
                                        target="_blank"
                                    >
                                        Öffnen
                                    </a>
                                ) : null}
                                <Button
                                    className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                                    onClick={() =>
                                        void handleCopy(config.publicRssUrl as string)
                                    }
                                    type="button"
                                >
                                    {copiedUrl === config.publicRssUrl
                                        ? 'Kopiert!'
                                        : 'Kopieren'}
                                </Button>
                            </span>
                        </li>
                    </ul>
                </section>
            ) : null}

            {seriesWithFeeds.length > 0 ? (
                <section>
                    <h2>Sendungs-Feeds</h2>
                    <ul className="overflow-hidden rounded-xl border bg-card divide-y [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-4 [&>li]:p-4">
                        {seriesWithFeeds.map((item) => (
                            <li key={item.id}>
                                <span>
                                    {item.title} <code>{item.slug}</code>{' '}
                                    <PublicationStatusBadge status={item.status} />
                                </span>
                                <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                                    {safeLinkHref(item.rssUrl) !== null ? (
                                        <a
                                            href={item.rssUrl as string}
                                            rel="noreferrer"
                                            target="_blank"
                                        >
                                            Öffnen
                                        </a>
                                    ) : null}
                                    <Button
                                        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                                        onClick={() =>
                                            void handleCopy(item.rssUrl as string)
                                        }
                                        type="button"
                                    >
                                        {copiedUrl === item.rssUrl
                                            ? 'Kopiert!'
                                            : 'Kopieren'}
                                    </Button>
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {draftSeries.length > 0 ? (
                <section>
                    <h2>Noch nicht veröffentlichte Sendungen</h2>
                    <p className="text-sm text-muted-foreground">
                        Entwürfe erscheinen nicht im öffentlichen Feed. Veröffentliche
                        die Sendung, damit die RSS-URL sichtbar wird.
                    </p>
                    <ul className="overflow-hidden rounded-xl border bg-card divide-y [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-4 [&>li]:p-4">
                        {draftSeries.map((item) => (
                            <li key={item.id}>
                                <span>
                                    {item.title} <code>{item.slug}</code>{' '}
                                    <PublicationStatusBadge status={item.status} />
                                </span>
                                <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                                    <Link
                                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                                        href={`/podcast/series/${item.id}`}
                                    >
                                        Sendung veröffentlichen
                                    </Link>
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {showSubscriberFeeds ? (
                <section>
                    <h2>Abonnenten-Feeds</h2>
                    {subscriberFeeds.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Noch keine Abonnenten-Feeds. Ein Feed wird bei der
                            ersten Freischaltung einer Abonnentin bzw. eines
                            Abonnenten automatisch angelegt.
                        </p>
                    ) : (
                        <ul className="overflow-hidden rounded-xl border bg-card divide-y [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-4 [&>li]:p-4">
                            {subscriberFeeds.map((feed) => (
                                <li key={feed.id}>
                                    <span>
                                        <span>{feed.userEmail}</span>{' '}
                                        <code>{feed.title}</code>
                                        {feed.isDefault ? ' (Standard)' : ' (Eigener Feed)'}
                                        {feed.formats.length > 0
                                            ? ` · ${feed.formats.map((item) => item.name).join(', ')}`
                                            : null}
                                    </span>
                                    <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                                        <span
                                            className={
                                                feed.enabled
                                                    ? 'text-foreground'
                                                    : 'text-muted-foreground'
                                            }
                                        >
                                            {feed.enabled ? 'Aktiv' : 'Deaktiviert'}
                                        </span>
                                        <Button
                                            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                                            disabled={busyFeedId === feed.id}
                                            onClick={() =>
                                                void handleToggleFeed(feed)
                                            }
                                            type="button"
                                        >
                                            {busyFeedId === feed.id
                                                ? 'Arbeiten…'
                                                : feed.enabled
                                                  ? 'Deaktivieren'
                                                  : 'Aktivieren'}
                                        </Button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            ) : null}
        </div>
    )
}
