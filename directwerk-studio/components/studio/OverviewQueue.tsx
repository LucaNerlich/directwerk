'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {listArticles, listEpisodes, listSeries} from '@/lib/api/tenantApi'
import type {ArticleSummary, EpisodeSummary, SeriesSummary, StudioDesk} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

const AWAITING_STATUSES = new Set(['DRAFT', 'SCHEDULED'])

interface OverviewQueueProps {
    desks: StudioDesk[]
}

/**
 * Shows drafts waiting to publish and first-run empty states on the studio overview.
 */
export default function OverviewQueue({desks}: OverviewQueueProps): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const showWrite = desks.includes('WRITE')
    const showPodcast = desks.includes('PODCAST')
    const [episodes, setEpisodes] = useState<EpisodeSummary[]>([])
    const [articles, setArticles] = useState<ArticleSummary[]>([])
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(showWrite || showPodcast)

    useEffect(() => {
        if (!showWrite && !showPodcast) {
            return
        }

        let active = true

        async function load(): Promise<void> {
            try {
                const host = getClientTenantHost()
                const [loadedArticles, loadedEpisodes, loadedSeries] = await Promise.all([
                    showWrite ? listArticles(host) : Promise.resolve([]),
                    showPodcast ? listEpisodes(host) : Promise.resolve([]),
                    showPodcast ? listSeries(host) : Promise.resolve([]),
                ])
                if (!active) {
                    return
                }
                setArticles(loadedArticles)
                setEpisodes(loadedEpisodes)
                setSeries(loadedSeries)
            } catch (error) {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Übersicht konnte nicht geladen werden.',
                )
            } finally {
                if (active) {
                    setIsLoading(false)
                }
            }
        }

        void load()

        return () => {
            active = false
        }
    }, [router, showPodcast, showWrite])

    if (!showWrite && !showPodcast) {
        return <></>
    }

    if (isLoading) {
        return <p>Aktuelle Entwürfe werden geladen…</p>
    }

    const awaitingArticles = articles.filter((item) => AWAITING_STATUSES.has(item.status))
    const awaitingEpisodes = episodes.filter((item) => AWAITING_STATUSES.has(item.status))
    const draftSeries = series.filter((item) => item.status === 'DRAFT')

    return (
        <section className="flex flex-col gap-4">
            <h2>Als Nächstes</h2>
            {errorMessage !== null ? (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            ) : null}

            {showPodcast && series.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Noch keine Sendung.{' '}
                    <Link href="/podcast/series/new">Erste Sendung anlegen</Link>
                    , danach die erste Folge.
                </p>
            ) : null}

            {showPodcast && series.length > 0 && episodes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Noch keine Folge.{' '}
                    <Link href="/podcast/episodes/new">Erste Folge anlegen</Link>.
                </p>
            ) : null}

            {showWrite && articles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Noch kein Beitrag.{' '}
                    <Link href="/write/articles/new">Ersten Beitrag schreiben</Link>.
                </p>
            ) : null}

            {draftSeries.length > 0 ? (
                <div>
                    <h3>Sendungen zum Veröffentlichen</h3>
                    <ul className="overflow-hidden rounded-xl border bg-card divide-y [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-4 [&>li]:p-3">
                        {draftSeries.map((item) => (
                            <li key={item.id}>
                                <Link href={`/podcast/series/${item.id}`}>{item.title}</Link>
                                <PublicationStatusBadge status={item.status} />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {awaitingEpisodes.length > 0 ? (
                <div>
                    <h3>Folgen-Entwürfe</h3>
                    <ul className="overflow-hidden rounded-xl border bg-card divide-y [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-4 [&>li]:p-3">
                        {awaitingEpisodes.map((item) => (
                            <li key={item.id}>
                                <Link href={`/podcast/episodes/${item.id}`}>{item.title}</Link>
                                <PublicationStatusBadge status={item.status} />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {awaitingArticles.length > 0 ? (
                <div>
                    <h3>Beitrags-Entwürfe</h3>
                    <ul className="overflow-hidden rounded-xl border bg-card divide-y [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-4 [&>li]:p-3">
                        {awaitingArticles.map((item) => (
                            <li key={item.id}>
                                <Link href={`/write/articles/${item.id}`}>{item.title}</Link>
                                <PublicationStatusBadge status={item.status} />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </section>
    )
}
