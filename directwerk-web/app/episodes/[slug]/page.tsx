'use client'

import Link from 'next/link'
import {useParams} from 'next/navigation'
import {useEffect, useState, useSyncExternalStore} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'

import {listMyEpisodes, listPublicEpisodes} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import type {PublicEpisode} from '@/lib/api/types'
import {
    getAccessToken,
    subscribeToTokenStore,
} from '@/lib/auth/tokenStore'
import {formatPublishedAt} from '@/lib/format'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

function readTokenClient(): string | null {
    return getAccessToken()
}

function readTokenServer(): string | null {
    return null
}

export default function EpisodeDetailPage(): React.JSX.Element {
    const params = useParams<{slug: string}>()
    const slug = typeof params.slug === 'string' ? params.slug : ''
    const tenantHost = getClientTenantHost()
    const accessToken = useSyncExternalStore(
        subscribeToTokenStore,
        readTokenClient,
        readTokenServer,
    )
    const isAuthenticated = accessToken !== null
    const [episode, setEpisode] = useState<PublicEpisode | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true
        if (slug.length === 0) {
            setErrorMessage('Folge nicht gefunden.')
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        setErrorMessage(null)

        const load = isAuthenticated
            ? listMyEpisodes(tenantHost)
            : listPublicEpisodes(tenantHost)

        load
            .then((episodes) => {
                if (!active) {
                    return
                }
                const match = episodes.find((item) => item.slug === slug) ?? null
                setEpisode(match)
                if (match === null) {
                    setErrorMessage(
                        isAuthenticated
                            ? 'Folge nicht gefunden oder nicht freigeschaltet.'
                            : 'Folge nicht im öffentlichen Katalog. Bei bezahlten Folgen bitte anmelden.',
                    )
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    setErrorMessage('Sitzung abgelaufen — bitte erneut anmelden.')
                    return
                }
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Folge konnte nicht geladen werden.',
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
    }, [tenantHost, isAuthenticated, slug])

    return (
        <div className="page-container space-y-6">
            <Link className="text-sm text-muted-foreground hover:text-foreground" href="/episodes">← Alle Folgen</Link>
            {isLoading ? <p>Wird geladen…</p> : null}
            {errorMessage !== null ? <Alert variant="destructive"><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}

            {episode !== null ? (
                <article className="max-w-3xl space-y-6">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                        {episode.episodeNumber !== null
                            ? `#${episode.episodeNumber} `
                            : ''}
                        {episode.title}
                    </h1>
                    <p>
                        <small>
                            {episode.seriesSlug} ·{' '}
                            {episode.accessPolicy === 'PAID' ? 'Bezahlt' : 'Frei'} ·{' '}
                            {formatPublishedAt(episode.publishedAt)}
                        </small>
                    </p>
                    {episode.description !== null &&
                    episode.description.length > 0 ? (
                        <div
                            className="editorial-copy"
                            dangerouslySetInnerHTML={{__html: episode.description}}
                        />
                    ) : null}

                    {episode.audioCdnUrl !== null ? (
                        <section>
                            <h2>Player</h2>
                            <audio className="media-player" controls preload="metadata" src={episode.audioCdnUrl}>
                                Audio nicht verfügbar
                            </audio>
                        </section>
                    ) : (
                        <section>
                            <h2>Player</h2>
                            <p>
                                {episode.accessPolicy === 'PAID' ? (
                                    isAuthenticated ? (
                                        <>
                                            Kein abspielbares Audio — fehlende
                                            Freischaltung oder Datei.{' '}
                                            <Link href="/pricing">Tarife ansehen</Link>
                                        </>
                                    ) : (
                                        <>
                                            Bezahlte Folge —{' '}
                                            <Link href="/login">anmelden</Link>, um sie
                                            freizuschalten.
                                        </>
                                    )
                                ) : (
                                    'Noch keine öffentliche Audio-URL.'
                                )}
                            </p>
                        </section>
                    )}
                </article>
            ) : null}
        </div>
    )
}
