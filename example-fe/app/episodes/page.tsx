'use client'

import Link from 'next/link'
import {useEffect, useState, useSyncExternalStore} from 'react'

import {Alert, AlertDescription} from '@publish/ui/components/alert'
import PageHeader from '@publish/ui/components/page-header'

import {
    getSiteConfig,
    listMyEpisodes,
    listPublicEpisodes,
    listPublicSeries,
} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import type {PublicEpisode, PublicSeries, SiteConfig} from '@/lib/api/types'
import {
    getAccessToken,
    subscribeToTokenStore,
} from '@/lib/auth/tokenStore'
import {
    feedOriginFromPublicRssUrl,
    publicSeriesFeedUrl,
} from '@/lib/feeds'
import {formatPublishedAt} from '@/lib/format'
import {useSelectedTenant} from '@/lib/useSelectedTenant'

function readTokenClient(): string | null {
    return getAccessToken()
}

function readTokenServer(): string | null {
    return null
}

export default function EpisodesPage() {
    const tenantHost = useSelectedTenant()
    const accessToken = useSyncExternalStore(
        subscribeToTokenStore,
        readTokenClient,
        readTokenServer,
    )
    const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null)
    const [series, setSeries] = useState<PublicSeries[]>([])
    const [episodes, setEpisodes] = useState<PublicEpisode[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const isAuthenticated = accessToken !== null

    useEffect(() => {
        let active = true
        setIsLoading(true)
        setErrorMessage(null)

        const episodesPromise = isAuthenticated
            ? listMyEpisodes(tenantHost)
            : listPublicEpisodes(tenantHost)

        Promise.all([
            getSiteConfig(tenantHost),
            listPublicSeries(tenantHost),
            episodesPromise,
        ])
            .then(([configEnvelope, seriesList, episodeList]) => {
                if (!active) {
                    return
                }
                setSiteConfig(configEnvelope.data)
                setSeries(seriesList)
                setEpisodes(episodeList)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                setSiteConfig(null)
                setSeries([])
                setEpisodes([])
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    setErrorMessage(
                        'Session expired — sign in again to play entitled episodes.',
                    )
                    return
                }
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Unable to load podcast content.',
                )
            })
            .finally(() => {
                if (active) {
                    setIsLoading(false)
                }
            })

        return () => {
            active = false
        }
    }, [tenantHost, isAuthenticated])

    const feedOrigin =
        feedOriginFromPublicRssUrl(siteConfig?.publicRssUrl) ?? tenantHost

    return (
        <div className="page-container space-y-8">
            <PageHeader
                title="Episodes"
                description={
                    <span>
                        Published podcast episodes. Tenant: <code>{tenantHost}</code>
                        {isAuthenticated
                            ? ' · Signed in (entitled / publisher audio included).'
                            : ' · Signed out (public FREE audio only).'}
                    </span>
                }
            />
            {isLoading && <p>Loading…</p>}
            {errorMessage !== null && (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            )}

            {!isLoading && errorMessage === null && (
                <>
                    <section>
                        <h2>Shows</h2>
                        {series.length === 0 ? (
                            <p>No published shows yet.</p>
                        ) : (
                            <ul className="space-y-3">
                                {series.map((item) => {
                                    const feedUrl =
                                        siteConfig !== null
                                            ? publicSeriesFeedUrl(
                                                  feedOrigin,
                                                  siteConfig.tenant.slug,
                                                  item.slug,
                                              )
                                            : null
                                    return (
                                        <li key={item.id}>
                                            <strong>{item.title}</strong> ({item.slug})
                                            {item.language !== null
                                                ? ` · ${item.language}`
                                                : ''}
                                            {feedUrl !== null ? (
                                                <>
                                                    <br />
                                                    <small>
                                                        Public RSS:{' '}
                                                        <a href={feedUrl} rel="noreferrer">
                                                            {feedUrl}
                                                        </a>
                                                    </small>
                                                </>
                                            ) : null}
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </section>

                    <section>
                        <h2>Published episodes</h2>
                        {episodes.length === 0 ? (
                            <p>
                                No published episodes yet
                                {isAuthenticated
                                    ? ' (or none you are entitled to).'
                                    : '. Create a show, attach audio, and publish in publish-studio.'}
                            </p>
                        ) : (
                            <ul className="space-y-4">
                                {episodes.map((episode) => (
                                    <li key={episode.id}>
                                        <h3>
                                            <Link href={`/episodes/${episode.slug}`}>
                                                {episode.episodeNumber !== null
                                                    ? `#${episode.episodeNumber} `
                                                    : ''}
                                                {episode.title}
                                            </Link>
                                        </h3>
                                        <p>
                                            <small>
                                                {episode.seriesSlug} · {episode.accessPolicy} ·{' '}
                                                {formatPublishedAt(episode.publishedAt)}
                                                {episode.formats.length > 0
                                                    ? ` · ${episode.formats.map((f) => f.name).join(', ')}`
                                                    : ''}
                                            </small>
                                        </p>
                                        {episode.audioCdnUrl !== null ? (
                                            <audio
                                                className="media-player"
                                                controls
                                                preload="none"
                                                src={episode.audioCdnUrl}
                                            >
                                                Audio unavailable
                                            </audio>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                {episode.accessPolicy === 'PAID'
                                                    ? isAuthenticated
                                                        ? 'Paid episode — no playable audio URL (missing entitlement or audio).'
                                                        : 'Paid episode — sign in to play if you have access.'
                                                    : 'No public audio URL yet.'}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}
        </div>
    )
}
