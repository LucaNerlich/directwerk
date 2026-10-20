'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
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

import FeedUrlActions from '@/components/publication/FeedUrlActions'
import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {hasModule} from '@/lib/api/client'
import {listSeries} from '@/lib/api/podcastApi'
import {listSubscriberFeeds, setSubscriberFeedEnabled} from '@/lib/api/subscriptionApi'
import type {SeriesSummary, SubscriberFeedAdminView} from '@directwerk/api/types'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {useDictionary} from '@/components/i18n/LocaleProvider'

/**
 * Renders the podcast feed management interface.
 *
 * @returns The feed management page.
 */
export default function FeedManagementClient(): React.JSX.Element {
    const dict = useDictionary()
    const authRedirect = useAuthRequired()
    const config = useSiteConfig()
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [subscriberFeeds, setSubscriberFeeds] = useState<SubscriberFeedAdminView[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [busyFeedId, setBusyFeedId] = useState<number | null>(null)
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
    const [reloadToken, setReloadToken] = useState(0)
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

        setIsLoading(true)
        setErrorMessage(null)
        async function load(): Promise<void> {
            try {
                const [loadedSeries, loadedFeeds] = await Promise.all([
                    listSeries(),
                    showSubscriberFeeds ? listSubscriberFeeds() : Promise.resolve([]),
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
    }, [handleAuthError, reloadToken, showSubscriberFeeds])

    async function handleCopy(url: string): Promise<void> {
        setErrorMessage(null)
        try {
            await navigator.clipboard.writeText(url)
            setCopiedUrl(url)
        } catch (error) {
            handleAuthError(error)
        }
    }

    async function handleToggleFeed(
        feed: SubscriberFeedAdminView,
    ): Promise<void> {
        if (busyFeedId !== null) {
            return
        }
        setBusyFeedId(feed.id)
        setErrorMessage(null)
        try {
            const updated = await setSubscriberFeedEnabled(
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
            <LocaleLink
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                href={`/podcast/series/${item.id}`}
            >
                Sendung veröffentlichen
            </LocaleLink>
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
    const hasAnyFeed =
        generalFeedItems.length > 0 ||
        seriesFeedItems.length > 0 ||
        draftSeriesItems.length > 0 ||
        (showSubscriberFeeds && subscriberFeedItems.length > 0)

    return (
        <PageStack>
            <PageHeader
                eyebrow={dict.podcast.setupTitle}
                title={dict.nav.podcast.feeds}
                description={dict.podcast.teileUrlsPodcastAppsVerzeichnissenSendungs}
            />

            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                    <Button
                        className="mt-3"
                        onClick={() => setReloadToken((value) => value + 1)}
                        type="button"
                        variant="outline"
                    >
                        Erneut versuchen
                    </Button>
                </Alert>
            ) : null}

            {!hasAnyFeed && errorMessage === null ? (
                <EmptyState
                    action={
                        <Button nativeButton={false} render={<LocaleLink href="/podcast/series/new" />}>
                            Sendung anlegen
                        </Button>
                    }
                    description={dict.podcast.legeZuerstSendungVeroeffentlicheDanachErsch}
                    title={dict.podcast.emptyFeedsTitle}
                />
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
                        ariaLabel="Allgemeiner Feed"
                        items={generalFeedItems}
                        viewMode="list"
                    />
                </section>
            ) : null}

            {seriesFeedItems.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <SectionHeader
                        description={dict.podcast.oeffentlicherFeedJeSendungEnthaeltFreie}
                        title={dict.common.seriesFeeds}
                    />
                    <EntityListView
                        ariaLabel="Sendungs-Feeds"
                        items={seriesFeedItems}
                        viewMode={viewMode}
                    />
                </section>
            ) : null}

            {draftSeriesItems.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <SectionHeader
                        description={dict.podcast.entwuerfeErscheinenOeffentlichenFeedVeroeffe}
                        title={dict.podcast.veroeffentlichteSendungen}
                    />
                    <EntityListView
                        ariaLabel="Noch nicht veröffentlichte Sendungen"
                        items={draftSeriesItems}
                        viewMode={viewMode}
                    />
                </section>
            ) : null}

            {showSubscriberFeeds ? (
                <section className="flex flex-col gap-4">
                    <SectionHeader
                        description={dict.podcast.jederPrivateFeedZeigtGenauFolgen}
                        title={dict.common.subscriberFeeds}
                    />
                    {subscriberFeedItems.length === 0 ? (
                        <EmptyState
                            description={dict.write.subscriberFeedAutoCreated}
                            title={dict.write.noSubscriberFeeds}
                        />
                    ) : (
                        <EntityListView
                            ariaLabel="Abonnenten-Feeds"
                            items={subscriberFeedItems}
                            viewMode={viewMode}
                        />
                    )}
                </section>
            ) : null}
        </PageStack>
    )
}
