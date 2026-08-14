'use client'

import Link from 'next/link'
import {useEffect, useState, useSyncExternalStore} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import PageHeader from '@directwerk/ui/components/page-header'

import {getSiteConfig, listMyEpisodes, listPublicEpisodes, listPublicSeries} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import type {PublicEpisode, PublicSeries, SiteConfig} from '@/lib/api/types'
import {
    getAccessToken,
    subscribeToTokenStore,
} from '@/lib/auth/tokenStore'
import {formatPublishedAt} from '@/lib/format'
import {publicSeriesFeedUrl} from '@/lib/feeds'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

function readTokenClient(): string | null {
    return getAccessToken()
}

function readTokenServer(): string | null {
    return null
}

export default function EpisodesPage() {
    const tenantHost = getClientTenantHost()
    const accessToken = useSyncExternalStore(
        subscribeToTokenStore,
        readTokenClient,
        readTokenServer,
    )
    const [series, setSeries] = useState<PublicSeries[]>([])
    const [episodes, setEpisodes] = useState<PublicEpisode[]>([])
    const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null)
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
                setSeries([])
                setEpisodes([])
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    setErrorMessage(
                        'Sitzung abgelaufen — bitte erneut anmelden, um freigeschaltete Folgen zu hören.',
                    )
                    return
                }
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Podcast-Inhalte konnten nicht geladen werden.',
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

    return (
        <div className="page-container space-y-8">
            <PageHeader
                title="Folgen"
                description={
                    isAuthenticated
                        ? 'Angemeldet: freie und für dich freigeschaltete Folgen.'
                        : 'Öffentlich: nur freie Folgen. Anmelden für bezahlte Inhalte.'
                }
            />
            {isLoading && <p>Wird geladen…</p>}
            {errorMessage !== null && <Alert variant="destructive"><AlertDescription>{errorMessage}</AlertDescription></Alert>}

            {!isLoading && errorMessage === null && (
                <>
                    <section>
                        <h2>Sendungen</h2>
                        {series.length === 0 ? (
                            <p>Noch keine veröffentlichten Sendungen.</p>
                        ) : (
                            <ul>
                                {series.map((item) => {
                                    const feedUrl =
                                        siteConfig === null
                                            ? null
                                            : publicSeriesFeedUrl(
                                                  tenantHost,
                                                  siteConfig.tenant.slug,
                                                  item.slug,
                                              )
                                    return (
                                        <li key={item.id}>
                                            <strong>{item.title}</strong> ({item.slug})
                                            {item.language !== null
                                                ? ` · ${item.language}`
                                                : ''}
                                            <br />
                                            {feedUrl !== null ? (
                                                <small>
                                                    Öffentlicher RSS:{' '}
                                                    <a href={feedUrl} rel="noreferrer">
                                                        {feedUrl}
                                                    </a>
                                                </small>
                                            ) : null}
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </section>

                    <section>
                        <h2>Veröffentlichte Folgen</h2>
                        {episodes.length === 0 ? (
                            <p>
                                {isAuthenticated
                                    ? 'Keine veröffentlichten Folgen, auf die du Zugriff hast.'
                                    : 'Noch keine veröffentlichten Folgen.'}
                            </p>
                        ) : (
                            <ul>
                                {episodes.map((episode) => (
                                    <li key={episode.id}>
                                        <h3>
                                            <Link href={`/episodes/${encodeURIComponent(episode.slug)}`}>
                                                {episode.episodeNumber !== null
                                                    ? `#${episode.episodeNumber} `
                                                    : ''}
                                                {episode.title}
                                            </Link>
                                        </h3>
                                        <p>
                                            <small>
                                                {episode.seriesSlug} ·{' '}
                                                {episode.accessPolicy === 'PAID'
                                                    ? 'Bezahlt'
                                                    : 'Frei'}{' '}
                                                · {formatPublishedAt(episode.publishedAt)}
                                            </small>
                                        </p>
                                        {episode.audioCdnUrl !== null ? (
                                            <p>
                                                <Link href={`/episodes/${encodeURIComponent(episode.slug)}`}>
                                                    Anhören
                                                </Link>
                                            </p>
                                        ) : (
                                            <p>
                                                {episode.accessPolicy === 'PAID'
                                                    ? isAuthenticated
                                                        ? 'Bezahlte Folge — Details für den Zugang öffnen.'
                                                        : 'Bezahlte Folge — anmelden, um sie zu hören.'
                                                    : 'Noch keine öffentliche Audio-URL.'}
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
