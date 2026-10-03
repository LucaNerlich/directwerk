'use client'

import Link from 'next/link'
import {useState} from 'react'
import useSWR from 'swr'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import ConfirmDialog from '@directwerk/ui/components/confirm-dialog'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import SectionHeader from '@directwerk/ui/components/section-header'

import CustomFeedsPanel, {
    articleCustomFeedsConfig,
    podcastCustomFeedsConfig,
} from '@/components/CustomFeedsPanel'
import FeedUrlDisplay from '@/components/FeedUrlDisplay'
import HowToSubscribe from '@/components/HowToSubscribe'
import {ListPanelSkeleton} from '@/components/ContentLoadingSkeleton'
import SubscriberContextBanner from '@/components/SubscriberContextBanner'
import {
    listPublicSeries,
    rotateDefaultArticleFeedToken,
    rotateDefaultFeedToken,
    setDefaultArticleFeedEnabled,
    setDefaultFeedEnabled,
} from '@/lib/api/client'
import type {
    ArticleFeedView,
    PublicSeries,
    SubscriberFeedView,
} from '@directwerk/api/types'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import {useArticleFeeds} from '@/lib/auth/useArticleFeeds'
import {useSubscriberFeeds} from '@/lib/auth/useSubscriberFeeds'
import {formatPublishedAt} from '@/lib/format/dateTime'
import {interpolate} from '@/lib/i18n/interpolate'
import type {Dictionary} from '@/lib/i18n/dictionary'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {userFacingFeedsError} from '@/lib/billing/userFacingBillingError'
import {
    webPublicArticleFeedUrl,
    webPublicPodcastFeedUrl,
} from '@/lib/feeds/webPublicFeedUrl'

function feedsPageCopy(
    feeds: Dictionary['feeds'],
    showPodcastFeeds: boolean,
    showArticleFeeds: boolean,
): {
    title: string
    description: string
} {
    if (showPodcastFeeds && showArticleFeeds) {
        return {title: feeds.pageTitleBoth, description: feeds.pageDescBoth}
    }
    if (showArticleFeeds) {
        return {title: feeds.pageTitleArticles, description: feeds.pageDescArticles}
    }
    return {title: feeds.pageTitleBoth, description: feeds.pageDescPodcast}
}

function DefaultFeedActions({
    enabled,
    togglePending,
    rotatePending,
    onToggle,
    onRotate,
}: {
    enabled: boolean
    togglePending: boolean
    rotatePending: boolean
    onToggle: () => void
    onRotate: () => void
}): React.JSX.Element {
    const {common} = useDictionary()
    return (
        <div className="flex flex-wrap gap-2">
            <Button
                disabled={togglePending || rotatePending}
                onClick={onToggle}
                size="sm"
                type="button"
                variant="outline"
            >
                {togglePending
                    ? common.toggling
                    : enabled
                      ? common.deactivate
                      : common.activate}
            </Button>
            <Button
                disabled={togglePending || rotatePending}
                onClick={onRotate}
                size="sm"
                type="button"
                variant="outline"
            >
                {rotatePending ? common.renewing : common.rotateToken}
            </Button>
        </div>
    )
}

function PrivateFeedEmptyState({kind}: {kind: 'podcast' | 'articles'}): React.JSX.Element {
    const lang = useLocale()
    const {feeds, nav} = useDictionary()
    return (
        <EmptyState
            title={
                kind === 'podcast'
                    ? feeds.privateEmptyPodcastTitle
                    : feeds.privateEmptyArticlesTitle
            }
            description={
                kind === 'podcast'
                    ? feeds.privateEmptyPodcastDesc
                    : feeds.privateEmptyArticlesDesc
            }
            action={
                <Button nativeButton={false} render={<Link href={localizedPath(lang, '/pricing')} />}>
                    {nav.viewPlans}
                </Button>
            }
        />
    )
}

function LoginHint({kind}: {kind: 'podcast' | 'articles'}): React.JSX.Element {
    const lang = useLocale()
    const {feeds, nav} = useDictionary()
    return (
        <Alert>
            <AlertDescription>
                <Link href={localizedPath(lang, '/login')}>
                    {feeds.loginForPrivateFeedLink}
                </Link>
                {feeds.loginForPrivateFeedMid}
                {kind === 'podcast'
                    ? feeds.loginForPrivateFeedSubjectPodcast
                    : feeds.loginForPrivateFeedSubjectArticles}
                {feeds.loginForPrivateFeedAfter}
                <Link href={localizedPath(lang, '/pricing')}>{nav.viewPlans}</Link>
            </AlertDescription>
        </Alert>
    )
}

/**
 * Displays enabled podcast and article feeds, including public, private, and custom feeds.
 */
export default function FeedsPage() {
    const lang = useLocale()
    const {common, errors, feeds, format} = useDictionary()
    const tenantHost = getWebClientTenantHost()
    const {isAuthenticated} = useSubscriberAuth()

    // Site config is already resolved by the root layout — reuse it instead of
    // issuing a second `GET /public/site-config` on every feeds visit.
    const siteConfig = useSiteConfig()

    const showPodcastFeeds =
        siteConfig?.enabledModules.includes('PODCAST_RSS') ?? false
    const showArticleFeeds =
        siteConfig?.enabledModules.includes('ARTICLE_RSS') ?? false
    const pageCopy = feedsPageCopy(feeds, showPodcastFeeds, showArticleFeeds)

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
        seriesError == null ? null : userFacingFeedsError(seriesError, errors)

    const [podcastTogglePending, setPodcastTogglePending] = useState(false)
    const [podcastRotatePending, setPodcastRotatePending] = useState(false)
    const [rotateKind, setRotateKind] = useState<'podcast' | 'articles' | null>(null)
    const [podcastToggleError, setPodcastToggleError] = useState<string | null>(null)
    const [podcastRotateError, setPodcastRotateError] = useState<string | null>(null)
    const [podcastCustomError, setPodcastCustomError] = useState<string | null>(null)
    const [articleTogglePending, setArticleTogglePending] = useState(false)
    const [articleRotatePending, setArticleRotatePending] = useState(false)
    const [articleToggleError, setArticleToggleError] = useState<string | null>(null)
    const [articleRotateError, setArticleRotateError] = useState<string | null>(null)
    const [articleCustomError, setArticleCustomError] = useState<string | null>(null)

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

    async function performPodcastRotate(): Promise<void> {
        setPodcastRotatePending(true)
        setPodcastRotateError(null)
        try {
            const updated = await rotateDefaultFeedToken(tenantHost)
            setPodcastPrivateFeeds((current) =>
                current.map((feed) => (feed.isDefault ? updated : feed)),
            )
        } catch (error: unknown) {
            setPodcastRotateError(userFacingFeedsError(error, errors))
        } finally {
            setPodcastRotatePending(false)
        }
    }

    async function handlePodcastToggleDefault(enabled: boolean): Promise<void> {
        setPodcastTogglePending(true)
        setPodcastToggleError(null)
        try {
            const updated = await setDefaultFeedEnabled(tenantHost, enabled)
            setPodcastPrivateFeeds((current) =>
                current.map((feed) => (feed.isDefault ? updated : feed)),
            )
        } catch (error: unknown) {
            setPodcastToggleError(userFacingFeedsError(error, errors))
        } finally {
            setPodcastTogglePending(false)
        }
    }

    async function performArticleRotate(): Promise<void> {
        setArticleRotatePending(true)
        setArticleRotateError(null)
        try {
            const updated = await rotateDefaultArticleFeedToken(tenantHost)
            setArticlePrivateFeeds((current) =>
                current.map((feed) => (feed.isDefault ? updated : feed)),
            )
        } catch (error: unknown) {
            setArticleRotateError(userFacingFeedsError(error, errors))
        } finally {
            setArticleRotatePending(false)
        }
    }

    async function handleArticleToggleDefault(enabled: boolean): Promise<void> {
        setArticleTogglePending(true)
        setArticleToggleError(null)
        try {
            const updated = await setDefaultArticleFeedEnabled(tenantHost, enabled)
            setArticlePrivateFeeds((current) =>
                current.map((feed) => (feed.isDefault ? updated : feed)),
            )
        } catch (error: unknown) {
            setArticleToggleError(userFacingFeedsError(error, errors))
        } finally {
            setArticleTogglePending(false)
        }
    }

    function renderDefaultFeedRow({
        feed,
        togglePending,
        rotatePending,
        onToggle,
        onRotate,
        readerHint,
    }: {
        feed: SubscriberFeedView | ArticleFeedView
        togglePending: boolean
        rotatePending: boolean
        onToggle: () => void
        onRotate: () => void
        readerHint: string
    }): React.JSX.Element {
        return (
            <ListPanelRow key={feed.id}>
                <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{feed.title}</p>
                        <Badge>{common.standard}</Badge>
                        <Badge variant={feed.enabled ? 'secondary' : 'outline'}>
                            {feed.enabled ? common.active : common.disabled}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {feeds.defaultFeedMeta}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {interpolate(common.updatedAt, {
                            date: formatPublishedAt(feed.updatedAt, lang, format),
                        })}
                    </p>
                    <div className={feed.enabled ? undefined : 'opacity-70'}>
                        <FeedUrlDisplay url={feed.url} />
                        {!feed.enabled ? (
                            <p className="mt-2 text-sm text-muted-foreground">
                                {feeds.defaultFeedDisabledBefore}
                                {readerHint}
                                {feeds.defaultFeedDisabledAfter}
                            </p>
                        ) : null}
                    </div>
                </div>
                <DefaultFeedActions
                    enabled={feed.enabled}
                    onRotate={onRotate}
                    onToggle={onToggle}
                    rotatePending={rotatePending}
                    togglePending={togglePending}
                />
            </ListPanelRow>
        )
    }

    function renderPodcastPrivateSection(): React.JSX.Element {
        return (
            <section className="flex flex-col gap-4">
                <SectionHeader
                    action={<Badge>{common.privateForYou}</Badge>}
                    description={feeds.defaultPodcastDesc}
                    title={feeds.defaultPodcastTitle}
                />
                {!isAuthenticated ? (
                    <LoginHint kind="podcast" />
                ) : (
                    <>
                        {isPodcastPrivateLoading && <ListPanelSkeleton rows={1} />}
                        {podcastPrivateError !== null && (
                            <Alert variant="destructive">
                                <AlertDescription>{podcastPrivateError}</AlertDescription>
                            </Alert>
                        )}
                        {podcastToggleError !== null && (
                            <Alert variant="destructive">
                                <AlertDescription>
                                    {errors.toggleFailedPrefix} {podcastToggleError}
                                </AlertDescription>
                            </Alert>
                        )}
                        {podcastRotateError !== null && (
                            <Alert variant="destructive">
                                <AlertDescription>
                                    {errors.rotateFailedPrefix} {podcastRotateError}
                                </AlertDescription>
                            </Alert>
                        )}
                        {!isPodcastPrivateLoading &&
                            podcastPrivateError === null &&
                            (defaultPodcastPrivate === null ? (
                                <PrivateFeedEmptyState kind="podcast" />
                            ) : (
                                <ListPanel>
                                    {renderDefaultFeedRow({
                                        feed: defaultPodcastPrivate,
                                        onRotate: () => setRotateKind('podcast'),
                                        onToggle: () =>
                                            void handlePodcastToggleDefault(
                                                !defaultPodcastPrivate.enabled,
                                            ),
                                        readerHint: feeds.readerHintPodcastApps,
                                        rotatePending: podcastRotatePending,
                                        togglePending: podcastTogglePending,
                                    })}
                                </ListPanel>
                            ))}
                    </>
                )}
            </section>
        )
    }

    function renderPodcastCustomSection(): React.JSX.Element | null {
        if (!showPodcastFeedBuilder) {
            if (
                isAuthenticated &&
                showPodcastFeeds &&
                defaultPodcastPrivate !== null
            ) {
                return (
                    <p className="text-sm text-muted-foreground">
                        {feeds.customDisabledPodcast}
                    </p>
                )
            }
            return null
        }
        return (
            <>
                {podcastCustomError !== null && (
                    <Alert variant="destructive">
                        <AlertDescription>{podcastCustomError}</AlertDescription>
                    </Alert>
                )}
                <CustomFeedsPanel
                    canBuild={canBuildPodcastFeeds}
                    config={podcastCustomFeedsConfig}
                    feeds={podcastPrivateFeeds}
                    onAuthRequired={() =>
                        setPodcastCustomError(errors.feedsReauth)
                    }
                    onError={setPodcastCustomError}
                    onFeedsChange={setPodcastPrivateFeeds}
                    tenantHost={tenantHost}
                />
            </>
        )
    }

    function renderPodcastPublicSection(): React.JSX.Element | null {
        if (!showPodcastFeeds) {
            return null
        }
        return (
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
                            action={
                                <Badge variant="outline">
                                    {common.publicForAll}
                                </Badge>
                            }
                            description={feeds.publicPodcastDesc}
                            title={feeds.publicPodcastTitle}
                        />
                        <ListPanel>
                            <ListPanelRow>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium">
                                            {feeds.allFreeEpisodes}
                                        </p>
                                        <Badge variant="outline">
                                            {common.publicStandard}
                                        </Badge>
                                    </div>
                                    {podcastFeedUrl !== null ? (
                                        <div className="mt-3">
                                            <FeedUrlDisplay url={podcastFeedUrl} />
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {feeds.noPublicPodcastFeed}
                                        </p>
                                    )}
                                </div>
                            </ListPanelRow>
                            {series.length === 0 ? (
                                <ListPanelRow>
                                    <p className="text-sm text-muted-foreground">
                                        {feeds.noSeriesPublished}
                                    </p>
                                </ListPanelRow>
                            ) : (
                                series.map((item) => {
                                    const feedUrl = item.rssUrl
                                    return (
                                        <ListPanelRow key={item.id}>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-medium">
                                                        {item.title}
                                                    </p>
                                                    <Badge variant="outline">
                                                        {common.public}
                                                    </Badge>
                                                </div>
                                                {feedUrl !== null ? (
                                                    <div className="mt-3">
                                                        <FeedUrlDisplay url={feedUrl} />
                                                    </div>
                                                ) : (
                                                    <p className="mt-2 text-sm text-muted-foreground">
                                                        {feeds.noSeriesFeed}
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
            </>
        )
    }

    function renderArticlePrivateSection(): React.JSX.Element {
        return (
            <section className="flex flex-col gap-4">
                <SectionHeader
                    action={<Badge>{common.privateForYou}</Badge>}
                    description={feeds.defaultArticlesDesc}
                    title={feeds.defaultArticlesTitle}
                />
                {!isAuthenticated ? (
                    <LoginHint kind="articles" />
                ) : (
                    <>
                        {isArticlePrivateLoading && <ListPanelSkeleton rows={1} />}
                        {articlePrivateError !== null && (
                            <Alert variant="destructive">
                                <AlertDescription>{articlePrivateError}</AlertDescription>
                            </Alert>
                        )}
                        {articleToggleError !== null && (
                            <Alert variant="destructive">
                                <AlertDescription>
                                    {errors.toggleFailedPrefix} {articleToggleError}
                                </AlertDescription>
                            </Alert>
                        )}
                        {articleRotateError !== null && (
                            <Alert variant="destructive">
                                <AlertDescription>
                                    {errors.rotateFailedPrefix} {articleRotateError}
                                </AlertDescription>
                            </Alert>
                        )}
                        {!isArticlePrivateLoading &&
                            articlePrivateError === null &&
                            (defaultArticlePrivate === null ? (
                                <PrivateFeedEmptyState kind="articles" />
                            ) : (
                                <ListPanel>
                                    {renderDefaultFeedRow({
                                        feed: defaultArticlePrivate,
                                        onRotate: () => setRotateKind('articles'),
                                        onToggle: () =>
                                            void handleArticleToggleDefault(
                                                !defaultArticlePrivate.enabled,
                                            ),
                                        readerHint: feeds.readerHintFeedReaders,
                                        rotatePending: articleRotatePending,
                                        togglePending: articleTogglePending,
                                    })}
                                </ListPanel>
                            ))}
                    </>
                )}
            </section>
        )
    }

    function renderArticleCustomSection(): React.JSX.Element | null {
        if (!showArticleFeedBuilder) {
            if (
                isAuthenticated &&
                showArticleFeeds &&
                defaultArticlePrivate !== null
            ) {
                return (
                    <p className="text-sm text-muted-foreground">
                        {feeds.customDisabledArticles}
                    </p>
                )
            }
            return null
        }
        return (
            <>
                {articleCustomError !== null && (
                    <Alert variant="destructive">
                        <AlertDescription>{articleCustomError}</AlertDescription>
                    </Alert>
                )}
                <CustomFeedsPanel
                    canBuild={canBuildArticleFeeds}
                    config={articleCustomFeedsConfig}
                    feeds={articlePrivateFeeds}
                    onAuthRequired={() =>
                        setArticleCustomError(errors.feedsReauth)
                    }
                    onError={setArticleCustomError}
                    onFeedsChange={setArticlePrivateFeeds}
                    tenantHost={tenantHost}
                />
            </>
        )
    }

    function renderArticlePublicSection(): React.JSX.Element | null {
        if (!showArticleFeeds) {
            return null
        }
        return (
            <section className="flex flex-col gap-4">
                <SectionHeader
                    action={
                        <Badge variant="outline">{common.publicForAll}</Badge>
                    }
                    description={feeds.publicArticlesDesc}
                    title={feeds.publicArticlesTitle}
                />
                <ListPanel>
                    <ListPanelRow>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">
                                    {feeds.allFreeArticles}
                                </p>
                                <Badge variant="outline">
                                    {common.publicStandard}
                                </Badge>
                            </div>
                            {articleFeedUrl !== null ? (
                                <div className="mt-3">
                                    <FeedUrlDisplay url={articleFeedUrl} />
                                </div>
                            ) : (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {feeds.noPublicArticleFeed}
                                </p>
                            )}
                        </div>
                    </ListPanelRow>
                </ListPanel>
            </section>
        )
    }

    return (
        <PageStack className="page-container">
            <PageHeader title={pageCopy.title} description={pageCopy.description} />

            <SubscriberContextBanner showWhenAuthenticated={false} />

            {showPodcastFeeds || showArticleFeeds ? (
                <HowToSubscribe
                    podcast={showPodcastFeeds}
                    articles={showArticleFeeds}
                />
            ) : null}

            {showPodcastFeeds ? (
                isAuthenticated ? (
                    <>
                        {renderPodcastPrivateSection()}
                        {renderPodcastCustomSection()}
                        {renderPodcastPublicSection()}
                    </>
                ) : (
                    <>
                        {renderPodcastPublicSection()}
                        {renderPodcastPrivateSection()}
                    </>
                )
            ) : null}

            {showArticleFeeds ? (
                isAuthenticated ? (
                    <>
                        {renderArticlePrivateSection()}
                        {renderArticleCustomSection()}
                        {renderArticlePublicSection()}
                    </>
                ) : (
                    <>
                        {renderArticlePublicSection()}
                        {renderArticlePrivateSection()}
                    </>
                )
            ) : null}

            <ConfirmDialog
                cancelLabel={common.cancel}
                closeLabel={common.close}
                confirmLabel={common.rotateToken}
                description={
                    rotateKind === 'articles'
                        ? feeds.rotateDefaultDescArticles
                        : feeds.rotateDefaultDescPodcast
                }
                destructive
                onConfirm={() => {
                    if (rotateKind === 'articles') {
                        void performArticleRotate().finally(() => setRotateKind(null))
                    } else if (rotateKind === 'podcast') {
                        void performPodcastRotate().finally(() => setRotateKind(null))
                    }
                }}
                onOpenChange={(open) => {
                    if (!open) {
                        setRotateKind(null)
                    }
                }}
                open={rotateKind !== null}
                pending={
                    rotateKind === 'articles'
                        ? articleRotatePending
                        : podcastRotatePending
                }
                pendingLabel={common.renewing}
                title={feeds.rotateDefaultTitle}
            />
        </PageStack>
    )
}
