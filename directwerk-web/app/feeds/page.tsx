'use client'

import Link from 'next/link'
import {useState} from 'react'
import useSWR from 'swr'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import SectionHeader from '@directwerk/ui/components/section-header'

import ArticleCustomFeedsPanel from '@/components/ArticleCustomFeedsPanel'
import CustomFeedsPanel from '@/components/CustomFeedsPanel'
import FeedUrlDisplay from '@/components/FeedUrlDisplay'
import HowToListen from '@/components/HowToListen'
import {ListPanelSkeleton} from '@/components/ContentLoadingSkeleton'
import SubscriberContextBanner from '@/components/SubscriberContextBanner'
import {
    getSiteConfig,
    listPublicSeries,
    rotateDefaultArticleFeedToken,
    rotateDefaultFeedToken,
    setDefaultArticleFeedEnabled,
    setDefaultFeedEnabled,
} from '@/lib/api/client'
import type {PublicSeries, PublicSiteConfig} from '@directwerk/api/types'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import {useArticleFeeds} from '@/lib/auth/useArticleFeeds'
import {useSubscriberFeeds} from '@/lib/auth/useSubscriberFeeds'
import {formatPublishedAt} from '@directwerk/api/format/datetime'
import {getClientTenantHost} from '@/lib/tenant/clientHost'
import {
    webPublicArticleFeedUrl,
    webPublicPodcastFeedUrl,
} from '@/lib/feeds/webPublicFeedUrl'

function feedsPageCopy(showPodcastFeeds: boolean, showArticleFeeds: boolean): {
    title: string
    description: string
} {
    if (showPodcastFeeds && showArticleFeeds) {
        return {
            title: 'RSS-Feeds',
            description:
                'Öffentliche Feeds für freie Folgen und Beiträge. Nach der Anmeldung kommen private Feeds für bezahlte Inhalte.',
        }
    }
    if (showArticleFeeds) {
        return {
            title: 'Beitrags-Feeds',
            description:
                'Öffentlicher Feed für freie Beiträge. Nach der Anmeldung kommt der private Feed für bezahlte Beiträge.',
        }
    }
    return {
        title: 'RSS-Feeds',
        description:
            'Öffentliche Feeds für freie Folgen. Nach der Anmeldung kommt der private Feed für bezahlte Inhalte.',
    }
}

export default function FeedsPage() {
    const tenantHost = getClientTenantHost()
    const {isAuthenticated} = useSubscriberAuth()

    const {data: siteConfig} = useSWR<PublicSiteConfig>(
        ['site-config', tenantHost] as const,
        async ([, host]: readonly [string, string]) =>
            (await getSiteConfig(host)).data,
    )

    const showPodcastFeeds =
        siteConfig?.enabledModules.includes('PODCAST_RSS') ?? false
    const showArticleFeeds =
        siteConfig?.enabledModules.includes('ARTICLE_RSS') ?? false
    const pageCopy = feedsPageCopy(showPodcastFeeds, showArticleFeeds)

    const {
        feeds: podcastPrivateFeeds,
        error: podcastPrivateError,
        isLoading: isPodcastPrivateLoading,
        setFeeds: setPodcastPrivateFeeds,
    } = useSubscriberFeeds(isAuthenticated && showPodcastFeeds)

    const {
        feeds: articlePrivateFeeds,
        error: articlePrivateError,
        isLoading: isArticlePrivateLoading,
        setFeeds: setArticlePrivateFeeds,
    } = useArticleFeeds(isAuthenticated && showArticleFeeds)

    const {
        data: seriesData,
        error: seriesError,
        isLoading: isSeriesLoading,
    } = useSWR<PublicSeries[]>(
        showPodcastFeeds ? (['public-series', tenantHost] as const) : null,
        ([, host]: readonly [string, string]) => listPublicSeries(host),
    )

    const series = seriesData ?? []
    const seriesErrorMessage =
        seriesError instanceof Error
            ? seriesError.message
            : seriesError
              ? 'Öffentliche Sendungen konnten nicht geladen werden.'
              : null

    const [podcastFeedActionBusy, setPodcastFeedActionBusy] = useState(false)
    const [podcastFeedActionError, setPodcastFeedActionError] = useState<string | null>(null)
    const [articleFeedActionBusy, setArticleFeedActionBusy] = useState(false)
    const [articleFeedActionError, setArticleFeedActionError] = useState<string | null>(null)

    const podcastFeedUrl =
        siteConfig === undefined
            ? null
            : webPublicPodcastFeedUrl(siteConfig, tenantHost)
    const articleFeedUrl =
        siteConfig === undefined
            ? null
            : webPublicArticleFeedUrl(siteConfig, tenantHost)

    const defaultPodcastPrivate =
        podcastPrivateFeeds.find((feed) => feed.isDefault) ?? null
    const customPodcastFeeds = podcastPrivateFeeds.filter((feed) => !feed.isDefault)
    const showPodcastFeedBuilder =
        showPodcastFeeds &&
        isAuthenticated &&
        ((siteConfig?.enabledModules.includes('FEED_BUILDER') ?? false) ||
            customPodcastFeeds.length > 0)
    const canBuildPodcastFeeds =
        showPodcastFeeds &&
        isAuthenticated &&
        (siteConfig?.enabledModules.includes('FEED_BUILDER') ?? false)

    const defaultArticlePrivate =
        articlePrivateFeeds.find((feed) => feed.isDefault) ?? null
    const customArticleFeeds = articlePrivateFeeds.filter((feed) => !feed.isDefault)
    const showArticleFeedBuilder =
        showArticleFeeds &&
        isAuthenticated &&
        ((siteConfig?.enabledModules.includes('ARTICLE_FEED_BUILDER') ?? false) ||
            customArticleFeeds.length > 0)
    const canBuildArticleFeeds =
        showArticleFeeds &&
        isAuthenticated &&
        (siteConfig?.enabledModules.includes('ARTICLE_FEED_BUILDER') ?? false)

    async function handlePodcastRotate(): Promise<void> {
        setPodcastFeedActionBusy(true)
        setPodcastFeedActionError(null)
        try {
            const updated = await rotateDefaultFeedToken(tenantHost)
            setPodcastPrivateFeeds((current) =>
                current.map((feed) => (feed.isDefault ? updated : feed)),
            )
        } catch (error: unknown) {
            setPodcastFeedActionError(
                error instanceof Error
                    ? error.message
                    : 'Token konnte nicht erneuert werden.',
            )
        } finally {
            setPodcastFeedActionBusy(false)
        }
    }

    async function handlePodcastToggleDefault(enabled: boolean): Promise<void> {
        setPodcastFeedActionBusy(true)
        setPodcastFeedActionError(null)
        try {
            const updated = await setDefaultFeedEnabled(tenantHost, enabled)
            setPodcastPrivateFeeds((current) =>
                current.map((feed) => (feed.isDefault ? updated : feed)),
            )
        } catch (error: unknown) {
            setPodcastFeedActionError(
                error instanceof Error
                    ? error.message
                    : 'Feed konnte nicht aktualisiert werden.',
            )
        } finally {
            setPodcastFeedActionBusy(false)
        }
    }

    async function handleArticleRotate(): Promise<void> {
        setArticleFeedActionBusy(true)
        setArticleFeedActionError(null)
        try {
            const updated = await rotateDefaultArticleFeedToken(tenantHost)
            setArticlePrivateFeeds((current) =>
                current.map((feed) => (feed.isDefault ? updated : feed)),
            )
        } catch (error: unknown) {
            setArticleFeedActionError(
                error instanceof Error
                    ? error.message
                    : 'Token konnte nicht erneuert werden.',
            )
        } finally {
            setArticleFeedActionBusy(false)
        }
    }

    async function handleArticleToggleDefault(enabled: boolean): Promise<void> {
        setArticleFeedActionBusy(true)
        setArticleFeedActionError(null)
        try {
            const updated = await setDefaultArticleFeedEnabled(tenantHost, enabled)
            setArticlePrivateFeeds((current) =>
                current.map((feed) => (feed.isDefault ? updated : feed)),
            )
        } catch (error: unknown) {
            setArticleFeedActionError(
                error instanceof Error
                    ? error.message
                    : 'Feed konnte nicht aktualisiert werden.',
            )
        } finally {
            setArticleFeedActionBusy(false)
        }
    }

    return (
        <PageStack className="page-container">
            <PageHeader title={pageCopy.title} description={pageCopy.description} />

            <SubscriberContextBanner showWhenAuthenticated={false} />

            {showPodcastFeeds ? (
                <HowToListen
                    isAuthenticated={isAuthenticated}
                    privateFeedUrl={
                        defaultPodcastPrivate?.enabled === true
                            ? defaultPodcastPrivate.url
                            : null
                    }
                    publicFeedUrl={podcastFeedUrl}
                />
            ) : null}

            {showPodcastFeeds ? (
                <>
                    {isSeriesLoading ? <ListPanelSkeleton rows={3} /> : null}
                    {seriesErrorMessage !== null && (
                        <Alert variant="destructive">
                            <AlertDescription>{seriesErrorMessage}</AlertDescription>
                        </Alert>
                    )}

                    {!isSeriesLoading && seriesErrorMessage === null && (
                        <section className="flex flex-col gap-4">
                            <SectionHeader
                                description="Nur veröffentlichte freie Folgen. Bezahlte Folgen erscheinen im privaten Feed."
                                title="Podcast — öffentliche Feeds"
                            />
                            <ListPanel>
                                <ListPanelRow>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium">Alle freien Folgen</p>
                                        {podcastFeedUrl !== null ? (
                                            <div className="mt-3">
                                                <FeedUrlDisplay url={podcastFeedUrl} />
                                            </div>
                                        ) : (
                                            <p className="mt-2 text-sm text-muted-foreground">
                                                Kein öffentlicher Feed (PODCAST_RSS aus).
                                            </p>
                                        )}
                                    </div>
                                </ListPanelRow>
                                {series.length === 0 ? (
                                    <ListPanelRow>
                                        <p className="text-sm text-muted-foreground">
                                            Noch keine veröffentlichten Sendungen.
                                        </p>
                                    </ListPanelRow>
                                ) : (
                                    series.map((item) => {
                                        const feedUrl = item.rssUrl
                                        return (
                                            <ListPanelRow key={item.id}>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium">{item.title}</p>
                                                    {feedUrl !== null ? (
                                                        <div className="mt-3">
                                                            <FeedUrlDisplay url={feedUrl} />
                                                        </div>
                                                    ) : (
                                                        <p className="mt-2 text-sm text-muted-foreground">
                                                            Kein Feed für diese Sendung.
                                                        </p>
                                                    )}
                                                </div>
                                            </ListPanelRow>
                                        )
                                    })
                                )}
                            </ListPanel>
                        </section>
                    )}

                    <section className="flex flex-col gap-4">
                        <SectionHeader
                            description="Enthält Folgen, die dein Abo freischaltet. Teile die URL nicht — sie ist persönlich."
                            title="Podcast — dein privater Feed"
                        />
                        {!isAuthenticated ? (
                            <Alert>
                                <AlertDescription>
                                    <Link href="/login">Anmelden</Link>, um den privaten Feed für
                                    Folgen zu sehen, die du freigeschaltet hast.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <>
                                {isPodcastPrivateLoading && (
                                    <ListPanelSkeleton rows={1} />
                                )}
                                {(podcastPrivateError ?? podcastFeedActionError) !== null && (
                                    <Alert variant="destructive">
                                        <AlertDescription>
                                            {podcastPrivateError ?? podcastFeedActionError}
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {!isPodcastPrivateLoading &&
                                    podcastPrivateError === null &&
                                    podcastFeedActionError === null &&
                                    (podcastPrivateFeeds.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Noch kein privater Feed für dieses Konto.
                                        </p>
                                    ) : (
                                        <ListPanel>
                                            {podcastPrivateFeeds
                                                .filter((feed) => feed.isDefault)
                                                .map((feed) => (
                                                    <ListPanelRow key={feed.id}>
                                                        <div className="min-w-0 flex-1 space-y-3">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="font-medium">
                                                                    {feed.title}
                                                                </p>
                                                                <Badge
                                                                    variant={
                                                                        feed.enabled
                                                                            ? 'secondary'
                                                                            : 'outline'
                                                                    }
                                                                >
                                                                    {feed.enabled
                                                                        ? 'Aktiv'
                                                                        : 'Deaktiviert'}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground">
                                                                Aktualisiert{' '}
                                                                {formatPublishedAt(feed.updatedAt)}
                                                            </p>
                                                            {feed.enabled ? (
                                                                <FeedUrlDisplay url={feed.url} />
                                                            ) : (
                                                                <p className="text-sm text-muted-foreground">
                                                                    Dieser Feed ist derzeit
                                                                    deaktiviert.
                                                                </p>
                                                            )}
                                                        </div>
                                                        {feed.isDefault ? (
                                                            <div className="flex flex-wrap gap-2">
                                                                <Button
                                                                    disabled={podcastFeedActionBusy}
                                                                    onClick={() =>
                                                                        void handlePodcastToggleDefault(
                                                                            !feed.enabled,
                                                                        )
                                                                    }
                                                                    size="sm"
                                                                    type="button"
                                                                    variant="outline"
                                                                >
                                                                    {feed.enabled
                                                                        ? 'Deaktivieren'
                                                                        : 'Aktivieren'}
                                                                </Button>
                                                                <Button
                                                                    disabled={podcastFeedActionBusy}
                                                                    onClick={() =>
                                                                        void handlePodcastRotate()
                                                                    }
                                                                    size="sm"
                                                                    type="button"
                                                                    variant="outline"
                                                                >
                                                                    Token erneuern
                                                                </Button>
                                                            </div>
                                                        ) : null}
                                                    </ListPanelRow>
                                                ))}
                                        </ListPanel>
                                    ))}
                            </>
                        )}
                    </section>

                    {showPodcastFeedBuilder ? (
                        <CustomFeedsPanel
                            canBuild={canBuildPodcastFeeds}
                            feeds={podcastPrivateFeeds}
                            onAuthRequired={() =>
                                setPodcastFeedActionError(
                                    'Bitte erneut anmelden, um private Feeds zu sehen.',
                                )
                            }
                            onError={setPodcastFeedActionError}
                            onFeedsChange={setPodcastPrivateFeeds}
                            tenantHost={tenantHost}
                        />
                    ) : null}
                </>
            ) : null}

            {showArticleFeeds ? (
                <>
                    <section className="flex flex-col gap-4">
                        <SectionHeader
                            description="Nur veröffentlichte freie Beiträge. Bezahlte Beiträge erscheinen im privaten Feed."
                            title="Beiträge — öffentlicher Feed"
                        />
                        <ListPanel>
                            <ListPanelRow>
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium">Alle freien Beiträge</p>
                                    {articleFeedUrl !== null ? (
                                        <div className="mt-3">
                                            <FeedUrlDisplay url={articleFeedUrl} />
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            Kein öffentlicher Feed (ARTICLE_RSS aus).
                                        </p>
                                    )}
                                </div>
                            </ListPanelRow>
                        </ListPanel>
                    </section>

                    <section className="flex flex-col gap-4">
                        <SectionHeader
                            description="Enthält Beiträge, die dein Abo freischaltet. Teile die URL nicht — sie ist persönlich."
                            title="Beiträge — dein privater Feed"
                        />
                        {!isAuthenticated ? (
                            <Alert>
                                <AlertDescription>
                                    <Link href="/login">Anmelden</Link>, um den privaten Feed für
                                    Beiträge zu sehen, die du freigeschaltet hast.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <>
                                {isArticlePrivateLoading && (
                                    <ListPanelSkeleton rows={1} />
                                )}
                                {(articlePrivateError ?? articleFeedActionError) !== null && (
                                    <Alert variant="destructive">
                                        <AlertDescription>
                                            {articlePrivateError ?? articleFeedActionError}
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {!isArticlePrivateLoading &&
                                    articlePrivateError === null &&
                                    articleFeedActionError === null &&
                                    (defaultArticlePrivate === null ? (
                                        <p className="text-sm text-muted-foreground">
                                            Noch kein privater Feed für dieses Konto.
                                        </p>
                                    ) : (
                                        <ListPanel>
                                            <ListPanelRow key={defaultArticlePrivate.id}>
                                                <div className="min-w-0 flex-1 space-y-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-medium">
                                                            {defaultArticlePrivate.title}
                                                        </p>
                                                        <Badge
                                                            variant={
                                                                defaultArticlePrivate.enabled
                                                                    ? 'secondary'
                                                                    : 'outline'
                                                            }
                                                        >
                                                            {defaultArticlePrivate.enabled
                                                                ? 'Aktiv'
                                                                : 'Deaktiviert'}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        Aktualisiert{' '}
                                                        {formatPublishedAt(
                                                            defaultArticlePrivate.updatedAt,
                                                        )}
                                                    </p>
                                                    {defaultArticlePrivate.enabled ? (
                                                        <FeedUrlDisplay
                                                            url={defaultArticlePrivate.url}
                                                        />
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground">
                                                            Dieser Feed ist derzeit deaktiviert.
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        disabled={articleFeedActionBusy}
                                                        onClick={() =>
                                                            void handleArticleToggleDefault(
                                                                !defaultArticlePrivate.enabled,
                                                            )
                                                        }
                                                        size="sm"
                                                        type="button"
                                                        variant="outline"
                                                    >
                                                        {defaultArticlePrivate.enabled
                                                            ? 'Deaktivieren'
                                                            : 'Aktivieren'}
                                                    </Button>
                                                    <Button
                                                        disabled={articleFeedActionBusy}
                                                        onClick={() => void handleArticleRotate()}
                                                        size="sm"
                                                        type="button"
                                                        variant="outline"
                                                    >
                                                        Token erneuern
                                                    </Button>
                                                </div>
                                            </ListPanelRow>
                                        </ListPanel>
                                    ))}
                            </>
                        )}
                    </section>

                    {showArticleFeedBuilder ? (
                        <ArticleCustomFeedsPanel
                            canBuild={canBuildArticleFeeds}
                            feeds={articlePrivateFeeds}
                            onAuthRequired={() =>
                                setArticleFeedActionError(
                                    'Bitte erneut anmelden, um private Feeds zu sehen.',
                                )
                            }
                            onError={setArticleFeedActionError}
                            onFeedsChange={setArticlePrivateFeeds}
                            tenantHost={tenantHost}
                        />
                    ) : null}
                </>
            ) : null}
        </PageStack>
    )
}
