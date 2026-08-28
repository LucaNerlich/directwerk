'use client'

import Link from 'next/link'
import {useEffect, useState, useSyncExternalStore} from 'react'
import useSWR from 'swr'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import SectionHeader from '@directwerk/ui/components/section-header'

import HowToListen from '@/components/HowToListen'
import CustomFeedsPanel from '@/components/CustomFeedsPanel'
import {
    getSiteConfig,
    listMyFeeds,
    listPublicSeries,
    rotateDefaultFeedToken,
    setDefaultFeedEnabled,
} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {PublicSeries, PublicSiteConfig, SubscriberFeed} from '@directwerk/api/types'
import {
    getAccessToken,
    subscribeToTokenStore,
} from '@/lib/auth/tokenStore'
import {publicPodcastFeedUrl, publicSeriesFeedUrl} from '@/lib/feeds'
import {formatPublishedAt} from '@/lib/format'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

function readTokenClient(): string | null {
    return getAccessToken()
}

function readTokenServer(): string | null {
    return null
}

export default function FeedsPage() {
    const tenantHost = getClientTenantHost()
    const accessToken = useSyncExternalStore(
        subscribeToTokenStore,
        readTokenClient,
        readTokenServer,
    )
    const isAuthenticated = accessToken !== null

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

    const [privateFeeds, setPrivateFeeds] = useState<SubscriberFeed[]>([])
    const [privateError, setPrivateError] = useState<string | null>(null)
    const [isPrivateLoading, setIsPrivateLoading] = useState(false)
    const [feedActionBusy, setFeedActionBusy] = useState(false)

    useEffect(() => {
        let active = true
        if (!isAuthenticated) {
            setPrivateFeeds([])
            setPrivateError(null)
            setIsPrivateLoading(false)
            return
        }

        setIsPrivateLoading(true)
        setPrivateError(null)

        listMyFeeds(tenantHost)
            .then((feedList) => {
                if (!active) {
                    return
                }
                setPrivateFeeds(feedList)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                setPrivateFeeds([])
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    setPrivateError('Bitte erneut anmelden, um private Feeds zu sehen.')
                    return
                }
                setPrivateError(
                    error instanceof Error
                        ? error.message
                        : 'Private Feeds konnten nicht geladen werden.',
                )
            })
            .finally(() => {
                if (active) {
                    setIsPrivateLoading(false)
                }
            })

        return () => {
            active = false
        }
    }, [tenantHost, isAuthenticated])

    const podcastFeedUrl =
        siteConfig === undefined
            ? null
            : (siteConfig.publicRssUrl ??
              publicPodcastFeedUrl(tenantHost, siteConfig.tenant.slug))

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
        setPrivateError(null)
        try {
            const updated = await rotateDefaultFeedToken(tenantHost)
            setPrivateFeeds((current) =>
                current.map((feed) => (feed.isDefault ? updated : feed)),
            )
        } catch (error: unknown) {
            setPrivateError(
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
        setPrivateError(null)
        try {
            const updated = await setDefaultFeedEnabled(tenantHost, enabled)
            setPrivateFeeds((current) =>
                current.map((feed) => (feed.isDefault ? updated : feed)),
            )
        } catch (error: unknown) {
            setPrivateError(
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

            <HowToListen
                isAuthenticated={isAuthenticated}
                privateFeedUrl={
                    defaultPrivate?.enabled === true ? defaultPrivate.url : null
                }
                publicFeedUrl={podcastFeedUrl}
            />

            {isLoading && (
                <p className="text-sm text-muted-foreground">Öffentliche Feeds werden geladen…</p>
            )}
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
                                <p className="mt-2 break-all text-sm text-muted-foreground">
                                    {podcastFeedUrl !== null ? (
                                        <a href={podcastFeedUrl} rel="noreferrer">
                                            {podcastFeedUrl}
                                        </a>
                                    ) : (
                                        'Kein öffentlicher Feed (PODCAST_RSS aus).'
                                    )}
                                </p>
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
                                const feedUrl =
                                    siteConfig === undefined
                                        ? null
                                        : publicSeriesFeedUrl(
                                              tenantHost,
                                              siteConfig.tenant.slug,
                                              item.slug,
                                          )
                                return (
                                    <ListPanelRow key={item.id}>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium">
                                                {item.title}{' '}
                                                <span className="font-normal text-muted-foreground">
                                                    ({item.slug})
                                                </span>
                                            </p>
                                            <p className="mt-2 break-all text-sm text-muted-foreground">
                                                {feedUrl !== null ? (
                                                    <a href={feedUrl} rel="noreferrer">
                                                        {feedUrl}
                                                    </a>
                                                ) : (
                                                    '—'
                                                )}
                                            </p>
                                        </div>
                                    </ListPanelRow>
                                )
                            })
                        )}
                    </ListPanel>
                </section>
            )}

            <section className="flex flex-col gap-4">
                <SectionHeader title="Dein privater Feed" />
                {!isAuthenticated ? (
                    <p className="text-sm text-muted-foreground">
                        <Link href="/login">Anmelden</Link>, um den privaten Feed für
                        Folgen zu sehen, die du freigeschaltet hast.
                    </p>
                ) : (
                    <>
                        {isPrivateLoading && (
                            <p className="text-sm text-muted-foreground">
                                Private Feeds werden geladen…
                            </p>
                        )}
                        {privateError !== null && (
                            <Alert variant="destructive">
                                <AlertDescription>{privateError}</AlertDescription>
                            </Alert>
                        )}
                        {!isPrivateLoading && privateError === null && (
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
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium">
                                                    {feed.title}
                                                    {feed.isDefault ? ' (Standard)' : ''}
                                                </p>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {feed.enabled ? 'Aktiv' : 'Deaktiviert'} ·
                                                    aktualisiert{' '}
                                                    {formatPublishedAt(feed.updatedAt)}
                                                </p>
                                                {feed.enabled ? (
                                                    <p className="mt-2 break-all text-sm">
                                                        <a href={feed.url} rel="noreferrer">
                                                            {feed.url}
                                                        </a>
                                                    </p>
                                                ) : (
                                                    <p className="mt-2 text-sm text-muted-foreground">
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
                        setPrivateError(
                            'Bitte erneut anmelden, um private Feeds zu sehen.',
                        )
                    }
                    onError={setPrivateError}
                    onFeedsChange={setPrivateFeeds}
                    tenantHost={tenantHost}
                />
            ) : null}
        </PageStack>
    )
}
