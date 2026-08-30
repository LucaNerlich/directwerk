'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {EntityListToolbar} from '@directwerk/ui/components/entity-list-toolbar'
import {
    EntityListView,
    type EntityListViewItem,
} from '@directwerk/ui/components/entity-list-view'
import SectionHeader from '@directwerk/ui/components/section-header'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {listEpisodes, listSeries} from '@/lib/api/podcastApi'
import {listArticles} from '@/lib/api/writeApi'
import type {
    ArticleSummary,
    EpisodeSummary,
    PublicationStatus,
    SeriesSummary,
    StudioDesk,
} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

const AWAITING_STATUSES = new Set(['DRAFT', 'SCHEDULED'])

interface OverviewQueueProps {
    desks: StudioDesk[]
}

function draftItems(
    items: {id: number; title: string; status: PublicationStatus}[],
    editorBasePath: string,
): EntityListViewItem<number>[] {
    return items.map((item) => ({
        id: item.id,
        title: item.title,
        href: `${editorBasePath}/${item.id}`,
        trailing: <PublicationStatusBadge status={item.status} />,
    }))
}

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
    const {viewMode, setViewMode} = useListViewMode()

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
        return <p className="text-sm text-muted-foreground">Aktuelle Entwürfe werden geladen…</p>
    }

    const awaitingArticles = articles.filter((item) => AWAITING_STATUSES.has(item.status))
    const awaitingEpisodes = episodes.filter((item) => AWAITING_STATUSES.has(item.status))
    const draftSeries = series.filter((item) => item.status === 'DRAFT')
    const hasQueuedItems =
        draftSeries.length + awaitingEpisodes.length + awaitingArticles.length > 0

    return (
        <section className="flex flex-col gap-6">
            <SectionHeader
                description="Entwürfe und geplante Inhalte, die als Nächstes dran sind."
                title="Als Nächstes"
            />
            {errorMessage !== null ? (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            ) : null}

            {hasQueuedItems ? (
                <EntityListToolbar
                    onViewModeChange={setViewMode}
                    showSelection={false}
                    viewMode={viewMode}
                />
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
                <div className="flex flex-col gap-3">
                    <SectionHeader as="h3" title="Sendungen zum Veröffentlichen" />
                    <EntityListView
                        items={draftItems(draftSeries, '/podcast/series')}
                        viewMode={viewMode}
                    />
                </div>
            ) : null}

            {awaitingEpisodes.length > 0 ? (
                <div className="flex flex-col gap-3">
                    <SectionHeader as="h3" title="Folgen-Entwürfe" />
                    <EntityListView
                        items={draftItems(awaitingEpisodes, '/podcast/episodes')}
                        viewMode={viewMode}
                    />
                </div>
            ) : null}

            {awaitingArticles.length > 0 ? (
                <div className="flex flex-col gap-3">
                    <SectionHeader as="h3" title="Beitrags-Entwürfe" />
                    <EntityListView
                        items={draftItems(awaitingArticles, '/write/articles')}
                        viewMode={viewMode}
                    />
                </div>
            ) : null}
        </section>
    )
}
