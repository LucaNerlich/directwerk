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
import {formatPublishedAt} from '@directwerk/api/format/datetime'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {userFacingFeedsError} from '@/lib/billing/userFacingBillingError'
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
                'Öffentliche Standard-Feeds für freie Folgen und Beiträge (für alle). Nach der Anmeldung: dein privater Standard-Feed mit allem Freigeschalteten — plus optional eigene filterbare Feeds.',
        }
    }
    if (showArticleFeeds) {
        return {
            title: 'Beitrags-Feeds',
            description:
                'Öffentlicher Standard-Feed für freie Beiträge (für alle). Nach der Anmeldung: dein privater Standard-Feed mit allem Freigeschalteten — plus optional eigene filterbare Feeds.',
        }
    }
    return {
        title: 'RSS-Feeds',
        description:
            'Öffentliche Standard-Feeds für freie Folgen (für alle). Nach der Anmeldung: dein privater Standard-Feed mit allem Freigeschalteten — plus optional eigene filterbare Feeds.',
    }
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
                    ? 'Wird umgeschaltet…'
                    : enabled
                      ? 'Deaktivieren'
                      : 'Aktivieren'}
            </Button>
            <Button
                disabled={togglePending || rotatePending}
                onClick={onRotate}
                size="sm"
                type="button"
                variant="outline"
            >
                {rotatePending ? 'Wird erneuert…' : 'Token erneuern'}
            </Button>
        </div>
    )
}

function PrivateFeedEmptyState({kind}: {kind: 'podcast' | 'articles'}): React.JSX.Element {
    return (
        <EmptyState
            title="Noch kein privater Feed"
            description={
                kind === 'podcast'
                    ? 'Sobald du ein Abo abschließt oder freigeschaltet wirst, erscheint hier dein persönlicher Feed mit allen freigeschalteten Folgen.'
                    : 'Sobald du ein Abo abschließt oder freigeschaltet wirst, erscheint hier dein persönlicher Feed mit allen freigeschalteten Beiträgen.'
            }
            action={
                <Button nativeButton={false} render={<Link href="/pricing" />}>
                    Tarife ansehen
                </Button>
            }
        />
    )
}

function LoginHint({kind}: {kind: 'podcast' | 'articles'}): React.JSX.Element {
    return (
        <Alert>
            <AlertDescription>
                <Link href="/login">Anmelden</Link>, um den privaten Feed für{' '}
                {kind === 'podcast'
                    ? 'Folgen zu sehen, die du freigeschaltet hast.'
                    : 'Beiträge zu sehen, die du freigeschaltet hast.'}{' '}
                <Link href="/pricing">Tarife ansehen</Link>
            </AlertDescription>
        </Alert>
    )
}

/**
 * Displays enabled podcast and article feeds, including public, private, and custom feeds.
 */
export default function FeedsPage() {
    const tenantHost = getWebClientTenantHost()
    const {isAuthenticated} = useSubscriberAuth()

    // Site config is already resolved by the root layout — reuse it instead of
    // issuing a second `GET /public/site-config` on every feeds visit.
    const siteConfig = useSiteConfig()

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
        seriesError == null ? null : userFacingFeedsError(seriesError)

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
            setPodcastRotateError(userFacingFeedsError(error))
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
            setPodcastToggleError(userFacingFeedsError(error))
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
            setArticleRotateError(userFacingFeedsError(error))
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
            setArticleToggleError(userFacingFeedsError(error))
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
                        <Badge>Standard</Badge>
                        <Badge variant={feed.enabled ? 'secondary' : 'outline'}>
                            {feed.enabled ? 'Aktiv' : 'Deaktiviert'}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Standard-Feed · automatisch angelegt · enthält alles, was
                        du freigeschaltet hast · nicht löschbar — im Unterschied
                        zu deinen eigenen Feeds weiter unten.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Aktualisiert {formatPublishedAt(feed.updatedAt)}
                    </p>
                    <div className={feed.enabled ? undefined : 'opacity-70'}>
                        <FeedUrlDisplay url={feed.url} />
                        {!feed.enabled ? (
                            <p className="mt-2 text-sm text-muted-foreground">
                                Deaktiviert — die URL bleibt sichtbar, aber{' '}
                                {readerHint} können sie erst nach dem Aktivieren
                                wieder abrufen.
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
                    action={<Badge>Privat · nur für dich</Badge>}
                    description="Dein automatisch angelegter Standard-Feed: Ein Feed für alles — enthält alle Folgen, die dein Abo freischaltet, alle Formate in einer URL. Im Unterschied zu deinen eigenen Feeds unten ist er nicht filter- oder löschbar. Teile die URL nicht — sie ist persönlich."
                    title="Dein Standard-Feed (Podcast)"
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
                                    Aktivieren fehlgeschlagen: {podcastToggleError}
                                </AlertDescription>
                            </Alert>
                        )}
                        {podcastRotateError !== null && (
                            <Alert variant="destructive">
                                <AlertDescription>
                                    Token-Erneuerung fehlgeschlagen: {podcastRotateError}
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
                                        readerHint: 'Podcast-Apps',
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
                        Eigene Feeds nach Format sind für dieses Angebot
                        deaktiviert. Dein Standard-Feed oben enthält trotzdem
                        alles, was du freigeschaltet hast.
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
                        setPodcastCustomError(
                            'Bitte erneut anmelden, um private Feeds zu sehen.',
                        )
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
                                    Öffentlich · für alle
                                </Badge>
                            }
                            description="Die Standard-Feeds für alle: Nur veröffentlichte freie Folgen, ohne Anmeldung. Bezahlte Folgen erscheinen in deinem privaten Standard-Feed und deinen eigenen Feeds."
                            title="Podcast — öffentliche Feeds"
                        />
                        <ListPanel>
                            <ListPanelRow>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium">
                                            Alle freien Folgen
                                        </p>
                                        <Badge variant="outline">
                                            Öffentlich · Standard
                                        </Badge>
                                    </div>
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
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-medium">
                                                        {item.title}
                                                    </p>
                                                    <Badge variant="outline">
                                                        Öffentlich
                                                    </Badge>
                                                </div>
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
            </>
        )
    }

    function renderArticlePrivateSection(): React.JSX.Element {
        return (
            <section className="flex flex-col gap-4">
                <SectionHeader
                    action={<Badge>Privat · nur für dich</Badge>}
                    description="Dein automatisch angelegter Standard-Feed: Ein Feed für alles — enthält alle Beiträge, die dein Abo freischaltet, alle Kategorien in einer URL. Im Unterschied zu deinen eigenen Feeds unten ist er nicht filter- oder löschbar. Teile die URL nicht — sie ist persönlich."
                    title="Dein Standard-Feed (Beiträge)"
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
                                    Aktivieren fehlgeschlagen: {articleToggleError}
                                </AlertDescription>
                            </Alert>
                        )}
                        {articleRotateError !== null && (
                            <Alert variant="destructive">
                                <AlertDescription>
                                    Token-Erneuerung fehlgeschlagen: {articleRotateError}
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
                                        readerHint: 'Feed-Reader',
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
                        Eigene Feeds nach Kategorie sind für dieses Angebot
                        deaktiviert. Dein Standard-Feed oben enthält trotzdem
                        alles, was du freigeschaltet hast.
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
                        setArticleCustomError(
                            'Bitte erneut anmelden, um private Feeds zu sehen.',
                        )
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
                        <Badge variant="outline">Öffentlich · für alle</Badge>
                    }
                    description="Der Standard-Feed für alle: Nur veröffentlichte freie Beiträge, ohne Anmeldung. Bezahlte Beiträge erscheinen in deinem privaten Standard-Feed und deinen eigenen Feeds."
                    title="Beiträge — öffentlicher Feed"
                />
                <ListPanel>
                    <ListPanelRow>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">
                                    Alle freien Beiträge
                                </p>
                                <Badge variant="outline">
                                    Öffentlich · Standard
                                </Badge>
                            </div>
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
        )
    }

    return (
        <PageStack className="page-container">
            <PageHeader title={pageCopy.title} description={pageCopy.description} />

            <SubscriberContextBanner showWhenAuthenticated={false} />

            {showPodcastFeeds ? (
                <HowToSubscribe
                    isAuthenticated={isAuthenticated}
                    podcast={{
                        publicFeedUrl: podcastFeedUrl,
                        privateFeedUrl:
                            defaultPodcastPrivate?.enabled === true
                                ? defaultPodcastPrivate.url
                                : null,
                    }}
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
                cancelLabel="Abbrechen"
                closeLabel="Schließen"
                confirmLabel="Token erneuern"
                description={
                    rotateKind === 'articles'
                        ? 'Die alte URL wird sofort ungültig. Trage die neue URL danach in deinem Feed-Reader ein.'
                        : 'Die alte URL wird sofort ungültig. Trage die neue URL danach in deiner Podcast-App ein.'
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
                pendingLabel="Wird erneuert…"
                title="Feed-URL erneuern?"
            />
        </PageStack>
    )
}
