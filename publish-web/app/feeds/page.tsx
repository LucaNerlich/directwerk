'use client'

import Link from 'next/link'
import {useEffect, useState, useSyncExternalStore} from 'react'
import useSWR from 'swr'

import {Alert, AlertDescription} from '@publish/ui/components/alert'
import {Button} from '@publish/ui/components/button'
import PageHeader from '@publish/ui/components/page-header'

import HowToListen from '@/components/HowToListen'
import {
    getSiteConfig,
    listMyFeeds,
    listPublicSeries,
    rotateDefaultFeedToken,
    setDefaultFeedEnabled,
} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import type {PublicSeries, SiteConfig, SubscriberFeed} from '@/lib/api/types'
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
    const {data: siteConfig} = useSWR<SiteConfig>(
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
        <div className="page-container space-y-8">
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

            {isLoading && <p>Öffentliche Feeds werden geladen…</p>}
            {errorMessage !== null && (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            )}

            {!isLoading && errorMessage === null && (
                <section className="space-y-4">
                    <h2>Öffentliche Feeds</h2>
                    <p className="text-sm text-muted-foreground">
                        Nur veröffentlichte <strong>freie</strong> Folgen. Bezahlte
                        Folgen erscheinen im privaten Feed.
                    </p>
                    <ul className="space-y-4">
                        <li>
                            <h3>Alle freien Folgen</h3>
                            <p>
                                {podcastFeedUrl !== null ? (
                                    <a href={podcastFeedUrl} rel="noreferrer">
                                        {podcastFeedUrl}
                                    </a>
                                ) : (
                                    'Kein öffentlicher Feed (PODCAST_RSS aus).'
                                )}
                            </p>
                        </li>
                        {series.length === 0 ? (
                            <li>
                                <p>Noch keine veröffentlichten Sendungen.</p>
                            </li>
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
                                    <li key={item.id}>
                                        <h3>
                                            {item.title}{' '}
                                            <small>({item.slug})</small>
                                        </h3>
                                        <p>
                                            {feedUrl !== null ? (
                                                <a href={feedUrl} rel="noreferrer">
                                                    {feedUrl}
                                                </a>
                                            ) : (
                                                '—'
                                            )}
                                        </p>
                                    </li>
                                )
                            })
                        )}
                    </ul>
                </section>
            )}

            <section className="space-y-4">
                <h2>Dein privater Feed</h2>
                {!isAuthenticated ? (
                    <p>
                        <Link href="/login">Anmelden</Link>, um den privaten Feed für
                        Folgen zu sehen, die du freigeschaltet hast.
                    </p>
                ) : (
                    <>
                        {isPrivateLoading && <p>Private Feeds werden geladen…</p>}
                        {privateError !== null && (
                            <p role="alert">{privateError}</p>
                        )}
                        {!isPrivateLoading && privateError === null && (
                            privateFeeds.length === 0 ? (
                                <p>Noch kein privater Feed für dieses Konto.</p>
                            ) : (
                                <ul className="space-y-4">
                                    {privateFeeds.map((feed) => (
                                        <li key={feed.id}>
                                            <h3>
                                                {feed.title}
                                                {feed.isDefault ? ' (Standard)' : ''}
                                            </h3>
                                            <p>
                                                <small>
                                                    {feed.enabled
                                                        ? 'Aktiv'
                                                        : 'Deaktiviert'}{' '}
                                                    · aktualisiert{' '}
                                                    {formatPublishedAt(feed.updatedAt)}
                                                </small>
                                            </p>
                                            {feed.enabled ? (
                                                <p className="break-all">
                                                    <a href={feed.url} rel="noreferrer">
                                                        {feed.url}
                                                    </a>
                                                </p>
                                            ) : (
                                                <p>Dieser Feed ist derzeit deaktiviert.</p>
                                            )}
                                            {feed.isDefault ? (
                                                <div className="mt-2 flex flex-wrap gap-2">
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
                                        </li>
                                    ))}
                                </ul>
                            )
                        )}
                    </>
                )}
            </section>
        </div>
    )
}
