'use client'

import Link from 'next/link'
import {useCallback, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListToolbar} from '@directwerk/ui/components/entity-list-toolbar'
import {
    EntityListView,
    type EntityListViewItem,
} from '@directwerk/ui/components/entity-list-view'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {hasModule} from '@/lib/api/client'
import {listSeries} from '@/lib/api/podcastApi'
import {listSubscriberFeeds, setSubscriberFeedEnabled} from '@/lib/api/subscriptionApi'
import type {SeriesSummary, SubscriberFeedAdminView} from '@directwerk/api/types'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {safeLinkHref} from '@/lib/url/safeUrl'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

function copyUrl(url: string): Promise<void> {
    return navigator.clipboard.writeText(url)
}

function FeedUrlActions({
    copiedUrl,
    onCopy,
    url,
}: {
    copiedUrl: string | null
    onCopy: (url: string) => void
    url: string
}): React.JSX.Element {
    return (
        <div className="flex flex-wrap gap-2">
            {safeLinkHref(url) !== null ? (
                <a
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    href={url}
                    rel="noreferrer"
                    target="_blank"
                >
                    Öffnen
                </a>
            ) : null}
            <Button
                onClick={() => onCopy(url)}
                size="sm"
                type="button"
                variant="outline"
            >
                {copiedUrl === url ? 'Kopiert!' : 'Kopieren'}
            </Button>
        </div>
    )
}

export default function FeedManagementClient(): React.JSX.Element {
    const authRedirect = useAuthRequired()
    const config = useSiteConfig()
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [subscriberFeeds, setSubscriberFeeds] = useState<SubscriberFeedAdminView[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [busyFeedId, setBusyFeedId] = useState<number | null>(null)
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
    const {viewMode, setViewMode} = useListViewMode()
    const showSubscriberFeeds = hasModule(config, 'SUBSCRIPTION')

    const handleAuthError = useCallback(
        (error: unknown) => {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
            )
        },
        [authRedirect],
    )

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
                handleAuthError(error)
            } finally {
                if (active) {
                    setIsLoading(false)
                }
            }
        }

        void load()

        return () => {
            active = false
        }
    }, [handleAuthError, showSubscriberFeeds])

    async function handleCopy(url: string): Promise<void> {
        setErrorMessage(null)
        try {
            await copyUrl(url)
            setCopiedUrl(url)
        } catch (error) {
            handleAuthError(error)
        }
    }

    async function handleToggleFeed(
        feed: SubscriberFeedAdminView,
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
            handleAuthError(error)
        } finally {
            setBusyFeedId(null)
        }
    }

    if (isLoading) {
        return <p className="text-sm text-muted-foreground">Feeds werden geladen…</p>
    }

    const seriesWithFeeds = series.filter(
        (item) => item.rssUrl !== null && item.status === 'PUBLISHED',
    )
    const draftSeries = series.filter((item) => item.status !== 'PUBLISHED')

    const generalFeedItems: EntityListViewItem[] =
        config.publicRssUrl !== null
            ? [
                  {
                      id: 'general-feed',
                      title: config.tenant.name,
                      description: config.publicRssUrl,
                      actions: (
                          <FeedUrlActions
                              copiedUrl={copiedUrl}
                              onCopy={(url) => {
                                  void handleCopy(url)
                              }}
                              url={config.publicRssUrl}
                          />
                      ),
                  },
              ]
            : []

    const seriesFeedItems: EntityListViewItem[] = seriesWithFeeds.map((item) => ({
        id: item.id,
        title: item.title,
        descriptions: [<code key="slug">{item.slug}</code>, item.rssUrl],
        trailing: <PublicationStatusBadge status={item.status} />,
        actions: (
            <FeedUrlActions
                copiedUrl={copiedUrl}
                onCopy={(url) => {
                    void handleCopy(url)
                }}
                url={item.rssUrl as string}
            />
        ),
    }))

    const draftSeriesItems: EntityListViewItem[] = draftSeries.map((item) => ({
        id: item.id,
        title: item.title,
        description: <code>{item.slug}</code>,
        trailing: <PublicationStatusBadge status={item.status} />,
        actions: (
            <Link
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                href={`/podcast/series/${item.id}`}
            >
                Sendung veröffentlichen
            </Link>
        ),
    }))

    const subscriberFeedItems: EntityListViewItem[] = subscriberFeeds.map((feed) => ({
        id: feed.id,
        title: feed.userEmail,
        descriptions: [
            <>
                <code>{feed.title}</code>
                {feed.isDefault ? ' (Standard)' : ' (Eigener Feed)'}
                {feed.formats.length > 0
                    ? ` · ${feed.formats.map((item) => item.name).join(', ')}`
                    : null}
            </>,
            feed.enabled ? 'Aktiv' : 'Deaktiviert',
        ],
        actions: (
            <Button
                disabled={busyFeedId === feed.id}
                onClick={() => {
                    void handleToggleFeed(feed)
                }}
                size="sm"
                type="button"
                variant="outline"
            >
                {busyFeedId === feed.id
                    ? 'Arbeiten…'
                    : feed.enabled
                      ? 'Deaktivieren'
                      : 'Aktivieren'}
            </Button>
        ),
    }))
    const showViewToggle =
        seriesFeedItems.length + draftSeriesItems.length + subscriberFeedItems.length > 0

    return (
        <PageStack>
            <PageHeader
                eyebrow="Podcast · Einrichtung"
                title="Feeds"
                description="Teile diese URLs mit Podcast-Apps und Verzeichnissen. Der Abonnenten-Feed ist privat und wird über den Feed-Token der Abonnentin bzw. des Abonnenten geschützt."
            />

            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}

            {showViewToggle ? (
                <EntityListToolbar
                    onViewModeChange={setViewMode}
                    showSelection={false}
                    viewMode={viewMode}
                />
            ) : null}

            {generalFeedItems.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <SectionHeader title="Allgemeiner Feed" />
                    <EntityListView
                        items={generalFeedItems}
                        viewMode="list"
                    />
                </section>
            ) : null}

            {seriesFeedItems.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <SectionHeader title="Sendungs-Feeds" />
                    <EntityListView
                        items={seriesFeedItems}
                        viewMode={viewMode}
                    />
                </section>
            ) : null}

            {draftSeriesItems.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <SectionHeader
                        description="Entwürfe erscheinen nicht im öffentlichen Feed. Veröffentliche die Sendung, damit die RSS-URL sichtbar wird."
                        title="Noch nicht veröffentlichte Sendungen"
                    />
                    <EntityListView
                        items={draftSeriesItems}
                        viewMode={viewMode}
                    />
                </section>
            ) : null}

            {showSubscriberFeeds ? (
                <section className="flex flex-col gap-4">
                    <SectionHeader title="Abonnenten-Feeds" />
                    {subscriberFeedItems.length === 0 ? (
                        <EmptyState
                            description="Ein Feed wird bei der ersten Freischaltung einer Abonnentin bzw. eines Abonnenten automatisch angelegt."
                            title="Noch keine Abonnenten-Feeds"
                        />
                    ) : (
                        <EntityListView
                            items={subscriberFeedItems}
                            viewMode={viewMode}
                        />
                    )}
                </section>
            ) : null}
        </PageStack>
    )
}
