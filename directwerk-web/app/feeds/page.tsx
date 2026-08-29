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

import CustomFeedsPanel from '@/components/CustomFeedsPanel'
import FeedUrlDisplay from '@/components/FeedUrlDisplay'
import HowToListen from '@/components/HowToListen'
import {ListPanelSkeleton} from '@/components/ContentLoadingSkeleton'
import SubscriberContextBanner from '@/components/SubscriberContextBanner'
import {
    getSiteConfig,
    listPublicSeries,
    rotateDefaultFeedToken,
    setDefaultFeedEnabled,
} from '@/lib/api/client'
import type {PublicSeries, PublicSiteConfig, SubscriberFeedView} from '@directwerk/api/types'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import {useSubscriberFeeds} from '@/lib/auth/useSubscriberFeeds'
import {formatPublishedAt} from '@directwerk/api/format/datetime'
import {getClientTenantHost} from '@directwerk/api/tenant'

export default function FeedsPage() {
    const tenantHost = getClientTenantHost()
    const {isAuthenticated} = useSubscriberAuth()
    const {
        feeds: privateFeeds,
        error: privateError,
        isLoading: isPrivateLoading,
        setFeeds: setPrivateFeeds,
    } = useSubscriberFeeds(isAuthenticated)

    const {
        data: seriesData,
        error: seriesError,
        isLoading,
    } = useSWR<PublicSeries[]>(
        ['public-series', tenantHost] as const,
        ([, host]: readonly [string, string]) => listPublicSeries(host),
    )
    const {data: siteConfig} = useSWR<PublicSiteConfig>(
        ['site-config', tenantHost] as const,
        async ([, host]: readonly [string, string]) =>
            (await getSiteConfig(host)).data,
    )
    const series = seriesData ?? []
    const errorMessage =
        seriesError instanceof Error
            ? seriesError.message
            : seriesError
              ? 'Öffentliche Sendungen konnten nicht geladen werden.'
              : null

    const [feedActionBusy, setFeedActionBusy] = useState(false)
    const [feedActionError, setFeedActionError] = useState<string | null>(null)

    const podcastFeedUrl =
        siteConfig === undefined ? null : siteConfig.publicRssUrl

    const defaultPrivate = privateFeeds.find((feed) => feed.isDefault) ?? null
    const customFeeds = privateFeeds.filter((feed) => !feed.isDefault)
    const showFeedBuilder =
        isAuthenticated &&
        ((siteConfig?.enabledModules.includes('FEED_BUILDER') ?? false) ||
            customFeeds.length > 0)
    const canBuildFeeds =
        isAuthenticated &&
        (siteConfig?.enabledModules.includes('FEED_BUILDER') ?? false)

    async function handleRotate(): Promise<void> {
        setFeedActionBusy(true)
        setFeedActionError(null)
        try {
            const updated = await rotateDefaultFeedToken(tenantHost)
            setPrivateFeeds((current) =>
                current.map((feed) => (feed.isDefault ? updated : feed)),
            )
        } catch (error: unknown) {
            setFeedActionError(
                error instanceof Error
                    ? error.message
                    : 'Token konnte nicht erneuert werden.',
            )
        } finally {
            setFeedActionBusy(false)
        }
    }

    async function handleToggleDefault(enabled: boolean): Promise<void> {
        setFeedActionBusy(true)
        setFeedActionError(null)
        try {
            const updated = await setDefaultFeedEnabled(tenantHost, enabled)
            setPrivateFeeds((current) =>
                current.map((feed) => (feed.isDefault ? updated : feed)),
            )
        } catch (error: unknown) {
            setFeedActionError(
                error instanceof Error
                    ? error.message
                    : 'Feed konnte nicht aktualisiert werden.',
            )
        } finally {
            setFeedActionBusy(false)
        }
    }

    return (
        <PageStack className="page-container">
            <PageHeader
                title="RSS-Feeds"
                description="Öffentliche Feeds für freie Folgen. Nach der Anmeldung kommt der private Feed für bezahlte Inhalte."
            />

            <SubscriberContextBanner showWhenAuthenticated={false} />

            <HowToListen
                isAuthenticated={isAuthenticated}
                privateFeedUrl={
                    defaultPrivate?.enabled === true ? defaultPrivate.url : null
                }
                publicFeedUrl={podcastFeedUrl}
            />

            {isLoading ? (
                <ListPanelSkeleton rows={3} />
            ) : null}
            {errorMessage !== null && (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            )}

            {!isLoading && errorMessage === null && (
                <section className="flex flex-col gap-4">
                    <SectionHeader
                        description="Nur veröffentlichte freie Folgen. Bezahlte Folgen erscheinen im privaten Feed."
                        title="Öffentliche Feeds"
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
                    title="Dein privater Feed"
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
                        {isPrivateLoading && (
                            <ListPanelSkeleton rows={1} />
                        )}
                        {(privateError ?? feedActionError) !== null && (
                            <Alert variant="destructive">
                                <AlertDescription>
                                    {privateError ?? feedActionError}
                                </AlertDescription>
                            </Alert>
                        )}
                        {!isPrivateLoading && privateError === null && feedActionError === null && (
                            privateFeeds.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Noch kein privater Feed für dieses Konto.
                                </p>
                            ) : (
                                <ListPanel>
                                    {privateFeeds
                                        .filter((feed) => feed.isDefault)
                                        .map((feed) => (
                                        <ListPanelRow key={feed.id}>
                                            <div className="min-w-0 flex-1 space-y-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-medium">
                                                        {feed.title}
                                                    </p>
                                                    <Badge variant={feed.enabled ? 'secondary' : 'outline'}>
                                                        {feed.enabled ? 'Aktiv' : 'Deaktiviert'}
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
                                                        Dieser Feed ist derzeit deaktiviert.
                                                    </p>
                                                )}
                                            </div>
                                            {feed.isDefault ? (
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        disabled={feedActionBusy}
                                                        onClick={() =>
                                                            void handleToggleDefault(
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
                                                        disabled={feedActionBusy}
                                                        onClick={() => void handleRotate()}
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
                            )
                        )}
                    </>
                )}
            </section>

            {showFeedBuilder ? (
                <CustomFeedsPanel
                    canBuild={canBuildFeeds}
                    feeds={privateFeeds}
                    onAuthRequired={() =>
                        setFeedActionError(
                            'Bitte erneut anmelden, um private Feeds zu sehen.',
                        )
                    }
                    onError={setFeedActionError}
                    onFeedsChange={setPrivateFeeds}
                    tenantHost={tenantHost}
                />
            ) : null}
        </PageStack>
    )
}
