'use client'

import Link from 'next/link'
import {useEffect, useState, useSyncExternalStore} from 'react'
import useSWR from 'swr'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import PageHeader from '@directwerk/ui/components/page-header'

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
import {
    feedOriginFromPublicRssUrl,
    publicPodcastFeedUrl,
    publicSeriesFeedUrl,
} from '@/lib/feeds'
import {formatPublishedAt} from '@/lib/format'
import type {TenantHost} from '@/lib/tenants'
import {useSelectedTenant} from '@/lib/useSelectedTenant'

function readTokenClient(): string | null {
    return getAccessToken()
}

function readTokenServer(): string | null {
    return null
}

export default function FeedsPage() {
    const tenantHost = useSelectedTenant()
    const accessToken = useSyncExternalStore(
        subscribeToTokenStore,
        readTokenClient,
        readTokenServer,
    )
    const isAuthenticated = accessToken !== null

    const {
        data: pageData,
        error: pageError,
        isLoading,
    } = useSWR(
        ['public-feeds', tenantHost] as const,
        async ([, host]: readonly [string, TenantHost]) => {
            const [configEnvelope, seriesList] = await Promise.all([
                getSiteConfig(host),
                listPublicSeries(host),
            ])
            return {config: configEnvelope.data, series: seriesList}
        },
    )
    const siteConfig: SiteConfig | null = pageData?.config ?? null
    const series: PublicSeries[] = pageData?.series ?? []
    const errorMessage =
        pageError instanceof Error
            ? pageError.message
            : pageError
              ? 'Unable to load public feeds.'
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
                    setPrivateError('Sign in again to view your private RSS feeds.')
                    return
                }
                setPrivateError(
                    error instanceof Error
                        ? error.message
                        : 'Unable to load private RSS feeds.',
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

    const feedOrigin =
        feedOriginFromPublicRssUrl(siteConfig?.publicRssUrl) ??
        (siteConfig !== null ? publicPodcastFeedUrl(tenantHost, siteConfig.tenant.slug).replace(/\/feeds\/.*$/, '') : null)

    const podcastFeedUrl =
        siteConfig?.publicRssUrl ??
        (siteConfig !== null
            ? publicPodcastFeedUrl(tenantHost, siteConfig.tenant.slug)
            : null)

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
                error instanceof Error ? error.message : 'Could not rotate feed token.',
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
                error instanceof Error ? error.message : 'Could not update feed.',
            )
        } finally {
            setFeedActionBusy(false)
        }
    }

    return (
        <div className="page-container space-y-8">
            <PageHeader
                title="RSS feeds"
                description={
                    <span>
                        Public and private feed URLs for podcast apps. On localhost these
                        use <code>http://…:8080</code> so they open without TLS. Tenant:{' '}
                        <code>{tenantHost}</code>
                    </span>
                }
            />

            {isLoading && <p>Loading public feeds…</p>}
            {errorMessage !== null && (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            )}

            {!isLoading && errorMessage === null && (
                <section className="space-y-4">
                    <h2>Public feeds</h2>
                    <p className="text-sm text-muted-foreground">
                        FREE published episodes only. Prefer the API-provided URL when
                        present (correct scheme and port).
                    </p>
                    <ul className="space-y-4">
                        <li>
                            <h3>All public episodes</h3>
                            {podcastFeedUrl !== null ? (
                                <p>
                                    <a href={podcastFeedUrl} rel="noreferrer">
                                        {podcastFeedUrl}
                                    </a>
                                </p>
                            ) : (
                                <p>No public podcast feed (PODCAST_RSS off).</p>
                            )}
                        </li>
                        {series.length === 0 ? (
                            <li>
                                <p>No published shows yet — no per-show feeds.</p>
                            </li>
                        ) : (
                            series.map((item) => {
                                const feedUrl =
                                    feedOrigin !== null && siteConfig !== null
                                        ? publicSeriesFeedUrl(
                                              feedOrigin,
                                              siteConfig.tenant.slug,
                                              item.slug,
                                          )
                                        : siteConfig !== null
                                          ? publicSeriesFeedUrl(
                                                tenantHost,
                                                siteConfig.tenant.slug,
                                                item.slug,
                                            )
                                          : null
                                return (
                                    <li key={item.id}>
                                        <h3>
                                            {item.title}{' '}
                                            <small>({item.slug})</small>
                                        </h3>
                                        {feedUrl !== null ? (
                                            <p>
                                                <a href={feedUrl} rel="noreferrer">
                                                    {feedUrl}
                                                </a>
                                            </p>
                                        ) : null}
                                    </li>
                                )
                            })
                        )}
                    </ul>
                </section>
            )}

            <section className="space-y-4">
                <h2>Your private feeds</h2>
                {!isAuthenticated ? (
                    <p>
                        <Link href="/login">Sign in</Link> to see private feeds for
                        episodes you are entitled to.
                    </p>
                ) : (
                    <>
                        {isPrivateLoading && <p>Loading private feeds…</p>}
                        {privateError !== null && (
                            <p role="alert">{privateError}</p>
                        )}
                        {!isPrivateLoading && privateError === null && (
                            privateFeeds.length === 0 ? (
                                <p>No private feeds yet for this account.</p>
                            ) : (
                                <ul className="space-y-4">
                                    {privateFeeds.map((feed) => (
                                        <li key={feed.id}>
                                            <h3>
                                                {feed.title}
                                                {feed.isDefault ? ' (default)' : ''}
                                            </h3>
                                            <p>
                                                <small>
                                                    {feed.enabled
                                                        ? 'Enabled'
                                                        : 'Disabled'}{' '}
                                                    · updated{' '}
                                                    {formatPublishedAt(feed.updatedAt)}
                                                </small>
                                            </p>
                                            {feed.enabled ? (
                                                <p>
                                                    <a href={feed.url} rel="noreferrer">
                                                        {feed.url}
                                                    </a>
                                                </p>
                                            ) : (
                                                <p>This feed is currently disabled.</p>
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
                                                            ? 'Disable'
                                                            : 'Enable'}
                                                    </Button>
                                                    <Button
                                                        disabled={feedActionBusy}
                                                        onClick={() => void handleRotate()}
                                                        size="sm"
                                                        type="button"
                                                        variant="outline"
                                                    >
                                                        Rotate token
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
